// Long rest: rations, and the things a character may change when finishing one. No DOM in here.
import { subclassSpellTables, pickKey, syncSubclassSpells } from "./subclassspells.js";

// ---- rations: they stay ordinary bag items (so they weigh something); the count is read from the bag
export const isRation = it => !!it && !it.weapon && /^rations?(?:\s*\(.*\))?$/i.test(String(it.name || ""));
export const rationsHave = c => (c.inventory || []).filter(isRation).reduce((n, it) => n + Math.max(0, it.qty || 0), 0);
export const rationsNeed = c => (Number.isFinite(c.restRations) ? Math.max(0, Math.min(9, Math.floor(c.restRations))) : 1);
// Takes n rations out of the bag. Returns false (and takes nothing) when there are not enough.
export function spendRations(c, n) {
  if (n <= 0) return true;
  if (rationsHave(c) < n) return false;
  let left = n;
  for (const it of (c.inventory || []).filter(isRation)) { const take = Math.min(it.qty || 0, left); it.qty -= take; left -= take; if (!left) break; }
  return true;
}

// ---- what can be changed on a long rest
const PREPARES = new Set(["Cleric", "Druid", "Paladin", "Ranger", "Wizard"]);
// Returns rows the long rest screen shows, each already at its current value:
//   pick: choose one of several (a subclass spell list), `required` = nothing chosen yet
//   swap: replace one of your choices with another (a weapon mastery)
//   note: a reminder with a shortcut
export function restOptions(L, c, weapons = []) {
  const out = [];
  const sc = c.subclass && (L.subclasses || []).find(s => s.name === c.subclass && s.cls === c.class);
  const t = sc ? subclassSpellTables(sc, L) : null;
  if (t && t.choices.length) {
    const current = (c.choices || {})[pickKey(sc.name)] || "";
    out.push({ kind: "pick", id: "list", label: `${sc.name}: spell list`, current, required: true,
      options: t.choices.map(o => ({ v: o.name, hint: o.rows.filter(r => r.lv <= (c.level || 1)).flatMap(r => r.spells).join(", ") })) });
  }
  if ((c.masteries || []).length) {
    const have = c.masteries.slice(), taken = new Set(have);
    out.push({ kind: "swap", id: "mastery", label: "Weapon mastery", have, choices: weapons.filter(w => w.mastery && !taken.has(w.name)).map(w => w.name).sort() });
  }
  if (PREPARES.has(c.class)) out.push({ kind: "note", id: "prepared", label: "Prepared spells", text: "You can change your prepared spells after this rest.", action: "lrSpells", button: "Open spells" });
  return out;
}

// Applies the player's picks (sel) when the rest finishes. Anything untouched stays as it was; a required pick
// that was never made is chosen at random. Returns { log, random }.
export function applyRestPicks(c, L, sel = {}, weapons = [], rand = Math.random) {
  const log = [], random = [];
  restOptions(L, c, weapons).forEach(o => {
    if (o.kind === "pick") {
      let v = sel[o.id] || o.current;
      if (!v && o.required && o.options.length) { v = o.options[Math.floor(rand() * o.options.length)].v; random.push(`${o.label}: ${v}`); }
      if (v && v !== o.current) { c.choices = c.choices || {}; const sc = c.subclass; c.choices[pickKey(sc)] = v; log.push(`${o.label}: ${v}`); }
    } else if (o.kind === "swap") {
      const drop = sel["mastery.drop"], add = sel["mastery.add"];
      if (drop && add && o.have.includes(drop) && o.choices.includes(add)) { c.masteries = c.masteries.map(n => n === drop ? add : n); log.push(`Weapon mastery: ${drop} → ${add}`); }
    }
  });
  const gained = syncSubclassSpells(c, L);
  if (gained.length) log.push(`Subclass spells: ${gained.join(", ")}`);
  return { log, random };
}
