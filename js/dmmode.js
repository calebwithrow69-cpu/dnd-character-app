// DM mode data layer (pure, no DOM). One local record, `dnd-dm-mode-v1`:
//   party    cards sent by players (read-only snapshots, keyed by character id)
//   creatures the DM's own creature book
//   enc      the encounter being prepared: {diff, picks:[{cid, qty}], skip:[card ids left out]}
//   combat   the running fight, or null
// Nothing here touches characters. ASCII only.

export const KEY = "dnd-dm-mode-v1";
export const CODE_PREFIX = "CRP1.";

// ---------------------------------------------------------------- small helpers
const num = (v, lo, hi, d = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const txt = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const uid = () => Math.random().toString(36).slice(2, 10);
const AB = ["str", "dex", "con", "int", "wis", "cha"];

// ---------------------------------------------------------------- 2024 DMG XP budget (per character)
// "XP Budget per Character", 2024 Dungeon Master's Guide, chapter 4 (also in the free Basic Rules).
export const BUDGET = [
  null,
  [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100],
  [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100],
  [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800],
  [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000]
];
export const DIFFS = [["low", "Low"], ["moderate", "Moderate"], ["high", "High"]];
const dIdx = d => Math.max(0, DIFFS.findIndex(x => x[0] === d));

// Budget of a party: the table value for each character's level, summed.
export function partyBudget(levels, diff) {
  const i = dIdx(diff);
  return (levels || []).reduce((s, lv) => s + BUDGET[num(lv, 1, 20, 1)][i], 0);
}
// Where a total of monster XP sits: the lowest tier whose budget it fits under.
export function rate(levels, xp) {
  for (let i = 0; i < DIFFS.length; i++) if (xp <= partyBudget(levels, DIFFS[i][0])) return { tier: DIFFS[i][0], label: DIFFS[i][1] };
  return { tier: "over", label: "Over High" };
}

// Challenge rating to XP (Monster Manual).
export const CR_XP = {
  "0": 0, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
  "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000,
  "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000
};
export const CRS = Object.keys(CR_XP);
export const crXp = cr => (cr in CR_XP ? CR_XP[cr] : null);

// ---------------------------------------------------------------- party cards (a player's snapshot)
// What the DM needs at the table, nothing else. Built on the player's device from a normalized character.
export function makeCard(c, d, now = Date.now()) {
  const sk = id => { const s = (d.skills || []).find(x => x.id === id); return s ? 10 + s.bonus : 10; };
  return sanitizeCard({
    id: c.id, name: c.name, cls: c.class, sub: c.subclass, species: c.species, level: d.level,
    ac: d.ac, hp: c.hp && c.hp.max, cur: c.hp && c.hp.cur, temp: c.hp && c.hp.temp, speed: d.speed, init: d.initiative,
    pp: d.passivePerception, pi: sk("insight"), pinv: sk("investigation"),
    saves: d.saves, dc: d.spellInfo ? d.spellInfo.dc : null,
    langs: String(c.languages || ""), conds: (c.conditions || []).map(x => (typeof x === "string" ? x : x && x.name)).filter(Boolean),
    exh: c.exhaustion, conc: c.concentration && (c.concentration.name || c.concentration.spell || (typeof c.concentration === "string" ? c.concentration : "")) || "",
    xp: c.xp, dead: !!c.dead, at: now
  });
}
export function sanitizeCard(o) {
  if (!o || typeof o !== "object") return null;
  const name = txt(o.name, 60); if (!name) return null;
  const saves = {}; AB.forEach(a => { saves[a] = num(o.saves && o.saves[a], -10, 30, 0); });
  const hp = num(o.hp, 1, 9999, 1);
  return {
    id: txt(o.id, 24) || uid(), name, cls: txt(o.cls, 40), sub: txt(o.sub, 60), species: txt(o.species, 60), level: num(o.level, 1, 20, 1),
    ac: num(o.ac, 0, 60, 10), hp, cur: num(o.cur, 0, hp, hp), temp: num(o.temp, 0, 9999, 0), speed: num(o.speed, 0, 400, 30), init: num(o.init, -10, 30, 0),
    pp: num(o.pp, 0, 60, 10), pi: num(o.pi, 0, 60, 10), pinv: num(o.pinv, 0, 60, 10), saves,
    dc: o.dc == null ? null : num(o.dc, 0, 40, 0),
    langs: txt(o.langs, 200), conds: (Array.isArray(o.conds) ? o.conds : []).map(x => txt(x, 30)).filter(Boolean).slice(0, 20),
    exh: num(o.exh, 0, 6, 0), conc: txt(o.conc, 60), xp: num(o.xp, 0, 1e7, 0), dead: !!o.dead, at: num(o.at, 0, 8.64e15, Date.now())
  };
}
export const encodeCard = card => CODE_PREFIX + toB64(JSON.stringify(card));
export function decodeCard(code) {
  try {
    const m = /^\s*CRP1\.([\w-]+)\s*$/.exec(String(code || "")); if (!m) return null;
    return sanitizeCard(JSON.parse(fromB64(m[1])));
  } catch (e) { return null; }
}
// Pasted text or a file: one code per line, or a {kind:"party-card"} file. Returns the cards it could read and how many lines it could not.
export function readCards(text) {
  const out = []; let bad = 0; const t = String(text || "").trim();
  if (t.startsWith("{")) {
    try { const j = JSON.parse(t); const list = j && j.kind === "party-cards" ? j.cards : j && j.kind === "party-card" ? [j.card] : []; list.forEach(x => { const c = sanitizeCard(x); if (c) out.push(c); else bad++; }); if (!list.length) bad++; } catch (e) { bad++; }
    return { cards: out, bad };
  }
  t.split(/\s+/).filter(Boolean).forEach(w => { const c = decodeCard(w); if (c) out.push(c); else bad++; });
  return { cards: out, bad };
}
export const cardFile = card => ({ kind: "party-card", v: 1, card });
function toB64(s) { const b = typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(Array.from(new TextEncoder().encode(s), x => String.fromCharCode(x)).join("")); return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromB64(t) { const s = String(t).replace(/-/g, "+").replace(/_/g, "/"); if (typeof Buffer !== "undefined") return Buffer.from(s, "base64").toString("utf8"); const b = atob(s); return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))); }

// ---------------------------------------------------------------- creature book
export function sanitizeCreature(o) {
  if (!o || typeof o !== "object") return null;
  const name = txt(o.name, 60); if (!name) return null;
  const cr = CRS.includes(String(o.cr)) ? String(o.cr) : "";
  const xp = o.xp === "" || o.xp == null ? (cr ? crXp(cr) : 0) : num(o.xp, 0, 1e6, 0);
  return { id: txt(o.id, 40) || uid(), name, cr, xp, hp: num(o.hp, 1, 99999, 1), ac: num(o.ac, 0, 60, 10), init: num(o.init, -10, 30, 0), note: txt(o.note, 300), mid: txt(o.mid, 60) };
}
// ---- bestiary (library.monsters, SRD 5.2) in the creature shape
export const abilMod = v => Math.floor((Number(v) - 10) / 2);
export const monsterCreature = m => sanitizeCreature({ id: "m:" + m.id, name: m.name, cr: m.cr, xp: m.xp, hp: m.hp, ac: m.ac, init: abilMod(m.abil[1]), mid: m.id });
const crNum = cr => (cr === "1/8" ? 0.125 : cr === "1/4" ? 0.25 : cr === "1/2" ? 0.5 : Number(cr) || 0);
export const CR_BANDS = [["all", "Any CR", 0, 99], ["low", "Up to 1", 0, 1], ["mid", "2 to 4", 2, 4], ["high", "5 to 10", 5, 10], ["epic", "11 to 16", 11, 16], ["top", "17 and up", 17, 99]];
// Filter and sort monsters (or creature-book entries). `q` matches name or type, `cr` is a CR_BANDS key, `type` an exact type.
export function searchMonsters(list, { q = "", cr = "all", type = "" } = {}) {
  const band = CR_BANDS.find(b => b[0] === cr) || CR_BANDS[0], k = String(q).trim().toLowerCase();
  return list.filter(m => { const n = crNum(m.cr); return n >= band[2] && n <= band[3] && (!type || m.type === type) && (!k || m.name.toLowerCase().includes(k) || String(m.type || "").toLowerCase().includes(k)); })
    .sort((a, b) => crNum(a.cr) - crNum(b.cr) || a.name.localeCompare(b.name));
}
export const monsterTypes = list => [...new Set(list.map(m => m.type).filter(Boolean))].sort();

// ---------------------------------------------------------------- combat
export function newCombat() { return { id: uid(), round: 1, turn: 0, started: false, rows: [] }; }
const cap = (n, hi) => Math.max(0, Math.min(hi, n));
export function makeRow(o) {
  const hp = num(o.hp, 1, 99999, 1);
  return {
    id: txt(o.id, 24) || uid(), kind: o.kind === "pc" ? "pc" : "mon", name: txt(o.name, 60) || "Creature", card: txt(o.card, 24),
    init: o.init == null || o.init === "" ? null : num(o.init, -20, 60, 0), bonus: num(o.bonus, -10, 30, 0),
    hp, cur: num(o.cur, 0, hp, hp), temp: num(o.temp, 0, 9999, 0), ac: num(o.ac, 0, 60, 10),
    conds: (Array.isArray(o.conds) ? o.conds : []).map(x => ({ n: txt(x && x.n, 30), r: x && x.r != null ? num(x.r, 1, 99, 1) : null })).filter(x => x.n).slice(0, 12),
    conc: !!o.conc, out: !!o.out, note: txt(o.note, 200), xp: num(o.xp, 0, 1e7, 0), mid: txt(o.mid, 60)
  };
}
export const rowFromCard = card => makeRow({ kind: "pc", name: card.name, card: card.id, hp: card.hp, cur: card.cur, temp: card.temp, ac: card.ac, bonus: card.init, conc: !!card.conc, conds: card.conds.map(n => ({ n })), out: card.dead });
export const rowFromCreature = (cr, n) => makeRow({ kind: "mon", name: n ? `${cr.name} ${n}` : cr.name, hp: cr.hp, ac: cr.ac, bonus: cr.init, xp: cr.xp, mid: cr.mid });

// Initiative order: highest first, then the higher bonus, then the order they were added.
export function sortRows(cb) {
  const cur = cb.rows[cb.turn] && cb.rows[cb.turn].id;
  const ix = new Map(cb.rows.map((r, i) => [r.id, i]));
  cb.rows.sort((a, b) => (b.init == null ? -1e9 : b.init) - (a.init == null ? -1e9 : a.init) || b.bonus - a.bonus || ix.get(a.id) - ix.get(b.id));
  if (cur) { const i = cb.rows.findIndex(r => r.id === cur); cb.turn = i < 0 ? 0 : i; }
  return cb;
}
// Roll for rows with no initiative yet (or all of them). rng() returns 0..1.
export function rollInit(cb, { all = false, rng = Math.random } = {}) {
  cb.rows.forEach(r => { if (all || r.init == null) r.init = 1 + Math.floor(rng() * 20) + r.bonus; });
  return sortRows(cb);
}
export const alive = r => !r.out;
// Damage goes to temporary hit points first. Returns the concentration DC when a concentrating creature is hurt.
export function damage(r, n) {
  n = num(n, 0, 99999, 0); let left = n;
  const soak = Math.min(r.temp, left); r.temp -= soak; left -= soak;
  r.cur = cap(r.cur - left, r.hp);
  if (r.cur === 0 && r.kind === "mon") r.out = true;
  return r.conc && n > 0 ? { dc: Math.min(30, Math.max(10, Math.floor(n / 2))) } : null;
}
export function heal(r, n) { r.cur = cap(r.cur + num(n, 0, 99999, 0), r.hp); if (r.cur > 0) r.out = false; }
export function setTemp(r, n) { r.temp = Math.max(r.temp, num(n, 0, 9999, 0)); } // temporary hit points do not stack
// Next turn: skips creatures that are out. A condition with rounds counts down at the end of its own creature's turn.
export function nextTurn(cb) {
  const rows = cb.rows; if (!rows.length || !rows.some(alive)) return cb;
  if (!cb.started) { cb.started = true; cb.turn = Math.max(0, rows.findIndex(alive)); return cb; }
  const r = rows[cb.turn];
  if (r) r.conds = r.conds.map(c => (c.r == null ? c : { ...c, r: c.r - 1 })).filter(c => c.r == null || c.r > 0);
  for (let i = 0; i < rows.length; i++) {
    cb.turn++; if (cb.turn >= rows.length) { cb.turn = 0; cb.round++; }
    if (alive(rows[cb.turn])) break;
  }
  return cb;
}
export function removeRow(cb, id) {
  const i = cb.rows.findIndex(r => r.id === id); if (i < 0) return cb;
  cb.rows.splice(i, 1); if (i < cb.turn) cb.turn--; if (cb.turn >= cb.rows.length) cb.turn = 0;
  return cb;
}
export const CONDITIONS = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];

// ---------------------------------------------------------------- record + storage
export function blank() { return { v: 1, party: {}, creatures: [], enc: { diff: "moderate", picks: [], skip: [], n: 4, lv: 1 }, rw: { gp: 0, xp: 0, skip: [] }, combat: null }; }
export function clean(o) {
  const out = blank(); if (!o || typeof o !== "object") return out;
  if (o.party && typeof o.party === "object") Object.values(o.party).slice(0, 40).forEach(x => { const c = sanitizeCard(x); if (c) out.party[c.id] = c; });
  if (Array.isArray(o.creatures)) out.creatures = o.creatures.slice(0, 300).map(sanitizeCreature).filter(Boolean);
  if (o.enc && typeof o.enc === "object") {
    out.enc.diff = DIFFS.some(x => x[0] === o.enc.diff) ? o.enc.diff : "moderate";
    // A pick keeps its own copy of the creature (`c`), so a library monster needs no entry in the book.
    out.enc.picks = (Array.isArray(o.enc.picks) ? o.enc.picks : []).map(p => ({ cid: txt(p && p.cid, 60), qty: num(p && p.qty, 1, 99, 1), c: sanitizeCreature(p && p.c) }))
      .filter(p => p.cid && (p.c || out.creatures.some(c => c.id === p.cid))).slice(0, 60);
    out.enc.n = num(o.enc.n, 1, 12, 4); out.enc.lv = num(o.enc.lv, 1, 20, 1);
    out.enc.skip = (Array.isArray(o.enc.skip) ? o.enc.skip : []).map(x => txt(x, 24)).filter(Boolean).slice(0, 40);
  }
  if (o.rw && typeof o.rw === "object") {
    out.rw.gp = num(o.rw.gp, 0, 1e9, 0); out.rw.xp = num(o.rw.xp, 0, 1e9, 0);
    out.rw.skip = (Array.isArray(o.rw.skip) ? o.rw.skip : []).map(x => txt(x, 24)).filter(Boolean).slice(0, 40);
  }
  if (o.combat && typeof o.combat === "object" && Array.isArray(o.combat.rows)) {
    const rows = o.combat.rows.slice(0, 80).map(makeRow);
    out.combat = { id: txt(o.combat.id, 24) || uid(), round: num(o.combat.round, 1, 9999, 1), turn: num(o.combat.turn, 0, Math.max(0, rows.length - 1), 0), started: !!o.combat.started, rows };
  }
  return out;
}
export function load(store = globalThis.localStorage) { try { return clean(JSON.parse(store.getItem(KEY))); } catch (e) { return blank(); } }
export function save(d, store = globalThis.localStorage) { try { store.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } }
export const exportData = d => JSON.parse(JSON.stringify(d));
// A restore adds cards and creatures it does not have; the running combat and encounter on this device stay.
export function mergeImport(d, o) {
  const x = clean(o);
  Object.values(x.party).forEach(c => { const mine = d.party[c.id]; if (!mine || mine.at < c.at) d.party[c.id] = c; });
  x.creatures.forEach(c => { if (!d.creatures.some(m => m.id === c.id)) d.creatures.push(c); });
  return d;
}

// ---------------------------------------------------------------- encounter
// The creature a pick stands for: the book entry (so edits show), else the copy the pick carries.
export const pickCreature = (d, p) => d.creatures.find(x => x.id === p.cid) || p.c || null;
export function encounterXp(d) {
  return d.enc.picks.reduce((s, p) => { const c = pickCreature(d, p); return s + (c ? c.xp * p.qty : 0); }, 0);
}
// Add one of a creature to the encounter (or one more of the same).
export function addPick(d, cr) {
  const p = d.enc.picks.find(x => x.cid === cr.id);
  if (p) p.qty = Math.min(99, p.qty + 1); else d.enc.picks.push({ cid: cr.id, qty: 1, c: cr });
  return d;
}
// Levels that set the budget: the imported party minus anyone left out; with no party at all, n characters of level lv.
export function encounterLevels(d) {
  const all = Object.values(d.party); if (!all.length) return Array(d.enc.n).fill(d.enc.lv);
  return all.filter(c => !c.dead && !d.enc.skip.includes(c.id)).map(c => c.level);
}
// Add `count` of a creature to a fight. Names are numbered when there is more than one of a kind, continuing after
// any already there; a lone unnumbered one becomes "Name 1" when a second arrives.
export function addCreatures(cb, cr, count) {
  const base = cr.name, num1 = r => r.kind === "mon" && r.name.startsWith(base + " ") && /^\d+$/.test(r.name.slice(base.length + 1));
  const same = cb.rows.filter(r => r.kind === "mon" && (r.name === base || num1(r)));
  if (!same.length && count === 1) { cb.rows.push(rowFromCreature(cr, 0)); return cb; }
  same.forEach(r => { if (r.name === base) r.name = base + " 1"; });
  let top = same.reduce((m, r) => Math.max(m, r.name === base ? 1 : parseInt(r.name.slice(base.length + 1), 10) || 0), 0);
  for (let i = 0; i < count; i++) cb.rows.push(rowFromCreature(cr, ++top));
  return cb;
}
// Put the picked creatures into the fight.
export function addEncounterToCombat(d) {
  if (!d.combat) d.combat = newCombat();
  d.enc.picks.forEach(p => { const c = pickCreature(d, p); if (c) addCreatures(d.combat, c, p.qty); });
  return d;
}

// ---------------------------------------------------------------- rewards
// XP of the creatures marked defeated in the running fight (heroes never count).
export const defeatedXp = cb => (cb ? cb.rows.filter(r => r.kind === "mon" && r.out).reduce((s, r) => s + r.xp, 0) : 0);
export const defeatedCount = cb => (cb ? cb.rows.filter(r => r.kind === "mon" && r.out).length : 0);
// An even split; whatever does not divide stays with the DM.
export function splitEven(total, n) { n = Math.max(1, n | 0); total = Math.max(0, total | 0); return { each: Math.floor(total / n), left: total % n }; }
// Who shares a reward: the imported party minus anyone left out; with no party, n unnamed characters.
export function recipients(d) {
  const all = Object.values(d.party);
  if (!all.length) return { cards: [], n: d.enc.n };
  const cards = all.filter(c => !c.dead && !d.rw.skip.includes(c.id)); return { cards, n: cards.length };
}
// Level a character would reach with this much XP (thresholds passed in so this module stays free of rules.js).
export function levelFor(xp, table) { let lv = 1; table.forEach((t, i) => { if (xp >= t) lv = i + 1; }); return lv; }
