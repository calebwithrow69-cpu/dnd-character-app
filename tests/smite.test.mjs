// Smite riders: which chips a melee hit offers. Pure Node. ASCII only.
import assert from "node:assert/strict";
import { smiteRiders, ridersFor } from "../js/riders.js";
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const pal = lv => ({ class: "Paladin", level: lv, resources: [{ name: "Paladin's Smite", max: 1, used: 0 }], spellcasting: { spells: [{ name: "Searing Smite", prepared: true }], slotsUsed: Array(10).fill(0) } });
t("paladin 2 gets free Divine Smite and level 1 slot chips", () => {
  const r = smiteRiders(pal(2)), ids = r.map(x => x.id);
  assert.ok(ids.includes("smite-free")); assert.ok(ids.includes("smite-Divine Smite-1")); assert.ok(ids.includes("smite-Searing Smite-1"));
  assert.equal(r.find(x => x.id === "smite-Divine Smite-1").dice, "2d8");
});
t("dice grow one die per slot level", () => {
  const r = smiteRiders(pal(17)), d = lv => r.find(x => x.id === `smite-Divine Smite-${lv}`).dice;
  assert.equal(d(3), "4d8"); assert.equal(d(5), "6d8");
  assert.equal(r.find(x => x.id === "smite-Searing Smite-3").dice, "3d6");
});
t("spent slots drop out; free cast gone when used", () => {
  const c = pal(5); c.spellcasting.slotsUsed[0] = 4; c.resources[0].used = 1;
  const ids = smiteRiders(c).map(x => x.id);
  assert.ok(!ids.includes("smite-Divine Smite-1")); assert.ok(!ids.includes("smite-free")); assert.ok(ids.includes("smite-Divine Smite-2"));
});
t("only a melee weapon roll offers them", () => {
  const c = pal(5), app = { library: { classes: [], subclasses: [] } };
  assert.ok(ridersFor(app, c, {}, { kind: "weapon", melee: true }).damage.some(x => /Smite/.test(x.label)));
  assert.ok(!ridersFor(app, c, {}, { kind: "weapon", melee: false }).damage.some(x => /Smite/.test(x.label)));
  assert.ok(!ridersFor(app, c, {}, { kind: "spell" }).damage.some(x => /Smite/.test(x.label)));
});
t("a non-Paladin without the spell sees nothing", () => {
  const c = { class: "Fighter", level: 5, resources: [], spellcasting: { spells: [], slotsUsed: [] } };
  assert.equal(smiteRiders(c).length, 0);
});
console.log(n + " passed");
