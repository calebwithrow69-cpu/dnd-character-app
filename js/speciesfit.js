// Loose species suggestions per class. A starting point, not a rule: any species works with any class.
// Names are the app's species names; a name that is not in the current ruleset is ignored.
const FIT = {
  Barbarian: ["Orc", "Dwarf", "Goliath", "Half-Troll", "Minotaur", "Bugbear", "Leonin", "Dragonborn", "Genasi (Earth)", "Lizardfolk", "Hobgoblin"],
  Fighter: ["Dwarf", "Orc", "Goliath", "Dragonborn", "Hobgoblin", "Githyanki", "Half-Troll", "Minotaur", "Bugbear", "Leonin", "Human", "Duergar", "Lizardfolk"],
  Paladin: ["Dwarf", "Aasimar", "Dragonborn", "Goliath", "Leonin", "Orc", "Human", "Genasi (Earth)", "Hobgoblin", "Githyanki", "Tiefling"],
  Monk: ["Githzerai", "Tabaxi", "Elf", "Halfling", "Kenku", "Shifter", "Simian", "Lizardfolk", "Human", "Aasimar", "Eladrin", "Shadar-Kai", "Ratfolk", "Goblin"],
  Rogue: ["Halfling", "Tabaxi", "Goblin", "Kenku", "Elf", "Shadar-Kai", "Ratfolk", "Bugbear", "Kobold", "Simian", "Gnome", "Tiefling"],
  Ranger: ["Elf", "Firbolg", "Shifter", "Tabaxi", "Lizardfolk", "Halfling", "Simian", "Bugbear", "Human", "Goblin"],
  Bard: ["Tiefling", "Satyr", "Eladrin", "Kenku", "Tabaxi", "Aasimar", "Dragonborn", "Gnome", "Halfling", "Human", "Dhampir", "Elf", "Kalashtar"],
  Sorcerer: ["Tiefling", "Dragonborn", "Aasimar", "Genasi (Air)", "Genasi (Earth)", "Genasi (Fire)", "Genasi (Water)", "Yuan-Ti", "Eladrin", "Kalashtar", "Shadar-Kai", "Dhampir", "Satyr", "Githyanki"],
  Warlock: ["Tiefling", "Dhampir", "Shadar-Kai", "Kalashtar", "Yuan-Ti", "Eladrin", "Deepborn", "Githyanki", "Satyr", "Human"],
  Wizard: ["Gnome", "Elf", "Eladrin", "Githyanki", "Githzerai", "Kalashtar", "Tiefling", "Deepborn", "Kobold", "Dhampir", "Human"],
  Cleric: ["Aasimar", "Dwarf", "Firbolg", "Kalashtar", "Genasi (Earth)", "Genasi (Water)", "Githzerai", "Dryad", "Human", "Elf", "Goliath", "Ardling"],
  Druid: ["Firbolg", "Dryad", "Elf", "Shifter", "Satyr", "Genasi (Earth)", "Genasi (Water)", "Genasi (Air)", "Gnome", "Ardling", "Human", "Lizardfolk", "Bullywug", "Halfling"]
};
export const speciesFit = (cls, species) => !!(FIT[cls] && FIT[cls].includes(species));
