// Loot box engine: odds, tier independence, classification, reel. Pure Node.
import assert from "node:assert/strict";
import { BOXES, RARITIES, effectiveOdds, rollRarity, classify, buildPools, pickItem, openBox, buildReel } from "../js/lootbox.js";

let n = 0; const t = (name, fn) => { fn(); n++; };
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

t("effective odds sum to 1 for every box", () => {
  for (const b of BOXES) { const o = effectiveOdds(b); assert.ok(Math.abs(RARITIES.reduce((a, r) => a + o[r], 0) - 1) < 1e-12, b.id); }
});
t("legendary effective odds equal its own chance", () => {
  for (const b of BOXES) assert.equal(effectiveOdds(b).legendary, b.chance.legendary);
});
t("changing a lower tier never moves legendary", () => {
  const a = { ...BOXES[0], chance: { ...BOXES[0].chance } }, b = { ...a, chance: { ...a.chance, uncommon: 0.6, rare: 0.01, epic: 0.2 } };
  assert.equal(effectiveOdds(a).legendary, effectiveOdds(b).legendary);
  // same rng stream: every roll that is legendary in one box is legendary in the other
  const r1 = lcg(7), r2 = lcg(7);
  for (let i = 0; i < 20000; i++) { const x = r1(), y = r2(); assert.equal(x < a.chance.legendary, x < b.chance.legendary && y === x); }
});
t("a rng of 0 is legendary, a rng near 1 is common", () => {
  assert.equal(rollRarity(BOXES[0], () => 0), "legendary");
  assert.equal(rollRarity(BOXES[0], () => 0.999999), "common");
});
t("observed frequencies match disclosed odds", () => {
  const N = 200000;
  for (const b of BOXES) {
    const rng = lcg(1234 + b.gp), seen = {}; RARITIES.forEach(r => { seen[r] = 0; });
    for (let i = 0; i < N; i++) seen[rollRarity(b, rng)]++;
    const o = effectiveOdds(b);
    for (const r of RARITIES) assert.ok(Math.abs(seen[r] / N - o[r]) < 0.004, `${b.id} ${r} ${seen[r] / N} vs ${o[r]}`);
  }
});
t("better boxes have better top-tier odds and cost more", () => {
  for (let i = 1; i < BOXES.length; i++) {
    assert.ok(BOXES[i].gp > BOXES[i - 1].gp);
    const a = effectiveOdds(BOXES[i - 1]), b = effectiveOdds(BOXES[i]);
    assert.ok(b.legendary > a.legendary && b.common < a.common);
  }
});
t("lowest box is about 60% common", () => { const c = effectiveOdds(BOXES[0]).common; assert.ok(c > 0.55 && c < 0.65, c); });
t("classify", () => {
  assert.equal(classify({ cat: "Gear", gp: 1 }), "common");
  assert.equal(classify({ cat: "Gear", gp: 50 }), "uncommon");
  assert.equal(classify({ cat: "Weapons", gp: 15 }), "uncommon");
  assert.equal(classify({ cat: "Armor", gp: 1500 }), "rare");
  assert.equal(classify({ cat: "Armor", gp: 10 }), "uncommon");
  assert.equal(classify({ cat: "Magic & potions", magic: true, gp: 120 }, "Uncommon"), "epic");
  assert.equal(classify({ cat: "Magic & potions", magic: true, gp: 0 }, "Very Rare"), "legendary");
  assert.equal(classify({ cat: "Magic & potions", magic: true, gp: 100 }, "Common"), "rare");
});
t("pools fill empty tiers and open returns an item of the rolled rarity", () => {
  const rows = [{ name: "Nail", rarity: "common" }, { name: "Sword", rarity: "uncommon" }, { name: "Ring", rarity: "legendary" }];
  const pools = buildPools(rows);
  assert.equal(pools.rare[0].name, "Sword"); assert.equal(pools.epic[0].name, "Sword");
  const rng = lcg(5);
  for (let i = 0; i < 500; i++) { const o = openBox(BOXES[2], pools, rng); assert.ok(o.item); }
  assert.equal(pickItem(pools, "legendary", () => 0).name, "Ring");
  assert.equal(pickItem({}, "legendary"), null);
});
t("reel puts the result at the stop and fills by the box odds", () => {
  const pools = buildPools([{ name: "A", rarity: "common" }, { name: "B", rarity: "uncommon" }]);
  const res = { rarity: "legendary", item: { name: "Z" } };
  const r = buildReel(BOXES[0], pools, res, lcg(9));
  assert.equal(r.strip.length, 44); assert.equal(r.strip[r.stop], res);
  assert.ok(r.strip.filter((x, i) => i !== r.stop).every(x => x.item));
});
t("an empty common pool borrows upward, never returns nothing", () => {
  const pools = buildPools([{ name: "Sword", rarity: "uncommon" }]);
  RARITIES.forEach(r => assert.equal(pickItem(pools, r, () => 0).name, "Sword"));
});
console.log(`lootbox: ${n} checks passed`);
