// Base game ruleset: only SRD 5.2 names are allowed. Needs the unlocked library.
import { readFileSync, existsSync } from "node:fs";
import { srdRuleset, setSrdNames, countAllowed, problems, effectiveCampaign } from "../js/rulesets.js";
if (!existsSync("data/library.json")) { console.log("srdruleset: skipped (library locked)"); process.exit(0); }
const L = JSON.parse(readFileSync("data/library.json", "utf8")), N = JSON.parse(readFileSync("data/srd-names.json", "utf8"));
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL", m); } };
setSrdNames(N);
const rs = srdRuleset(L), c = Object.fromEntries(countAllowed(rs, L).map(([l, on]) => [l.toLowerCase(), on]));
ok(c.classes === 12 && c.species === 9 && c.backgrounds === 4 && c.spells === 339, "counts " + JSON.stringify(c));
ok(c.feats >= 16 && c.feats <= 17, "feats " + c.feats);
ok(problems(rs, L).length === 0, "usable");
const camp = effectiveCampaign({}, L, rs);
ok(camp.enabled.classes.length === 12 && !camp.enabled.species.includes("Tiefling-Homebrew"), "campaign lists");
ok(camp._subAllow.size === 12, "12 subclasses " + camp._subAllow.size);
setSrdNames(null); ok(srdRuleset(L).defaultBooks === true, "no names file allows everything");
console.log(bad ? "srdruleset: " + bad + " failed" : "srdruleset: all checks passed");
process.exit(bad ? 1 : 0);
