// Rules-engine conformance tests: pure Node, no browser, runs in a second.
// Each case writes a real 5e ability as DATA (the same JSON the DM block editor will produce)
// and checks the engine's numbers. When an ability is "misread", fix its data, not the code.
//   node tests/engine.test.mjs                (also checks data/library.json effects if unlocked)
import { readFileSync, existsSync } from "node:fs";
import { isSustained } from "../js/combat.js";
import { rerollsFor, ensureLuck } from "../js/riders.js";
import { weaponNumbers } from "../js/rules.js";
import { unarmedWeapons, attacksPerAction } from "../js/attackctx.js";
import { computeAC } from "../js/gear.js";
import { setEffectsSource, collectEffects, fxList, fxSum, fxStat, rollMods, grantsOf, hpParts, evalExpr, evalDice, diceAverage, validateEffect } from "../js/effects.js";

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.log("FAIL " + name + " - " + e.message); } };
const eq = (a, b, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

const FEATS = {
  Hearty: [{ t: "hp.max", v: { perLevel: 1 } }],
  Tough: [{ t: "hp.max", v: { perLevel: 2 } }],
  Alert: [{ t: "init", v: { prof: true }, name: "Alert" }],
  Defense: [{ t: "ac", v: 1, when: "armored" }],
  Dueling: [{ t: "dmg", v: 2, when: { all: [{ attack: "weapon" }, { wield: "melee" }, { wield: "oneHanded" }, { not: { wield: "dual" } }] } }],
  Archery: [{ t: "atk", v: 2, when: { all: [{ attack: "weapon" }, { attack: "ranged" }] } }],
  "Great Weapon Fighting": [{ t: "dmg", op: "reroll", v: { max: 2 }, when: { all: [{ wield: "melee" }, { wield: "twoHanded" }] } }],
  Hunter: [{ t: "dmg", v: { dice: "1d4", steps: [[9, "2d4"], [16, "4d4"]] }, once: true, name: "Quick Strike" }, { t: "hp.max", v: { perLevel: 1 } }],
  Bloodied: [{ t: "ac", v: 1, when: { hpBelow: 0.5 } }]
};
const CLASSES = [
  { name: "Barbarian", features: [
    { name: "Fast Movement", lv: 5, effects: [{ t: "speed", v: 10, when: "notHeavy" }] },
    { name: "Danger Sense", lv: 2, effects: [{ t: "save.dex", op: "adv" }] },
    { name: "Unarmored Defense", lv: 1, effects: [{ t: "ac.base", op: "max", v: { add: [10, { abil: "dex" }, { abil: "con" }] }, when: { armor: "none" } }] },
    { name: "Rage", lv: 1, effects: [{ t: "dmg", v: { steps: [[1, 2], [9, 3], [16, 4]] }, when: { all: [{ toggle: "Rage" }, { attack: "melee" }] } }] },
    { name: "Resist", lv: 1, effects: [{ t: "grant.resist.bludgeoning", op: "grant", when: { toggle: "Rage" } }] } ] },
  { name: "Monk", features: [
    { name: "Unarmored Movement", lv: 2, effects: [{ t: "speed", v: { steps: [[2, 10], [6, 15], [10, 20], [14, 25], [18, 30]] }, when: "unarmoredNoShield" }] },
    { name: "Unarmored Defense", lv: 1, effects: [{ t: "ac.base", op: "max", v: { add: [10, { abil: "dex" }, { abil: "wis" }] }, when: { all: [{ armor: "none" }, { shield: false }] } }] } ] },
  { name: "Bard", features: [{ name: "Jack of All Trades", lv: 2, effects: [{ t: "skill.nonprof", v: { halfProf: true } }] }] }
];
const SPECIES = [{ name: "Dwarf", effects: [{ t: "hp.max", v: { perLevel: 1 }, name: "Dwarven Toughness" }, { t: "grant.resist.poison", op: "grant" }] }];
const BASE = () => ({ feats: Object.entries(FEATS).map(([name, effects]) => ({ name, effects })), classes: CLASSES, subclasses: [], species: SPECIES, effectsV: 1 });
setEffectsSource(BASE);
const withSource = (src, fn) => { setEffectsSource(() => src); try { fn(); } finally { setEffectsSource(BASE); } };

const mk = (o = {}) => ({ class: "Fighter", level: 5, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, feats: [], hp: { base: 30, max: 30, cur: 30 }, species: "Human", active: [], resources: [], conditions: [], ...o });

t("Hearty adds your level to max HP", () => eq(hpParts(mk({ feats: ["Hearty"] })).total, 30 + 2 * 5 + 5));
t("Tough adds twice your level", () => eq(hpParts(mk({ feats: ["Tough"] })).total, 30 + 10 + 10));
t("Hearty + Tough + Dwarf stack", () => eq(hpParts(mk({ feats: ["Hearty", "Tough"], species: "Dwarf", level: 3 })).total, 30 + 6 + 3 + 6 + 3));
t("feat saved as 'Name (option)' still matches", () => eq(hpParts(mk({ feats: ["Hearty (Strength)"] })).total, 30 + 10 + 5));
t("Alert adds proficiency bonus to initiative (lvl 1 and 9)", () => { eq(fxSum(fxList(mk({ feats: ["Alert"], level: 1 }), "init")), 2); eq(fxSum(fxList(mk({ feats: ["Alert"], level: 9 }), "init")), 4); eq(fxSum(fxList(mk({ feats: ["Alert"], level: 13 }), "init")), 5); });
t("Defense only while armored", () => { const c = mk({ feats: ["Defense"] }); eq(fxSum(fxList(c, "ac", { armored: true })), 1); eq(fxSum(fxList(c, "ac", { armored: false })), 0); });
t("Fast Movement: needs the level, off in heavy armor", () => {
  eq(fxSum(fxList(mk({ class: "Barbarian", level: 4 }), "speed", {})), 0);
  eq(fxSum(fxList(mk({ class: "Barbarian", level: 5 }), "speed", { armored: true })), 10);
  eq(fxSum(fxList(mk({ class: "Barbarian", level: 5 }), "speed", { armored: true, heavy: true })), 0);
});
t("Unarmored Movement scales and needs no armor and no shield", () => {
  const sp = (lvl, ctx) => fxSum(fxList(mk({ class: "Monk", level: lvl }), "speed", ctx));
  eq(sp(2, {}), 10); eq(sp(6, {}), 15); eq(sp(18, {}), 30); eq(sp(6, { armored: true }), 0); eq(sp(6, { shield: true }), 0);
});
t("Jack of All Trades: half proficiency, rounded down", () => { eq(fxSum(fxList(mk({ class: "Bard", level: 5 }), "skill.nonprof")), 1); eq(fxSum(fxList(mk({ class: "Bard", level: 9 }), "skill.nonprof")), 2); });
t("Unarmored Defense formulas pick the better base (Barbarian 10+Dex+Con)", () => {
  const c = mk({ class: "Barbarian", level: 3 });
  eq(fxStat(c, "ac.base", 12, { armored: false }).total, 10 + 2 + 2);
  eq(fxStat(c, "ac.base", 12, { armored: true }).total, 12);
});
t("Monk Unarmored Defense is off with a shield", () => {
  const c = mk({ class: "Monk", level: 3 });
  eq(fxStat(c, "ac.base", 12, { armored: false, shield: false }).total, 10 + 2 + 1);
  eq(fxStat(c, "ac.base", 12, { armored: false, shield: true }).total, 12);
});
t("set / max / min / add are applied in the right order", () => withSource({ feats: [], classes: [], subclasses: [], effectsV: 1,
  species: [{ name: "X", effects: [{ t: "ac.base", op: "set", v: 13 }, { t: "ac.base", op: "min", v: 12 }, { t: "ac.base", v: 1, name: "plus" }] }] },
  () => eq(fxStat(mk({ species: "X" }), "ac.base", 10).total, 13))); // set 13, the min caps it to 12, then +1
t("max never lowers the base", () => withSource({ feats: [], classes: [], subclasses: [], effectsV: 1, species: [{ name: "X", effects: [{ t: "ac.base", op: "max", v: 11 }] }] },
  () => eq(fxStat(mk({ species: "X" }), "ac.base", 14).total, 14)));
t("computeAC uses ac.base data: Barbarian and Monk Unarmored Defense, shield rules", () => {
  const ac = (cls, inv = [], eq = {}) => computeAC(mk({ class: cls, level: 3, inventory: inv, equipment: eq, ac: { base: 10, bonus: 0, shield: false, dexCap: null, armorName: "", override: null } })).total;
  eq(ac("Barbarian"), 10 + 2 + 2);   // dex 14, con 14
  eq(ac("Monk"), 10 + 2 + 1);        // dex 14, wis 12
  eq(ac("Fighter"), 12);
  const shield = [{ id: "s1", name: "Shield", armor: { cat: "Shield", base: 2 } }];
  eq(computeAC(mk({ class: "Monk", inventory: shield, equipment: { off: "s1" }, ac: { base: 10, bonus: 0, shield: true } })).total >= 12, true);
  eq(computeAC(mk({ class: "Monk", ac: { base: 10, bonus: 0, shield: true } })).total, 12 + 2); // by-hand shield: Monk loses Unarmored Defense, keeps 10 + Dex, +2
});
t("Dueling: +2 damage only one-handed, melee, no second weapon", () => {
  const c = mk({ feats: ["Dueling"] });
  const ok = { attack: ["weapon", "melee"], wield: { melee: true, oneHanded: true } };
  eq(rollMods(c, "dmg", ok).flat, 2);
  eq(rollMods(c, "dmg", { ...ok, wield: { melee: true, oneHanded: true, dual: true } }).flat, 0);
  eq(rollMods(c, "dmg", { attack: ["weapon", "ranged"], wield: { oneHanded: true } }).flat, 0);
});
t("Archery: +2 to ranged weapon attacks only", () => { const c = mk({ feats: ["Archery"] }); eq(rollMods(c, "atk", { attack: ["weapon", "ranged"] }).flat, 2); eq(rollMods(c, "atk", { attack: ["weapon", "melee"] }).flat, 0); });
t("Great Weapon Fighting: reroll 1s and 2s with a two-handed melee weapon", () => {
  const c = mk({ feats: ["Great Weapon Fighting"] });
  eq(rollMods(c, "dmg", { wield: { melee: true, twoHanded: true } }).reroll.length, 1);
  eq(rollMods(c, "dmg", { wield: { melee: true } }).reroll.length, 0);
});
t("Rage: damage steps with level, only while the Rage toggle is on, melee only", () => {
  const off = mk({ class: "Barbarian", level: 9 }), on = mk({ class: "Barbarian", level: 9, active: [{ id: "feature:Rage", name: "Rage" }] });
  eq(rollMods(off, "dmg", { attack: ["melee"] }).flat, 0);
  eq(rollMods(on, "dmg", { attack: ["melee"] }).flat, 3);
  eq(rollMods(on, "dmg", { attack: ["ranged"] }).flat, 0);
  eq(rollMods(mk({ class: "Barbarian", level: 16, active: [{ id: "Rage" }] }), "dmg", { attack: ["melee"] }).flat, 4);
});
t("Rage grants bludgeoning resistance only while raging", () => {
  eq(grantsOf(mk({ class: "Barbarian" }), "resist").length, 0);
  eq(grantsOf(mk({ class: "Barbarian", active: [{ id: "Rage" }] }), "resist").map(x => x.name), ["bludgeoning"]);
});
t("Danger Sense: advantage on Dexterity saves from level 2", () => { eq(rollMods(mk({ class: "Barbarian", level: 2 }), "save.dex").adv.length, 1); eq(rollMods(mk({ class: "Barbarian", level: 1 }), "save.dex").adv.length, 0); });
t("Hunter's Quick Strike: bonus dice scale 1d4 -> 2d4 -> 4d4", () => {
  const d = lvl => rollMods(mk({ feats: ["Hunter"], level: lvl }), "dmg", {}).dice[0].dice;
  eq(d(1), "1d4"); eq(d(9), "2d4"); eq(d(16), "4d4");
  eq(rollMods(mk({ feats: ["Hunter"] }), "dmg", {}).dice[0].once, true);
});
t("Bloodied: a bonus that appears below half HP", () => {
  eq(fxSum(fxList(mk({ feats: ["Bloodied"], hp: { max: 40, cur: 30 } }), "ac")), 0);
  eq(fxSum(fxList(mk({ feats: ["Bloodied"], hp: { max: 40, cur: 19 } }), "ac")), 1);
});
t("species grants: Dwarf poison resistance", () => eq(grantsOf(mk({ species: "Dwarf" }), "resist").map(x => x.name), ["poison"]));
t("custom bonuses stack and show their label", () => {
  const c = mk({ custom: [{ id: "1", t: "ac", v: 2, label: "Ring" }, { id: "2", t: "ac", v: -1, label: "Curse" }] });
  eq(fxSum(fxList(c, "ac")), 1); eq(fxList(c, "ac").map(x => x.src), ["Ring", "Curse"]);
});
t("expression maths: add, mul, half, max, min, if", () => {
  const c = mk({ level: 6 });
  eq(evalExpr({ add: [1, { lvl: true }] }, c), 7); eq(evalExpr({ mul: [{ prof: true }, 2] }, c), 6); eq(evalExpr({ half: { lvl: true } }, c), 3);
  eq(evalExpr({ max: [1, { abil: "str" }] }, c), 3); eq(evalExpr({ min: [5, { lvl: true }] }, c), 5);
  eq(evalExpr({ if: { level: { gte: 5 } }, then: 4, else: 1 }, c), 4); eq(evalExpr({ if: { level: { gte: 9 } }, then: 4 }, c), 0);
});
t("dice helpers", () => { eq(evalDice("2d6", mk()), "2d6"); eq(diceAverage("2d6+3"), 10); });
t("validateEffect accepts good data and flags mistakes", () => {
  eq(validateEffect({ t: "ac", v: 1, when: "armored" }), []);
  eq(validateEffect({ t: "skill.stealth", op: "adv" }), []);
  eq(validateEffect({ t: "ac", v: { add: [1, { abil: "dex" }] } }), []);
  if (!validateEffect({ t: "colour", v: 1 }).length) throw new Error("unknown target accepted");
  if (!validateEffect({ t: "ac", v: { wat: 1 } }).length) throw new Error("bad expression accepted");
  if (!validateEffect({ t: "ac", v: 1, when: { moon: "full" } }).length) throw new Error("bad condition accepted");
  if (!validateEffect({ t: "ac", op: "multiply", v: 2 }).length) throw new Error("bad op accepted");
});

// Every effect already in the rules file must be valid (skipped when the readable file is not unlocked).
const libUrl = new URL("../data/library.json", import.meta.url);
if (existsSync(libUrl)) {
  const L = JSON.parse(readFileSync(libUrl, "utf8"));
  t("all effects in data/library.json are valid", () => {
    const bad = [];
    const scan = (label, e) => (e.effects || []).forEach(x => { const p = validateEffect(x); if (p.length) bad.push(label + ": " + p.join(", ")); });
    L.feats.forEach(f => scan(f.name, f)); L.species.forEach(f => scan(f.name, f));
    L.classes.forEach(c => (c.features || []).forEach(f => scan(c.name + ":" + f.name, f)));
    L.subclasses.forEach(c => (c.features || []).forEach(f => scan(c.name + ":" + f.name, f)));
    if (bad.length) throw new Error(bad.join(" | "));
  });
}

// ---- attacks and damage, against the real (unlocked) rules ----
if (existsSync(new URL("../data/library.json", import.meta.url))) {
  const LIB = JSON.parse(readFileSync(new URL("../data/library.json", import.meta.url), "utf8"));
  const REAL = { feats: LIB.feats, classes: LIB.classes, subclasses: LIB.subclasses, species: LIB.species, effectsV: LIB.effectsV };
  const W = {
    longbow: { dice: "1d8", dtype: "piercing", kind: "Ranged", props: "Ammunition, Heavy, Two-Handed", ability: null, magic: 0 },
    longsword: { dice: "1d8", dtype: "slashing", kind: "Melee", props: "Versatile (1d10)", ability: null, magic: 0 },
    greatsword: { dice: "2d6", dtype: "slashing", kind: "Melee", props: "Heavy, Two-Handed", ability: null, magic: 0 },
    dagger: { dice: "1d4", dtype: "piercing", kind: "Melee", props: "Finesse, Light, Thrown (Range 20/60)", ability: null, magic: 0 },
    shortsword: { dice: "1d6", dtype: "piercing", kind: "Melee", props: "Finesse, Light", ability: null, magic: 0 },
    javelin: { dice: "1d6", dtype: "piercing", kind: "Melee", props: "Thrown (Range 30/120)", ability: null, magic: 0 }
  };
  // a character holding the named weapons: first is main hand, second (if any) off hand
  const hold = (feats, main, off, o = {}) => {
    const inv = [{ id: "a", name: main, weapon: { ...W[main] } }]; const eq = { main: "a" };
    if (off) { inv.push({ id: "b", name: off, weapon: { ...W[off] } }); eq.off = "b"; }
    return { ...mk({ feats, ...o }), inventory: inv, equipment: eq };
  };
  const withReal = fn => withSource(REAL, fn);
  const numA = (c, id = "a") => weaponNumbers(c.inventory.find(i => i.id === id).weapon, c);
  t("real rules: every fighting style/feat effect validates", () => withReal(() => { eq(LIB.feats.filter(f => f.effects).flatMap(f => f.effects.flatMap(validateEffect)), []); }));
  t("Archery adds +2 to ranged weapon attacks only", () => withReal(() => {
    const plain = numA(hold([], "longbow")).toHit, arch = numA(hold(["Archery"], "longbow")).toHit;
    eq(arch - plain, 2); eq(numA(hold(["Archery"], "longsword")).toHit, numA(hold([], "longsword")).toHit);
  }));
  t("Dueling: +2 damage with one melee weapon in hand and nothing else, not with a second weapon", () => withReal(() => {
    const base = numA(hold([], "longsword")).dmgMod;
    eq(numA(hold(["Dueling"], "longsword")).dmgMod - base, 2);
    eq(numA(hold(["Dueling"], "longsword", "shortsword")).dmgMod - base, 0);
    eq(numA(hold(["Dueling"], "greatsword")).dmgMod - numA(hold([], "greatsword")).dmgMod, 0);
  }));
  t("Great Weapon Fighting: counts 1s and 2s as 3 with a two-handed grip only", () => withReal(() => {
    eq(numA(hold(["Great Weapon Fighting"], "greatsword")).reroll.map(r => [r.atMost, r.as]), [[2, 3]]);
    eq(numA(hold(["Great Weapon Fighting"], "longsword")).reroll.length, 1, "versatile with a free hand");
    eq(numA(hold(["Great Weapon Fighting"], "longsword", "shortsword")).reroll.length, 0, "other weapon in hand");
    eq(numA(hold(["Great Weapon Fighting"], "longbow")).reroll.length, 0, "ranged");
  }));
  t("Two-Weapon Fighting: the off-hand attack adds the ability modifier; without it, it does not", () => withReal(() => {
    const off = hold([], "dagger", "shortsword"), offT = hold(["Two-Weapon Fighting"], "dagger", "shortsword");
    eq(numA(off, "b").dmgMod, 0); eq(numA(offT, "b").dmgMod, numA(offT, "a").dmgMod);
  }));
  t("Thrown Weapon Fighting is offered as a rider on a Thrown weapon", () => withReal(() => {
    const n = numA(hold(["Thrown Weapon Fighting"], "javelin")); eq(n.riders.dmg.map(r => [r.src, r.flat]), [["Thrown Weapon Fighting", 2]]);
    eq(numA(hold(["Thrown Weapon Fighting"], "longsword")).riders.dmg.length, 0);
  }));
  t("Rage adds its damage only while Rage is on and the attack uses Strength", () => withReal(() => {
    const on = { ...hold([], "greatsword", null, { class: "Barbarian", level: 9 }), active: [{ id: "feature:Rage", name: "Rage" }] };
    const off = hold([], "greatsword", null, { class: "Barbarian", level: 9 });
    eq(numA(on).dmgMod - numA(off).dmgMod, 3);
    const dexOn = { ...on, inventory: [{ id: "a", name: "x", weapon: { ...W.shortsword, ability: "dex" } }] };
    eq(numA(dexOn).dmgMod, 2);
  }));
  t("Reckless Attack gives advantage on Strength attacks while it is on", () => withReal(() => {
    const on = { ...hold([], "greatsword", null, { class: "Barbarian" }), active: [{ id: "feature:Reckless Attack", name: "Reckless Attack" }] };
    eq(numA(on).adv, ["Reckless Attack"]); eq(numA(hold([], "greatsword", null, { class: "Barbarian" })).adv, []);
  }));
  t("Unarmed Strike: one strike; species, Tavern Brawler, Unarmed Fighting and Altered improve it, only separate attacks get a row", () => withReal(() => {
    const names = c => unarmedWeapons(c).map(i => i.name), first = c => unarmedWeapons(c)[0].weapon;
    eq(names(mk({})), ["Unarmed Strike"]); eq(first(mk({})).dice, "1");
    eq(names(mk({ species: "Tabaxi" })), ["Unarmed Strike"]); eq([first(mk({ species: "Tabaxi" })).dice, first(mk({ species: "Tabaxi" })).via, first(mk({ species: "Tabaxi" })).dtype], ["1d6", "Cat's Claws", "slashing"]);
    eq(first(mk({ feats: ["Tavern Brawler"] })).via, "Tavern Brawler");
    eq(first({ ...mk({ feats: ["Unarmed Fighting"] }), inventory: [], equipment: {} }).dice, "1d8");
    eq(first(hold(["Unarmed Fighting"], "longsword")).dice, "1d6");
    eq(first(mk({ feats: ["Altered"] })).dice, "1");
    eq(first({ ...mk({ feats: ["Altered"] }), choices: { Altered: ["Natural Weapons"] } }).dice, "1d8");
    eq(first(mk({ species: "Dhampir" })).ability, "con");
    eq(names(mk({ species: "Shifter" })), ["Unarmed Strike", "Longtooth"]);
    eq(names(mk({ species: "Tabaxi", feats: ["Tavern Brawler"] })), ["Unarmed Strike"]);
  }));
  t("attacks per Attack action come from Extra Attack and its upgrades", () => withReal(() => {
    eq([1, 4, 5, 10, 11, 19, 20].map(level => attacksPerAction(mk({ class: "Fighter", level }))), [1, 1, 2, 2, 3, 3, 4]);
    eq(attacksPerAction(mk({ class: "Wizard", level: 9 })), 1); eq(attacksPerAction(mk({ class: "Paladin", level: 5 })), 2);
  }));
  t("reroll sources: Inspiration, Savage Attacker, Piercer, Halfling Lucky", () => {
    const ids = (c, ctx) => rerollsFor(c, ctx).map(r => r.id);
    eq(ids(mk({}), { weapon: true, hasDmg: true, hasD20: true }), []);
    eq(ids({ ...mk({}), inspiration: true }, { hasD20: true }), ["insp"]);
    eq(ids(mk({ feats: ["Savage Attacker"] }), { weapon: true, hasDmg: true, hasD20: true }), ["savage"]);
    eq(ids(mk({ feats: ["Piercer"] }), { weapon: true, hasDmg: true, piercing: true }), ["piercer"]);
    eq(ids(mk({ feats: ["Piercer"] }), { weapon: true, hasDmg: true, piercing: false }), []);
    eq(ids(mk({ species: "Halfling" }), { hasD20: true }), ["hlf"]);
  });
  t("Goblin gets a Fury of the Small tracker equal to proficiency bonus", () => {
    const c = mk({ species: "Goblin", level: 5 }); ensureLuck(c); const r = c.resources.find(x => x.name === "Fury of the Small");
    eq([r.max, r.reset], [3, "long"]); c.level = 9; ensureLuck(c); eq(c.resources.find(x => x.name === "Fury of the Small").max, 4);
  });
  t("Tavern Brawler rerolls 1s on Unarmed Strike damage, not weapon damage", () => withReal(() => {
    const c = hold(["Tavern Brawler"], "longsword");
    eq(weaponNumbers(unarmedWeapons(c)[0].weapon, c).reroll.map(r => r.atMost), [1]); eq(numA(c).reroll.length, 0);
  }));
}
t("one-shot abilities are not toggles; lasting ones are", () => {
  eq(isSustained("On your turn, you can take one additional action, except the Magic action. Once you use this feature, you can't do so again until you finish a Short or Long Rest."), false);
  eq(isSustained("You regain Hit Points equal to 1d10 plus your Fighter level."), false);
  eq(isSustained("You can imbue yourself with a primal power. Your Rage lasts until the end of your next turn, up to 10 minutes."), true);
  eq(isSustained("You assume the form of a Beast for 1 hour."), true);
});
console.log(`${pass}/${pass + fail} engine checks passed`);
process.exit(fail ? 1 : 0);
