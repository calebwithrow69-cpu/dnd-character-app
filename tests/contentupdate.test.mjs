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
test("launch rule: existing players see what is pending, new devices and automation do not", () => {
  const p = { id: "u1", items: [{}] };
  assert(C.shouldShow(p, { seen: "", hasCharacters: true, automated: false }), "existing player");
  assert(!C.shouldShow(p, { seen: "", hasCharacters: false, automated: false }), "new device");
  assert(C.shouldShow(p, { seen: "u0", hasCharacters: false, automated: false }), "has a marker, so not new");
  assert(!C.shouldShow(p, { seen: "", hasCharacters: true, automated: true }) && !C.shouldShow(null, { hasCharacters: true }), "automation and nothing pending");
});
test("seen survives and ignores a broken store", () => {
  const s = mem(); assert(C.seenId(s) === "", "empty"); C.markSeen("u9", s); assert(C.seenId(s) === "u9", "stored");
  assert(C.seenId({ getItem() { throw new Error("x"); } }) === "", "throwing store");
});
const H = L.updates || [], U = H[H.length - 1];
test("the rules file carries the update history with a note for the next editor", () => {
  assert(Array.isArray(L.updates) && H.length >= 1 && H.length <= 12 && C.updatesOf(L).length === H.length, "history");
  assert(/FUTURE CLAUDE/.test(L.updatesNote) && /APPENDS/.test(L.updatesNote) && /squashed/.test(L.updatesNote), "note");
  assert(L.update && L.update.id === U.id, "newest mirrored for older app versions");
  assert(H.every(r => /^\d{4}-\d\d-\d\d-[0-9a-f]{6}$/.test(r.id) && !("_note" in r)) && new Set(H.map(r => r.id)).size === H.length, "ids");
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
// ---- history, pending and squash
const it = (status, name, extra = {}) => ({ status, kind: "spells", label: "Spell", name, effect: "", summary: "", before: status === "new" ? null : { name, x: 1 }, after: status === "removed" ? null : { name, x: 2 }, changes: [], ...extra });
const ch = (field, before, after, effect, note) => ({ field, label: field, before, after, effect, note });
const rec = (id, items) => ({ id, date: id.slice(0, 10), title: "Content update", items });
test("pending is everything after the last checked update, or everything when unknown", () => {
  const h = [rec("2026-01-01-aaaaaa", [it("new", "A")]), rec("2026-02-01-bbbbbb", [it("new", "B")]), rec("2026-03-01-cccccc", [it("new", "C")])];
  assert(C.pending(h, "").records.length === 3 && !C.pending(h, "").older, "never checked");
  assert(C.pending(h, "2026-02-01-bbbbbb").records.map(r => r.id).join() === "2026-03-01-cccccc", "after the marker");
  assert(C.pending(h, "2026-03-01-cccccc").records.length === 0, "all checked");
  const lost = C.pending(h, "gone"); assert(lost.records.length === 3 && lost.older, "marker older than the history kept");
});
test("two updates read as one total per entry", () => {
  const r1 = rec("2026-01-01-aaaaaa", [it("changed", "Fireball", { before: { text: "8d6" }, after: { text: "7d6" }, changes: [ch("text", "8d6", "7d6", "nerf", "Down a die.")], effect: "nerf", summary: "Weaker." }), it("new", "Tickle")]);
  const r2 = rec("2026-02-01-bbbbbb", [it("changed", "Fireball", { before: { text: "7d6" }, after: { text: "6d6" }, changes: [ch("text", "7d6", "6d6", "nerf", "Down again.")], effect: "nerf", summary: "Weaker still." }), it("changed", "Tickle", { before: { name: "Tickle", x: 2 }, after: { name: "Tickle", x: 3 }, changes: [ch("x", 2, 3, "buff", "More.")], effect: "buff" })]);
  const u = C.squash([r1, r2]); const by = n => u.items.find(i => i.name === n);
  assert(u.count === 2 && u.id === r2.id && u.from === "2026-01-01" && u.to === "2026-02-01", JSON.stringify([u.count, u.id, u.from, u.to]));
  const f = by("Fireball"); assert(f.status === "changed" && f.before.text === "8d6" && f.after.text === "6d6" && f.changes[0].before === "8d6" && f.changes[0].after === "6d6", "oldest before, newest after");
  assert(f.changes[0].effect === "nerf" && /Down a die\./.test(f.changes[0].note) && /Down again\./.test(f.changes[0].note) && /Weaker\./.test(f.summary), "notes from both updates");
  const t = by("Tickle"); assert(t.status === "new" && t.before === null && t.after.x === 3 && t.changes.length === 0, "new then changed is still new, with the latest text");
});
test("squash handles add then remove, remove then add, undone changes and mixed effects", () => {
  const u = C.squash([rec("2026-01-01-aaaaaa", [it("new", "Gone"), it("removed", "Back"), it("changed", "Flip", { before: { a: 1 }, after: { a: 2 }, changes: [ch("a", 1, 2, "buff", "Up.")] }), it("changed", "Seesaw", { before: { a: 1 }, after: { a: 2 }, changes: [ch("a", 1, 2, "buff", "Up.")] }), it("changed", "Old", { before: { a: 1 }, after: { a: 2 }, changes: [ch("a", 1, 2, "buff", "Up.")] })]),
    rec("2026-02-01-bbbbbb", [it("removed", "Gone"), it("new", "Back", { after: { name: "Back", x: 9 } }), it("changed", "Flip", { before: { a: 2 }, after: { a: 1 }, changes: [ch("a", 2, 1, "nerf", "Down.")] }), it("changed", "Seesaw", { before: { a: 2 }, after: { a: 5 }, changes: [ch("a", 2, 5, "nerf", "Nerf?")] })])]);
  const names = u.items.map(i => i.name).sort().join();
  assert(names === "Back,Old,Seesaw", "Gone and Flip vanish: " + names);
  const b = u.items.find(i => i.name === "Back"); assert(b.status === "changed" && b.before.x === 1 && b.after.x === 9, "removed then added reads as changed");
  const s = u.items.find(i => i.name === "Seesaw"); assert(s.changes[0].effect === "mixed" && s.effect === "mixed" && s.changes[0].after === 5, "buff then nerf is mixed");
  assert(u.items.find(i => i.name === "Old").changes.length === 1, "single-step items are unchanged");
  assert(C.squash([]) === null, "no records");
});
test("pendingUpdate reads a library for a device and is null once checked", () => {
  const lib = { updates: [rec("2026-01-01-aaaaaa", [it("new", "A")]), rec("2026-02-01-bbbbbb", [it("new", "B")])] };
  assert(C.pendingUpdate(lib, "").items.length === 2 && C.pendingUpdate(lib, "2026-01-01-aaaaaa").items.length === 1 && C.pendingUpdate(lib, "2026-02-01-bbbbbb") === null, "cuts");
  assert(C.pendingUpdate({ update: rec("2026-01-01-aaaaaa", [it("new", "A")]) }, "").items.length === 1, "older library shape");
  assert(C.latestUpdate(lib).items.length === 1 && /2 updates/.test(C.rangeText(C.squash(lib.updates))) && C.rangeText(C.squash([lib.updates[0]])) === "2026-01-01", "latest and range text");
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
