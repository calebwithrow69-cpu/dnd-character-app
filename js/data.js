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
  write(LS.library, data);
  setHash("library", fingerprint(lockedErr.text));
  return data;
}

// Returns {library, campaign}: cache first (instant, offline-safe), else
// network. Throws LockedError when the password is needed, or a network
// error when there's no cache and no connection.
export async function loadData() {
  let library = read(LS.library), campaign = read(LS.campaign);
  if (!campaign) {
    const t = await fetchText(PATH.campaign);
    campaign = JSON.parse(t); write(LS.campaign, campaign); setHash("campaign", fingerprint(t));
  }
  if (!library) {
    const t = await fetchText(PATH.library);
    library = await openLibrary(t);
    write(LS.library, library); setHash("library", fingerprint(t));
  }
  return { library, campaign };
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
      write(LS[kind], obj); setHash(kind, fp);
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
export const enabledBackgrounds = (L, C) => allow(L.backgrounds, C.enabled?.backgrounds);
export const enabledFeats = (L, C) => allow([...L.feats, ...(C.homebrew?.feats || [])], C.enabled?.feats && [...C.enabled.feats, ...(C.homebrew?.feats || []).map(f => f.name)]);
export const enabledSpells = (L, C) => allow([...L.spells, ...(C.homebrew?.spells || [])], C.enabled?.spells && [...C.enabled.spells, ...(C.homebrew?.spells || []).map(s => s.name)]);
export const allWeapons = (L, C) => [...L.weapons, ...(C.homebrew?.weapons || [])];
export const allItems = (L, C) => [...L.items, ...(C.homebrew?.items || [])];

export function findByName(list, name) {
  return (list || []).find(x => x.name === name) || null;
}
export function subclassesFor(L, className) {
  return L.subclasses.filter(s => s.cls === className);
}
