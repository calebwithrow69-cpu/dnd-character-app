// What an attack looks like to the effects engine: which hand, which kind of weapon, which
// ability. Fighting styles, Rage, Unarmed Strike options and the like read this context.
// Pure, no DOM. ASCII only.
import { unarmedOptions, diceAverage, fxStat } from "./effects.js";

// Attacks you can make with one Attack action (Extra Attack and its upgrades come from the rules as `attacks` effects).
export const attacksPerAction = c => Math.max(1, fxStat(c, "attacks", 1).total);

const modOf = s => Math.floor((Number(s || 10) - 10) / 2);
const has = (props, re) => re.test(String(props || ""));

// Which ability key a weapon swings with (a stored str/dex wins; Finesse takes the better one).
export function weaponAbilKey(weapon, abilities) {
  const a = abilities || {};
  if (weapon.ability === "str" || weapon.ability === "dex") return weapon.ability;
  if (weapon.ability === "fin" || has(weapon.props, /finesse/i)) return modOf(a.dex) > modOf(a.str) ? "dex" : "str";
  if (weapon.ability && /^(con|int|wis|cha)$/.test(weapon.ability)) return weapon.ability;
  return weapon.kind === "Ranged" ? "dex" : "str";
}

const heldWeapons = c => {
  const eq = c.equipment || {}, inv = c.inventory || [];
  return ["main", "off"].map(k => inv.find(i => i.id === eq[k])).filter(i => i && i.weapon);
};

// Context for one weapon (an object from c.inventory[].weapon, or a virtual unarmed one).
export function attackCtx(char, weapon) {
  const props = weapon.props || "", eq = char.equipment || {}, inv = char.inventory || [];
  const abilKey = weaponAbilKey(weapon, char.abilities), abilMod = modOf((char.abilities || {})[abilKey]);
  const toggles = (char.active || []).map(a => a.id);
  const held = heldWeapons(char), shield = !!(char.ac && char.ac.shield);
  if (weapon.unarmed) {
    return { attack: ["unarmed", "melee"], abil: abilKey, abilMod, toggles,
      wield: { unarmed: true, melee: true, oneHanded: true, alone: !held.length && !shield } };
  }
  const me = inv.find(i => i.weapon === weapon), isOff = !!me && eq.off === me.id;
  const other = held.find(i => i !== me);
  const light = has(props, /\blight\b/i), versatile = has(props, /versatile/i);
  // A Versatile weapon counts as both: swung in one hand, or in two when the other hand is free.
  const twoHanded = has(props, /two-handed/i) || (versatile && !other && !shield);
  const melee = weapon.kind !== "Ranged";
  return {
    attack: ["weapon", melee ? "melee" : "ranged"], abil: abilKey, abilMod, toggles,
    wield: {
      melee, ranged: !melee, twoHanded, oneHanded: !has(props, /two-handed/i), alone: !other, light, finesse: has(props, /finesse/i),
      thrown: has(props, /thrown/i), versatile,
      // the extra attack with a second Light weapon (no ability modifier on its damage unless negative)
      dual: !!(isOff && other && light && has(other.weapon.props, /\blight\b/i))
    }
  };
}

// Virtual attack entries for Unarmed Strike. A character has ONE Unarmed Strike: when a species trait,
// feat or feature says "instead of the normal damage", the best of those replaces the plain 1 + Str
// (`via` names where it comes from). Only an option marked `separate` (a different attack with its own
// action cost, like the Shifter's Longtooth) gets a row of its own. Same shape as an inventory weapon item.
export function unarmedWeapons(char) {
  const probe = attackCtx(char, { unarmed: true, ability: "str" });
  const score = o => diceAverage(o.dice || "0") + (o.flat || 0) + modOf((char.abilities || {})[o.abil]);
  const best = {};
  unarmedOptions(char, probe).forEach(o => {
    const cur = best[o.src];
    if (!cur || diceAverage(o.dice) > diceAverage(cur.dice)) best[o.src] = o;
  });
  const all = Object.values(best);
  let main = { src: "Unarmed Strike", dice: null, flat: 1, dtype: "bludgeoning", abil: "str" };
  all.filter(o => !o.separate).forEach(o => { if (score(o) > score(main)) main = o; });
  const rows = [main, ...all.filter(o => o.separate)];
  return rows.map((o, i) => ({
    id: "unarmed:" + (i ? o.src : "base"), name: i ? o.src : "Unarmed Strike", qty: 1, virtual: true,
    weapon: { dice: o.dice || "1", dtype: o.dtype, kind: "Melee", props: "", ability: o.abil, magic: 0, unarmed: true, prof: true, mastery: "", cat: "Unarmed", via: o.src === "Unarmed Strike" ? "" : o.src }
  }));
}
export const isUnarmedId = id => String(id || "").startsWith("unarmed:");
