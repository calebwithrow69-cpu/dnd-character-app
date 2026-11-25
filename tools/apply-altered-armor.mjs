// Adds the Natural Armor benefit of the Altered feat to its effects (AC 13 + Dex or Con while unarmored).
// Run on the unlocked library: node tools/apply-altered-armor.mjs, then lock and commit the .enc.json.
import { readFileSync, writeFileSync } from "node:fs";
const P = "data/library.json";
const L = JSON.parse(readFileSync(P, "utf8"));
const f = (L.feats || []).find(x => x.name === "Altered");
if (!f) { console.error("Altered not found"); process.exit(1); }
f.effects = (f.effects || []).filter(e => e.name !== "Natural Armor");
for (const e of f.effects) if (e.when) e.when = JSON.parse(JSON.stringify(e.when).replace(/\["Altered","/g, '["Altered: Altered","'));
for (const ab of ["dex", "con"]) {
  f.effects.push({ t: "ac.base", op: "max", v: { add: [13, { abil: ab }] }, name: "Natural Armor", when: { all: [{ armor: "none" }, { pick: ["Altered: Altered", "Natural Armor"] }, { pick: ["Altered: Natural Armor ability", ab] }] } });
}
writeFileSync(P, JSON.stringify(L));
console.log("Altered effects:", f.effects.length);
