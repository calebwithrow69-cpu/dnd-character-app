#!/usr/bin/env node
// Rules-file fixes for species variants that the text reader cannot get right on its own.
//   CR_PASSWORD=... node tools/crypt.mjs unlock ; node tools/apply-variant-fixes.mjs ; CR_PASSWORD=... node tools/crypt.mjs lock
// Ardling: the reader finds Climber, Flyer and Racer but not Swimmer, so all four are listed here from the book text. ASCII only.
import { readFileSync, writeFileSync } from "node:fs";
const LIB = "data/library.json", L = JSON.parse(readFileSync(LIB, "utf8"));
const ard = L.species.find(s => s.name === "Ardling");
const opts = [...String(ard.traits).matchAll(/^(Climber|Flyer|Racer|Swimmer) \(([^)]+)\)\.\s*(.+)$/gm)].map(m => ({ v: m[1], label: m[1] + " (" + m[2] + ")", detail: m[3].trim() }));
if (opts.length !== 4) { console.error("expected 4 ancestry types, found " + opts.length); process.exit(1); }
ard.choiceFix = { ...(ard.choiceFix || {}), options: { ...((ard.choiceFix || {}).options || {}), "Animal Ancestry": opts } };
console.log("Ardling Animal Ancestry:", opts.map(o => o.v).join(", "));
writeFileSync(LIB, JSON.stringify(L));
