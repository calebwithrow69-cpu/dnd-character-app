// Carrying weight in pounds for common gear, taken from the SRD 5.2 equipment tables (CC-BY-4.0, credit in Settings).
// Items that are not listed show no weight and are left out of the total. A character's own item can carry `weight`.
const W = {
  // simple melee
  "club": 2, "dagger": 1, "greatclub": 10, "handaxe": 2, "javelin": 2, "light hammer": 2, "mace": 4, "quarterstaff": 4, "sickle": 2, "spear": 3,
  // simple ranged
  "dart": .25, "light crossbow": 5, "shortbow": 2, "sling": 0,
  // martial melee
  "battleaxe": 4, "flail": 2, "glaive": 6, "greataxe": 7, "greatsword": 6, "halberd": 6, "lance": 6, "longsword": 3, "maul": 10, "morningstar": 4, "pike": 18,
  "rapier": 2, "scimitar": 3, "shortsword": 2, "trident": 4, "war pick": 2, "warhammer": 5, "whip": 3,
  // martial ranged
  "blowgun": 1, "hand crossbow": 3, "heavy crossbow": 18, "longbow": 2, "musket": 10, "pistol": 3,
  // armor
  "padded armor": 8, "leather armor": 10, "studded leather armor": 13, "hide armor": 12, "chain shirt": 20, "scale mail": 45, "breastplate": 20, "half plate armor": 40,
  "ring mail": 40, "chain mail": 55, "splint armor": 60, "plate armor": 65, "shield": 6,
  // adventuring gear
  "backpack": 5, "bedroll": 7, "rope": 5, "torch": 1, "rations": 2, "waterskin": 5, "healer's kit": 3, "tinderbox": 1, "crowbar": 5, "hooded lantern": 2, "bullseye lantern": 2,
  "lamp": 1, "ladder": 25, "mess kit": 1, "sack": .5, "shovel": 5, "hammer": 3, "piton": .25, "chain": 10, "manacles": 6, "caltrops": 2, "ball bearings": 2, "oil": 1,
  "book": 5, "spellbook": 3, "component pouch": 2, "crystal": 1, "orb": 3, "rod": 2, "staff": 4, "wand": 1, "amulet": 1, "emblem": 0, "reliquary": 2,
  "sprig of mistletoe": 0, "totem": 0, "wooden staff": 4, "yew wand": 1, "thieves' tools": 1, "quiver": 1,
  "potion of healing": .5, "case, map or scroll": 1, "map case": 1, "bell": 0, "candle": 0, "chalk": 0, "fishing tackle": 4, "flask": 1, "jug": 4, "pot, iron": 10, "iron pot": 10, "tent": 20,
  "holy symbol (amulet)": 1, "holy symbol (emblem)": 0, "holy symbol (reliquary)": 2, "arcane focus (crystal)": 1, "arcane focus (orb)": 3, "arcane focus (rod)": 2, "arcane focus (staff)": 4, "arcane focus (wand)": 1, "druidic focus (sprig of mistletoe)": 0, "druidic focus (totem)": 0, "druidic focus (wooden staff)": 4, "druidic focus (yew wand)": 1, "musical instrument": 3, "lute": 2, "flute": 1, "drum": 3, "horn": 2, "lyre": 2, "pan flute": 2, "shawm": 1, "viol": 1, "dulcimer": 10,
  "artisan's tools": 5, "herbalism kit": 3, "navigator's tools": 2, "poisoner's kit": 2, "disguise kit": 3, "forgery kit": 5, "gaming set": 0, "alchemist's supplies": 8, "brewer's supplies": 9, "calligrapher's supplies": 5,
  "carpenter's tools": 6, "cartographer's tools": 6, "cobbler's tools": 5, "cook's utensils": 8, "glassblower's tools": 5, "jeweler's tools": 2, "leatherworker's tools": 5, "mason's tools": 8, "painter's supplies": 5,
  "potter's tools": 3, "smith's tools": 8, "tinker's tools": 10, "weaver's tools": 5, "woodcarver's tools": 5, "vehicles (land or water)": 0,
  // packs
  "burglar's pack": 46.5, "diplomat's pack": 39, "dungeoneer's pack": 61.5, "entertainer's pack": 38, "explorer's pack": 55, "priest's pack": 29, "scholar's pack": 22
};
const clean = n => String(n || "").toLowerCase().replace(/^\s*[+-]\d+\s+/, "").replace(/\s+[+-]\d+\s*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
const lookup = n => { const full = String(n || "").toLowerCase().trim(); if (full in W) return W[full]; const k = clean(n); return k in W ? W[k] : (k.endsWith("s") && k.slice(0, -1) in W ? W[k.slice(0, -1)] : null); };

// Weight of ONE of the item, in lb, or null if unknown.
export function unitWeight(it) {
  if (typeof it.weight === "number") return it.weight;
  const w = lookup(it.name);
  if (w != null) return w;
  return it.weapon && it.weapon.base ? lookup(it.weapon.base) : null;
}
export const fmtLb = n => (Math.round(n * 100) / 100).toString().replace(/\.0+$/, "") + " lb";

// { total, unknown, coins, capacity } for a character. Coins weigh 1 lb per 50. Capacity is Strength x 15.
export function carried(c) {
  let total = 0, unknown = 0;
  (c.inventory || []).forEach(it => { const u = unitWeight(it); if (u == null) { unknown++; return; } total += u * (it.qty == null ? 1 : it.qty); });
  const coins = Object.values(c.coins || {}).reduce((a, n) => a + (+n || 0), 0) / 50;
  return { total: total + coins, unknown, coins, capacity: (c.abilities?.str || 10) * 15 };
}
