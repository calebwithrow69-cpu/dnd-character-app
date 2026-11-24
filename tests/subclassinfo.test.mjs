// Subclass model: template/gaps, stat needs, recommendation. Uses the unlocked library when present. Pure Node.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { template, missingLevels, needs, classPrimary, assess, toneOf } from "../js/subclassinfo.js";
import { normalizeSubclass } from "../js/data.js";
let n = 0; const t = (name, fn) => { fn(); n++; };

const sc = (cls, name, feats) => ({ cls, name, features: feats.map(([lv, text, intro]) => ({ lv, name: "F" + lv, text: text || "", intro })) });

t("template follows the class levels and flags empty slots", () => {
  const s = sc("Fighter", "X", [[3, "", true], [3, "a"], [7, "b"], [10, "c"]]);
  assert.deepEqual(template(s).map(r => r.lv), [3, 7, 10, 15, 18]);
  assert.deepEqual(missingLevels(s), [15, 18]);
  assert.equal(template(sc("Cleric", "Y", [[3, "a"], [6, "b"], [17, "c"]])).some(r => r.missing), false);
});
t("a feature at an unusual level still gets a row", () => {
  assert.ok(template(sc("Fighter", "X", [[3, "a"], [5, "odd"]])).some(r => r.lv === 5 && !r.missing));
});
t("needs reads the player's modifier, not a target's", () => {
  const a = needs(sc("Fighter", "B", [[3, "You can use this a number of times equal to your Charisma modifier. The target makes a Wisdom saving throw. DC 8 plus your Strength or Dexterity modifier."]]));
  assert.deepEqual(a.map(x => x.ab).sort(), ["cha", "dex", "str"]);
  assert.equal(needs(sc("Fighter", "B", [[3, "The creature's Strength modifier is added."]])).length, 0);
  assert.deepEqual(needs(sc("Fighter", "EK", [[3, "Intelligence is your spellcasting ability for your spells."]])).map(x => x.ab), ["int"]);
});
t("class primary ability", () => {
  assert.deepEqual(classPrimary({ core: "Primary Ability:\nStrength or Dexterity\n\nHit Point Die:" }), ["str", "dex"]);
  assert.deepEqual(classPrimary({}), []);
});
t("tone by modifier", () => { assert.equal(toneOf(16), "ok"); assert.equal(toneOf(12), "low"); assert.equal(toneOf(8), "poor"); });
t("recommendation follows the scores and flags off-class stats", () => {
  const cls = { core: "Primary Ability:\nStrength or Dexterity" };
  const subs = [sc("Fighter", "Banneret", [[3, "equal to your Charisma modifier"]]), sc("Fighter", "Brute", [[3, "add your Strength modifier"]])];
  const strong = assess(subs, cls, { str: 17, dex: 12, con: 14, int: 8, wis: 10, cha: 8 });
  assert.equal(strong.get("Brute").rec, true); assert.equal(strong.get("Banneret").rec, false);
  assert.equal(strong.get("Banneret").needs[0].off, true); assert.equal(strong.get("Banneret").needs[0].tone, "poor");
  const charming = assess(subs, cls, { str: 12, dex: 12, con: 12, int: 8, wis: 10, cha: 17 });
  assert.equal(charming.get("Banneret").rec, true);
  const flat = assess(subs, cls, { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  assert.ok([...flat.values()].every(v => !v.rec), "nothing fits flat scores");
});
t("at most one recommendation, and none for an empty list", () => {
  const cls = { core: "Primary Ability:\nStrength" };
  const subs = ["A", "B", "C"].map(x => sc("Fighter", x, [[3, "your Strength modifier"]]));
  assert.equal([...assess(subs, cls, { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }).values()].filter(v => v.rec).length, 1);
  assert.equal(assess([], cls, {}).size, 0);
});
if (existsSync(new URL("../data/library.json", import.meta.url))) {
  const L = JSON.parse(readFileSync(new URL("../data/library.json", import.meta.url), "utf8"));
  t("real library: Banneret needs Charisma, Eldritch Knight Intelligence, every subclass has a template", () => {
    const get = nm => { const s = L.subclasses.find(x => x.name === nm); return { ...s, features: normalizeSubclass(s) }; };
    assert.ok(needs(get("Banneret")).some(x => x.ab === "cha"));
    assert.ok(needs(get("Eldritch Knight")).some(x => x.ab === "int"));
    assert.deepEqual(missingLevels(get("Banneret")), [15, 18]);
    for (const s of L.subclasses) assert.ok(template({ ...s, features: normalizeSubclass(s) }).length >= 3, s.name);
    for (const c of ["Fighter", "Wizard", "Cleric"]) assert.ok(classPrimary(L.classes.find(x => x.name === c)).length >= 1, c);
  });
}
console.log(`subclassinfo: ${n} checks passed`);
