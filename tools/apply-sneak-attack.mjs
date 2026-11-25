// Encodes the Rogue's Sneak Attack as a once-per-turn damage rider (shown as a button on the damage roll).
// Run on the unlocked library: node tools/apply-sneak-attack.mjs, then lock and commit the .enc.json. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";
const P = "data/library.json";
const L = JSON.parse(readFileSync(P, "utf8"));
const f = (L.classes.find(c => c.name === "Rogue")?.features || []).find(x => x.name === "Sneak Attack");
if (!f) { console.error("Sneak Attack not found"); process.exit(1); }
const steps = [3, 5, 7, 9, 11, 13, 15, 17, 19].map((lv, i) => [lv, (i + 2) + "d6"]);
f.effects = [{ t: "dmg", v: { dice: "1d6", steps }, rider: true, once: true, name: "Sneak Attack", note: "Once per turn. Needs Advantage, or an ally within 5 ft and no Disadvantage.", when: { any: [{ wield: "finesse" }, { wield: "ranged" }] } }];
writeFileSync(P, JSON.stringify(L));
console.log("Sneak Attack effects:", f.effects.length);
