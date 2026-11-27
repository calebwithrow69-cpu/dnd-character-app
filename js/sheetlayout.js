// Layout of the Classic Sheet page: which blocks show and in what order. Pure (no DOM).
// Stored per device in prefs.sheetLayout = { preset, blocks: [{id, on}] }. Every read goes through layoutOf, so bad data cannot break the page.
export const BLOCKS = [
  { id: "identity", label: "Identity", about: "Class, subclass, species, background", wide: true },
  { id: "status", label: "Status", about: "Inspiration, size, hit dice, death saves", wide: true },
  { id: "abilities", label: "Abilities and skills", about: "Six cards: score, save and the skills under each", wide: true },
  { id: "favorites", label: "Favorites", about: "Your one-tap attacks, spells, items and abilities", wide: true },
  { id: "physical", label: "Physical traits", about: "Age, height, weight, eyes, hair, skin" },
  { id: "allies", label: "Allies and organizations", about: "Free notes on who you travel with" },
  { id: "statweb", label: "Stat web", about: "Radar of the six scores, tap to roll" },
  { id: "skills", label: "Saves and skills list", about: "One searchable list, as on the Stats page" },
  { id: "weapons", label: "Weapons and damage", about: "Attacks and cantrips" },
  { id: "spellcasting", label: "Spellcasting", about: "Ability, DC, attack bonus, slots", caster: true },
  { id: "senses", label: "Senses and defenses", about: "Passives, senses, resistances" },
  { id: "trackers", label: "Trackers", about: "Limited-use counters and rations" },
  { id: "equipped", label: "Equipped", about: "Armor class, attunement, worn gear, weight" },
  { id: "coins", label: "Coins", about: "Purse with add and spend" },
  { id: "feats", label: "Feats", about: "Your feats, tap to read" },
  { id: "profs", label: "Proficiencies and languages", about: "Armor, weapons, tools, languages" },
  { id: "details", label: "Character details", about: "Alignment, appearance, backstory" }
];
export const PRESETS = [
  { id: "printed", label: "Character sheet", about: "Only what other tabs do not show", on: ["identity", "status", "favorites", "abilities", "senses", "physical", "profs", "details", "allies"] },
  { id: "web", label: "Stat web", about: "Radar, then saves and skills", on: ["status", "favorites", "statweb", "skills", "senses", "physical", "profs", "details", "allies"] },
  { id: "numbers", label: "Numbers", about: "Scores, saves, skills, proficiencies", on: ["status", "abilities", "senses", "profs"] },
  { id: "caster", label: "Caster", about: "Spells up front", on: ["status", "favorites", "spellcasting", "abilities", "trackers", "senses"] },
  { id: "combat", label: "Combat", about: "Attacks and counters first", on: ["status", "favorites", "weapons", "trackers", "abilities", "senses", "spellcasting"] },
  { id: "full", label: "Everything", about: "Every block, repeats included", on: ["identity", "status", "favorites", "abilities", "weapons", "spellcasting", "senses", "trackers", "equipped", "coins", "feats", "physical", "profs", "details", "allies"] }
];
const IDS = BLOCKS.map(b => b.id);
export const blockOf = id => BLOCKS.find(b => b.id === id);

// A preset as a full list: its blocks on in its order, the rest off after them.
export function presetBlocks(id) {
  const p = PRESETS.find(x => x.id === id) || PRESETS[0];
  return [...p.on.map(i => ({ id: i, on: true })), ...IDS.filter(i => !p.on.includes(i)).map(i => ({ id: i, on: false }))];
}

// Clean layout: known blocks once each, anything missing appended off, at least one block on.
export function layoutOf(prefs) {
  const raw = prefs && prefs.sheetLayout && typeof prefs.sheetLayout === "object" ? prefs.sheetLayout : {};
  const preset = PRESETS.some(p => p.id === raw.preset) ? raw.preset : "printed";
  let blocks = Array.isArray(raw.blocks) ? raw.blocks.filter(b => b && IDS.includes(b.id)).filter((b, i, a) => a.findIndex(x => x.id === b.id) === i).map(b => ({ id: b.id, on: b.on !== false })) : null;
  if (!blocks || !blocks.length) return { preset, blocks: presetBlocks(preset), custom: false };
  IDS.forEach(i => { if (!blocks.some(b => b.id === i)) blocks.push({ id: i, on: false }); });
  if (!blocks.some(b => b.on)) blocks = presetBlocks(preset);
  const base = presetBlocks(preset);
  const custom = blocks.some((b, i) => b.id !== base[i].id || b.on !== base[i].on);
  return { preset, blocks, custom };
}

export function moveBlock(layout, id, dir) {
  const b = layout.blocks.map(x => ({ ...x })), i = b.findIndex(x => x.id === id), j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= b.length) return b;
  [b[i], b[j]] = [b[j], b[i]];
  return b;
}
// Turning the last visible block off is refused (returns null).
export function toggleBlock(layout, id) {
  const b = layout.blocks.map(x => x.id === id ? { ...x, on: !x.on } : { ...x });
  return b.some(x => x.on) ? b : null;
}

// The Favorites bar lives on the Sheet page of the Classic sheet when that block is shown; otherwise Play keeps it.
export function favoritesOnSheet(prefs) {
  return prefs && prefs.sheetStyle !== "advanced" && layoutOf(prefs).blocks.some(b => b.id === "favorites" && b.on);
}
