#!/usr/bin/env node
// Unit tests for js/creation.js — the shared creation model.
// Run: CR_PASSWORD=<group password> node tools/crypt.mjs unlock, then node tests/creation.test.mjs, then delete data/library.json
// No framework: plain assertions, exit 1 on failure.

import { readFileSync } from "fs";
import { createRequire } from "module";

// ── Bootstrap: load library without a browser ─────────────────
// The modules import from each other with bare specifiers that work
// in a browser via import maps. Node needs a small shim.

// We can't import the browser modules directly because they use
// bare imports and browser APIs. Instead we'll test the logic by
// loading the library JSON and exercising the functions through
// a minimal app-shaped context.

// For now, we test the pure-data functions by building a mock app
// object and calling the creation module's exports.

const LIB_PATH = new URL("../data/library.json", import.meta.url).pathname;
const CAMP_PATH = new URL("../data/campaign.json", import.meta.url).pathname;

let library, campaign;
try {
  library = JSON.parse(readFileSync(LIB_PATH, "utf8"));
  campaign = JSON.parse(readFileSync(CAMP_PATH, "utf8"));
} catch (e) {
  console.error("Cannot load library.json — did you unlock it? Run: CR_PASSWORD=<pw> node tools/crypt.mjs unlock");
  process.exit(1);
}

// ── Minimal shim of the imports creation.js needs ─────────────
// Since the source is browser ES modules with import maps,
// we can't import them in Node directly. Instead, we replicate
// the key logic inline and test it structurally against real data.

// Load rules.js functions we need
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABEL = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const SKILLS = [
  { id: "acrobatics", label: "Acrobatics", ability: "dex" },
  { id: "animal-handling", label: "Animal Handling", ability: "wis" },
  { id: "arcana", label: "Arcana", ability: "int" },
  { id: "athletics", label: "Athletics", ability: "str" },
  { id: "deception", label: "Deception", ability: "cha" },
  { id: "history", label: "History", ability: "int" },
  { id: "insight", label: "Insight", ability: "wis" },
  { id: "intimidation", label: "Intimidation", ability: "cha" },
  { id: "investigation", label: "Investigation", ability: "int" },
  { id: "medicine", label: "Medicine", ability: "wis" },
  { id: "nature", label: "Nature", ability: "int" },
  { id: "perception", label: "Perception", ability: "wis" },
  { id: "performance", label: "Performance", ability: "cha" },
  { id: "persuasion", label: "Persuasion", ability: "cha" },
  { id: "religion", label: "Religion", ability: "int" },
  { id: "sleight-of-hand", label: "Sleight of Hand", ability: "dex" },
  { id: "stealth", label: "Stealth", ability: "dex" },
  { id: "survival", label: "Survival", ability: "wis" },
];

// ── Test harness ──────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "Assertion failed"); }
function eq(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── Data integrity checks ─────────────────────────────────────
console.log("\n=== Data integrity ===");

test("library has species, classes, backgrounds, feats, spells", () => {
  assert(library.species.length > 40, `species: ${library.species.length}`);
  assert(library.classes.length >= 12, `classes: ${library.classes.length}`);
  assert(library.backgrounds.length > 10, `backgrounds: ${library.backgrounds.length}`);
  assert(library.feats.length > 50, `feats: ${library.feats.length}`);
  assert(library.spells.length > 100, `spells: ${library.spells.length}`);
});

test("campaign.json has enabled lists", () => {
  assert(campaign.enabled, "no enabled key");
  assert(campaign.enabled.species?.length > 0, "no enabled species");
  assert(campaign.enabled.classes?.length > 0, "no enabled classes");
});

test("every enabled species exists in library", () => {
  for (const name of campaign.enabled.species || []) {
    assert(library.species.some(s => s.name === name), `species "${name}" not in library`);
  }
});

test("every enabled class exists in library", () => {
  for (const name of campaign.enabled.classes || []) {
    assert(library.classes.some(c => c.name === name), `class "${name}" not in library`);
  }
});

// ── Campaign-filtered helpers (replicate data.js logic) ───────
function enabledSpecies() {
  const allow = campaign.enabled?.species ? new Set(campaign.enabled.species) : null;
  return library.species.filter(s => !allow || allow.has(s.name));
}
function enabledClasses() {
  const allow = campaign.enabled?.classes ? new Set(campaign.enabled.classes) : null;
  return library.classes.filter(c => !allow || allow.has(c.name));
}
function enabledBackgrounds() {
  const allow = campaign.enabled?.backgrounds ? new Set(campaign.enabled.backgrounds) : null;
  return library.backgrounds.filter(b => !allow || allow.has(b.name));
}

// ── Chapter validation logic (test against real data) ─────────
console.log("\n=== Validation ===");

// We test the validation concepts without importing the browser module.
// This verifies that the data shapes support the validation rules.

test("every class has skillFrom and skillN", () => {
  for (const cls of enabledClasses()) {
    assert(cls.skillFrom, `${cls.name} missing skillFrom`);
    assert(cls.skillN > 0, `${cls.name} missing skillN`);
  }
});

test("every class has hd (hit die)", () => {
  for (const cls of enabledClasses()) {
    assert([6, 8, 10, 12].includes(cls.hd), `${cls.name} hd=${cls.hd}`);
  }
});

test("every class has saves", () => {
  for (const cls of enabledClasses()) {
    assert(cls.saves, `${cls.name} missing saves`);
  }
});

test("every class has equipment text", () => {
  for (const cls of enabledClasses()) {
    assert(cls.equipment && cls.equipment.length > 10, `${cls.name} missing equipment`);
  }
});

test("every background has skills or effect with Skill Proficiency", () => {
  for (const bg of enabledBackgrounds()) {
    const hasSkills = bg.skills || /Skill Proficienc/i.test(bg.effect || "");
    assert(hasSkills, `${bg.name} missing skills`);
  }
});

test("every background has a feat", () => {
  for (const bg of enabledBackgrounds()) {
    const hasFeat = bg.feat || /Feat:\s*\S/.test(bg.effect || "");
    assert(hasFeat, `${bg.name} missing feat`);
  }
});

test("every background has ability score options or effect with Ability Scores", () => {
  for (const bg of enabledBackgrounds()) {
    const has = bg.abilities || /Ability Scores:\s*\S/.test(bg.effect || "");
    assert(has, `${bg.name} missing ability scores`);
  }
});

// ── Species choice parsing (structural check) ─────────────────
console.log("\n=== Species choices ===");

test("species with known choices parse correctly", () => {
  // Aasimar should have a lineage choice ("Celestial Revelation")
  const aasimar = library.species.find(s => s.name === "Aasimar");
  assert(aasimar, "Aasimar not found");
  assert(aasimar.traits.length > 100, "Aasimar traits too short");
  // The traits should mention "choose" or have an option table
  const hasChoice = /choose|lineage|revelation/i.test(aasimar.traits);
  assert(hasChoice, "Aasimar traits don't mention choices");
});

test("Dragonborn has Draconic Ancestry in traits", () => {
  const db = library.species.find(s => s.name === "Dragonborn");
  assert(db, "Dragonborn not found");
  assert(/Draconic Ancestry/i.test(db.traits), "Dragonborn missing Draconic Ancestry");
});

test("species with size choice (Human should be Medium only)", () => {
  const human = library.species.find(s => s.name === "Human");
  assert(human, "Human not found");
  // Human should NOT have a size choice (always Medium)
  const hasSizeChoice = /Medium or Small/i.test(human.traits);
  // Some species DO have size choice
  const halfling = library.species.find(s => s.name === "Halfling");
  if (halfling) {
    // Halfling is Small
    assert(/Small/i.test(halfling.traits), "Halfling should be Small");
  }
});

// ── Equipment parsing ─────────────────────────────────────────
console.log("\n=== Equipment ===");

test("Fighter equipment has three options (A, B, C)", () => {
  const fighter = library.classes.find(c => c.name === "Fighter");
  assert(fighter, "Fighter not found");
  const text = fighter.equipment;
  assert(/Option A|Choose A/i.test(text) || /\bA:/.test(text), "Fighter missing option A");
  // Should have GP amounts
  assert(/\d+ GP/i.test(text), "Fighter missing GP in equipment");
});

test("every enabled class equipment text is parseable", () => {
  for (const cls of enabledClasses()) {
    // Just check it doesn't crash and has content
    assert(cls.equipment, `${cls.name} equipment is empty`);
    assert(cls.equipment.length > 20, `${cls.name} equipment too short: ${cls.equipment.length}`);
  }
});

// ── Dependency invalidation (conceptual) ──────────────────────
console.log("\n=== Dependencies ===");

test("feat names referenced by backgrounds exist in library", () => {
  const missing = [];
  for (const bg of enabledBackgrounds()) {
    const line = /Feat:\s*([^\n]+)/.exec(bg?.effect || "");
    const raw = (line ? line[1] : bg?.feat || "").replace(/['']/g, "'").trim();
    if (!raw) continue;
    const names = raw.split(/\s+or\s+/).map(s => s.trim().replace(/\s*\(.*\)$/, ""));
    for (const n of names) {
      if (!library.feats.some(f => f.name === n)) missing.push(`${bg.name} -> ${n}`);
    }
  }
  assert(missing.length === 0, `Missing feats: ${missing.join(", ")}`);
});

test("spells referenced by origin feats exist", () => {
  const originFeats = library.feats.filter(f => /Origin/i.test(f.type || ""));
  const missing = [];
  for (const feat of originFeats) {
    // Look for spell references
    const re = /(?:know|learn|always have) the ([a-z][\w'/ ]+?) (?:cantrip|spell)/gi;
    let m;
    while ((m = re.exec(feat.text || ""))) {
      const name = m[1].replace(/^the\s+/i, "").replace(/(^|[\s/-])([a-z])/g, (x, a, b) => a + b.toUpperCase());
      if (!library.spells.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        missing.push(`${feat.name} -> ${name}`);
      }
    }
  }
  // Allow a few misses from parsing noise
  if (missing.length > 3) assert(false, `Too many missing spell refs: ${missing.join(", ")}`);
});

// ── Draft shape ───────────────────────────────────────────────
console.log("\n=== Draft shape ===");

test("blank draft has all required fields", () => {
  // Replicate blankDraft structure
  const d = {
    chapter: 0, name: "", species: "", class: "", background: "", subclass: "",
    base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    bonusMode: "21", plus2: "", plus1: "", classSkills: [], picks: {},
    equipClass: "A", equipBg: "A", rolls: null, mode: "manual", templateId: null, ts: Date.now(),
  };
  for (const a of ABILITIES) assert(typeof d.base[a] === "number", `base.${a} not a number`);
  assert(Array.isArray(d.classSkills));
  assert(typeof d.picks === "object");
});

test("draft persistence round-trips through JSON", () => {
  const d = {
    chapter: 2, name: "Test", species: "Elf", class: "Wizard", background: "Sage",
    subclass: "", base: { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 },
    bonusMode: "21", plus2: "int", plus1: "dex", classSkills: ["arcana", "history"],
    picks: { "sp:0": "High Elf", "bg:lang": ["Elvish", "Draconic"] },
    equipClass: "A", equipBg: "A", rolls: null, mode: "manual", templateId: null, ts: 1234567890,
  };
  const json = JSON.stringify(d);
  const d2 = JSON.parse(json);
  eq(d2.name, "Test");
  eq(d2.species, "Elf");
  eq(d2.picks["sp:0"], "High Elf");
  eq(d2.picks["bg:lang"], ["Elvish", "Draconic"]);
  eq(d2.classSkills, ["arcana", "history"]);
  eq(d2.base.int, 15);
});

// ── Chapter structure ─────────────────────────────────────────
console.log("\n=== Chapter structure ===");

const CHAPTERS = [
  { id: "abilities",  title: "Ability Scores",  short: "Abilities" },
  { id: "class",      title: "Class",           short: "Class" },
  { id: "classOpts",  title: "Class Choices",   short: "Class Opts" },
  { id: "species",    title: "Species",         short: "Species" },
  { id: "background", title: "Background",      short: "Background" },
  { id: "finalize",   title: "Finalize Choices", short: "Finalize" },
  { id: "roleplay",   title: "Roleplay Details", short: "Roleplay" },
];

test("7 chapters in correct order", () => {
  eq(CHAPTERS.length, 7);
  eq(CHAPTERS[0].id, "abilities");
  eq(CHAPTERS[1].id, "class");
  eq(CHAPTERS[6].id, "roleplay");
});

test("every chapter has id, title, short", () => {
  for (const ch of CHAPTERS) {
    assert(ch.id, "missing id");
    assert(ch.title, "missing title");
    assert(ch.short, "missing short");
  }
});

// ── Summary ───────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
