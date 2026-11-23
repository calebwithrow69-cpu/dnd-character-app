import assert from "node:assert/strict";
import { SECTION_KEYS, exportSettings, cleanSettings, resetKeys } from "../js/prefsdata.js";
let n = 0; const t = (name, fn) => { fn(); n++; };
t("export keeps only settings keys", () => {
  const e = exportSettings({ theme: "dark", lastChar: "x", seenVersion: "1", vol: 40 });
  assert.deepEqual(e.prefs, { theme: "dark", vol: 40 }); assert.equal(e.kind, "settings");
});
t("clean drops unknown keys and bad values", () => {
  const c = cleanSettings({ kind: "settings", prefs: { theme: "neon", accent: "teal", vol: 500, wake: "yes", bigtap: true, evil: 1, backupDays: 7 } });
  assert.deepEqual(c, { accent: "teal", vol: 100, bigtap: true, backupDays: "7" });
});
t("clean rejects other files", () => {
  assert.throws(() => cleanSettings({ characters: [] })); assert.throws(() => cleanSettings(null));
});
t("round trip", () => {
  const p = { theme: "light", accent: "violet", size: "small", corners: "round", density: "roomy", width: "wide", showxp: false, sheetStyle: "advanced" };
  assert.deepEqual(cleanSettings(exportSettings(p)), p);
});
t("resetKeys clears one section only", () => {
  const p = { theme: "dark", accent: "gold", vol: 20, lastBackup: 5 };
  resetKeys(p, "appearance"); assert.deepEqual(p, { vol: 20, lastBackup: 5 });
  assert.ok(SECTION_KEYS.sheet.includes("width"));
});
console.log(n + " passed");
