import { computeAC, gearSaveBonus } from "./gear.js";
import { fxList, fxSum, rollMods } from "./effects.js";
import { attackCtx } from "./attackctx.js";

// Pure D&D 2024 rules helpers. No DOM, no state — math and tables only,
// so the sheet, dice and wizard all compute numbers the same way.

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_LABEL = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma"
};
export const ABILITY_SHORT = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
export const ABILITY_BY_LABEL = {
  Strength: "str", Dexterity: "dex", Constitution: "con",
  Intelligence: "int", Wisdom: "wis", Charisma: "cha"
};

export const SKILLS = [
  { id: "acrobatics", label: "Acrobatics", ability: "dex" },
  { id: "animal", label: "Animal Handling", ability: "wis" },
  { id: "arcana", label: "Arcana", ability: "int" },
  { id: "athletics", label: "Athletics", ability: "str" },
  { id: "deception", label: "Deception", ability: "cha" },
  { id: "history", label: "History", ability: "int" },
  { id: "insight", label: "Insight", ability: "wis" },
  { id: "intimidation", label: "Intimidation", ability: "cha" },
  { id: "investigation", label: "Investigation", ability: "int" },
  { id: "medicine", label: "Medicine", ability: "wis" },
  { id: "nature", label: "Nature", ability: "int" },
  { id: "perception", label: "Perception", ability: "wis" },
  { id: "performance", label: "Performance", ability: "cha" },
  { id: "persuasion", label: "Persuasion", ability: "cha" },
  { id: "religion", label: "Religion", ability: "int" },
  { id: "sleight", label: "Sleight of Hand", ability: "dex" },
  { id: "stealth", label: "Stealth", ability: "dex" },
  { id: "survival", label: "Survival", ability: "wis" }
];

export const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible",
  "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"
];

export function skillIdByLabel(label) {
  const hit = SKILLS.find(s => s.label.toLowerCase() === String(label || "").trim().toLowerCase());
  return hit ? hit.id : null;
}

// The imported library stores some list fields as Python repr strings
// ("['Insight', 'Religion']") rather than JSON arrays. This reads either.
export function parseList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string" || !v.trim()) return [];
  const matches = v.match(/'([^']*)'|"([^"]*)"/g);
  if (!matches) return v.split(",").map(s => s.trim()).filter(Boolean);
  return matches.map(m => m.slice(1, -1));
}

// "Wisdom", "Strength or Dexterity" -> first ability key found.
export function primaryAbility(primaryText) {
  const m = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/.exec(primaryText || "");
  return m ? ABILITY_BY_LABEL[m[1]] : null;
}

// Species traits carry a line like "Speed: 30 feet".
export function speciesSpeed(traits) {
  const m = /Speed:\s*(\d+)/i.exec(traits || "");
  return m ? parseInt(m[1], 10) : 30;
}
export function speciesSize(traits) {
  const m = /Size:\s*([A-Za-z]+)/i.exec(traits || "");
  return m ? m[1] : "";
}

export function abilityMod(score) {
  return Math.floor((Number(score || 10) - 10) / 2);
}
export function fmtMod(n) {
  n = Number(n) || 0;
  return (n >= 0 ? "+" : "−") + Math.abs(n);
}
export function proficiencyBonus(level) {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

// Standard spell slot tables, [character level] -> slots per spell level.
const FULL = {
  1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3],
  7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1], 15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
};
// 2024 Paladins and Rangers get slots from level 1.
const HALF = {
  1: [2], 2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3],
  9: [4, 3, 2], 10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1],
  14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2], 17: [4, 3, 3, 3, 1],
  18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2]
};
const PACT = {
  1: [1, 1], 2: [2, 1], 3: [2, 2], 4: [2, 2], 5: [2, 3], 6: [2, 3], 7: [2, 4], 8: [2, 4],
  9: [2, 5], 10: [2, 5], 11: [3, 5], 12: [3, 5], 13: [3, 5], 14: [3, 5], 15: [3, 5],
  16: [3, 5], 17: [4, 5], 18: [4, 5], 19: [4, 5], 20: [4, 5]
};
export const CASTER_TYPE = {
  Bard: "full", Cleric: "full", Druid: "full", Sorcerer: "full", Wizard: "full",
  Paladin: "half", Ranger: "half", Warlock: "pact"
};
const CAST_ABILITY = {
  Bard: "cha", Cleric: "wis", Druid: "wis", Sorcerer: "cha", Wizard: "int",
  Paladin: "cha", Ranger: "wis", Warlock: "cha"
};
export function spellcastingAbility(className) { return CAST_ABILITY[className] || null; }

const clampLevel = l => Math.min(20, Math.max(1, Number(l) || 1));

// Unified slot list: [{level, max, pact}] — pact slots are one row at the pact level.
export function slotRows(className, level) {
  const type = CASTER_TYPE[className];
  if (!type) return [];
  const lv = clampLevel(level);
  if (type === "pact") {
    const [count, slotLevel] = PACT[lv];
    return [{ level: slotLevel, max: count, pact: true }];
  }
  const table = type === "full" ? FULL : HALF;
  return (table[lv] || []).map((max, i) => ({ level: i + 1, max, pact: false }));
}

// Which ability a weapon swings with. A stored str/dex choice wins;
// Finesse uses the better of the two; otherwise ranged = Dex, melee = Str.
export function weaponAbilityMod(weapon, abilities) {
  const str = abilityMod(abilities.str), dex = abilityMod(abilities.dex);
  if (weapon.ability === "str") return str;
  if (weapon.ability === "dex") return dex;
  if (weapon.ability === "fin" || /finesse/i.test(weapon.props || "")) return Math.max(str, dex);
  return weapon.kind === "Ranged" ? dex : str;
}

export function rollDie(sides) {
  if (window.crypto && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    // rejection sampling so every face is exactly equally likely
    const limit = Math.floor(0x100000000 / sides) * sides;
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return 1 + (buf[0] % sides);
  }
  return 1 + Math.floor(Math.random() * sides);
}

// Everything derived from a character's saved state. Nothing here is ever
// stored, so derived numbers can't go stale.
export function deriveCharacter(char) {
  const level = char.level || 1;
  const prof = proficiencyBonus(level);
  const mods = {};
  ABILITIES.forEach(a => { mods[a] = abilityMod(char.abilities?.[a] ?? 10); });

  const acInfo = computeAC(char);
  const acTotal = acInfo.total;
  const ctx = { armored: acInfo.armored, heavy: acInfo.heavy, shield: acInfo.shield };
  const fx = t => fxList(char, t, ctx);

  const saveItems = gearSaveBonus(char);
  const saves = {};
  ABILITIES.forEach(a => { saves[a] = mods[a] + ((char.saveProf || []).includes(a) ? prof : 0) + saveItems + fxSum(fx(["save." + a, "save.all"])); });

  const skills = SKILLS.map(s => {
    const proficient = (char.skillProf || []).includes(s.id);
    const expert = (char.skillExpertise || []).includes(s.id);
    const extra = fxSum(fx(["skill." + s.id, "skill.all"])) + (!proficient && !expert ? fxSum(fx("skill.nonprof")) : 0);
    const bonus = mods[s.ability] + (expert ? prof * 2 : proficient ? prof : 0) + extra;
    return { ...s, proficient, expert, bonus };
  });
  const perception = skills.find(s => s.id === "perception").bonus;

  const castAbility = spellcastingAbility(char.class);
  const spellInfo = castAbility ? {
    ability: castAbility, mod: mods[castAbility],
    dc: 8 + prof + mods[castAbility] + fxSum(fx("spell.dc")), attackBonus: prof + mods[castAbility] + fxSum(fx("spell.atk")),
    slots: slotRows(char.class, level)
  } : null;

  const speedFx = fx("speed"), initFx = fx("init");
  const speed = (Number(char.speed) || 30) + fxSum(speedFx);
  const initiative = mods.dex + Number(char.initBonus || 0) + fxSum(initFx);
  return {
    level, prof, mods, saves, skills, ac: acTotal, acInfo, spellInfo, speed, speedFx, initFx,
    initiative,
    passivePerception: 10 + perception + fxSum(fx("pp"))
  };
}

// Attack: d20 + ability + proficiency + magic. Damage: dice + ability + magic.
// (Proficiency never adds to damage.)
export function weaponNumbers(weapon, char) {
  const d = deriveCharacter(char);
  const ctx = attackCtx(char, weapon);
  const abil = ctx.abilMod;
  const magic = Number(weapon.magic || 0);
  const proficient = weapon.prof !== false;
  const atk = rollMods(char, "atk", ctx), dm = rollMods(char, "dmg", ctx);
  // The extra attack with a second Light weapon does not add the ability modifier (unless it is negative).
  const dmgAbil = ctx.wield.dual ? Math.min(0, abil) : abil;
  const adv = [...atk.adv], dis = [...atk.dis];
  return {
    toHit: abil + (proficient ? d.prof : 0) + magic + atk.flat,
    dmgMod: dmgAbil + magic + dm.flat,
    dice: weapon.dice || "1d4",
    extraDice: dm.dice.filter(x => !x.once),
    riders: { atk: atk.riders, dmg: dm.riders },
    reroll: dm.reroll,
    adv, dis, parts: { atk: atk.parts, dmg: dm.parts }, ctx
  };
}

export function standardArray(primary) {
  const order = [primary, "con", "dex", "wis", "int", "cha", "str"].filter(Boolean);
  const unique = [...new Set(order)].slice(0, 6);
  const vals = [15, 14, 13, 12, 10, 8];
  const out = {};
  unique.forEach((a, i) => { out[a] = vals[i]; });
  ABILITIES.forEach(a => { if (out[a] == null) out[a] = 8; });
  return out;
}

// Suggested standard-array spread per class (2024 Player's Handbook, chapter 2).
// Campaign file can override with campaign.suggestedArrays = { Fighter: { str: 15, ... } }.
export const SUGGESTED_ARRAYS = {
  Barbarian: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  Bard: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 15 },
  Cleric: { str: 14, dex: 8, con: 13, int: 10, wis: 15, cha: 12 },
  Druid: { str: 8, dex: 12, con: 14, int: 13, wis: 15, cha: 10 },
  Fighter: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 },
  Monk: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 },
  Paladin: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 },
  Ranger: { str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 },
  Rogue: { str: 12, dex: 15, con: 13, int: 14, wis: 10, cha: 8 },
  Sorcerer: { str: 10, dex: 13, con: 14, int: 8, wis: 12, cha: 15 },
  Warlock: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
  Wizard: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 }
};

export function roll4d6DropLowest() {
  const r = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => b - a);
  return r[0] + r[1] + r[2];
}

export function hpAverageGain(hitDie, conMod) {
  return Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
}

// XP needed to reach each level (index 0 = level 1). 2024 rules / SRD 5.2.
export const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const xpForLevel = lv => XP_TABLE[Math.max(1, Math.min(20, lv)) - 1];

// ---- Armor and weapon training as check boxes (c.profs) ----
export const PROF_GROUPS = [
  ["armor", "Armor", [["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"], ["shield", "Shields"]]],
  ["weapons", "Weapons", [["simple", "Simple"], ["martial", "Martial"]]]
];
// Reads the older free-text training line: returns the boxes it implies and what is left over (tools, special rules).
export function parseProfs(text) {
  let t = String(text || "");
  const profs = { armor: [], weapons: [] };
  const take = (re, grp, key) => { if (re.test(t)) { profs[grp].push(key); t = t.replace(re, "\u0001"); } };
  const keep = [];
  t = t.replace(/Martial weapons that have[^.,]*/gi, m => { keep.push(m.trim()); return "\u0002"; });
  take(/\bLight(?:\s+armou?r)?\b/i, "armor", "light"); take(/\bMedium(?:\s+armou?r)?\b/i, "armor", "medium");
  take(/\bHeavy(?:\s+armou?r)?\b/i, "armor", "heavy"); take(/\bShields?\b/i, "armor", "shield");
  take(/\bSimple\b(?:\s+weapons?)?/i, "weapons", "simple"); take(/\bMartial\b(?:\s+weapons?)?/i, "weapons", "martial");
  t = t.replace(/(?:\band\s+)?[\u0001\u0002](?:\s*(?:,|\band\b)?\s*[\u0001\u0002])*/g, " ").replace(/\s+/g, " ").replace(/(\s*[,.]\s*){2,}/g, ". ").replace(/^[\s,.]+|[\s,.]+$/g, "");
  const rest = [...(t ? [t] : []), ...keep].join(". ");
  return { profs, rest };
}
export function profsString(c) {
  const p = c.profs || { armor: [], weapons: [] };
  const names = PROF_GROUPS.flatMap(([g, , opts]) => opts.filter(([k]) => (p[g] || []).includes(k)).map(([, l]) => (g === "armor" ? l + (l === "Shields" ? "" : " armor") : l + " weapons")));
  return [...names, c.profsText].filter(Boolean).join(". ");
}
