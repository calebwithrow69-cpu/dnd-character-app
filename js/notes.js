// Notes ledger: one list of notes per device (not per character), with categories, sorting, counters and
// length milestones. Pure data layer; storage is injectable so node tests can run it. ASCII only.
import { BADGES } from "./milestones.js";
export { BADGES };
export const KEY = "dnd-notes-v1";
export const GENERAL = "General";
export const DEFAULT_CATS = [GENERAL, "Session", "NPC", "Quest", "Place", "Loot", "Character", "Rules", "Ideas"];
export const SORTS = [["updated", "Edited"], ["created", "Created"], ["title", "Title"], ["size", "Length"], ["cat", "Category"]];
export const QUOTA_CHARS = 5000000; // typical localStorage budget; the browser decides the real number

const newId = () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const len = s => [...String(s || "")].length;
export const noteLen = n => len(n.title) + len(n.body);
const blank = () => ({ v: 1, notes: [], cats: DEFAULT_CATS.slice(), migrated: [], badges: {} });

export function clean(raw) {
  const d = blank();
  if (!raw || typeof raw !== "object") return d;
  const cats = Array.isArray(raw.cats) ? raw.cats.map(c => String(c).trim().slice(0, 24)).filter(Boolean) : [];
  d.cats = [GENERAL, ...new Set([...cats.filter(c => c !== GENERAL), ...DEFAULT_CATS.filter(c => c !== GENERAL && !cats.length)])];
  const seen = new Set();
  for (const n of Array.isArray(raw.notes) ? raw.notes : []) {
    if (!n || typeof n !== "object") continue;
    const id = String(n.id || newId()); if (seen.has(id)) continue; seen.add(id);
    const cat = d.cats.includes(n.cat) ? n.cat : (n.cat && String(n.cat).trim() ? (d.cats.push(String(n.cat).trim().slice(0, 24)), String(n.cat).trim().slice(0, 24)) : GENERAL);
    d.notes.push({ id, title: String(n.title || "").slice(0, 120), body: String(n.body || ""), cat, pin: !!n.pin, charId: String(n.charId || ""),
      created: +n.created || Date.now(), updated: +n.updated || +n.created || Date.now() });
  }
  d.migrated = Array.isArray(raw.migrated) ? raw.migrated.map(String) : [];
  d.badges = {};
  if (raw.badges && typeof raw.badges === "object") for (const b of BADGES) if (+raw.badges[b.id]) d.badges[b.id] = +raw.badges[b.id];
  d.hadBadges = !!(raw.badges && typeof raw.badges === "object");
  return d;
}
export function load(st) { try { return clean(JSON.parse(st.getItem(KEY))); } catch (e) { return blank(); } }
export function save(data, st) { try { const { hadBadges, ...rest } = data; st.setItem(KEY, JSON.stringify(rest)); return true; } catch (e) { return false; } }

export function addNote(data, cat, now = Date.now()) {
  const n = { id: newId(), title: "", body: "", cat: data.cats.includes(cat) ? cat : GENERAL, pin: false, charId: "", created: now, updated: now };
  data.notes.push(n); return n;
}
export function edit(note, fields, now = Date.now()) {
  if ("title" in fields) note.title = String(fields.title).slice(0, 120);
  if ("body" in fields) note.body = String(fields.body);
  if ("cat" in fields) note.cat = fields.cat;
  if ("pin" in fields) note.pin = !!fields.pin;
  note.updated = now; return note;
}
export function removeNote(data, id) { data.notes = data.notes.filter(n => n.id !== id); }
export function addCat(data, name) {
  const c = String(name || "").trim().slice(0, 24);
  if (!c) return "";
  const hit = data.cats.find(x => x.toLowerCase() === c.toLowerCase());
  if (hit) return hit;
  data.cats.push(c); return c;
}
export function removeCat(data, name) {
  if (name === GENERAL || !data.cats.includes(name)) return false;
  data.cats = data.cats.filter(c => c !== name);
  data.notes.forEach(n => { if (n.cat === name) n.cat = GENERAL; });
  return true;
}
export const titleOf = n => (n.title && n.title.trim()) || (n.body || "").split("\n").find(l => l.trim())?.replace(/^[#>\-*\s]+/, "").slice(0, 60) || "Untitled";

export function sortNotes(list, key = "updated", desc = true) {
  const dir = desc ? -1 : 1;
  const val = { updated: n => n.updated, created: n => n.created, size: noteLen, title: n => titleOf(n).toLowerCase(), cat: n => n.cat.toLowerCase() }[key] || (n => n.updated);
  return list.slice().sort((a, b) => (b.pin - a.pin) || (val(a) < val(b) ? -dir : val(a) > val(b) ? dir : 0) || (b.updated - a.updated));
}
export function filterNotes(list, { cat = "all", q = "" } = {}) {
  const s = String(q || "").trim().toLowerCase();
  return list.filter(n => (cat === "all" || n.cat === cat) && (!s || (n.title + "\n" + n.body).toLowerCase().includes(s)));
}
export function catCounts(data) { const c = { all: data.notes.length }; data.cats.forEach(k => { c[k] = 0; }); data.notes.forEach(n => { c[n.cat] = (c[n.cat] || 0) + 1; }); return c; }

export function stats(list) {
  let chars = 0, words = 0;
  for (const n of list) { chars += noteLen(n); const t = (n.title + " " + n.body).trim(); if (t) words += t.split(/\s+/).length; }
  const bytes = new TextEncoder().encode(JSON.stringify(list)).length;
  return { notes: list.length, chars, words, bytes };
}
// How much of the browser's local storage this device has used (all data, not just notes).
export function storageUse(st) {
  let used = 0;
  try { for (let i = 0; i < st.length; i++) { const k = st.key(i); used += k.length + String(st.getItem(k)).length; } } catch (e) { /* unreadable */ }
  return { used, quota: QUOTA_CHARS, pct: Math.min(100, used / QUOTA_CHARS * 100) };
}
export function fmtBytes(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB" : (n / 1048576).toFixed(1) + " MB"; }

// Length milestones come from milestones.js (each is also a badge with facts).
export const MILESTONES = BADGES;
export function milestone(chars) {
  let at = null, next = null;
  for (const m of MILESTONES) { if (chars >= m.n) at = m; else { next = m; break; } }
  const prev = at ? at.n : 0;
  return {
    at, next, times: at ? chars / at.n : 0,
    left: next ? next.n - chars : 0,
    pct: next ? Math.max(0, Math.min(100, (chars - prev) / (next.n - prev) * 100)) : 100
  };
}
export function milestoneText(chars) {
  const m = milestone(chars);
  if (!m.at) return { head: "Under a tweet", sub: `${m.left.toLocaleString()} to ${m.next.name}`, pct: m.pct };
  const t = m.times;
  const head = t >= 1.95 ? `About ${t >= 10 ? Math.round(t) : t.toFixed(1)}x ${m.at.name}` : `As long as ${m.at.name}`;
  return { head, sub: m.next ? `${m.left.toLocaleString()} to ${m.next.name}` : "Longest milestone", pct: m.pct };
}

// Move each character's old sheet notes into the ledger once.
export function migrateSheetNotes(data, chars) {
  let added = 0;
  for (const c of chars) {
    if (!c || !c.id || data.migrated.includes(c.id)) continue;
    data.migrated.push(c.id);
    if (c.notes && String(c.notes).trim()) {
      const n = addNote(data, "Character"); n.title = `${c.name || "Character"} notes`.slice(0, 120); n.body = String(c.notes); n.charId = c.id; added++;
    }
  }
  return added;
}

// Backups: the ledger rides along in a full backup. Importing merges by id, newest edit wins.
export function exportData(data) { return { v: 1, cats: data.cats, notes: data.notes, badges: data.badges }; }
export function mergeImport(data, raw) {
  const inc = clean(raw); let added = 0, updated = 0;
  inc.cats.forEach(c => { if (!data.cats.includes(c)) data.cats.push(c); });
  for (const [id, ts] of Object.entries(inc.badges)) if (!data.badges[id] || ts < data.badges[id]) data.badges[id] = ts;
  for (const n of inc.notes) {
    const mine = data.notes.find(x => x.id === n.id);
    if (!mine) { data.notes.push(n); added++; } else if (n.updated > mine.updated) { Object.assign(mine, n); updated++; }
  }
  return { added, updated };
}
export function toMarkdownFile(data, now = new Date()) {
  const body = sortNotes(data.notes, "cat", false).map(n => `# ${titleOf(n)}\n\n_${n.cat}_\n\n${n.body}`).join("\n\n---\n\n");
  return body || "";
}

// Badges: earned once, kept even if notes are deleted later. Returns the badges earned by this call.
export function awardBadges(data, chars, now = Date.now()) {
  const won = [];
  for (const b of BADGES) if (chars >= b.n && !data.badges[b.id]) { data.badges[b.id] = now; won.push(b); }
  return won;
}
export function badgeCount(data) { return BADGES.filter(b => data.badges[b.id]).length; }
