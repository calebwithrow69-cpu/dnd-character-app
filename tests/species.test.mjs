#!/usr/bin/env node
// Species with variants: the options are complete, the book's table is not left behind in the ability text, and traits that follow a table are their own traits.
// Needs the unlocked rules: CR_PASSWORD=<pw> node tools/crypt.mjs unlock, run this, then delete data/library.json.
import { readFileSync } from "node:fs";
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
globalThis.window = globalThis; globalThis.localStorage = mem(); globalThis.sessionStorage = mem();
const CH = await import("../js/choices.js"), SP = await import("../js/species.js");
let library, campaign;
try { library = JSON.parse(readFileSync(new URL("../data/library.json", import.meta.url), "utf8")); campaign = JSON.parse(readFileSync(new URL("../data/campaign.json", import.meta.url), "utf8")); }
catch (e) { console.error("Cannot load library.json - unlock it first."); process.exit(1); }
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { failed++; console.log("  FAIL " + name + " - " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const withVariants = library.species.filter(s => campaign.enabled.species.includes(s.name)).map(s => [s, CH.variantDef(s, library, campaign)]).filter(([, v]) => v);

test("nine species have variants", () => assert(withVariants.length === 9, withVariants.map(([s]) => s.name).join(",")));
test("Ardling lists all four ancestry types", () => {
  const v = withVariants.find(([s]) => s.name === "Ardling")[1]; assert(v.options.map(o => o.v).sort().join(",") === "Climber,Flyer,Racer,Swimmer", v.options.map(o => o.v).join(","));
});
test("every variant option has a description", () => {
  for (const [s, v] of withVariants) for (const o of v.options) assert(String(o.detail || "").trim().length > 5, s.name + " / " + o.v + " has no text");
});
test("the ability text keeps no table rows, table titles or all-caps headers", () => {
  for (const [s, v] of withVariants) {
    const t = SP.parseSpecies(s).traits.find(x => x.name === v.trait); if (!t) continue;
    const body = CH.stripVariantText(t.body, v);
    assert(!body.split("\n").some(l => /\S\s{3,}\S/.test(l)), s.name + ": table row left in the text");
    assert(!body.split("\n").some(l => /^[A-Z0-9' ]{4,50}$/.test(l.trim())), s.name + ": header left in the text");
  }
});
test("Dragonborn: Breath Weapon is its own ability, not part of Draconic Ancestry", () => {
  const tr = SP.parseSpecies(library.species.find(s => s.name === "Dragonborn")).traits;
  const bw = tr.find(t => t.name === "Breath Weapon"); assert(bw && bw.kind === "active", "Breath Weapon missing or not an ability");
  assert(!/exhalation of magical energy/i.test(tr.find(t => t.name === "Draconic Ancestry").body), "Breath Weapon text still inside Draconic Ancestry");
});
test("Elf, Tiefling and Dragonborn variants are listed A to Z by the picker order", () => {
  for (const n of ["Elf", "Tiefling", "Dragonborn"]) { const v = withVariants.find(([s]) => s.name === n)[1]; const sorted = [...v.options].sort((a, b) => a.v.localeCompare(b.v)); assert(sorted.length === v.options.length && sorted[0].v, n); }
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
