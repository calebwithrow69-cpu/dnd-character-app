// Reads a spell's rules text for what casting it should roll: spell attack
// or saving throw, damage/healing dice, cantrip scaling and upcasting.
// The 2024 wording is consistent enough that plain patterns work; anything
// we can't read just casts without a roll.

const ABIL = "Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma";

export function analyzeSpell(sp) {
  const t = String(sp?.text || "").replace(/\s+/g, " ");
  const attack = /\bmelee spell attack\b/i.test(t) ? "Melee spell attack" : /\bspell attack\b/i.test(t) ? "Ranged spell attack" : null;
  const sv = new RegExp(`\\b(${ABIL}) saving throw`, "i").exec(t);
  const dmg = /(\d+d\d+)(\s*\+\s*(\d+|your spellcasting ability modifier))?\s+([A-Z][a-z]+) damage/.exec(t);
  const heal = /regains? (?:a number of )?Hit Points equal to (\d+d\d+)( plus your spellcasting ability modifier)?/i.exec(t);
  const up = /(?:damage|healing) increases by (\d+)d(\d+) for each (?:spell )?slot level above (\d)/i.exec(t);
  const half = /half as much damage on a successful/i.test(t);
  const scale = sp?.level === 0 && /increases by \d+d\d+ when you reach levels? 5/i.test(t);
  return {
    attack, save: sv ? sv[1] : null, half,
    damage: dmg ? { dice: dmg[1], flat: dmg[3] && /^\d+$/.test(dmg[3]) ? +dmg[3] : 0, addMod: /spellcasting/.test(dmg[3] || ""), type: dmg[4] } : null,
    heal: heal ? { dice: heal[1], addMod: !!heal[2] } : null,
    upcast: up ? { n: +up[1], die: +up[2], base: +up[3] } : null,
    cantripScale: scale
  };
}

// Dice string for this cast: cantrips scale at 5/11/17, upcasting adds dice.
export function castDice(base, info, { charLevel, slotLevel, spellLevel }) {
  const m = /^(\d+)d(\d+)$/.exec(base);
  if (!m) return base;
  let n = +m[1];
  const die = +m[2];
  if (info.cantripScale) n *= 1 + (charLevel >= 5) + (charLevel >= 11) + (charLevel >= 17);
  if (info.upcast && slotLevel > spellLevel && info.upcast.die === die) n += info.upcast.n * (slotLevel - spellLevel);
  return `${n}d${die}`;
}
