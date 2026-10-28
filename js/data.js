// Loads the shared ruleset (library.json) and the DM's campaign config
// (campaign.json), caching both so the app works offline after the first
// load. When online it re-fetches both and compares a fingerprint of the
// file text — so ANY edit the DM pushes reaches players, even if nobody
// remembered to bump a version number. Characters are never touched here.

import { isLockedFile, decryptWithKey, decryptWithPassword } from "./crypt.js";

const LS = { library: "dnd-library-v1", campaign: "dnd-campaign-v1" };
const LS_HASH = { library: "dnd-library-hash", campaign: "dnd-campaign-hash" };
const LS_KEY = "dnd-library-key"; // {salt, key}: the derived key, never the password
const PATH = { library: "data/library.enc.json", campaign: "data/campaign.json" };

function read(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function write(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); return true; } catch (e) { return false; }
}
const setHash = (kind, fp) => { try { localStorage.setItem(LS_HASH[kind], fp); } catch (e) { } };
const getHash = kind => { try { return localStorage.getItem(LS_HASH[kind]); } catch (e) { return null; } };

// FNV-1a: tiny, fast fingerprint — not security, just "did the file change?"
export function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16) + ":" + text.length;
}

async function fetchText(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

// Thrown when the rules are locked and this device doesn't have the key yet.
export class LockedError extends Error {
  constructor(file, text) { super("locked"); this.file = file; this.text = text; }
}

// Turns the fetched library text into the library object, using the key
// this device remembered. Plain (unlocked) files are accepted as-is.
async function openLibrary(text) {
  const file = JSON.parse(text);
  if (!isLockedFile(file)) return file;
  const saved = read(LS_KEY);
  if (saved && saved.salt === file.salt) {
    try { return await decryptWithKey(file, saved.key); } catch (e) { /* password changed */ }
  }
  throw new LockedError(file, text);
}

// Called from the unlock screen. Returns the library or throws on a wrong password.
export async function unlockWithPassword(lockedErr, password) {
  const { data, key } = await decryptWithPassword(lockedErr.file, password.trim());
  write(LS_KEY, { salt: lockedErr.file.salt, key });
  setHash("library", fingerprint(lockedErr.text));
  rememberGood(lockedErr.text);
  return data;
}

// Returns {library, campaign}: cache first (instant, offline-safe), else
// network. Throws LockedError when the password is needed, or a network
// error when there's no cache and no connection.
// The rules are NOT kept readable in localStorage: they're big, and that
// storage is shared with (and capped together with) everyone's characters.
// The locked file sits in the offline cache instead and is opened at launch
// with the key this device remembers (fast: no password stretching).
async function cachedText(path) {
  try {
    if (!("caches" in window)) return null;
    const hit = await caches.match(new URL(path, location.href).href, { ignoreSearch: true });
    return hit ? await hit.text() : null;
  } catch (e) { return null; }
}
// The last locked file this device managed to open. If the DM changes the
// password, the new file can't be opened yet, so the app keeps running on
// this one (and shows "enter the new password") instead of locking everyone out.
const GOOD = "rules-good";
async function rememberGood(text) {
  try { if ("caches" in window) await (await caches.open(GOOD)).put("library", new Response(text)); } catch (e) { }
}
async function lastGood() {
  try { const r = "caches" in window ? await (await caches.open(GOOD)).match("library") : null; return r ? await r.text() : null; } catch (e) { return null; }
}

export async function loadData() {
  let library = null, campaign = read(LS.campaign), pendingLock = null;
  if (!campaign) {
    const t = await fetchText(PATH.campaign);
    campaign = JSON.parse(t); write(LS.campaign, campaign); setHash("campaign", fingerprint(t));
  }
  if (!library) {
    const t = (await cachedText(PATH.library)) || await fetchText(PATH.library);
    try {
      library = await openLibrary(t);
      setHash("library", fingerprint(t));
      rememberGood(t);
    } catch (e) {
      if (!(e instanceof LockedError)) throw e;
      const good = await lastGood();
      if (good) { try { library = await openLibrary(good); } catch (e2) { } }
      if (!library) library = read(LS.library); // readable copy kept by older versions
      if (!library) throw e;
      pendingLock = e;
    }
  }
  // Drop the readable copy older versions kept, once the cached file opened fine.
  if (!pendingLock) { try { localStorage.removeItem(LS.library); } catch (e) { } }
  return { library, campaign, pendingLock };
}

// Background check. Calls onUpdate({library, campaign, changed}) when a
// hosted file differs from what's cached; onLocked(err) when the DM changed
// the password and this device needs it again.
export async function checkForUpdates(current, onUpdate, onLocked) {
  if (!navigator.onLine) return;
  const changed = [];
  const next = { ...current };
  for (const kind of ["campaign", "library"]) {
    try {
      const text = await fetchText(PATH[kind]);
      const fp = fingerprint(text), old = getHash(kind);
      if (fp === old) continue;
      let obj;
      try { obj = kind === "library" ? await openLibrary(text) : JSON.parse(text); }
      catch (e) { if (e instanceof LockedError && onLocked) onLocked(e); continue; }
      if (kind !== "library") write(LS[kind], obj); else rememberGood(text);
      setHash(kind, fp);
      if (old) changed.push(kind);
      next[kind] = obj;
    } catch (e) { /* offline or host unreachable — keep what we have */ }
  }
  if (changed.length) onUpdate({ ...next, changed });
}

// --- campaign.json is an allowlist by name; library.json holds the text.
const allow = (list, names) => (names ? list.filter(x => new Set(names).has(x.name)) : list);

export const enabledClasses = (L, C) => allow(L.classes, C.enabled?.classes);
export const enabledSpecies = (L, C) => allow(L.species, C.enabled?.species);
export const enabledBackgrounds = (L, C) => { const names = C.enabled?.backgrounds && new Set(C.enabled.backgrounds); return L.backgrounds.filter(b => b.custom || !names || names.has(b.name)); };
export const enabledFeats = (L, C) => allow([...L.feats, ...(C.homebrew?.feats || [])], C.enabled?.feats && [...C.enabled.feats, ...(C.homebrew?.feats || []).map(f => f.name)]);
export const enabledSpells = (L, C) => allow([...L.spells, ...(C.homebrew?.spells || [])], C.enabled?.spells && [...C.enabled.spells, ...(C.homebrew?.spells || []).map(s => s.name)]);
export const allWeapons = (L, C) => [...L.weapons, ...(C.homebrew?.weapons || [])];
export const allItems = (L, C) => [...L.items, ...(C.homebrew?.items || [])];

const SRC = /^[A-Z]{2,}[A-Za-z0-9'’:&.-]*(?: p\d+(?:[-–]\d+)?)?$/;
const HEAD = /^Level (\d+): (.+)$/;
// Some imported subclasses have several features run together under one entry (or under
// no name), each starting "Level N: Name" and a source line. Split them back apart so
// every feature is found at its own level. Text is never reworded.
export function normalizeSubclass(sc) {
  const out = [];
  for (const f of sc.features || []) {
    const lines = String(f.text || "").split("\n");
    let cur = { ...f, _l: [] }, any = false;
    const push = () => { const t = cur._l.join("\n").replace(/^\n+|\n+$/g, ""); const o = { ...cur, text: t }; delete o._l; if (o.text || o.name) out.push(o); };
    for (let i = 0; i < lines.length; i++) {
      const m = HEAD.exec(lines[i].trim());
      if (m && !f.intro || (m && f.intro && i > 0)) {
        push(); any = true;
        let j = i + 1; if (lines[j] && SRC.test(lines[j].trim())) j++;
        cur = { lv: Number(m[1]), name: m[2].replace(/^["“](.*)["”]$/, "$1").trim(), text: "", _l: [], split: true };
        i = j - 1; continue;
      }
      cur._l.push(lines[i]);
    }
    push();
  }
  return out.filter(f => f.intro || f.name || !/^nothing\.*$/i.test(String(f.text).trim()));
}

export function findByName(list, name) {
  return (list || []).find(x => x.name === name) || null;
}
// A character's feat can carry its chosen option, e.g. "Magic Initiate (Cleric)". The rules entry is the base feat.
export const featBase = n => String(n || "").replace(/\s*\([^)]*\)\s*$/, "");
export function findFeat(list, name) { return findByName(list, name) || findByName(list, featBase(name)); }
export function subclassesFor(L, className) {
  return L.subclasses.filter(s => s.cls === className);
}
