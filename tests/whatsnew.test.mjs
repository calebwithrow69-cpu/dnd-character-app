import assert from "node:assert/strict";
import { cmpVer, entriesSince, splashPlan } from "../js/whatsnew.js";
import { CHANGELOG, VERSION } from "../js/changelog.js";
let n = 0; const t = (name, fn) => { fn(); n++; };
const log = ["0.1.9", "0.1.10", "0.1.11", "0.2.0"].map(v => ({ v }));
t("version compare is numeric", () => { assert.equal(cmpVer("0.1.9", "0.1.10"), -1); assert.equal(cmpVer("0.2.0", "0.1.99"), 1); assert.equal(cmpVer("0.1", "0.1.0"), 0); assert.equal(cmpVer("", "0.0.1"), -1); });
t("entries since a version, newest first, capped", () => {
  assert.deepEqual(entriesSince(log, "0.1.9").list.map(e => e.v), ["0.2.0", "0.1.11", "0.1.10"]);
  assert.deepEqual(entriesSince(log, "0.1.9", 2).list.map(e => e.v), ["0.2.0", "0.1.11"]); assert.equal(entriesSince(log, "0.1.9", 2).more, 1);
  assert.equal(entriesSince(log, "0.2.0").list.length, 0);
});
t("a device away for many versions gets all of them", () => { assert.equal(entriesSince(log, "0.0.1").list.length, 4); });
const base = { version: "0.2.0", enabled: true, automated: false, hasContent: false, changelog: log };
t("splash plan", () => {
  assert.equal(splashPlan({ ...base, prev: "0.1.10" }).show, true);
  assert.equal(splashPlan({ ...base, prev: "0.2.0" }).show, false);
  assert.equal(splashPlan({ ...base, prev: "0.2.0", hasContent: true }).show, true);
  assert.equal(splashPlan({ ...base, prev: "" }).show, false, "new device");
  assert.equal(splashPlan({ ...base, prev: "0.1.9", enabled: false }).show, false, "setting off");
  assert.equal(splashPlan({ ...base, prev: "0.1.9", automated: true }).show, false);
  assert.equal(splashPlan({ ...base, prev: "0.3.0" }).show, false, "a newer marker never shows older entries");
});
t("the real changelog has a newest entry matching VERSION and groups", () => {
  assert.equal(CHANGELOG[0].v, VERSION);
  for (const e of CHANGELOG) assert.ok(Array.isArray(e.groups) && e.groups.length, e.v);
  assert.ok(entriesSince(CHANGELOG, "0.1.0", 99).list.length > 10);
});
console.log(`whatsnew: ${n} checks passed`);
