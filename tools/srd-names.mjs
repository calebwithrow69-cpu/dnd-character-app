// Writes data/srd-names.json: only the NAMES of the 2024 SRD (5.2) entries, no rules text.
//   node tools/srd-names.mjs <5e-database/src/2024/en>
import { readFileSync, writeFileSync } from "node:fs";
const dir = process.argv[2];
if (!dir) { console.error("usage: node tools/srd-names.mjs <5e-database/src/2024/en>"); process.exit(1); }
const names = f => JSON.parse(readFileSync(`${dir}/5e-SRD-${f}.json`, "utf8")).map(x => x.name).sort((a, b) => a.localeCompare(b));
const out = { _comment: "Names of the 2024 SRD 5.2 entries (CC-BY-4.0). Names only. Used by the built-in SRD ruleset.",
  classes: names("Classes"), subclasses: names("Subclasses"), species: names("Species"), backgrounds: names("Backgrounds"), feats: names("Feats"), spells: names("Spells") };
writeFileSync("data/srd-names.json", JSON.stringify(out, null, 1) + "\n");
console.log(Object.entries(out).filter(([k]) => k[0] !== "_").map(([k, v]) => `${k}: ${v.length}`).join(", "));
