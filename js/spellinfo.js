// What a spell's text says about its area, its role and its numbers. Pure (no DOM).
import { analyzeSpell, castDice } from "./spells.js";

export const SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
export const NUMERAL = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
export const schoolKey = s => String(s || "").toLowerCase().replace(/[^a-z]/g, "") || "none";

// 2024 area wording: "20-foot-radius Sphere", "15-foot Cone", "60-foot-long, 5-foot-wide Line", "10-foot Cube", "10-foot Emanation",
// "10-foot-radius, 40-foot-high Cylinder". Returns every match with its position in the given text.
const FT = "(\\d+)[- ]?foot";
const AREA_RE = new RegExp([
  `${FT}[- ]radius,?\\s*${FT}[- ]?(?:high|tall) Cylinder`,
  `${FT}[- ]?(?:high|tall),?\\s*${FT}[- ]radius,?\\s*Cylinder`,
  `${FT}[- ]radius Sphere`,
  `${FT}[- ]radius Cylinder`,
  `${FT}[- ]long,?\\s*${FT}[- ]wide Line`,
  `${FT}[- ]wide,?\\s*${FT}[- ]long Line`,
  `${FT}[- ]Cube`,
  `${FT}[- ]Cone`,
  `${FT}[- ]Emanation`,
  `${FT}[- ]Line`
].join("|"), "gi");

function parseArea(m) {
  const raw = m[0], t = raw.toLowerCase(), n = m.slice(1).filter(x => x != null).map(Number);
  if (/cylinder/.test(t)) { const tallFirst = /^\d+[- ]?foot[- ]?(?:high|tall)/.test(t); return { shape: "cylinder", r: tallFirst ? n[1] : n[0], h: tallFirst ? n[0] : n[1], raw }; }
  if (/sphere/.test(t)) return { shape: "sphere", r: n[0], raw };
  if (/line/.test(t)) { const wideFirst = /^\d+[- ]?foot[- ]wide/.test(t); return { shape: "line", len: n.length > 1 ? (wideFirst ? n[1] : n[0]) : n[0], wid: n.length > 1 ? (wideFirst ? n[0] : n[1]) : 5, raw }; }
  if (/cube/.test(t)) return { shape: "cube", size: n[0], raw };
  if (/cone/.test(t)) return { shape: "cone", size: n[0], raw };
  return { shape: "emanation", r: n[0], raw };
}

export function areasIn(text) {
  const out = [], s = String(text || "");
  AREA_RE.lastIndex = 0;
  let m;
  while ((m = AREA_RE.exec(s))) out.push({ ...parseArea(m), at: m.index });
  return out;
}
export const areaOf = sp => areasIn(sp && sp.text)[0] || null;
export const areaKey = a => a ? [a.shape, a.r || a.size || a.len || 0, a.h || a.wid || 0].join("_") : "";

// Wrap each area phrase in already-escaped HTML as a button that opens the grid diagram.
export function highlightAreas(html) {
  AREA_RE.lastIndex = 0;
  return String(html).replace(AREA_RE, raw => {
    const m = new RegExp(AREA_RE.source, "i").exec(raw); if (!m) return raw;
    const a = parseArea(m);
    return `<button class="areahit" data-a="areaShow" data-shape="${a.shape}" data-r="${a.r || 0}" data-size="${a.size || 0}" data-len="${a.len || 0}" data-wid="${a.wid || 0}" data-h="${a.h || 0}" title="Show on a grid">${raw}</button>`;
  });
}

const COND = /\b(Blinded|Charmed|Deafened|Frightened|Grappled|Incapacitated|Paralyzed|Petrified|Poisoned|Prone|Restrained|Stunned|Unconscious|Invisible)\b|speed (?:becomes|is reduced)|difficult terrain|can't (?:move|take)/;
// Rough reading of what a spell is for: Damage, Healing, Control, Buff, Utility.
export function rolesOf(sp) {
  if (Array.isArray(sp.tags) && sp.tags.length) { const set = sp.tags.map(t => String(t).trim().toLowerCase()); const r = ROLES.filter(x => set.includes(x.toLowerCase())); if (r.length) return r; }
  const t = String(sp.text || ""), a = analyzeSpell(sp), r = [];
  if (a.damage || /\b\w+ damage\b/.test(t) && /damage/i.test(t) && !/damage Resistance/i.test(t) && /takes?|taking|deals?/i.test(t)) r.push("Damage");
  if (a.heal || /regains? (?:\d+d\d+|a number of) Hit Points|Temporary Hit Points/i.test(t)) r.push("Healing");
  if (COND.test(t) && /saving throw/i.test(t) || /\bcharmed|frightened|restrained\b/i.test(t) && /saving throw/i.test(t)) r.push("Control");
  if (/\badvantage\b|bonus to|\+\d+ bonus|gains? (?:a )?bonus|Resistance to|Temporary Hit Points|Armor Class (?:of|equals|becomes)|\bhaste\b/i.test(t) && !r.includes("Control") || /willing creature/i.test(t)) r.push("Buff");
  if (!r.length) r.push("Utility");
  return r;
}
export const ROLES = ["Damage", "Healing", "Control", "Buff", "Utility"];

export function damageTypes(sp) {
  const out = new Set();
  for (const m of String(sp.text || "").matchAll(/\b(Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder) damage/g)) out.add(m[1]);
  return [...out];
}
export const DAMAGE_TYPES = ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"];

export function rangeFeet(sp) {
  const r = String(sp.range || "").toLowerCase();
  if (/^self/.test(r)) return 0;
  if (/^touch/.test(r)) return 1;
  const m = /([\d,]+)\s*(feet|foot|mile)/.exec(r);
  if (!m) return 9999;
  return parseInt(m[1].replace(/,/g, ""), 10) * (m[2] === "mile" ? 5280 : 1);
}

// Everything the browser filters and sorts on, computed once per spell.
const cache = new WeakMap();
export function spellFacts(sp) {
  if (cache.has(sp)) return cache.get(sp);
  const a = analyzeSpell(sp), area = areaOf(sp);
  const f = { school: sp.school || "", level: sp.level || 0, area, shape: area ? area.shape : "", roles: rolesOf(sp), dmg: damageTypes(sp), save: a.save || "", attack: !!a.attack,
    conc: !!sp.conc, ritual: !!sp.ritual, range: rangeFeet(sp), time: /bonus/i.test(sp.time || "") ? "Bonus" : /reaction/i.test(sp.time || "") ? "Reaction" : /^action/i.test(sp.time || "") ? "Action" : "Other" };
  cache.set(sp, f);
  return f;
}

// Damage or healing by slot level (leveled spells) or by character level (cantrips): [[label, dice]], or [] when the text has no scaling.
export function scaleRows(sp) {
  const a = analyzeSpell(sp), base = a.damage ? a.damage.dice : a.heal ? a.heal.dice : "";
  if (!base) return [];
  if (sp.level === 0) return a.cantripScale ? [1, 5, 11, 17].map(l => ["Level " + l, castDice(base, a, { charLevel: l, slotLevel: 0, spellLevel: 0 })]) : [];
  if (!a.upcast) return [];
  const out = [];
  for (let l = sp.level; l <= 9; l++) out.push([["", "1st", "2nd", "3rd"][l] || l + "th", castDice(base, a, { charLevel: 1, slotLevel: l, spellLevel: sp.level })]);
  return out;
}

// A material component with a gold price: { gp, min (the "+" in "300+ GP"), consumed, text }, or null. Only the first price is read.
export function matCost(sp) {
  const comp = String((sp && sp.comp) || "");
  if (!/\bM\b/.test(comp)) return null;
  const m = /(\d[\d,]*)(\+)?[,\s]*GP/i.exec(comp);
  if (!m) return null;
  return { gp: parseInt(m[1].replace(/,/g, ""), 10), min: !!m[2], consumed: /consum/i.test(comp), text: comp.replace(/^.*?\bM\s*\(+/, "").replace(/\)+\s*$/, "") };
}
