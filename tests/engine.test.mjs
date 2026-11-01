// Rules-engine conformance tests: pure Node, no browser, runs in a second.
// Each case writes a real 5e ability as DATA (the same JSON the DM block editor will produce)
// and checks the engine's numbers. When an ability is "misread", fix its data, not the code.
//   node tests/engine.test.mjs                (also checks data/library.json effects if unlocked)
import { readFileSync, existsSync } from "node:fs";
import { isSustained } from "../js/combat.js";
import { normalizeSubclass, subclassGaps } from "../js/data.js";
import { newFeatures } from "../js/progression.js";
import { bookName, bookKey, listBooks, allowed, allowedBy, effectiveCampaign, groupRuleset, blankRuleset, copyRuleset, encodeRuleset, decodeRuleset, clean as cleanRuleset, problems } from "../js/rulesets.js";
import { rationsHave, rationsNeed, spendRations, restOptions, applyRestPicks } from "../js/rest.js";
import { subclassSpellGrants, subclassSpellTables, syncSubclassSpells, findSpellName, pickKey } from "../js/subclassspells.js";
import { rerollsFor, ensureLuck, shortRestRefill } from "../js/riders.js";
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
  { name: "Druid", features: [{ name: "Primal Order", lv: 1, effects: [{ t: "skill.arcana", v: { abil: "wis", min: 1 }, when: { pick: ["Primal Order", "Magician"] } }, { t: "skill.nature", v: { abil: "wis", min: 1 }, when: { pick: ["Primal Order", "Magician"] } }] }] },
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
t("Primal Order: Magician adds Wisdom modifier (minimum +1) to Arcana and Nature checks, Warden does not", () => {
  const wis = (w, pick) => mk({ class: "Druid", level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: w, cha: 10 }, choices: pick ? { "Primal Order": pick } : {} });
  eq(fxSum(fxList(wis(16, "Magician"), "skill.arcana")), 3); eq(fxSum(fxList(wis(16, "Magician"), "skill.nature")), 3);
  eq(fxSum(fxList(wis(8, "Magician"), "skill.arcana")), 1, "minimum +1");
  eq(fxSum(fxList(wis(16, "Warden"), "skill.arcana")), 0); eq(fxSum(fxList(wis(16, null), "skill.nature")), 0);
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
  t("real rules: subclass spell tables resolve (Life Domain, Oath of Devotion typo, Draconic run-on)", () => withReal(() => {
    const g = n => subclassSpellGrants(LIB.subclasses.find(x => x.name === n), LIB);
    eq(g("Life Domain").map(x => x.lv), [3, 5, 7, 9]); eq(g("Life Domain")[0].spells, ["Aid", "Bless", "Cure Wounds", "Lesser Restoration"]);
    eq(g("Oath of Devotion")[0].spells, ["Protection from Evil and Good", "Shield of Faith"]);
    eq(g("Draconic Sorcery").map(x => x.lv), [3, 5, 7, 9]);
    const withTable = LIB.subclasses.filter(sc => { const t = subclassSpellTables(sc, LIB); return t.grants.length || t.choices.length; });
    eq(withTable.length >= 60, true, "subclasses with a spell table: " + withTable.length);
    eq(subclassSpellTables(LIB.subclasses.find(x => x.name === "Circle of the Land"), LIB).choices.map(o => o.name), ["Arid Land", "Polar Land", "Temperate Land", "Tropical Land"]);
    eq(subclassSpellTables(LIB.subclasses.find(x => x.name === "Harvest Domain"), LIB).choices.map(o => o.name), ["Sowing", "Growing", "Reaping"]);
    eq(g("Eldritch Domain")[0].spells, ["Detect Thoughts", "Hideous Laughter", "See Invisibility", "Sleep"]); // table lives inside the intro text
    eq(g("Circle of the Sea").map(x => x.lv), [3, 5, 7, 9]); eq(g("Shadow Sorcery")[0].spells.includes("Pass without Trace"), true);
  }));
  t("real rules: every class and subclass tracker is well formed and gives at least one use at every level", () => withReal(() => {
    const bad = [], all = [];
    const walk = (owner, features) => (features || []).forEach(f => (f.trackers || []).forEach(tr => all.push([owner, f.lv, tr])));
    LIB.classes.forEach(c => walk(c.name, c.features)); LIB.subclasses.forEach(sc => walk(sc.name, sc.features));
    LIB.species.forEach(sp => (sp.trackers || []).forEach(tr => all.push([sp.name, 1, tr]))); LIB.feats.forEach(ft => (ft.trackers || []).forEach(tr => all.push([ft.name, 1, tr])));
    all.forEach(([owner, lv, tr]) => {
      if (!tr.name || !["long", "short"].includes(tr.reset)) bad.push(owner + ": " + tr.name + " reset");
      if (tr.shortRegain != null && !(tr.shortRegain >= 1)) bad.push(owner + ": " + tr.name + " shortRegain");
      (tr.resetAt || []).forEach(([l, r]) => { if (!(l >= 1) || !["long", "short"].includes(r)) bad.push(owner + ": " + tr.name + " resetAt"); });
      for (const level of [3, 10, 20]) { const n = evalExpr(tr.max, mk({ level })); if (!(n >= 0) || n > 120) bad.push(`${owner}: ${tr.name} max ${n} at ${level}`); }
    });
    eq(bad, []); eq(all.length >= 170, true, "trackers: " + all.length);
    const rage = LIB.classes.find(c => c.name === "Barbarian").features.find(f => f.name === "Rage").trackers[0];
    eq([1, 3, 6, 12, 17].map(l => evalExpr(rage.max, mk({ level: l }))), [2, 3, 4, 5, 6]); eq(rage.shortRegain, 1);
    const cd = LIB.classes.find(c => c.name === "Cleric").features.find(f => f.name === "Channel Divinity").trackers[0];
    eq([2, 6, 18].map(l => evalExpr(cd.max, mk({ level: l }))), [2, 3, 4]);
    const mf = LIB.classes.find(c => c.name === "Monk").features.find(f => f.name === "Monk's Focus").trackers[0];
    eq([2, 9, 20].map(l => evalExpr(mf.max, mk({ level: l }))), [2, 9, 20]); eq(mf.reset, "short");
    const ba = LIB.classes.find(c => c.name === "Bard").features.find(f => f.name === "Bardic Inspiration").trackers[0];
    eq(evalExpr(ba.max, mk({ abilities: { cha: 18 } })), 4);
    const names = c => { ensureLuck(c); return c.resources.map(r => [r.name, r.max, r.reset]); };
    eq(names(mk({ class: "Wizard", level: 5, species: "Dragonborn" })).filter(r => ["Breath Weapon", "Draconic Flight"].includes(r[0])), [["Breath Weapon", 3, "long"], ["Draconic Flight", 1, "long"]]);
    eq(names(mk({ class: "Wizard", level: 4, species: "Duergar" })).map(r => [r[0], r[1]]).filter(r => r[0] === "Duergar Magic"), [["Duergar Magic", 1]]);
    eq(names(mk({ class: "Wizard", level: 5, species: "Duergar" })).filter(r => r[0] === "Duergar Magic")[0][1], 2);
    eq(names(mk({ class: "Wizard", level: 1, species: "Orc" })).filter(r => r[0] === "Adrenaline Rush"), [["Adrenaline Rush", 2, "short"]]);
    eq(names(mk({ class: "Wizard", level: 1, feats: ["Fey-Touched"] })).filter(r => r[0] === "Fey Magic"), [["Fey Magic", 2, "long"]]);
    eq(names(mk({ class: "Wizard", level: 1, feats: ["Hero"] })).filter(r => r[0] === "Heroic Intervention"), [["Heroic Intervention", 2, "short"]]);
    eq(LIB.species.find(s2 => s2.name === "Goliath").trackers.map(t2 => t2.name), ["Giant Ancestry", "Large Form"]); // hand-made ones are left alone
    const g = mk({ class: "Druid", level: 5, species: "Human" }); ensureLuck(g); eq(g.resources.map(r => r.name), ["Wild Shape", "Wild Resurgence"]);
    const w = mk({ class: "Fighter", level: 9, subclass: "Battle Master" }); ensureLuck(w); eq(w.resources.map(r => r.name).sort(), ["Action Surge", "Indomitable", "Know Your Enemy", "Second Wind"].sort());
  }));
  t("real rules: species trackers, Goliath/Azurite boons, Danger Sense", () => withReal(() => {
    eq(LIB.species.flatMap(sp => (sp.effects || []).flatMap(validateEffect)), []);
    const gol = mk({ species: "Goliath", level: 5, choices: { "Goliath: Giant Ancestry": ["Fire's Burn"] } });
    ensureLuck(gol);
    eq(gol.resources.filter(r => !/Second Wind|Action Surge/.test(r.name)).map(r => [r.name, r.max]), [["Giant Ancestry", 3], ["Large Form", 1]]);
    const fb = rollMods(gol, "dmg", {}).riders; eq(fb.map(r => [r.src, r.dice, r.res]), [["Fire's Burn", "1d10", "Giant Ancestry"]]);
    const low = mk({ species: "Goliath", level: 3 }); ensureLuck(low); eq(low.resources.map(r => r.name).filter(n => !/Second Wind|Action Surge/.test(n)), ["Giant Ancestry"]);
    const lf = { ...gol, active: [{ id: "t:Large Form" }] };
    eq(fxStat(lf, "speed", 35).total, 45); eq(rollMods(lf, "check.str").adv, ["Large Form"]); eq(rollMods(gol, "check.str").adv, []);
    const az = mk({ species: "Azurite", level: 5, choices: { "Azurite: Gem Origin": ["Diamond"] }, active: [{ id: "t:Gem Origin:Solidify" }] });
    eq(fxStat(az, "ac", 10).total, 12); eq(grantsOf(az, "resist").map(g => g.name), ["Force"]);
    eq(rollMods(mk({ class: "Barbarian", level: 3 }), "save.dex").adv, ["Danger Sense"]);
    eq(rollMods(mk({ class: "Barbarian", level: 3, conditions: ["Incapacitated"] }), "save.dex").adv, []);
  }));
}
t("subclass features before level 3 arrive at 3; gaps are listed", () => {
  const sc = { cls: "Cleric", name: "Test Domain", features: [{ lv: 1, name: "Bonus", text: "x" }, { lv: 2, name: "Channel", text: "y" }, { lv: 3, name: "Spells", text: "z" }, { lv: 6, name: "Six", text: "w" }] };
  const n = { ...sc, features: normalizeSubclass(sc) };
  eq(n.features.map(f => f.lv), [3, 3, 3, 6]); eq(n.features[0].bookLv, 1);
  eq(newFeatures({ subclasses: [n] }, { name: "Cleric", features: [] }, "Test Domain", 3).map(f => f.name), ["Bonus", "Channel", "Spells"]);
  eq(subclassGaps(n), [17]);
});
t("subclass spell tables: formats, run-on tables, sync by level", () => {
  const L = { spells: ["Aid", "Bless", "Cure Wounds", "Shield of Faith", "Fly", "Arcane Eye", "Fear"].map(name => ({ name })), subclasses: [] };
  eq(findSpellName(L, "shield of faith*"), "Shield of Faith"); eq(findSpellName(L, "Shielf of Faith"), "Shield of Faith"); eq(findSpellName(L, "Wish"), null);
  const mk2 = (cls, text) => ({ cls, name: "S", features: [{ lv: 3, name: "S Spells", text: "S Spells\nClass Level\tSpells\n" + text }] });
  eq(subclassSpellGrants(mk2("Cleric", "3rd\tAid, Bless\n5th\tCure Wounds\n1\tflavour that is not a spell"), L).map(g => [g.lv, g.spells]), [[3, ["Aid", "Bless"]], [5, ["Cure Wounds"]]]);
  eq(subclassSpellGrants(mk2("Paladin", "3 / Shielf of Faith\n5 / Fear, Fly 7 | Arcane Eye"), L).map(g => [g.lv, g.spells]), [[3, ["Shield of Faith"]], [5, ["Fear", "Fly"]], [7, ["Arcane Eye"]]]);
  eq(subclassSpellGrants(mk2("Cleric", "1st level: aid\n3rd level: wish, bless"), L).map(g => [g.lv, g.spells, g.missing]), [[1, ["Aid"], []], [3, ["Bless"], ["wish"]]]);
  L.subclasses.push(mk2("Cleric", "3\tAid, Bless\n5\tCure Wounds"));
  const c = { class: "Cleric", subclass: "S", level: 3, spellcasting: { spells: [{ name: "Aid", prepared: false, always: false }] } };
  eq(syncSubclassSpells(c, L), ["Bless"]); eq(c.spellcasting.spells.map(s => [s.name, s.always]), [["Aid", true], ["Bless", true]]);
  c.level = 5; eq(syncSubclassSpells(c, L), ["Cure Wounds"]); eq(syncSubclassSpells(c, L), []);
  c.subclass = "Other"; syncSubclassSpells(c, L); eq(c.spellcasting.spells.filter(s => s.fromSubclass).length, 0);
});
  t("subclass spell tables: columns/titled options need a pick; whitespace tables; found inside the intro", () => {
    const L = { spells: ["Aid", "Bless", "Fireball", "Fog Cloud", "Web", "Blur", "Cone of Cold"].map(name => ({ name })), subclasses: [] };
    const land = { cls: "Druid", name: "Land", features: [{ lv: 3, name: "Land Spells", text: "Pick one.\n\nArid Land\n\nDruid Level / Circle Spells\n\n3 / Blur\n\n5 / Fireball\n\nPolar Land\n\nDruid Level / Circle Spells\n\n3 / Fog Cloud\n\n5 / Cone of Cold" }] };
    const harvest = { cls: "Cleric", name: "Harv", features: [{ lv: 3, name: "H", text: "Harv Spells\nCleric Level        Sowing        Growing\n3rd        Aid, Bless        Web" }] };
    const intro = { cls: "Cleric", name: "Intro", features: [{ lv: 3, name: "", intro: true, text: "Flavour here.\n\nLevel 3: Intro Spells\nSrc p1\nText sentence.\n\nIntro Spells\nCleric Level        Prepared Spells\n3        Aid, Bless\n5        Fireball\nNext feature\nbody" }] };
    const lt = subclassSpellTables(land, L); eq(lt.grants, []); eq(lt.choices.map(o => [o.name, o.rows.map(r => r.spells)]), [["Arid Land", [["Blur"], ["Fireball"]]], ["Polar Land", [["Fog Cloud"], ["Cone of Cold"]]]]);
    eq(subclassSpellTables(harvest, L).choices.map(o => [o.name, o.rows[0].spells]), [["Sowing", ["Aid", "Bless"]], ["Growing", ["Web"]]]);
    eq(subclassSpellGrants(intro, L).map(g => [g.lv, g.spells]), [[3, ["Aid", "Bless"]], [5, ["Fireball"]]]);
    L.subclasses.push(land);
    const c = { class: "Druid", subclass: "Land", level: 5, choices: {}, spellcasting: { spells: [] } };
    eq(syncSubclassSpells(c, L), []); c.choices[pickKey("Land")] = "Polar Land"; eq(syncSubclassSpells(c, L), ["Fog Cloud", "Cone of Cold"]);
    c.choices[pickKey("Land")] = "Arid Land"; syncSubclassSpells(c, L); eq(c.spellcasting.spells.map(s => s.name), ["Blur", "Fireball"]);
  });
t("class trackers: counts from the level, short-rest regain, rest type changes with level", () => {
  const classes = [
    { name: "Barbarian", features: [{ name: "Rage", lv: 1, trackers: [{ name: "Rage", max: { steps: [[1, 2], [3, 3], [6, 4]] }, reset: "long", shortRegain: 1 }] }] },
    { name: "Bard", features: [{ name: "Bardic Inspiration", lv: 1, trackers: [{ name: "Bardic Inspiration", max: { abil: "cha", min: 1 }, reset: "long", resetAt: [[5, "short"]] }] }] },
    { name: "Fighter", features: [{ name: "Action Surge", lv: 2, trackers: [{ name: "Action Surge", max: { steps: [[2, 1], [17, 2]] }, reset: "short" }] }] }];
  withSource({ ...BASE(), classes }, () => {
    const b = mk({ class: "Barbarian", level: 3 }); ensureLuck(b); eq(b.resources.map(r => [r.name, r.max, r.reset, r.shortRegain]), [["Rage", 3, "long", 1]]);
    b.resources[0].used = 3; shortRestRefill(b.resources); eq(b.resources[0].used, 2); shortRestRefill(b.resources); shortRestRefill(b.resources); shortRestRefill(b.resources); eq(b.resources[0].used, 0);
    b.level = 6; ensureLuck(b); eq(b.resources[0].max, 4);
    const d = mk({ class: "Bard", level: 4, abilities: { cha: 16 } }); ensureLuck(d); eq([d.resources[0].max, d.resources[0].reset], [3, "long"]);
    d.level = 5; ensureLuck(d); eq(d.resources[0].reset, "short"); d.resources[0].used = 2; shortRestRefill(d.resources); eq(d.resources[0].used, 0);
    const lowCha = mk({ class: "Bard", level: 1, abilities: { cha: 8 } }); ensureLuck(lowCha); eq(lowCha.resources[0].max, 1);
    const f = mk({ class: "Fighter", level: 1 }); ensureLuck(f); eq(f.resources.length, 0); f.level = 2; ensureLuck(f); eq(f.resources.map(r => [r.name, r.max, r.reset]), [["Action Surge", 1, "short"]]);
  });
});
t("long rest: rations come from the bag, picks stay unless changed, a missing required pick is random", () => {
  const c = { inventory: [{ name: "Rations", qty: 2 }, { name: "Rations (1 day)", qty: 1 }, { name: "Ration Box", qty: 9 }, { name: "Dagger", qty: 1, weapon: {} }] };
  eq(rationsHave(c), 3); eq(rationsNeed(c), 1); c.restRations = 0; eq(rationsNeed(c), 0); c.restRations = 2; eq(rationsNeed(c), 2);
  eq(spendRations(c, 4), false); eq(rationsHave(c), 3); eq(spendRations(c, 2), true); eq(rationsHave(c), 1); eq(spendRations(c, 0), true);
  const L = { spells: ["Blur", "Fireball", "Fog Cloud", "Cone of Cold"].map(name => ({ name })), subclasses: [{ cls: "Druid", name: "Land", features: [{ lv: 3, name: "Land Spells", text: "Arid Land\n\nDruid Level / Circle Spells\n\n3 / Blur\n\n5 / Fireball\n\nPolar Land\n\nDruid Level / Circle Spells\n\n3 / Fog Cloud\n\n5 / Cone of Cold" }] }] };
  const d = { class: "Druid", subclass: "Land", level: 5, choices: {}, spellcasting: { spells: [] }, masteries: ["Club", "Dagger"] };
  const weapons = [{ name: "Club", mastery: "Slow" }, { name: "Dagger", mastery: "Nick" }, { name: "Scimitar", mastery: "Nick" }, { name: "Net" }];
  const o = restOptions(L, d, weapons);
  eq(o.map(x => x.kind), ["pick", "swap", "note"]); eq(o[0].current, ""); eq(o[0].options.map(x => x.v), ["Arid Land", "Polar Land"]); eq(o[1].choices, ["Scimitar"]);
  const r = applyRestPicks(d, L, {}, weapons, () => 0.9); eq(r.random.length, 1); eq(d.choices["Land spell list"], "Polar Land"); eq(d.spellcasting.spells.map(x => x.name), ["Fog Cloud", "Cone of Cold"]);
  const r2 = applyRestPicks(d, L, {}, weapons, () => 0.1); eq([r2.random, r2.log], [[], []]); eq(d.choices["Land spell list"], "Polar Land"); // untouched stays
  applyRestPicks(d, L, { list: "Arid Land", "mastery.drop": "Club", "mastery.add": "Scimitar" }, weapons); eq(d.spellcasting.spells.map(x => x.name), ["Blur", "Fireball"]); eq(d.masteries, ["Scimitar", "Dagger"]);
  applyRestPicks(d, L, { "mastery.drop": "Scimitar", "mastery.add": "Dagger" }, weapons); eq(d.masteries, ["Scimitar", "Dagger"]); // cannot duplicate
});
t("rulesets: books, single entries beat books, share codes round-trip, hostile input is cleaned", () => {
  eq([bookName({ source: "PHB'24 p87" }), bookName({ source: "XGE p37-38" }), bookName({ source: "SRD 5.2" }), bookName({})], ["PHB'24", "XGE", "SRD 5.2", "Unlabelled"]);
  eq(bookKey({ source: "Phb'24" }), bookKey({ source: "PHB'24 p5" }));
  const L = { classes: [{ name: "Fighter", source: "PHB'24" }, { name: "Artificer", source: "TCE" }], species: [{ name: "Elf", source: "PHB'24" }], backgrounds: [{ name: "Sage", source: "PHB'24" }],
    feats: [{ name: "Alert", source: "PHB'24" }, { name: "Tough", source: "PHB'24 p9" }, { name: "Cruel", source: "Homebrew" }], spells: [{ name: "Shield", source: "SRD 5.2" }],
    subclasses: [{ cls: "Fighter", name: "Champion", source: "PHB'24" }, { cls: "Fighter", name: "Gunslinger", source: "Homebrew" }] };
  eq(listBooks(L).find(b => b.key === "phb'24").total, 6);
  const rs = blankRuleset("T"); eq(allowed(rs, "feats", L.feats[0]), true);
  rs.books["homebrew"] = false; eq([allowed(rs, "feats", L.feats[2]), allowedBy(rs, "feats", L.feats[2])], [false, "book"]);
  rs.entries.feats = { Cruel: true, Alert: false }; eq([allowed(rs, "feats", L.feats[2]), allowedBy(rs, "feats", L.feats[2]), allowed(rs, "feats", L.feats[0])], [true, "entry", false]);
  rs.entries.subclasses = { "Fighter|Gunslinger": true }; eq(allowed(rs, "subclasses", L.subclasses[1]), true);
  const eff = effectiveCampaign({ name: "G", enabled: { feats: ["Nope"] }, homebrew: {} }, L, rs);
  eq(eff.enabled.feats, ["Tough", "Cruel"]); eq(eff.enabled.classes, ["Fighter", "Artificer"]); eq([...eff._subAllow].sort(), ["Fighter|Champion", "Fighter|Gunslinger"]);
  const grp = effectiveCampaign({ name: "G", enabled: { feats: ["Alert"] } }, L, groupRuleset({ name: "G" }, L)); eq(grp.enabled.feats, ["Alert"]); eq(grp._subAllow, null); // the group's own rules pass through
  const gl = groupRuleset({ name: "G", enabled: { feats: ["Alert"] } }, L); eq([allowed(gl, "feats", L.feats[0]), allowed(gl, "feats", L.feats[1])], [true, false]);
  const code = encodeRuleset(rs); eq(/^CRR1\.[\w-]+$/.test(code), true);
  const back = decodeRuleset(code); eq([back.name, back.books, back.entries.feats, back.defaultBooks], ["T", { homebrew: false }, { Cruel: true, Alert: false }, true]);
  eq(back.id === rs.id, false); eq(decodeRuleset("nonsense"), null); eq(decodeRuleset("CRR1.@@@"), null);
  const evil = cleanRuleset({ id: "<x>", name: "x".repeat(500), books: { a: "yes", b: true, ["k".repeat(200)]: true }, entries: { feats: { A: true, B: 1 }, hax: { Z: true }, spells: null } });
  eq([evil.name.length, /^[\w-]+$/.test(evil.id), evil.books, evil.entries], [60, true, { b: true }, { feats: { A: true } }]);
  const none = copyRuleset(rs, "None"); none.books = {}; none.entries = {}; none.defaultBooks = false; eq(problems(none, L).length, 3); eq(problems(rs, L), []);
  eq(decodeRuleset(encodeRuleset(copyRuleset({ name: "\u00e9 \u2603", entries: { spells: { "Tasha\u2019s": true } } }))).entries.spells, { "Tasha\u2019s": true });
});
t("one-shot abilities are not toggles; lasting ones are", () => {
  eq(isSustained("On your turn, you can take one additional action, except the Magic action. Once you use this feature, you can't do so again until you finish a Short or Long Rest."), false);
  eq(isSustained("You regain Hit Points equal to 1d10 plus your Fighter level."), false);
  eq(isSustained("You can imbue yourself with a primal power. Your Rage lasts until the end of your next turn, up to 10 minutes."), true);
  eq(isSustained("You assume the form of a Beast for 1 hour."), true);
});
console.log(`${pass}/${pass + fail} engine checks passed`);
process.exit(fail ? 1 : 0);
