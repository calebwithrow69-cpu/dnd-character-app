import { fxList, fxStat, effectsReady } from "./effects.js";
// Equipment: slots, what fits where, armor stats, and gear-driven AC.
// Pure functions over a character — no DOM.

const mod = s => Math.floor((Number(s || 10) - 10) / 2);

// 2024 Player's Handbook armor table.
export const ARMOR = {
  "Padded Armor": { cat: "Light", base: 11, dexCap: null, stealth: true },
  "Leather Armor": { cat: "Light", base: 11, dexCap: null },
  "Studded Leather Armor": { cat: "Light", base: 12, dexCap: null },
  "Hide Armor": { cat: "Medium", base: 12, dexCap: 2 },
  "Chain Shirt": { cat: "Medium", base: 13, dexCap: 2 },
  "Scale Mail": { cat: "Medium", base: 14, dexCap: 2, stealth: true },
  "Breastplate": { cat: "Medium", base: 14, dexCap: 2 },
  "Half Plate Armor": { cat: "Medium", base: 15, dexCap: 2, stealth: true },
  "Ring Mail": { cat: "Heavy", base: 14, dexCap: 0, stealth: true },
  "Chain Mail": { cat: "Heavy", base: 16, dexCap: 0, str: 13, stealth: true },
  "Splint Armor": { cat: "Heavy", base: 17, dexCap: 0, str: 15, stealth: true },
  "Plate Armor": { cat: "Heavy", base: 18, dexCap: 0, str: 15, stealth: true },
  "Clothing": { cat: "None", base: null, dexCap: null }
};

// Order matters: check "studded leather" before "leather", "half plate" before "plate".
const ARMOR_PATTERNS = [
  [/studded leather/i, "Studded Leather Armor"], [/padded/i, "Padded Armor"], [/leather/i, "Leather Armor"],
  [/\bhide\b/i, "Hide Armor"], [/chain shirt/i, "Chain Shirt"], [/scale mail/i, "Scale Mail"],
  [/breastplate/i, "Breastplate"], [/half[\s-]?plate/i, "Half Plate Armor"], [/ring mail/i, "Ring Mail"],
  [/chain mail/i, "Chain Mail"], [/splint/i, "Splint Armor"], [/\bplate\b/i, "Plate Armor"]
];
export function armorTypeFromName(name) {
  for (const [re, key] of ARMOR_PATTERNS) if (re.test(name || "")) return key;
  return null;
}

export const SLOTS = [
  { key: "head", label: "Head" }, { key: "neck", label: "Neck" }, { key: "cloak", label: "Back" },
  { key: "armor", label: "Armor" }, { key: "ring1", label: "Ring" }, { key: "ring2", label: "Ring" },
  { key: "gloves", label: "Hands" }, { key: "belt", label: "Belt" }, { key: "boots", label: "Feet" },
  { key: "main", label: "Main hand" }, { key: "ranged", label: "Ranged" }, { key: "off", label: "Off hand" }
];
export const WEAR_CHOICES = [
  ["", "Not worn"], ["head", "Head"], ["neck", "Neck"], ["cloak", "Back (cloak or pack)"], ["armor", "Armor / body"],
  ["gloves", "Hands / wrists"], ["belt", "Belt"], ["boots", "Feet"], ["ring", "Ring"], ["shield", "Shield"]
];

const WEAR_PATTERNS = [
  [/\bring of\b|\bring\b(?! mail)/i, "ring"],
  [/amulet|necklace|periapt|medallion|pendant|talisman|brooch|scarab/i, "neck"],
  [/cloak|cape|mantle|\bbackpack\b|rucksack|knapsack/i, "cloak"],
  [/helm|\bhat\b|\bcap\b|circlet|crown|headband|diadem|goggles|\bmask\b|eyes of/i, "head"],
  [/gloves|gauntlets|bracers|bracelet/i, "gloves"],
  [/\bbelt\b|girdle|\bsash\b/i, "belt"],
  [/boots|slippers|\bshoes\b|sandals|greaves/i, "boots"],
  [/\brobe\b|vestments/i, "armor"]
];

// What kind of thing is this inventory item, for slot purposes?
export function wearKind(item) {
  if (item.slot === "none") return null;
  if (item.slot) return item.slot;
  if (item.weapon) return "weapon";
  if (/\bshield\b/i.test(item.name || "")) return "shield";
  if (item.armor || armorTypeFromName(item.name) || /\barmor\b/i.test(item.name || "")) return "armor";
  for (const [re, kind] of WEAR_PATTERNS) if (re.test(item.name || "")) return kind;
  return null;
}

const isTwoHanded = it => !!(it && it.weapon && /two-handed/i.test(it.weapon.props || ""));
const isLight = it => !!(it && it.weapon && /\blight\b/i.test(it.weapon.props || ""));

// Can `item` go in `slotKey`? Returns true, or a short reason string.
export function fits(item, slotKey, char) {
  const k = wearKind(item);
  if (!k) return "That item isn't worn or held";
  const main = itemById(char, char.equipment?.main);
  switch (slotKey) {
    case "ring1": case "ring2": return k === "ring" || "Only rings go here";
    case "main": return k === "weapon" || "Only weapons go in your hand";
    case "ranged": return (k === "weapon" && (item.weapon.kind === "Ranged" || /thrown/i.test(item.weapon.props || ""))) || "Only ranged or thrown weapons";
    case "off":
      if (isTwoHanded(main) && main.id !== item.id) return "Your main-hand weapon needs both hands";
      if (k === "shield") return true;
      if (k === "weapon") return isTwoHanded(item) ? "Two-handed weapons go in the main hand" : true;
      return "Shields or one-handed weapons only";
    default: return k === slotKey || `Doesn't go on your ${((SLOTS.find(s => s.key === slotKey) || {}).label || slotKey).toLowerCase()}`;
  }
}
export const fitsOk = (item, slot, char) => fits(item, slot, char) === true;

export function itemById(char, id) {
  return id ? (char.inventory || []).find(i => i.id === id) || null : null;
}
export function slotOf(char, id) {
  const eq = char.equipment || {};
  return Object.keys(eq).find(k => eq[k] === id) || null;
}
// Every slot this item is in (a stack of 2 daggers can fill 2 slots).
export function slotsOf(char, id) {
  const eq = char.equipment || {};
  return Object.keys(eq).filter(k => eq[k] === id);
}
export function attunedCount(char) {
  return (char.inventory || []).filter(i => i.attuned).length;
}
const active = it => it && (!it.attune || it.attuned);

export function armorStats(item) {
  const type = item?.armor?.type || armorTypeFromName(item?.name);
  return type ? { type, ...ARMOR[type] } : null;
}

// AC from what's worn. Falls back to the hand-entered numbers when no
// armor or shield is equipped (so older characters keep their AC).
export function computeAC(char) {
  const eq = char.equipment || {}, ac = char.ac || {};
  const dex = mod(char.abilities?.dex), con = mod(char.abilities?.con), wis = mod(char.abilities?.wis);
  const parts = [];
  if (ac.override != null && ac.override !== "") return { total: Number(ac.override), parts: [["Set by hand", Number(ac.override)]], mode: "override" };

  const armorItem = itemById(char, eq.armor);
  const offItem = itemById(char, eq.off);
  const shieldItem = offItem && wearKind(offItem) === "shield" ? offItem : null;
  let base, mode = "manual", warn = null;
  const a = armorItem ? armorStats(armorItem) : null;

  if (armorItem && a && a.base != null) {
    mode = "gear";
    const d = a.dexCap == null ? dex : Math.min(dex, a.dexCap);
    base = a.base + d;
    parts.push([armorItem.name, a.base]);
    if (a.cat !== "Heavy") parts.push([a.dexCap == null ? "Dex" : `Dex (max ${a.dexCap})`, d]);
    if (a.str && (char.abilities?.str || 10) < a.str) warn = `Needs Strength ${a.str}: −10 ft speed`;
  } else {
    if (armorItem && !a) warn = `Pick an armor type for ${armorItem.name} (tap it)`;
    const plain = () => {
      if (armorItem || shieldItem) { parts.push(["Unarmored", 10], ["Dex", dex]); mode = "gear"; return 10 + dex; }
      const capped = ac.dexCap != null && ac.dexCap !== "" ? Math.min(dex, Number(ac.dexCap)) : dex;
      parts.push([ac.armorName || "Base", Number(ac.base ?? 10)], ["Dex", capped]);
      return Number(ac.base ?? 10) + capped;
    };
    if (effectsReady()) {
      // Unarmored Defense and similar are data now: an "ac.base" effect with op "max" (see js/effects.js).
      base = plain();
      const shieldNow = !!shieldItem || !!(ac.shield && !eq.off);
      const st = fxStat(char, "ac.base", base, { armored: false, heavy: false, shield: shieldNow });
      const win = st.parts.filter(x => /better base|sets/.test(x[0])).pop();
      if (win && st.total > base) { base = st.total; parts.length = 0; parts.push([win[0].replace(/ \((better base|sets)\)$/, ""), base]); mode = "gear"; }
    } else if (char.class === "Barbarian") { base = 10 + dex + con; parts.push(["Unarmored Defense", 10], ["Dex", dex], ["Con", con]); mode = "gear"; }
    else if (char.class === "Monk" && !shieldItem) { base = 10 + dex + wis; parts.push(["Unarmored Defense", 10], ["Dex", dex], ["Wis", wis]); mode = "gear"; }
    else base = plain();
  }
  let total = base;
  if (armorItem && armorItem.magic && active(armorItem)) { total += +armorItem.magic; parts.push([`${armorItem.name} magic`, +armorItem.magic]); }
  if (shieldItem) {
    const s = 2 + (active(shieldItem) ? +(shieldItem.magic || 0) : 0);
    total += s; parts.push([shieldItem.name, s]);
  } else if (ac.shield && !eq.off) { total += 2; parts.push(["Shield", 2]); }
  Object.values(eq).forEach(id => {
    const it = itemById(char, id);
    if (it && it.acBonus && active(it)) { total += +it.acBonus; parts.push([it.name, +it.acBonus]); }
  });
  if (ac.bonus) { total += +ac.bonus; parts.push(["Other", +ac.bonus]); }
  const ctx = { armored: !!(armorItem && a && a.base != null), heavy: !!(a && a.cat === "Heavy"), shield: !!shieldItem || !!(ac.shield && !eq.off) };
  fxList(char, "ac", ctx).forEach(x => { total += x.v; parts.push([x.src, x.v]); });
  return { total, parts, mode, warn, stealthDis: !!(a && a.stealth), armored: ctx.armored, heavy: ctx.heavy, shield: ctx.shield };
}

export function gearSaveBonus(char) {
  return Object.values(char.equipment || {}).reduce((s, id) => {
    const it = itemById(char, id);
    return s + (it && it.saveBonus && active(it) ? +it.saveBonus : 0);
  }, 0);
}

export function weaponsOf(char) {
  const eq = char.equipment || {};
  const order = id => (eq.main === id ? 0 : eq.off === id ? 1 : eq.ranged === id ? 2 : 3);
  return (char.inventory || []).filter(i => i.weapon).sort((a, b) => order(a.id) - order(b.id));
}

// Build an inventory entry from a library/homebrew name, carrying over
// weapon stats, armor type and magic properties where we can tell.
export function makeItem(name, { weapons = [], items = [] } = {}, newId) {
  const w = weapons.find(x => x.name === name);
  const ref = items.find(x => x.name === name);
  const it = { id: newId(), name, qty: 1, notes: "" };
  if (w) {
    it.weapon = {
      dice: w.dice, dtype: w.dtype || "", kind: w.kind || "Melee", props: w.props || "", mastery: w.mastery || "",
      cat: w.cat || "", ability: null, magic: 0
    };
    if (w.ammoMax) it.weapon.ammo = { cur: w.ammoMax, max: w.ammoMax, name: w.ammoName || "Ammo" };
    if (w.text) it.text = w.text;
  }
  const t = armorTypeFromName(name);
  if (t && !/\bring\b(?! mail)/i.test(name)) it.armor = { type: t };
  const text = (ref && ref.text) || "";
  if (/requires attunement/i.test(text) || /\(requires attunement/i.test(ref?.type || "")) it.attune = true;
  if (/of protection/i.test(name)) { it.acBonus = 1; it.saveBonus = 1; it.attune = true; }
  const plus = /^\+(\d)\s|\s\+(\d)$/.exec(name);
  if (plus) it.weapon ? (it.weapon.magic = +(plus[1] || plus[2])) : (it.magic = +(plus[1] || plus[2]));
  return it;
}

// ---- item categories, for the inventory grid's icons and sorting ----
// Returns one of: weapon, armor, shield, potion, scroll, ring, wondrous, ammo, focus, tool, gear
export function itemCategory(it) {
  if (!it) return "gear";
  if (it.weapon) return "weapon";
  const n = (it.name || "").toLowerCase(), t = (it.type || "").toLowerCase();
  if (/\bshield\b/.test(n)) return "shield";
  if (it.armor || armorTypeFromName(it.name) || /\barmor\b|\bmail\b|breastplate|plate\b/.test(n)) return "armor";
  if (/potion|elixir|oil of|philter/.test(n) || /potion/.test(t)) return "potion";
  if (/scroll|spellbook|\bbook\b|\btome\b/.test(n)) return "scroll";
  if (/\bring\b/.test(n)) return "ring";
  if (/amulet|necklace|periapt|cloak|cape|boots|gloves|gauntlets|bracers|belt|helm|\bhat\b|circlet|crown|goggles|\bmask\b|wondrous/.test(n) || /wondrous/.test(t)) return "wondrous";
  if (/arrow|bolt|bullet|needle|dart\b|ammunition/.test(n)) return "ammo";
  if (/focus|holy symbol|wand\b|\brod\b|\bstaff\b|orb|crystal|sprig|totem/.test(n)) return "focus";
  if (/tools|supplies|utensils|kit\b|set\b|instrument|bagpipes|drum|flute|lute|lyre|horn|viol/.test(n)) return "tool";
  return "gear";
}
const CAT_ORDER = ["weapon", "armor", "shield", "ammo", "focus", "potion", "scroll", "ring", "wondrous", "tool", "gear"];
export const categoryRank = c => { const i = CAT_ORDER.indexOf(c); return i < 0 ? 99 : i; };

// A subtle per-species tint + build for the paper-doll figure.
// Keyed off size and a hash of the species name, so each race reads a little
// different (color + width + head size) without anything cartoonish.
export function speciesLook(species, size) {
  let h = 0; for (const ch of String(species || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const small = /small/i.test(size || "");
  const large = /large|huge/i.test(size || "");
  const scale = large ? 1.12 : small ? 0.82 : 1;
  const width = 1 + ((h >> 3) % 5 - 2) * 0.04;      // ±8% torso width
  const head = 1 + ((h >> 6) % 5 - 2) * 0.05;        // ±10% head
  return { hue, scale, width, head, sat: 20 + (h >> 9) % 18 };
}
