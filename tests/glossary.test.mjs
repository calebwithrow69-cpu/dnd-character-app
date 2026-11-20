#!/usr/bin/env node
// Rules glossary: every lookup the app has is one list, nothing is listed twice, the SRD reference entries are all there,
// and search, filters and bookmarks behave. Needs the unlocked rules:
// CR_PASSWORD=<pw> node tools/crypt.mjs unlock, run this, then delete data/library.json.
import { readFileSync } from "node:fs";
const G = await import("../js/glossary.js");
let L, T;
try { L = JSON.parse(readFileSync(new URL("../data/library.json", import.meta.url), "utf8")); T = JSON.parse(readFileSync(new URL("../data/terms.json", import.meta.url), "utf8")).terms; }
catch (e) { console.error("Cannot load library.json - unlock it first."); process.exit(1); }
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { failed++; console.log("  FAIL " + name + " - " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const E = G.buildEntries({ classes: L.classes, subclasses: L.subclasses, species: L.species, backgrounds: L.backgrounds, feats: L.feats, spells: L.spells, items: L.items, weapons: L.weapons, rules: L.rules, glossary: L.glossary, terms: T });
const named = (cat, n) => E.find(e => e.cat === cat && e.name.toLowerCase() === n.toLowerCase());
const ruleish = E.filter(e => e.cat === "rule" || e.cat === "condition");

test("every entry has a unique id", () => { const s = new Set(E.map(e => e.id)); assert(s.size === E.length, `${E.length - s.size} duplicate ids`); });
test("one entry per spell, feat, species, background, class", () => {
  const n = c => E.filter(e => e.cat === c).length;
  assert(n("spell") === L.spells.length && n("feat") === L.feats.length && n("species") === L.species.length && n("background") === L.backgrounds.length && n("class") === L.classes.length && n("subclass") === L.subclasses.length, "count mismatch");
});
test("rules and conditions all carry text", () => assert(ruleish.every(e => e.text && e.text.trim().length > 5), ruleish.find(e => !e.text)?.name));
test("no rule is listed twice (plural or singular)", () => {
  const seen = new Map();
  for (const e of ruleish.filter(e => /^(Rule|Action|Area of Effect|Hazard|Attitude|Condition)$/.test(e.group))) {
    const k = e.name.toLowerCase().replace(/s$/, ""); assert(!seen.has(k), `${e.name} and ${seen.get(k)}`); seen.set(k, e.name);
  }
});
test("all 15 conditions are in Conditions", () => assert(E.filter(e => e.cat === "condition").length >= 15, "only " + E.filter(e => e.cat === "condition").length));
test("the SRD reference lists are complete", () => {
  const want = { Skill: 18, Ability: 6, "Damage Type": 13, Language: 19, Alignment: 10, "Magic School": 8, "Weapon Property": 10, "Weapon Mastery": 8, Poison: 14 };
  for (const [g, n] of Object.entries(want)) { const got = ruleish.filter(e => e.group === g).length; assert(got === n, `${g}: ${got} of ${n}`); }
});
test("everyday rules can be looked up", () => {
  for (const n of ["Saving Throw", "Long Rest", "Short Rest", "Cover", "Grappling", "Falling", "Hit Points", "Reaction", "Initiative", "Concentration", "Difficult Terrain", "Opportunity Attacks", "Temporary Hit Points", "Heroic Inspiration", "Darkvision", "Stealth", "Acid", "Prone"]) assert(named("rule", n) || named("condition", n), n + " is missing");
});
test("glossary tables keep their rows", () => assert(/Acid\tCorrosive/.test(named("rule", "Damage Types").text), "Damage Types table lost"));
test("glossary text has no leftover markdown or cross-references", () => { const bad = ruleish.find(e => /\*\*|\|\s*-{3}|See also/i.test(e.text)); assert(!bad, bad && bad.name); });
test("search ranks exact, then prefix, then word, then substring", () => {
  const r = G.matchQuery(E, "fire"); assert(r[0].name.toLowerCase() === "fire", r[0].name);
  const iFB = r.findIndex(e => e.name === "Fire Bolt"), iFS = r.findIndex(e => e.name === "Wall of Fire"); assert(iFB >= 0 && iFS > iFB, "ranking");
});
test("search reads rule text only for longer queries", () => {
  assert(G.matchQuery(E, "ab").every(e => e.name.toLowerCase().includes("ab")), "two letters matched text");
  assert(G.matchQuery(E, "bonus to AC").some(e => e.cat === "rule"), "text search found nothing");
});
test("filters narrow by level, school and class", () => {
  const sp = E.filter(e => e.cat === "spell"), f = G.filtersFor("spell", sp).map(x => x.id).join(",");
  assert(f === "lv,school,cls,src", f);
  const l3 = G.applyFilters(sp, { lv: "3" }); assert(l3.length > 10 && l3.every(e => e.lv === 3), "level");
  const w = G.applyFilters(sp, { cls: "Wizard" }); assert(w.length > 50 && w.every(e => e.classes.includes("Wizard")), "class");
  assert(G.applyFilters(sp, { lv: "3", school: "Evocation" }).every(e => e.lv === 3 && e.school === "Evocation"), "both");
});
test("spells list by level, then name", () => {
  const { list } = G.view(E, [], { cat: "spell", q: "", f: {}, sort: "", desc: false });
  for (let i = 1; i < list.length; i++) assert(list[i - 1].lv < list[i].lv || (list[i - 1].lv === list[i].lv && list[i - 1].name.localeCompare(list[i].name) <= 0), list[i].name);
});
test("column sort flips and book sort puts unlabelled last", () => {
  const a = G.view(E, [], { cat: "feat", q: "", f: {}, sort: "name", desc: false }).list, d = G.view(E, [], { cat: "feat", q: "", f: {}, sort: "name", desc: true }).list;
  assert(a[0].name === d[d.length - 1].name, "desc");
});
test("tab counts follow the query", () => {
  const c = G.counts(E, [], "fireball"); assert(c.spell >= 1 && c.all >= c.spell && c.condition === 0, JSON.stringify(c));
});
test("bookmarks toggle, newest first, and survive a reload", () => {
  let m = G.toggleMark([], "spell||Fireball"); m = G.toggleMark(m, "rule||Cover"); assert(m[0] === "rule||Cover" && m.length === 2, m.join());
  const st = mem(); G.saveMarks(m, st); assert(G.loadMarks(st).join() === m.join(), "reload");
  assert(G.toggleMark(m, "rule||Cover").join() === "spell||Fireball", "remove");
});
test("bad saved data is ignored", () => { const st = mem(); st.setItem(G.LS_MARKS, "{oops"); assert(G.loadMarks(st).length === 0, "junk"); st.setItem(G.LS_MARKS, JSON.stringify([1, "a", null])); assert(G.loadMarks(st).join() === "a", "filter"); });
test("Saved tab shows saved entries in the order saved, and only those that still exist", () => {
  const a = named("spell", "Fireball").id, b = named("rule", "Cover").id;
  const { list } = G.view(E, [b, "gone||x", a], { cat: "marks", q: "", f: {}, sort: "", desc: false });
  assert(list.map(e => e.id).join() === [b, a].join(), list.map(e => e.name).join());
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
