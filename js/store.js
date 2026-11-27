import { allPortraits } from "./portraits.js";
import { parseProfs } from "./rules.js";
import { repairLevels } from "./levelfix.js";
import { cleanShop } from "./shopdata.js";

// Character roster: lives in this device's localStorage only.
// Backups are plain JSON files the player saves wherever they like.

const LS_ROSTER = "dnd-roster-v1"; // { [id]: character }
const LS_ACTIVE = "dnd-active-v1";

// A damaged or hand-edited roster must never take the app down: keep only well-formed entries.
function readRoster() {
  let r;
  try { r = JSON.parse(localStorage.getItem(LS_ROSTER) || "{}"); } catch (e) { return {}; }
  if (!r || typeof r !== "object" || Array.isArray(r)) return {};
  const out = {};
  Object.keys(r).forEach(k => {
    const c = r[k];
    if (k === "__proto__" || !c || typeof c !== "object" || Array.isArray(c)) return;
    out[k] = typeof c.id === "string" && c.id ? c : { ...c, id: k };
  });
  return out;
}
let lastWriteFailed = false;
function writeRoster(roster) {
  try { localStorage.setItem(LS_ROSTER, JSON.stringify(roster)); lastWriteFailed = false; return true; }
  catch (e) { lastWriteFailed = true; return false; }
}
export const saveFailed = () => lastWriteFailed;

// Fills in fields older saves (or imports) may lack, so the sheet never
// has to guard against undefined.
// Wrong types in a save (hand edits, old builds, bad imports) are coerced here, once, so the sheet can trust the shape.
const txt = (v, max = 200) => typeof v === "string" ? v.slice(0, max) : typeof v === "number" && isFinite(v) ? String(v) : "";
const num = (v, d, lo, hi) => { v = Number(v); if (v === null || !isFinite(v)) v = d; return Math.min(hi, Math.max(lo, v)); };
const plain = v => v && typeof v === "object" && !Array.isArray(v);
function prep(c) {
  if (!plain(c)) c = {};
  const o = { ...c };
  ["name", "species", "class", "subclass", "background", "alignment", "appearance", "backstory", "languages", "classFeatureNotes", "notes", "profsText", "size", "wielded"].forEach(k => { if (k in o) o[k] = txt(o[k], k === "backstory" || k === "notes" || k === "appearance" ? 20000 : 200); });
  ["feats", "conditions", "saveProf", "skillProf", "skillExpertise", "inventory", "resources", "weapons", "masteries", "lineageGranted", "hotbar", "loadouts", "pins", "formulas", "levelLog", "custom", "active"].forEach(k => { if (k in o && !Array.isArray(o[k])) o[k] = []; });
  ["inventory", "resources", "weapons"].forEach(k => { if (k in o) o[k] = o[k].filter(plain); });
  if (o.inventory) o.inventory = o.inventory.map(it => { const r = { ...it, name: txt(it.name, 120) || "Item" }; if ("contents" in r) { r.contents = Array.isArray(r.contents) ? r.contents.filter(x => x && typeof x === "object").slice(0, 60).map((x, i) => ({ id: txt(x.id, 24) || "p" + i, name: txt(x.name, 80) || "Item", qty: Math.max(1, Math.min(999, Math.round(Number(x.qty)) || 1)) })) : undefined; if (!r.contents) delete r.contents; } return r; });
  if (o.weapons) o.weapons = o.weapons.map(w => ({ ...w, name: txt(w.name, 120) || "Weapon" }));
  if (o.feats) o.feats = o.feats.filter(f => typeof f === "string" || plain(f));
  ["spellcasting", "choices", "coins", "equipment", "ac", "deathSaves", "hitDice", "hp", "abilities"].forEach(k => { if (k in o && !plain(o[k])) o[k] = {}; });
  if (o.spellcasting) { const sc = { ...o.spellcasting }; sc.spells = (Array.isArray(sc.spells) ? sc.spells : []).filter(x => plain(x) && typeof x.name === "string"); if (!Array.isArray(sc.slotsUsed)) delete sc.slotsUsed; o.spellcasting = sc; }
  if (o.abilities) { const a = {}; ["str", "dex", "con", "int", "wis", "cha"].forEach(k => { if (k in o.abilities) a[k] = num(o.abilities[k], 10, 1, 30); }); o.abilities = a; }
  if (o.hp) { const h = { ...o.hp }; if ("max" in h) h.max = num(h.max, 1, 1, 9999); if ("cur" in h) h.cur = num(h.cur, 1, 0, 9999); if ("temp" in h) h.temp = num(h.temp, 0, 0, 9999); if ("adjust" in h) h.adjust = num(h.adjust, 0, -999, 999); o.hp = h; }
  if (o.coins) { const k = {}; ["cp", "sp", "ep", "gp", "pp"].forEach(x => { if (x in o.coins) k[x] = num(o.coins[x], 0, 0, 1e9); }); o.coins = k; }
  if (o.deathSaves) o.deathSaves = { success: num(o.deathSaves.success, 0, 0, 3), fail: num(o.deathSaves.fail, 0, 0, 3) };
  return o;
}

export function normalize(c, library) {
  c = prep(c);
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
    conditions: c.conditions || [], encumbrance: !!c.encumbrance, shop: cleanShop(c.shop), active: Array.isArray(c.active) ? c.active.filter(a => a && a.id && a.name) : [], exhaustion: Number(c.exhaustion) || 0,
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
  // Rolls tab: pinned checks ("init", "abil:str", "save:con", "skill:stealth") and saved dice formulas
  out.pins = (Array.isArray(c.pins) ? c.pins : ["init"]).filter((k, i, a) => typeof k === "string" && /^(init|(abil|save):[a-z]{3}|skill:[a-z-]+)$/.test(k) && a.indexOf(k) === i).slice(0, 12);
  out.formulas = (Array.isArray(c.formulas) ? c.formulas : []).filter((f, i, a) => typeof f === "string" && /^[0-9dD+\-\s]{2,30}$/.test(f) && a.indexOf(f) === i).slice(0, 12);
  out.levelLog = Array.isArray(c.levelLog) ? c.levelLog.filter(e => e && Number(e.level) > 0) : [];
  { const fixed = repairLevels(out); out.levelFix = fixed.length ? fixed : (Array.isArray(c.levelFix) ? c.levelFix : []); }
  out.dead =c.dead && typeof c.dead === "object" ? { cause: String(c.dead.cause || "").slice(0, 300), at: String(c.dead.at || "").slice(0, 10) } : null;
  out.hpRoll = c.hpRoll && c.hpRoll.level ? { level: Number(c.hpRoll.level), v: Number(c.hpRoll.v) } : undefined;
  out.custom = (Array.isArray(c.custom) ? c.custom : []).filter(x => x && x.id && x.t).map(x => ({ id: x.id, t: x.t, v: Number(x.v) || 0, label: String(x.label || "Custom").slice(0, 40), kind: x.kind ? String(x.kind).slice(0, 12) : undefined }));
  out.spellfx = (Array.isArray(c.spellfx) ? c.spellfx : []).filter(x => x && x.id && x.name && Array.isArray(x.effects)).slice(0, 12).map(x => ({ id: String(x.id), name: String(x.name).slice(0, 60), level: Number(x.level) || 0, conc: !!x.conc, effects: x.effects.filter(e => e && typeof e === "object" && typeof e.t === "string").slice(0, 12) }));
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
  const ok = l => l.filter(c => c && typeof c === "object" && !Array.isArray(c) && typeof c.name === "string" && c.abilities && typeof c.abilities === "object");
  let list = null;
  if (Array.isArray(data)) list = ok(data);
  else if (data && Array.isArray(data.characters)) list = ok(data.characters);
  else if (data && data.name && data.abilities) list = ok([data]);
  if (!list) throw new Error("Not a Sheet backup.");
  if (!list.length) throw new Error("No characters in that file.");
  return list;
}
