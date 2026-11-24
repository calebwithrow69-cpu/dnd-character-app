// Recently deleted characters: kept 30 days so a delete is never final on the day. localStorage key dnd-trash-v1.
// Pure over a storage object so it can be tested. ASCII only.
const KEY = "dnd-trash-v1", DAYS = 30, CAP = 8;
const DAY = 864e5;
function read(ls) { try { const a = JSON.parse(ls.getItem(KEY) || "[]"); return Array.isArray(a) ? a.filter(e => e && typeof e === "object" && e.char && typeof e.char === "object" && typeof e.at === "number") : []; } catch (e) { return []; } }
function write(ls, list) { try { ls.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
export function trashList(ls = localStorage, now = Date.now()) {
  return read(ls).filter(e => now - e.at < DAYS * DAY).sort((a, b) => b.at - a.at);
}
export function trashAdd(char, ls = localStorage, now = Date.now()) {
  const list = trashList(ls, now).filter(e => e.char.id !== char.id);
  list.unshift({ at: now, char });
  let kept = list.slice(0, CAP);
  while (kept.length > 1 && !write(ls, kept)) kept = kept.slice(0, -1); // quota: drop the oldest until it fits
  return write(ls, kept);
}
export function trashTake(id, ls = localStorage, now = Date.now()) {
  const list = trashList(ls, now), hit = list.find(e => e.char.id === id);
  if (!hit) return null;
  write(ls, list.filter(e => e !== hit));
  return hit.char;
}
export function trashDrop(id, ls = localStorage, now = Date.now()) { return write(ls, trashList(ls, now).filter(e => e.char.id !== id)); }
export function daysLeft(e, now = Date.now()) { return Math.max(0, Math.ceil(DAYS - (now - e.at) / DAY)); }
export const TRASH_DAYS = DAYS;
