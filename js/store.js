import { allPortraits } from "./portraits.js";
import { parseProfs } from "./rules.js";

// Character roster: lives in this device's localStorage only.
// Backups are plain JSON files the player saves wherever they like.

const LS_ROSTER = "dnd-roster-v1"; // { [id]: character }
const LS_ACTIVE = "dnd-active-v1";

function readRoster() {
  try { return JSON.parse(localStorage.getItem(LS_ROSTER) || "{}"); } catch (e) { return {}; }
}
let lastWriteFailed = false;
function writeRoster(roster) {
  try { localStorage.setItem(LS_ROSTER, JSON.stringify(roster)); lastWriteFailed = false; return true; }
  catch (e) { lastWriteFailed = true; return false; }
}
export const saveFailed = () => lastWriteFailed;

// Fills in fields older saves (or imports) may lack, so the sheet never
// has to guard against undefined.
export function normalize(c, library) {
  const cls = library?.classes?.find(x => x.name === c.class);
  const out = {
    schema: 2, id: c.id || newId(), name: c.name || "Unnamed",
    species: c.species || "", class: c.class || "", subclass: c.subclass || "",
    level: Math.min(20, Math.max(1, Number(c.level) || 1)), background: c.background || "",
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...(c.abilities || {}) },
    saveProf: c.saveProf || [], skillProf: c.skillProf || [], skillExpertise: c.skillExpertise || [],
    xp: Math.max(0, Number(c.xp) || 0), levelMode: c.levelMode === "milestone" ? "milestone" : "xp",
    profs: c.profs && typeof c.profs === "object" ? { armor: c.profs.armor || [], weapons: c.profs.weapons || [] } : null, profsText: c.profsText || "", languages: c.languages || "", feats: c.feats || [],
    hp: { max: 1, cur: 1, temp: 0, ...(c.hp || {}) },
    ac: { base: 10, bonus: 0, shield: false, dexCap: null, armorName: "", override: null, ...(c.ac || {}) },
    speed: Number(c.speed) || 30, initBonus: Number(c.initBonus) || 0, size: c.size || "",
    hitDice: { total: c.level || 1, spent: 0, die: cls ? cls.hd : 8, ...(c.hitDice || {}) },
    deathSaves: { success: 0, fail: 0, ...(c.deathSaves || {}) },
    conditions: c.conditions || [], active: Array.isArray(c.active) ? c.active.filter(a => a && a.id && a.name) : [], exhaustion: Number(c.exhaustion) || 0,
    concentration: c.concentration || null,
    spellcasting: {
      slotsUsed: Array(10).fill(0),
      ...(c.spellcasting || {}),
      spells: ((c.spellcasting && c.spellcasting.spells) || []).map(s => ({ prepared: true, always: false, ...s }))
    },
    resources: (c.resources || []).map(r => ({ reset: "long", used: 0, max: 1, ...r })),
    inventory: c.inventory || [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...(c.coins || {}) },
    wielded: typeof c.wielded === "string" ? c.wielded : "", furyChoice: c.furyChoice === "Potent Spellcasting" ? "Potent Spellcasting" : "",
    classFeatureNotes: c.classFeatureNotes || "", notes: c.notes || "",
    alignment: c.alignment || "", appearance: c.appearance || "", backstory: c.backstory || ""
  };
  if (!out.hitDice.die) out.hitDice.die = cls ? cls.hd : 8;
  out.hitDice.total = out.level;
  while (out.spellcasting.slotsUsed.length < 10) out.spellcasting.slotsUsed.push(0);

  // --- schema 3: one inventory. Weapons used to be a separate list; fold
  // each into the matching carried item (or add it), keeping its stats.
  out.inventory = out.inventory.map(it => ({ qty: 1, notes: "", ...it, id: it.id || newId() }));
  (c.weapons || []).forEach(w => {
    const { name, ammo, ...stats } = w;
    const weapon = { ...stats, ...(ammo ? { ammo } : {}) };
    const match = out.inventory.find(it => !it.weapon && it.name.toLowerCase() === String(name).toLowerCase());
    if (match) match.weapon = weapon;
    else out.inventory.push({ id: newId(), name, qty: 1, notes: "", weapon });
  });
  delete out.weapons;
  out.equipment = { ...(c.equipment || {}) };
  Object.keys(out.equipment).forEach(k => { if (!out.inventory.some(i => i.id === out.equipment[k])) delete out.equipment[k]; });
  out.masteries = c.masteries || [];
  out.choices = c.choices || {};
  out.lineageGranted = c.lineageGranted || [];
  out.hotbar = Array.isArray(c.hotbar) ? c.hotbar : [];
  // drop hotbar entries whose target is gone
  out.hotbar = out.hotbar.filter(h => h && (
    h.kind === "spell" ? out.spellcasting.spells.some(s => s.name === h.name)
    : (h.kind === "attack" || h.kind === "item") ? out.inventory.some(i => i.id === h.id)
    : h.kind === "ability" ? true : false));
  out.loadouts = (Array.isArray(c.loadouts) ? c.loadouts : []).filter(l => l && l.id && l.name && l.eq && typeof l.eq === "object").slice(0, 12);
  out.levelLog = c.levelLog || [];
  out.hpRoll = c.hpRoll && c.hpRoll.level ? { level: Number(c.hpRoll.level), v: Number(c.hpRoll.v) } : undefined;
  out.custom = (Array.isArray(c.custom) ? c.custom : []).filter(x => x && x.id && x.t).map(x => ({ id: x.id, t: x.t, v: Number(x.v) || 0, label: x.label || "Custom" }));
  out.schema = 3;
  if (!out.profs) { const r = parseProfs(out.profsText); out.profs = r.profs; out.profsText = r.rest; }
  return out;
}

export function listCharacters() {
  return Object.values(readRoster()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}
export function getCharacter(id) { return readRoster()[id] || null; }
export function saveCharacter(char) {
  const roster = readRoster();
  roster[char.id] = char;
  return writeRoster(roster);
}
export function deleteCharacter(id) {
  const roster = readRoster();
  delete roster[id];
  writeRoster(roster);
  if (getActiveId() === id) setActiveId(null);
}
export function getActiveId() { try { return localStorage.getItem(LS_ACTIVE) || null; } catch (e) { return null; } }
export function setActiveId(id) {
  try { id ? localStorage.setItem(LS_ACTIVE, id) : localStorage.removeItem(LS_ACTIVE); } catch (e) { }
}
export function newId() { return Math.random().toString(36).slice(2, 10); }

// Ask the browser not to evict our data under storage pressure.
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
  } catch (e) { }
  return false;
}

// --- Backups
export function backupPayload(ids) {
  const roster = readRoster();
  const chars = (ids || Object.keys(roster)).map(id => roster[id]).filter(Boolean);
  const out = { app: "character-runner", kind: "backup", version: 1, exportedAt: new Date().toISOString(), characters: chars };
  const pics = ids ? {} : allPortraits(); // a full backup carries the species portraits too
  if (Object.keys(pics).length) out.portraits = pics;
  return out;
}
export function parsePortraits(text) {
  try { const d = JSON.parse(text); return d && d.portraits && typeof d.portraits === "object" ? d.portraits : {}; } catch (e) { return {}; }
}

// Accepts a backup file, a single exported character, or a bare array.
export function parseImport(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.characters)) return data.characters;
  if (data && data.name && data.abilities) return [data];
  throw new Error("That file isn't a Character Runner backup.");
}
