// Premade spell lists: a theme, a blurb and spell names. Names that are missing, off the class list or too high for the character are skipped when applied.
export const SPELL_LISTS = {
  Wizard: [
    { id: "w-blast", name: "Blaster", blurb: "Big damage and areas.", spells: ["Fire Bolt", "Ray of Frost", "Magic Missile", "Burning Hands", "Scorching Ray", "Fireball", "Lightning Bolt", "Ice Storm", "Cone of Cold"] },
    { id: "w-ctrl", name: "Controller", blurb: "Shape the fight.", spells: ["Mind Sliver", "Sleep", "Web", "Hold Person", "Slow", "Hypnotic Pattern", "Fear", "Polymorph", "Wall of Force"] },
    { id: "w-util", name: "Utility", blurb: "Scouting, travel, answers.", spells: ["Mage Hand", "Prestidigitation", "Detect Magic", "Find Familiar", "Identify", "Misty Step", "Fly", "Counterspell", "Dimension Door"] },
    { id: "w-def", name: "Defender", blurb: "Keep the party standing.", spells: ["Shield", "Mage Armor", "Absorb Elements", "Mirror Image", "Counterspell", "Dispel Magic", "Haste", "Fire Shield", "Stoneskin"] }
  ],
  Sorcerer: [
    { id: "s-blast", name: "Blaster", blurb: "Raw damage.", spells: ["Fire Bolt", "Chill Touch", "Magic Missile", "Burning Hands", "Scorching Ray", "Fireball", "Lightning Bolt", "Ice Storm", "Cone of Cold"] },
    { id: "s-face", name: "Face", blurb: "Talk and charm.", spells: ["Mind Sliver", "Charm Person", "Disguise Self", "Suggestion", "Hypnotic Pattern", "Fear", "Dominate Person", "Greater Invisibility"] },
    { id: "s-meta", name: "Mobile caster", blurb: "Stay alive and move.", spells: ["Shield", "Feather Fall", "Misty Step", "Haste", "Counterspell", "Fly", "Dimension Door", "Hold Person"] }
  ],
  Warlock: [
    { id: "k-eb", name: "Eldritch striker", blurb: "Pact slots and single targets.", spells: ["Eldritch Blast", "Hex", "Armor of Agathys", "Hellish Rebuke", "Misty Step", "Hold Person", "Counterspell", "Fear", "Banishment"] },
    { id: "k-ctrl", name: "Controller", blurb: "Lock enemies down.", spells: ["Eldritch Blast", "Hex", "Hold Person", "Darkness", "Fear", "Banishment", "Dimension Door"] }
  ],
  Cleric: [
    { id: "c-heal", name: "Healer", blurb: "Patch people up.", spells: ["Guidance", "Sacred Flame", "Cure Wounds", "Healing Word", "Bless", "Lesser Restoration", "Prayer of Healing", "Revivify", "Mass Healing Word", "Heal"] },
    { id: "c-war", name: "War cleric", blurb: "Fight on the front line.", spells: ["Toll the Dead", "Shield of Faith", "Guiding Bolt", "Spiritual Weapon", "Spirit Guardians", "Hold Person", "Banishment", "Flame Strike"] },
    { id: "c-supp", name: "Support", blurb: "Buffs and protection.", spells: ["Guidance", "Bless", "Protection from Evil and Good", "Aid", "Dispel Magic", "Beacon of Hope", "Death Ward", "Greater Restoration"] }
  ],
  Druid: [
    { id: "d-ctrl", name: "Controller", blurb: "Plants, terrain and crowds.", spells: ["Druidcraft", "Thorn Whip", "Entangle", "Fog Cloud", "Moonbeam", "Spike Growth", "Plant Growth", "Conjure Animals", "Ice Storm", "Wall of Fire"] },
    { id: "d-heal", name: "Healer", blurb: "Nature's medicine.", spells: ["Guidance", "Cure Wounds", "Healing Word", "Goodberry", "Lesser Restoration", "Aid", "Revivify", "Heal"] },
    { id: "d-blast", name: "Storm caller", blurb: "Damage from the sky.", spells: ["Produce Flame", "Thunderclap", "Thunderwave", "Call Lightning", "Sleet Storm", "Wind Wall", "Ice Storm", "Wall of Fire"] }
  ],
  Bard: [
    { id: "b-face", name: "Face", blurb: "Words as weapons.", spells: ["Vicious Mockery", "Minor Illusion", "Charm Person", "Disguise Self", "Suggestion", "Hypnotic Pattern", "Fear", "Dominate Person"] },
    { id: "b-supp", name: "Support", blurb: "Heal and inspire.", spells: ["Vicious Mockery", "Healing Word", "Dissonant Whispers", "Heroism", "Lesser Restoration", "Hold Person", "Mass Healing Word", "Dispel Magic", "Greater Invisibility"] }
  ],
  Paladin: [
    { id: "p-smite", name: "Smiter", blurb: "Burst damage on hit.", spells: ["Divine Smite", "Searing Smite", "Thunderous Smite", "Wrathful Smite", "Shield of Faith", "Aid", "Blinding Smite"] },
    { id: "p-guard", name: "Guardian", blurb: "Protect and cure.", spells: ["Bless", "Cure Wounds", "Shield of Faith", "Protection from Evil and Good", "Lesser Restoration", "Aid", "Revivify", "Aura of Vitality"] }
  ],
  Ranger: [
    { id: "r-hunt", name: "Hunter", blurb: "Mark and kill.", spells: ["Hunter's Mark", "Ensnaring Strike", "Hail of Thorns", "Conjure Animals", "Pass without Trace", "Conjure Barrage", "Spike Growth", "Cordon of Arrows"] },
    { id: "r-scout", name: "Scout", blurb: "Track and slip away.", spells: ["Goodberry", "Cure Wounds", "Fog Cloud", "Alarm", "Pass without Trace", "Locate Object", "Speak with Animals", "Silence"] }
  ]
};
export const listsFor = cls => SPELL_LISTS[cls] || [];
// What applying a list to a character does: add (new, allowed), have (already known), skip (missing, off the class list or too high).
export function listPlan(list, known, pool, cls, maxLevel) {
  const have = new Set(known), byName = new Map(pool.map(s => [s.name.toLowerCase(), s]));
  const out = { add: [], have: [], skip: [] };
  for (const n of list.spells) {
    const s = byName.get(n.toLowerCase());
    if (!s) { out.skip.push([n, "Not in your rules"]); continue; }
    if (have.has(s.name)) { out.have.push(s.name); continue; }
    const cl = String(s.classes || "");
    if (cl && !(Array.isArray(s.classes) ? s.classes : cl.split(/,\s*/)).includes(cls)) { out.skip.push([s.name, "Not a " + cls + " spell"]); continue; }
    if (s.level > maxLevel) { out.skip.push([s.name, "Level " + s.level + " is too high"]); continue; }
    out.add.push(s.name);
  }
  return out;
}
