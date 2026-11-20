#!/usr/bin/env node
// Notes ledger: data layer, markdown renderer, milestones, backup merge. Pure Node.
import * as N from "../js/notes.js";
import { renderMd, toggleTask, applyFormat } from "../js/markdown.js";
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { failed++; console.log("  FAIL " + name + " - " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { get length() { return m.size; }, key: i => [...m.keys()][i], getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test("a new ledger has the default categories with General first", () => {
  const d = N.load(mem()); assert(d.cats[0] === "General" && d.cats.includes("NPC") && d.notes.length === 0, d.cats.join());
});
test("notes save, reload, and a broken store reads as empty", () => {
  const st = mem(), d = N.load(st), n = N.addNote(d, "NPC"); N.edit(n, { title: "Barkeep", body: "Owes **me** a drink" });
  assert(N.save(d, st), "save"); const r = N.load(st); assert(r.notes.length === 1 && r.notes[0].cat === "NPC" && r.notes[0].title === "Barkeep", JSON.stringify(r.notes));
  assert(N.load(mem({ [N.KEY]: "{not json" })).notes.length === 0, "broken json");
  assert(N.save(d, { setItem() { throw new Error("quota"); } }) === false, "quota failure reported");
});
test("unknown categories fall back safely and custom ones are kept", () => {
  const d = N.load(mem()); assert(N.addNote(d, "Nope").cat === "General", "unknown cat");
  assert(N.addCat(d, "  Heist  ") === "Heist" && N.addCat(d, "heist") === "Heist" && d.cats.filter(c => /heist/i.test(c)).length === 1, "dedupe");
  const n = N.addNote(d, "Heist"); assert(N.removeCat(d, "Heist") && n.cat === "General", "notes move to General");
  assert(!N.removeCat(d, "General"), "General stays");
});
test("sorting puts pinned first, then the chosen key either way", () => {
  const d = N.load(mem()); const mk = (t, b, u, pin) => { const n = N.addNote(d, "General", u); N.edit(n, { title: t, body: b, pin }, u); n.created = u; return n; };
  mk("b", "xx", 2, false); mk("a", "xxxxxx", 3, false); mk("c", "x", 1, true);
  assert(N.sortNotes(d.notes, "title", false).map(n => n.title).join("") === "cab", "pinned first then title");
  assert(N.sortNotes(d.notes, "updated", true).map(n => n.title).join("") === "cab", "pinned then newest");
  assert(N.sortNotes(d.notes, "size", true).map(n => n.title).join("") === "cab", "size desc");
  assert(N.sortNotes(d.notes, "size", false).map(n => n.title).join("") === "cba", "size asc");
});
test("search and category filter combine; counts follow the categories", () => {
  const d = N.load(mem()); const a = N.addNote(d, "NPC"); N.edit(a, { title: "Orin", body: "Smith in Hollow" }); const b = N.addNote(d, "Loot"); N.edit(b, { title: "Gem", body: "smith's gift" });
  assert(N.filterNotes(d.notes, { q: "SMITH" }).length === 2 && N.filterNotes(d.notes, { cat: "NPC", q: "smith" }).length === 1, "filter");
  const c = N.catCounts(d); assert(c.all === 2 && c.NPC === 1 && c.Loot === 1 && c.Quest === 0, JSON.stringify(c));
});
test("character and word counts count what was typed, emoji as one", () => {
  const d = N.load(mem()); const n = N.addNote(d, "General"); N.edit(n, { title: "Hi", body: "one two\nthree \u{1F409}" });
  const s = N.stats(d.notes); assert(s.chars === 2 + 15 && s.words === 5 && s.bytes > 0 && s.notes === 1, JSON.stringify(s));
});
test("milestones climb in order and report the next one", () => {
  const ns = N.MILESTONES.map(m => m.n); assert(ns.every((v, i) => !i || v > ns[i - 1]), "ascending");
  assert(N.milestoneText(0).head === "Under a tweet", "zero");
  const m = N.milestoneText(2000); assert(/Gettysburg/.test(m.head) && /single-spaced page/.test(m.sub), JSON.stringify(m));
  assert(/single-spaced page/.test(N.milestoneText(3000).head), "3000 chars is a page");
  const big = N.milestoneText(4e6); assert(/War and Peace/.test(big.head) && big.pct === 100, JSON.stringify(big));
  assert(/Hobbit/.test(N.milestoneText(N.MILESTONES.find(x => /Hobbit/.test(x.name)).n).head), "exact hit");
});
test("storage use sums every key and caps at 100 percent", () => {
  const u = N.storageUse(mem({ a: "xx", bb: "yyy" })); assert(u.used === 1 + 2 + 2 + 3 && u.pct < 1, JSON.stringify(u));
  assert(N.storageUse(mem({ k: "x".repeat(6e6) })).pct === 100, "cap");
  assert(N.fmtBytes(512) === "512 B" && N.fmtBytes(2048) === "2.0 KB" && N.fmtBytes(5 * 1048576) === "5.0 MB", "fmt");
});
test("old sheet notes move into the ledger once", () => {
  const d = N.load(mem()); const chars = [{ id: "c1", name: "Gandork", notes: "Remember the key" }, { id: "c2", name: "Empty", notes: "  " }];
  assert(N.migrateSheetNotes(d, chars) === 1 && d.notes[0].title === "Gandork notes" && d.notes[0].cat === "Character" && d.notes[0].charId === "c1", "first run");
  assert(N.migrateSheetNotes(d, chars) === 0 && d.notes.length === 1, "second run adds nothing");
  d.notes[0].body = "edited"; N.migrateSheetNotes(d, chars); assert(d.notes[0].body === "edited", "edits survive");
});
test("backup merge keeps both sides and the newest edit", () => {
  const a = N.load(mem()), n = N.addNote(a, "NPC", 10); N.edit(n, { title: "mine", body: "old" }, 10);
  const inc = N.exportData(a); const b = N.load(mem()); assert(N.mergeImport(b, inc).added === 1 && b.notes[0].title === "mine", "added");
  inc.notes[0].title = "theirs"; inc.notes[0].updated = 99; assert(N.mergeImport(b, inc).updated === 1 && b.notes[0].title === "theirs", "newer wins");
  inc.notes[0].title = "stale"; inc.notes[0].updated = 5; N.mergeImport(b, inc); assert(b.notes[0].title === "theirs", "older ignored");
  assert(N.mergeImport(b, { notes: "junk" }).added === 0, "junk input");
});
test("markdown renders the basics", () => {
  const h = renderMd("# T\n\n**b** and *i* and ~~s~~ and `c`\n\n- a\n- b\n\n1. x\n2. y\n\n> q\n\n---\n\n```\ncode **no**\n```");
  for (const s of ["<h3>T</h3>", "<strong>b</strong>", "<em>i</em>", "<s>s</s>", "<code>c</code>", "<ul><li>a</li><li>b</li></ul>", "<ol><li>x</li><li>y</li></ol>", "<blockquote>q</blockquote>", "<hr>", "<pre><code>code **no**</code></pre>"]) assert(h.includes(s), "missing " + s + " in " + h);
});
test("markdown never lets markup through", () => {
  const h = renderMd('<img src=x onerror=alert(1)> <script>x</script> [a](javascript:alert(1)) [ok](https://x.y/?a=1&b=2) "q"');
  assert(!/<img|<script/.test(h) && !/href="javascript/.test(h) && /href="https:\/\/x\.y\/\?a=1&amp;b=2"/.test(h) && /rel="noopener noreferrer"/.test(h), h);
  assert(/&lt;img/.test(h), "escaped");
});
test("unmatched backtick and lone asterisks stay text", () => {
  const h = renderMd("a ` b and 2 * 3 * 4"); assert(!/<code>/.test(h) && /2 \* 3 \* 4/.test(h), h);
});
test("checklists render with the source line and toggle both ways", () => {
  const src = "- [ ] one\ntext\n- [x] two"; const h = renderMd(src);
  assert(/data-line="0"[^>]*>/.test(h) && /data-line="2" checked/.test(h), h);
  const t = toggleTask(src, 0); assert(t.startsWith("- [x] one") && toggleTask(t, 2).endsWith("- [ ] two") && toggleTask(src, 1) === src, t);
});
test("toolbar formatting wraps, prefixes and unwraps", () => {
  assert(applyFormat("hello world", 6, 11, "bold").text === "hello **world**", "bold");
  const e = applyFormat("abc", 3, 3, "italic"); assert(e.text === "abc*italic*" && e.start === 4 && e.end === 10, JSON.stringify(e));
  assert(applyFormat("a\nb", 0, 3, "ul").text === "- a\n- b" && applyFormat("- a\n- b", 0, 7, "ul").text === "a\nb", "list on and off");
  assert(applyFormat("x", 0, 1, "check").text === "- [ ] x" && applyFormat("x", 0, 1, "nope").text === "x", "check and unknown");
});
test("every badge has a unique id, an explanation and several facts", () => {
  assert(N.BADGES.length >= 20, "a lot of badges");
  assert(new Set(N.BADGES.map(b => b.id)).size === N.BADGES.length, "unique ids");
  for (const b of N.BADGES) assert(b.name && b.short && b.about && b.facts.length >= 2 && b.facts.every(f => f.length > 15) && Number.isInteger(b.n) && b.n > 0, b.id);
  assert(N.BADGES.every((b, i, a) => !i || b.n > a[i - 1].n), "ascending");
});
test("badges are earned once and kept after notes are deleted", () => {
  const d = N.load(mem()); assert(N.awardBadges(d, 100, 1).length === 1 && d.badges.sms1 === 1, "first badge");
  assert(N.awardBadges(d, 100, 2).length === 0 && d.badges.sms1 === 1, "not twice");
  assert(N.awardBadges(d, 300, 3).map(b => b.id).join() === "sms160,tweet", "two more");
  assert(N.awardBadges(d, 0, 4).length === 0 && N.badgeCount(d) === 3, "deleting text keeps badges");
});
test("badges survive save and load, junk ids are dropped, backups merge the earliest date", () => {
  const st = mem(), d = N.load(st); N.awardBadges(d, 300, 5); N.save(d, st);
  assert(!("hadBadges" in JSON.parse(st.getItem(N.KEY))), "no helper flag in storage");
  const r = N.load(st); assert(N.badgeCount(r) === 3 && r.hadBadges === true && !N.load(mem()).hadBadges, "reload");
  assert(Object.keys(N.clean({ badges: { nope: 5, tweet: 7, sms1: "x" } }).badges).join() === "tweet", "junk dropped");
  const b = N.load(mem()); b.badges.tweet = 9; N.mergeImport(b, N.exportData(d)); assert(b.badges.tweet === 5 && N.badgeCount(b) === 3, "earliest wins");
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
