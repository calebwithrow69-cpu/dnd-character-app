// Spell effects: spells whose rules entry carries `effects` (a number on the sheet) can be applied to the
// character. An applied spell is {id, name, level, conc, effects} in `c.spellfx`; the effects engine reads it.
// An effect with `up: n` grows by n per slot level above the spell's own level. Pure, no DOM. ASCII only.
import { FX_TARGETS } from "./effects.js";

export const hasFx = sp => !!sp && Array.isArray(sp.effects) && sp.effects.length > 0;
export const spellsWithFx = lib => ((lib && lib.spells) || []).filter(hasFx).sort((a, b) => a.name.localeCompare(b.name));
export const upLevels = sp => (hasFx(sp) && sp.effects.some(e => e.up) ? [0, 1, 2].map(i => sp.level + i).filter(l => l <= 9) : []);

export function makeEntry(sp, lvl, id) {
  const lv = Math.max(sp.level || 1, Number(lvl) || sp.level || 1), up = sp.effects.some(e => e.up);
  return {
    id, name: sp.name + (up ? ` (level ${lv})` : ""), level: lv, conc: !!sp.conc,
    effects: sp.effects.map(e => { const { up: u, ...r } = e; return u && typeof e.v === "number" ? { ...r, v: e.v + u * (lv - (sp.level || 1)) } : { ...r }; })
  };
}
const sg = n => (n > 0 ? "+" : "") + n;
const TL = { ac: "AC", "ac.base": "Base AC", "ac.floor": "AC at least", speed: "Speed", "hp.max": "Max HP", atk: "Attacks", dmg: "Damage", "save.all": "Saves", init: "Initiative", pp: "Passive Perception", "spell.dc": "Spell DC", "spell.atk": "Spell attack" };
function label(e) {
  if (TL[e.t]) return TL[e.t];
  const f = FX_TARGETS.find(x => x[0] === e.t); if (f) return f[1];
  let m = /^skill\.(\w+)$/.exec(e.t); if (m) return m[1][0].toUpperCase() + m[1].slice(1);
  m = /^grant\.resist\.(.+)$/.exec(e.t); if (m) return "Resist " + m[1];
  m = /^grant\.sense\.(.+)$/.exec(e.t); if (m) return m[1];
  return e.t;
}
function value(e) {
  if (typeof e.v === "number") return e.op === "max" || e.op === "set" ? String(e.v) : sg(e.v);
  if (typeof e.v === "string") return "+" + e.v;
  if (e.t === "ac.base") return "13 + Dex";
  return "";
}
// "AC +2", "Max HP +5 (level 2)", "Resist Bludgeoning, Resist Piercing"
export function summary(effects) {
  return (effects || []).map(e => (label(e) + " " + (e.t.startsWith("grant.") && e.v == null ? "" : value(e))).trim()).join(", ");
}
