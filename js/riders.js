// Things a character can add to a roll: Lucky's advantage before a d20, Primal
// Strike's extra damage after a weapon hit, and so on. Each entry is the app's
// reading of the rules text; the player can always ignore it. No DOM in here.
// ASCII only.
import { findByName } from "./data.js";
import { trackersOf } from "./effects.js";

export const pbOf = level => Math.ceil((level || 1) / 4) + 1;
const modOf = s => Math.floor((Number(s || 10) - 10) / 2);

// Lucky gives Luck Points equal to the Proficiency Bonus. Keep a tracker for them.
const PB_TRACKERS = [
  { name: "Luck Points", note: "From the Lucky feat", when: c => (c.feats || []).some(f => /^Lucky\b/.test(f)) },
  { name: "Fury of the Small", note: "Goblin trait: extra damage equal to your Proficiency Bonus", when: c => c.species === "Goblin" }
];
export function ensureLuck(c) {
  const pb = pbOf(c.level);
  trackersOf(c).forEach(t => {
    const r = (c.resources || []).find(x => x.name === t.name);
    if (!r) c.resources.push({ name: t.name, max: t.max, used: 0, reset: t.reset || "long", note: t.note || "" });
    else if (r.max !== t.max) { r.max = t.max; r.used = Math.min(r.used, t.max); }
  });
  PB_TRACKERS.forEach(t => {
    if (!t.when(c)) return;
    const r = (c.resources || []).find(x => x.name === t.name);
    if (!r) c.resources.push({ name: t.name, max: pb, used: 0, reset: "long", note: t.note });
    else if (r.max !== pb) { r.max = pb; r.used = Math.min(r.used, pb); }
  });
}

// Ways to reroll a die on this roll. mode "die" = pick one die and reroll it (the new roll stands),
// "set" = roll the damage dice again and keep the better set, "d20" = reroll the d20.
// ctx: { weapon, piercing, hasD20, hasDmg }
export function rerollsFor(c, ctx) {
  const out = [];
  if (c.inspiration) out.push({ id: "insp", label: "Heroic Inspiration", mode: "die", any: true, insp: true, note: "Reroll one die. You must use the new roll." });
  const has = n => (c.feats || []).some(f => f === n || f.startsWith(n + " ("));
  if (ctx.weapon && ctx.hasDmg && has("Savage Attacker")) out.push({ id: "savage", label: "Savage Attacker", mode: "set", once: true, note: "Once per turn: roll the weapon's damage dice twice, keep the better." });
  if (ctx.piercing && ctx.hasDmg && has("Piercer")) out.push({ id: "piercer", label: "Piercer", mode: "die", once: true, note: "Once per turn: reroll one damage die and use the new roll." });
  if (ctx.hasD20 && c.species === "Halfling") out.push({ id: "hlf", label: "Halfling Lucky", mode: "d20", onNat1: true, note: "Reroll the 1. You must use the new roll." });
  return out;
}

function hasFeature(app, c, name) {
  const L = app.library, cls = findByName(L.classes, c.class), sub = c.subclass ? findByName(L.subclasses, c.subclass) : null;
  const pool = [...((cls && cls.features) || []), ...((sub && sub.features) || [])];
  return pool.some(f => f.name === name && f.lv <= c.level) || (c.feats || []).includes(name);
}

export function starryOn(c) { return (c.active || []).some(a => /Starry Form/.test(a.id)); }

// ctx: { kind: "weapon" | "spell" | "check", cantrip, heal }
// Returns { pre, attack, damage }: arrays of { id, label, note, dice?, flat?, once?, adv?, res? }.
export function ridersFor(app, c, d, ctx) {
  const out = { pre: [], attack: [], damage: [] };
  const wis = modOf(c.abilities && c.abilities.wis);
  const luck = (c.resources || []).find(r => r.name === "Luck Points");
  if (luck && luck.max - luck.used > 0) {
    out.pre.push({ id: "lucky", label: "Lucky: Advantage", note: `${luck.max - luck.used} Luck Point${luck.max - luck.used === 1 ? "" : "s"} left`, adv: true, res: "Luck Points" });
  }
  const pb = pbOf(c.level), fury = (c.resources || []).find(r => r.name === "Fury of the Small");
  if (c.species === "Goblin" && !ctx.heal && (ctx.kind === "weapon" || ctx.kind === "spell") && fury && fury.max - fury.used > 0) {
    out.damage.push({ id: "fury", label: "Fury of the Small", flat: pb, note: `Target is larger than you. ${fury.max - fury.used} use${fury.max - fury.used === 1 ? "" : "s"} left`, res: "Fury of the Small" });
  }
  if (ctx.kind === "weapon" && c.class === "Druid" && hasFeature(app, c, "Elemental Fury") && c.furyChoice !== "Potent Spellcasting") {
    out.damage.push({ id: "primal", label: "Primal Strike", dice: "1d8", note: "Cold, Fire, Lightning or Thunder. Once per turn, on a hit.", once: true });
  }
  if (ctx.kind === "spell" && ctx.cantrip && !ctx.heal && c.class === "Druid" && hasFeature(app, c, "Elemental Fury") && c.furyChoice === "Potent Spellcasting") {
    out.damage.push({ id: "potent", label: "Potent Spellcasting", flat: wis, note: "Add your Wisdom modifier to Druid cantrip damage." });
  }
  if (ctx.kind === "spell" && ctx.heal && starryOn(c)) {
    out.damage.push({ id: "chalice", label: "Chalice", dice: c.level >= 10 ? "2d8" : "1d8", flat: wis, note: "Starry Form: you or a creature within 30 feet also regains this much." });
  }
  return out;
}
