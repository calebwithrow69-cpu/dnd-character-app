#!/usr/bin/env node
// Survey of class and subclass features: what each one needs from the app, coverage by level, and holes. Reads the UNLOCKED data/library.json. Nothing is written.
//   CR_PASSWORD=... node tools/crypt.mjs unlock ; node tools/ability-survey.mjs [--json]
import fs from "node:fs";
const L = JSON.parse(fs.readFileSync(new URL("../data/library.json", import.meta.url)));
const C = JSON.parse(fs.readFileSync(new URL("../data/campaign.json", import.meta.url)));
const KINDS = [
  ["limited", /(a number of times equal to|regain(?:s|ing)? (?:all )?(?:expended )?uses?|once per (?:short|long) rest|(?:short|long) rest[^.]{0,40}(?:regain|restore)|you can use this feature (?:once|twice|\w+ times)|uses? of this feature)/i],
  ["timed", /(for 1 minute|for 10 minutes|for 1 hour|until the (?:start|end) of your next turn|until the end of your turn|ends early if|for the duration)/i],
  ["resist", /(Resistance to [A-Z][a-z]+ damage|have Resistance|Immunity to)/],
  ["stat", /(Hit Point maximum increases|bonus to (?:your )?(?:AC|Armor Class|attack|damage|initiative|saving|Speed)|Speed increases|your Speed|Armor Class equals|add your .{0,30}(?:modifier|proficiency)|proficiency bonus to)/i],
  ["rollmod", /(Advantage on|Disadvantage on|extra \d+d\d+|additional \d+d\d+|\d+d\d+ (?:extra )?damage|reroll|can replace the roll|add (?:\d+d\d+|your))/i],
  ["spells", /(always have .{0,30}prepared|you (?:know|learn) the .{0,40}(?:cantrip|spell)|cast .{0,40}without (?:expending )?a spell slot|spell slot)/i],
  ["choice", /(choose (?:one|two|three|a|an)\b|of your choice|your choice)/i]
];
const kindsOf = t => KINDS.filter(([, re]) => re.test(t || "")).map(([k]) => k);
const hasFx = f => Array.isArray(f.effects) && f.effects.length > 0;
const hasTr = f => Array.isArray(f.trackers) && f.trackers.length > 0;
const out = { classes: {}, subclasses: {}, totals: {} };
const tally = (rows, label) => {
  const t = { features: rows.length, withEffects: rows.filter(r => r.fx).length, withTrackers: rows.filter(r => r.tr).length, byKind: {} };
  for (const k of KINDS.map(x => x[0])) t.byKind[k] = rows.filter(r => r.kinds.includes(k)).length;
  t.needsWork = rows.filter(r => r.kinds.length && !r.fx && !r.tr).length; t.narrativeOnly = rows.filter(r => !r.kinds.length).length;
  out.totals[label] = t; return t;
};
const classRows = [];
for (const c of L.classes.filter(c => C.enabled.classes.includes(c.name))) {
  const rows = (c.features || []).map(f => ({ cls: c.name, name: f.name, lv: f.lv, fx: hasFx(f), tr: hasTr(f), kinds: kindsOf(f.text) }));
  classRows.push(...rows);
  const maxLv = Math.max(0, ...rows.map(r => r.lv)); out.classes[c.name] = { features: rows.length, maxLevel: maxLv, ...tally(rows, "class:" + c.name) };
}
tally(classRows, "ALL class features");
const subRows = [];
for (const s of L.subclasses) {
  const feats = (s.features || []);
  const rows = feats.map(f => ({ cls: s.cls, sub: s.name, name: f.name, lv: f.lv, fx: hasFx(f), tr: hasTr(f), kinds: kindsOf(f.text), intro: !!f.intro }));
  subRows.push(...rows.filter(r => !r.intro));
  const lvls = rows.filter(r => !r.intro).map(r => r.lv);
  out.subclasses[s.cls + ": " + s.name] = { source: s.source || "", features: lvls.length, levels: [...new Set(lvls)].sort((a, b) => a - b), maxLevel: Math.max(0, ...lvls), below3: rows.filter(r => !r.intro && r.lv < 3).map(r => r.name + "@" + r.lv), enabled: C.enabled.subclasses ? C.enabled.subclasses.includes(s.name) : true };
}
tally(subRows, "ALL subclass features");
if (process.argv.includes("--json")) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
const T = out.totals;
for (const k of ["ALL class features", "ALL subclass features"]) { const t = T[k]; console.log(`${k}: ${t.features} | with effects ${t.withEffects} | with trackers ${t.withTrackers} | text suggests work but none yet ${t.needsWork} | narrative only ${t.narrativeOnly}\n   by need: ${Object.entries(t.byKind).map(([a, b]) => a + " " + b).join(", ")}`); }
console.log("\nPER CLASS (features / max level / need work)"); for (const [n, c] of Object.entries(out.classes)) console.log(`  ${n.padEnd(10)} ${String(c.features).padStart(3)} / L${c.maxLevel} / ${c.needsWork}`);
const subs = Object.entries(out.subclasses);
console.log(`\nSUBCLASSES: ${subs.length}`); const byMax = {}; subs.forEach(([, s]) => { byMax[s.maxLevel] = (byMax[s.maxLevel] || 0) + 1; }); console.log("  by highest feature level:", JSON.stringify(byMax));
console.log("  subclasses with features before level 3:", subs.filter(([, s]) => s.below3.length).length);
console.log("  subclasses ending at level 10 or lower (data cut):", subs.filter(([, s]) => s.maxLevel <= 10).length, "| reaching 14+:", subs.filter(([, s]) => s.maxLevel >= 14).length);
