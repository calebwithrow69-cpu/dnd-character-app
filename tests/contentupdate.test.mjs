#!/usr/bin/env node
// Content update popup: grouping, the before/after diff, the "seen once per device" rule, and the record in the rules file.
// Needs the unlocked rules: CR_PASSWORD=<pw> node tools/crypt.mjs unlock, run this, then delete data/library.json.
import { readFileSync } from "node:fs";
const C = await import("../js/contentupdate.js");
let L;
try { L = JSON.parse(readFileSync(new URL("../data/library.json", import.meta.url), "utf8")); } catch (e) { console.error("Cannot load library.json - unlock it first."); process.exit(1); }
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { failed++; console.log("  FAIL " + name + " - " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const text = runs => runs.map(r => r.s).join("");
const marked = (runs, mark) => runs.filter(r => r.mark === mark).map(r => r.s);

test("items group by status and keep their order", () => {
  const g = C.groupItems({ items: [{ status: "new", name: "a" }, { status: "changed", name: "b" }, { status: "new", name: "c" }, { status: "removed", name: "d" }, { status: "odd", name: "e" }] });
  assert(g.new.map(i => i.name).join() === "a,c" && g.changed.length === 1 && g.removed.length === 1, JSON.stringify(g));
  assert(g.new[1].key === "2", "keys follow the record position");
});
test("word diff marks only the words that changed, on the right side", () => {
  const d = C.wordDiff("deals 4d6 fire damage", "deals 3d6 fire damage");
  assert(marked(d.before, "del").join() === "4d6" && marked(d.after, "ins").join() === "3d6", JSON.stringify(d));
  assert(text(d.before) === "deals 4d6 fire damage" && text(d.after) === "deals 3d6 fire damage", "text must survive");
});
test("an added sentence is marked only in After", () => {
  const d = C.wordDiff("You glare. It takes 1d4.", "You glare. Choose one. It takes 1d4.");
  assert(marked(d.before, "del").length === 0 && /Choose one\./.test(marked(d.after, "ins").join("")), JSON.stringify(d));
});
test("identical text has no marks and empty text is safe", () => {
  assert(C.wordDiff("same", "same").before.every(r => !r.mark), "marks on identical");
  assert(text(C.wordDiff("", "new words").after) === "new words" && text(C.wordDiff("old", "").before) === "old", "empty side");
});
test("long text collapses identical lines and shows the changed ones", () => {
  const a = "Intro line.\n\n1-10 feet: 5d6\n11-60 feet: 4d6\nTail line.", b = "Intro line.\n\n1-10 feet: 5d6\n11-60 feet: 3d6\nTail line.";
  const v = C.changeView(a, b);
  assert(marked(v.before, "skip").length === 2 && !/Intro|Tail/.test(text(v.before)), text(v.before));
  assert(marked(v.before, "del").join() === "4d6" && marked(v.after, "ins").join() === "3d6", "changed words");
});
test("short fields print plainly", () => {
  assert(C.show(["A", "B"]) === "A, B" && C.show([]) === "None" && C.show(null) === "None" && C.show(0) === "0" && C.show(true) === "Yes", "show");
  assert(!C.isLong("90 feet") && C.isLong("a\nb") && C.isLong("x".repeat(61)), "isLong");
});
test("the popup shows once: existing players yes, new devices no, automation never", () => {
  const u = { id: "u1", items: [{}] };
  assert(C.shouldShow(u, { seen: "", hasCharacters: true, automated: false }), "existing player");
  assert(!C.shouldShow(u, { seen: "", hasCharacters: false, automated: false }), "new device");
  assert(!C.shouldShow(u, { seen: "u1", hasCharacters: true, automated: false }), "already seen");
  assert(C.shouldShow(u, { seen: "u0", hasCharacters: false, automated: false }), "newer update than the one seen");
  assert(!C.shouldShow(u, { seen: "", hasCharacters: true, automated: true }), "automation");
  assert(!C.shouldShow({ id: "u2", items: [] }, { seen: "", hasCharacters: true }) && !C.shouldShow(null, {}), "empty record");
});
test("seen survives and ignores a broken store", () => {
  const s = mem(); assert(C.seenId(s) === "", "empty"); C.markSeen("u9", s); assert(C.seenId(s) === "u9", "stored");
  assert(C.seenId({ getItem() { throw new Error("x"); } }) === "", "throwing store");
});
const U = L.update;
test("the rules file carries one update record with a note for the next editor", () => {
  assert(C.hasUpdate(U), "no update record");
  assert(/FUTURE CLAUDE/.test(U._note) && /REPLACES/.test(U._note) && /leave this object exactly as it is/.test(U._note), "note");
  assert(/^\d{4}-\d\d-\d\d-[0-9a-f]{6}$/.test(U.id), U.id);
});
test("every item has a status, a label, a name, and the snapshots its status needs", () => {
  for (const i of U.items) {
    assert(["new", "changed", "removed"].includes(i.status) && i.label && i.name, i.name);
    if (i.status === "new") assert(i.before === null && i.after && i.after.name === i.name, i.name + " new");
    if (i.status === "removed") assert(i.after === null && i.before, i.name + " removed");
    if (i.status === "changed") assert(i.before && i.after && i.changes.length, i.name + " changed");
  }
});
test("changed items explain themselves and mark buff or nerf per change", () => {
  for (const i of U.items.filter(x => x.status === "changed")) {
    assert(i.summary && ["buff", "nerf", "mixed", "neutral"].includes(i.effect), i.name + " needs a summary and an effect");
    for (const c of i.changes) assert(c.effect && c.note, `${i.name}/${c.field} needs an effect and a note`);
  }
});
test("the before snapshot is the old rules and the library holds the new", () => {
  const ee = U.items.find(i => i.name === "Evil Eye"), wb = U.items.find(i => i.name === "Water Bullet");
  assert(ee.effect === "nerf" && ee.before.classes.includes("Druid") && !ee.after.classes.includes("Druid"), "Evil Eye snapshots");
  assert(!L.spells.find(s => s.name === "Evil Eye").classes.includes("Druid") && /Charisma Saving Throw/.test(L.spells.find(s => s.name === "Evil Eye").text), "library has the new Evil Eye");
  assert(/11-60 feet: 4d6/.test(wb.before.text) && /11-60 feet: 3d6/.test(L.spells.find(s => s.name === "Water Bullet").text), "Water Bullet");
});
test("new spells have clean class names", () => {
  const t = L.spells.find(s => s.name === "Tickle"); assert(t && t.classes.every(c => L.classes.some(k => k.name === c)), t && t.classes.join());
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
