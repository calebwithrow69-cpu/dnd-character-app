// Lists every feat / class feature / subclass feature / species whose rules text looks like it
// changes a number but has no `effects` entry yet. Reads the UNLOCKED data/library.json
// (CR_PASSWORD=... node tools/crypt.mjs unlock first). Nothing is written.
//   node tools/effects-audit.mjs          summary + names
//   node tools/effects-audit.mjs --done   also list entries that already have effects
import fs from "node:fs";
const lib = JSON.parse(fs.readFileSync(new URL("../data/library.json", import.meta.url)));
const MATH = /(Hit Point maximum increases|\+\d+ bonus to|bonus to (your )?(AC|Armor Class|attack|damage|initiative|Speed)|Speed increases|increases? by \d+ feet|your Speed|add your .{0,30}(modifier|Proficiency Bonus) to|Initiative|Armor Class equals|base Armor Class)/i;
const rows = [];
const scan = (kind, owner, e, text) => { const has = Array.isArray(e.effects) && e.effects.length; if (has || MATH.test(text || "")) rows.push({ kind, name: (owner ? owner + ": " : "") + (e.name || "(intro)"), has }); };
lib.feats.forEach(f => scan("feat", "", f, f.text));
lib.classes.forEach(c => (c.features || []).forEach(f => scan("class feature", c.name, f, f.text)));
lib.subclasses.forEach(c => (c.features || []).forEach(f => scan("subclass feature", c.name, f, f.text)));
lib.species.forEach(s => scan("species", "", s, s.traits));
const todo = rows.filter(r => !r.has), done = rows.filter(r => r.has);
console.log(`effects entries: ${done.length}   still to cover: ${todo.length}`);
for (const kind of ["feat", "class feature", "subclass feature", "species"]) {
  const t = todo.filter(r => r.kind === kind);
  console.log(`\n${kind} (${t.length})\n  ` + t.map(r => r.name).join("\n  "));
}
if (process.argv.includes("--done")) console.log("\nDONE\n  " + done.map(r => `${r.kind}: ${r.name}`).join("\n  "));
