#!/usr/bin/env node
// Level 1 class choices: what each class asks for at creation, and that the Class Choices chapter comes right after Class.
// Needs the unlocked rules: CR_PASSWORD=<pw> node tools/crypt.mjs unlock, run this, then delete data/library.json.
import { readFileSync } from "node:fs";
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
globalThis.window = globalThis; globalThis.localStorage = mem(); globalThis.sessionStorage = mem();
const C = await import("../js/creation.js"); const S = await import("../js/store.js");
let library, campaign;
try { library = JSON.parse(readFileSync(new URL("../data/library.json", import.meta.url), "utf8")); campaign = JSON.parse(readFileSync(new URL("../data/campaign.json", import.meta.url), "utf8")); }
catch (e) { console.error("Cannot load library.json - unlock it first."); process.exit(1); }
const app = { library, campaign };
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { failed++; console.log("  FAIL " + name + " - " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const draftFor = (cls, sp = "", bg = "") => { const d = C.blankDraft(); d.class = cls; d.species = sp; d.background = bg; return d; };
const labels = cls => { const cp = C.choicePlan(draftFor(cls), app); return cp.steps.map(s => s.label + (s.n ? " x" + s.n : "")).concat(cp.expertise ? ["Expertise(later)"] : []); };

// What the 2024 rules ask for at level 1, checked against what the app asks.
const EXPECT = {
  Barbarian: ["Weapon mastery x2"], Bard: ["Cantrips x2", "Spells x4"], Cleric: ["Divine Order", "Cantrips x3", "Spells x4"],
  Druid: ["Primal Order", "Cantrips x2", "Spells x4"], Fighter: ["Fighting style", "Weapon mastery x3"], Monk: [],
  Paladin: ["Weapon mastery x2", "Spells x2"], Ranger: ["Weapon mastery x2", "Spells x2"], Rogue: ["Language", "Weapon mastery x2", "Expertise(later)"],
  Sorcerer: ["Cantrips x4", "Spells x2"], Warlock: ["Eldritch Invocations x1", "Cantrips x2", "Spells x2"], Wizard: ["Cantrips x3", "Spells x4"]
};
for (const [cls, want] of Object.entries(EXPECT)) test(cls + " asks for: " + (want.join(", ") || "nothing"), () => {
  const got = labels(cls); assert(JSON.stringify(got) === JSON.stringify(want), "got " + JSON.stringify(got));
});
test("Class Choices is the second chapter and needs only a class", () => {
  assert(C.CHAPTERS[0].id === "class" && C.CHAPTERS[1].id === "classChoices" && C.CHAPTERS.length === 7, C.CHAPTERS.map(c => c.id).join(","));
  const d = draftFor("Druid"); assert(C.choicePlan(d, app) && !C.validateChapter("classChoices", d, app).valid, "Primal Order not required");
  assert(C.choicePlan(C.blankDraft(), app) === null);
});
test("Druid: Primal Order options come from the book text", () => {
  const st = C.choicePlan(draftFor("Druid"), app).steps.find(s => s.id === "order");
  assert(st.options.map(o => o.name).join(",") === "Magician,Warden", st.options.map(o => o.name).join(","));
});
test("Cleric: Divine Order options come from the book text", () => {
  assert(C.choicePlan(draftFor("Cleric"), app).steps.find(s => s.id === "order").options.map(o => o.name).join(",") === "Protector,Thaumaturge");
});
test("Magician and Thaumaturge learn one extra cantrip, Warden and Protector do not", () => {
  const n = (cls, order) => { const d = draftFor(cls); C.choicePlan(d, app); d.lvl.order = order; return C.choicePlan(d, app).steps.find(s => s.id === "cantrips").n; };
  assert(n("Druid", "Magician") === n("Druid", "Warden") + 1 && n("Cleric", "Thaumaturge") === n("Cleric", "Protector") + 1);
});
test("an unanswered Order blocks the chapter; answering it opens the chapter for the rest", () => {
  const d = draftFor("Druid"), cp = C.choicePlan(d, app); assert(!cp.ok);
  cp.lvl.order = "Warden"; assert(C.choicePlan(d, app).steps.find(s => s.id === "order") && !C.choicePlan(d, app).ok, "cantrips still needed");
});
test("Rogue expertise waits for the skills: it blocks Skills and Gear, not Class Choices", () => {
  const d = draftFor("Rogue", "Human", "Criminal"); d.scoresSet = true; const cp = C.choicePlan(d, app);
  assert(cp.expertise && !cp.steps.some(s => s.id === "expertise"), "expertise should be deferred");
  assert(C.validateChapter("classOpts", d, app).reasons.includes("Choose your expertise skills."), C.validateChapter("classOpts", d, app).reasons.join("|"));
});
test("a cantrip a species or background grants is dropped from the class picks", () => {
  const d = draftFor("Wizard", "Elf", "Sage"); const cp = C.choicePlan(d, app); cp.lvl.cantrips = ["Light", "Mage Hand"];
  const had = new Set((C.choicePlan(d, app).tmp.spellcasting?.spells || []).map(s => s.name)); assert(had.size >= 0);
  d.lvl.cantrips = [...had].slice(0, 1).concat(["Light"]); const after = C.choicePlan(d, app).lvl.cantrips; assert(!after.some(n => had.has(n)), "kept " + after.join(","));
});
test("Druid shop: light armor and shields, simple weapons, Herbalism Kit, nothing heavier", () => {
  const d = draftFor("Druid", "Human", "Guide"), names = g => C.creationStock(app, d).filter(r => r.group === g).map(r => r.name);
  const a = names("Armor"), w = names("Weapons"), t = names("Tools");
  assert(a.includes("Leather Armor") && a.includes("Shield") && !a.includes("Chain Shirt") && !a.includes("Chain Mail") && !a.includes("Plate Armor"), "armor: " + a.join(","));
  assert(w.includes("Quarterstaff") && w.includes("Sickle") && !w.includes("Longsword") && !w.includes("Rapier"), "weapons: " + w.join(","));
  assert(t.includes("Herbalism Kit") && !t.includes("Thieves' Tools"), "tools: " + t.join(","));
});
test("the shop on the sheet filters by the character's training", () => {
  const d = draftFor("Druid", "Human", "Guide"); d.name = "D"; d.scoresSet = true;
  const ch = S.normalize(C.buildCharacter(d, app), library), t = C.trainingFromChar(ch), row = n => ({ name: n, cat: n === "Chain Mail" || n === "Shield" || n === "Leather Armor" ? "Armor" : "Weapons" });
  assert(C.isTrained(app, t, row("Leather Armor")) && C.isTrained(app, t, row("Shield")) && !C.isTrained(app, t, row("Chain Mail")), "armor training");
  assert(C.isTrained(app, t, row("Quarterstaff")) && !C.isTrained(app, t, row("Longsword")), "weapon training");
  assert(C.isTrained(app, t, { name: "Rope", cat: "Gear" }) && C.isTrained(app, t, { name: "Herbalism Kit", cat: "Gear" }), "gear and tools");
});
test("random characters are complete for every class, including Magician and Thaumaturge (extra cantrip)", () => {
  const bad = [];
  for (const cls of campaign.enabled.classes) for (let i = 0; i < 25; i++) {
    const d = C.blankDraft(); C.generateRandom(d, app, { class: cls }); d.name = "T"; const v = C.validateAll(d, app);
    if (!v.valid) bad.push(cls + ": " + Object.entries(v.chapters).filter(([, x]) => !x.valid).map(([c, x]) => c + "=" + x.reasons[0]).join("|"));
  }
  assert(bad.length === 0, bad.slice(0, 3).join(" ; "));
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
