// Loot boxes (experimental feature): the pure part. No DOM, no storage. ASCII only.
// A box rolls its rarity in tiers, top down: legendary first, then epic among what is left, and so on.
// Each tier has its own chance, so changing one tier never moves the tiers above it.
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
export const RARITY_LABEL = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

// chance = the tier's own roll, made only when every tier above it missed (common takes the rest).
// Prices differ a little so a better box costs more; change them here.
export const BOXES = [
  { id: "crate", name: "Worn Crate", gp: 40, chance: { legendary: 0.005, epic: 0.04, rare: 0.12, uncommon: 0.30 } },
  { id: "chest", name: "Iron-Bound Chest", gp: 50, chance: { legendary: 0.015, epic: 0.07, rare: 0.18, uncommon: 0.35 } },
  { id: "coffer", name: "Gilded Coffer", gp: 65, chance: { legendary: 0.04, epic: 0.12, rare: 0.25, uncommon: 0.40 } }
];
export const boxById = id => BOXES.find(b => b.id === id) || null;
export const boxByName = name => BOXES.find(b => b.name === name) || null;

// The odds a player is shown: what each rarity ends up at, after the tiers above have missed.
export function effectiveOdds(box) {
  const out = {}; let left = 1;
  for (const r of [...RARITIES].reverse()) {
    if (r === "common") { out[r] = left; break; }
    const p = box.chance[r] || 0;
    out[r] = left * p; left *= 1 - p;
  }
  return out;
}
export function oddsText(p) { const v = p * 100; return (v < 10 ? +v.toFixed(2) : +v.toFixed(1)) + "%"; }

// Tiered roll. rng() returns [0,1). Returns a rarity.
export function rollRarity(box, rng = Math.random) {
  for (const r of [...RARITIES].reverse()) {
    if (r === "common") return "common";
    if (rng() < (box.chance[r] || 0)) return r;
  }
  return "common";
}

// Which rarity an item belongs to. row = a shop row ({name, gp, cat, magic}); rarityText = the book rarity of a magic item.
export function classify(row, rarityText = "") {
  const gp = +row.gp || 0, rt = String(rarityText || "");
  if (row.magic || /magic|potion/i.test(row.sub || "") || rt) {
    if (/very rare|legendary/i.test(rt)) return "legendary";
    if (/uncommon|\brare\b/i.test(rt)) return "epic";
    if (/\bcommon\b/i.test(rt)) return "rare";
    return gp >= 500 ? "legendary" : "epic";
  }
  if (row.cat === "Weapons") return gp >= 100 ? "rare" : "uncommon";
  if (row.cat === "Armor") return gp >= 200 ? "rare" : "uncommon";
  if (gp >= 100) return "rare";
  if (gp > 25) return "uncommon";
  return "common";
}

// rows: [{name, gp, rarity}] -> {common: [...], ...}. An empty tier borrows from the nearest filled one.
export function buildPools(rows) {
  const pools = {}; RARITIES.forEach(r => { pools[r] = []; });
  rows.forEach(r => { if (pools[r.rarity]) pools[r.rarity].push(r); });
  RARITIES.forEach((r, i) => {
    if (pools[r].length) return;
    for (let d = 1; d < RARITIES.length; d++) { const near = pools[RARITIES[i - d]] || pools[RARITIES[i + d]]; if (near && near.length) { pools[r] = near; return; } }
  });
  return pools;
}
export function pickItem(pools, rarity, rng = Math.random) {
  const list = pools[rarity] || [];
  return list.length ? list[Math.floor(rng() * list.length) % list.length] : null;
}
// One full open: rarity first, then an item of that rarity.
export function openBox(box, pools, rng = Math.random) {
  const rarity = rollRarity(box, rng);
  return { rarity, item: pickItem(pools, rarity, rng) };
}
// A reel strip for the spin: filler drawn by the box's own odds (no staged near misses), the result at index `stop`.
export function buildReel(box, pools, result, rng = Math.random, n = 44, stop = 38) {
  const strip = [];
  for (let i = 0; i < n; i++) strip.push(i === stop ? result : openBox(box, pools, rng));
  return { strip, stop };
}
