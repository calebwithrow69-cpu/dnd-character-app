// Feat recommendations at a level-up. A starting point, not a rule: the picks are the app's reading
// of what usually helps each class, plus whether a feat raises the class's main ability.
// Names that are not in the current ruleset are ignored. ASCII only.
import { ABILITIES, ABILITY_LABEL } from "./rules.js";
import { featAbilityIncrease } from "./featfx.js";

const MAIN = { Barbarian: ["str"], Bard: ["cha"], Cleric: ["wis"], Druid: ["wis"], Fighter: ["str", "dex"], Monk: ["dex", "wis"], Paladin: ["str", "cha"], Ranger: ["dex", "wis"], Rogue: ["dex"], Sorcerer: ["cha"], Warlock: ["cha"], Wizard: ["int"] };
const PICKS = {
  Barbarian: ["Great Weapon Master", "Tough", "Alert", "Resilient", "Sentinel", "Savage Attacker", "Durable", "Athlete", "Crusher", "Slasher", "Heavy Armor Master"],
  Bard: ["War Caster", "Resilient", "Lucky", "Alert", "Inspiring Leader", "Fey-Touched", "Skill Expert", "Telepathic", "Observant", "Ritual Caster"],
  Cleric: ["War Caster", "Resilient", "Alert", "Tough", "Inspiring Leader", "Heavily Armored", "Lucky", "Telekinetic", "Fey-Touched"],
  Druid: ["War Caster", "Resilient", "Alert", "Tough", "Fey-Touched", "Lucky", "Observant", "Ritual Caster"],
  Fighter: ["Great Weapon Master", "Sharpshooter", "Polearm Master", "Crossbow Expert", "Sentinel", "Shield Master", "Tough", "Alert", "Resilient", "Lucky", "Savage Attacker"],
  Monk: ["Alert", "Tough", "Resilient", "Lucky", "Athlete", "Sentinel", "Speedy", "Skulker", "Observant", "Savage Attacker"],
  Paladin: ["Great Weapon Master", "Polearm Master", "Sentinel", "Shield Master", "War Caster", "Resilient", "Inspiring Leader", "Tough", "Alert", "Lucky", "Heavy Armor Master"],
  Ranger: ["Sharpshooter", "Crossbow Expert", "Alert", "Skulker", "Resilient", "Tough", "Lucky", "Observant", "War Caster", "Speedy", "Dual Wielder"],
  Rogue: ["Alert", "Skulker", "Sharpshooter", "Crossbow Expert", "Lucky", "Speedy", "Skill Expert", "Observant", "Resilient", "Tough", "Savage Attacker"],
  Sorcerer: ["War Caster", "Resilient", "Alert", "Fey-Touched", "Lucky", "Elemental Adept", "Spell Sniper", "Telekinetic", "Tough"],
  Warlock: ["War Caster", "Resilient", "Alert", "Fey-Touched", "Lucky", "Spell Sniper", "Elemental Adept", "Shadow-Touched", "Tough"],
  Wizard: ["War Caster", "Resilient", "Alert", "Lucky", "Fey-Touched", "Spell Sniper", "Elemental Adept", "Telekinetic", "Tough", "Keen Mind", "Ritual Caster"]
};
const TOP = 5;

// items: [{ f, ok, why }]. Returns a Map of feat name -> { score, why, top } for the feats worth showing first.
export function recommendFeats(c, items) {
  const picks = PICKS[c.class] || [];
  const ab = c.abilities || {};
  const main = (MAIN[c.class] || []).slice().sort((a, b) => (ab[b] || 0) - (ab[a] || 0))[0] || null;
  const mainScore = main ? ab[main] || 10 : 0;
  const scored = [];
  items.forEach(({ f, ok }) => {
    if (!ok) return;
    let score = 0, why = "";
    const i = picks.indexOf(f.name);
    if (i >= 0) { score += 60 - i * 4; why = `Fits ${c.class}`; }
    if (f.name === "Ability Score Improvement") {
      if (main && mainScore < 20) { score += 50 + (mainScore <= 18 ? 25 : 10); why = `Raises ${ABILITY_LABEL[main]} (${mainScore})`; }
      else if (ABILITIES.some(a => (ab[a] || 0) < 20)) score += 8;
    } else {
      const inc = featAbilityIncrease(f, c);
      if (inc && main && inc.options.includes(main) && mainScore < inc.cap) {
        score += 25 + (mainScore % 2 ? 12 : 0); why = `Raises ${ABILITY_LABEL[main]} (${mainScore})`;
      }
      if (f.name === "Resilient" && !(c.saveProf || []).includes("con")) { score += 12; if (!why) why = "Adds a saving throw"; }
    }
    if (score > 0) scored.push({ name: f.name, score, why });
  });
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const out = new Map();
  scored.forEach((s, k) => out.set(s.name, { score: s.score, why: s.why, top: k < TOP }));
  return out;
}
