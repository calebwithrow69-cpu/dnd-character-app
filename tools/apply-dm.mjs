#!/usr/bin/env node
// Fold a DM-editor changes file into the rules.
//   CR_PASSWORD=... node tools/crypt.mjs unlock
//   node tools/apply-dm.mjs character-runner-dm-changes.json
//   CR_PASSWORD=... node tools/crypt.mjs lock      (commit only the .enc.json and campaign.json)
// New names are also added to data/campaign.json's enabled lists.
import { readFileSync, writeFileSync } from "node:fs";
import { applyPatch } from "../js/dm.js";

const file = process.argv[2];
if (!file) { console.error("Usage: node tools/apply-dm.mjs <changes.json>"); process.exit(1); }
const patch = JSON.parse(readFileSync(file, "utf8"));
const lib = JSON.parse(readFileSync("data/library.json", "utf8"));
const camp = JSON.parse(readFileSync("data/campaign.json", "utf8"));
const r = applyPatch(lib, camp, patch);
writeFileSync("data/library.json", JSON.stringify(r.library, null, 0));
writeFileSync("data/campaign.json", JSON.stringify(r.campaign, null, 2) + "\n");
for (const k of Object.keys(patch)) console.log(k, "->", (r.library[k] || []).length, "entries");
console.log("Now lock the library and commit. Then clear the changes on your device (DM editor > Clear).");
