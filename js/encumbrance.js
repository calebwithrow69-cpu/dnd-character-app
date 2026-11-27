// Encumbrance (variant rule): weight carried against Strength x 5 / x 10 / x 15. Pure. ASCII only.
// The bar and tier always show; the penalties only apply when the character has `encumbrance` switched on.
import { carried } from "./weights.js";

const ABS = ["str", "dex", "con", "int", "wis", "cha"];
export const TIERS = [
  { key: "light", label: "Light", note: "No penalty" },
  { key: "enc", label: "Encumbered", note: "Speed -10 ft" },
  { key: "heavy", label: "Heavily encumbered", note: "Speed -20 ft. Disadvantage on attacks, ability checks, Str, Dex and Con saves" },
  { key: "over", label: "Over capacity", note: "Speed 5 ft. Disadvantage on attacks, ability checks, Str, Dex and Con saves" }
];

// The tier at a given total weight (lb), for "what if" previews.
export function encTierFor(c, total) {
  const s = Math.max(1, (c.abilities && c.abilities.str) || 10);
  const i = total > s * 15 ? 3 : total > s * 10 ? 2 : total > s * 5 ? 1 : 0;
  return { ...TIERS[i], i, total, marks: [s * 5, s * 10, s * 15] };
}
export const encTier = c => encTierFor(c, carried(c).total);

export function encumbranceEffects(c) {
  if (!c.encumbrance) return [];
  const t = encTier(c), out = [], base = Number(c.speed) || 30;
  if (t.i === 1) out.push({ t: "speed", op: "add", v: -10, src: t.label });
  if (t.i === 2) out.push({ t: "speed", op: "add", v: -20, src: t.label });
  if (t.i === 3) out.push({ t: "speed", op: "add", v: -Math.max(0, base - 5), src: t.label });
  if (t.i >= 2) {
    out.push({ t: "atk", op: "dis", src: t.label });
    ABS.forEach(a => out.push({ t: "check." + a, op: "dis", src: t.label }));
    ["str", "dex", "con"].forEach(a => out.push({ t: "save." + a, op: "dis", src: t.label }));
  }
  return out;
}
