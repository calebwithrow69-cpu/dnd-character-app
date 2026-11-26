// Encodes the Monk's Martial Arts: the Martial Arts die as an Unarmed Strike option, and Dexterous Attacks
// (Dex instead of Str for Unarmed Strikes and Monk weapons) while wearing no armor and no shield.
// Run on the unlocked library: node tools/apply-martial-arts.mjs, then lock and commit the .enc.json. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";
const P = "data/library.json";
const L = JSON.parse(readFileSync(P, "utf8"));
const f = (L.classes.find(c => c.name === "Monk")?.features || []).find(x => x.name === "Martial Arts");
if (!f) { console.error("Martial Arts not found"); process.exit(1); }
const bare = [{ armor: "none" }, { shield: false }];
f.effects = [
  { t: "unarmed", op: "grant", name: "Martial Arts", v: { dice: "1d6", steps: [[5, "1d8"], [11, "1d10"], [17, "1d12"]], dtype: "bludgeoning", abil: "str" }, when: { all: bare } },
  { t: "abil.alt", op: "grant", name: "Dexterous Attacks", v: { abil: "dex" }, when: { all: [...bare, { wield: "monk" }] } }
];
writeFileSync(P, JSON.stringify(L));
console.log("Martial Arts effects:", f.effects.length);
