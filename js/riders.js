// Things a character can add to a roll: Lucky's advantage before a d20, Primal
// Strike's extra damage after a weapon hit, and so on. Each entry is the app's
// reading of the rules text; the player can always ignore it. No DOM in here.
// ASCII only.
import { findByName } from "./data.js";

export const pbOf = level => Math.ceil((level || 1) / 4) + 1;
const modOf = s => Math.floor((Number(s || 10) - 10) / 2);

// Lucky gives Luck Points equal to the Proficiency Bonus. Keep a tracker for them.
export function ensureLuck(c) {
  if (!(c.feats || []).some(f => /^Lucky\b/.test(f))) return;
  const pb = pbOf(c.level);
  const r = (c.resources || []).find(x => x.name === "Luck Points");
  if (!r) c.resources.push({ name: "Luck Points", max: pb, used: 0, reset: "long", note: "From the Lucky feat" });
  else if (r.max !== pb) { r.max = pb; r.used = Math.min(r.used, pb); }
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
