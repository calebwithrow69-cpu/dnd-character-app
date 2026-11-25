// Conditions and the math they change (pure Node).
import assert from "node:assert/strict";
import { conditionEffects, zeroSpeedBy, autoFailBy, COND_INFO, condLine, condNotes } from "../js/conditions.js";
import { setEffectsSource, collectEffects, rollMods } from "../js/effects.js";
import { deriveCharacter, ABILITIES } from "../js/rules.js";
import { calcEval, calcPress } from "../js/views/tools.js";

setEffectsSource(() => null);
const ch = (conditions = [], exhaustion = 0) => ({ level: 5, class: "Fighter", speed: 30, conditions, exhaustion, abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }, saveProf: [], skillProf: [], hp: { cur: 10, max: 10 }, equipment: {} });
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FAIL", name); throw e; } };

t("no conditions, no effects", () => assert.deepEqual(conditionEffects(ch()), []));
t("Poisoned: disadvantage on attacks and every ability check", () => {
  const c = ch(["Poisoned"]); assert.deepEqual(rollMods(c, "atk").dis, ["Poisoned"]);
  ABILITIES.forEach(a => assert.deepEqual(rollMods(c, "check." + a).dis, ["Poisoned"], a)); assert.deepEqual(rollMods(c, "save.dex").dis, []);
});
t("Invisible gives advantage; Invisible + Poisoned cancel in the roll code (both listed)", () => {
  const c = ch(["Invisible", "Poisoned"]); const m = rollMods(c, "atk"); assert.deepEqual(m.adv, ["Invisible"]); assert.deepEqual(m.dis, ["Poisoned"]);
});
t("Restrained: speed 0, disadvantage on attacks and Dex saves", () => {
  const c = ch(["Restrained"]); assert.equal(deriveCharacter(c).speed, 0); assert.deepEqual(rollMods(c, "save.dex").dis, ["Restrained"]); assert.deepEqual(rollMods(c, "save.str").dis, []);
});
t("speed zero is not counted twice", () => assert.equal(deriveCharacter(ch(["Grappled", "Restrained"], 2)).speed, 0));
t("Exhaustion lowers speed by 5 per level, never below 0", () => {
  assert.equal(deriveCharacter(ch([], 2)).speed, 20); assert.equal(deriveCharacter({ ...ch([], 6), speed: 25 }).speed, 0);
});
t("auto-fail Str and Dex saves", () => {
  assert.deepEqual(autoFailBy(ch(["Paralyzed"]), "dex"), ["Paralyzed"]); assert.deepEqual(autoFailBy(ch(["Paralyzed"]), "wis"), []);
  assert.deepEqual(autoFailBy(ch(["Stunned", "Unconscious"]), "str"), ["Stunned", "Unconscious"]); assert.deepEqual(zeroSpeedBy(ch(["Charmed"])), []);
});
t("every condition has text and a short tag", () => Object.keys(COND_INFO).forEach(k => { assert.ok(condLine(k) || k === "Exhaustion", k); }));
t("notes list what the app applies and what stays manual", () => { const x = condNotes(ch(["Prone"], 1)); assert.equal(x.length, 2); assert.ok(x[0].manual.length); });
t("calculator", () => {
  assert.equal(calcEval("2+3×4"), 14); assert.equal(calcEval("(2+3)×4"), 20); assert.equal(calcEval("10÷4"), 2.5); assert.equal(calcEval("7−3"), 4);
  assert.equal(calcEval("2++"), null); assert.equal(calcEval("alert(1)"), null); assert.equal(calcEval("1/0"), null);
  let s = {}; "12+5".split("").forEach(k => { s = calcPress(s, k); }); s = calcPress(s, "="); assert.equal(s.expr, "17"); assert.equal(calcPress(s, "C").expr, "");
});
console.log(`conditions: ${n} checks passed`);
