#!/usr/bin/env node
// Notes PDF: markdown structure parser and the PDF layout. Pure Node (pdf-lib from js/vendor).
import { createRequire } from "node:module";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseMd, inlineRuns } from "../js/markdown.js";
import { buildNotesPdf, slug } from "../js/notespdf.js";
const PDFLib = createRequire(import.meta.url)("../js/vendor/pdf-lib.min.js");
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { failed++; console.log("  FAIL " + name + " - " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const note = (title, body, cat = "NPC") => ({ id: title, title, body, cat, pin: false, created: 1, updated: 1700000000000 });
const text = bytes => { const f = join(mkdtempSync(join(tmpdir(), "np-")), "n.pdf"); writeFileSync(f, bytes); const r = spawnSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" }); return r.status === 0 ? r.stdout : null; };

await test("inline runs: bold, italic, strike, code, links, and unmatched markers stay text", () => {
  const r = inlineRuns("a **b** *c* ~~d~~ `e` [f](https://x.y)");
  assert(r.find(x => x.s === "b").b && r.find(x => x.s === "c").i && r.find(x => x.s === "d").st && r.find(x => x.s === "e").code && r.find(x => x.s === "f").link === "https://x.y", JSON.stringify(r));
  assert(inlineRuns("2 * 3 * 4").map(x => x.s).join("") === "2 * 3 * 4" && inlineRuns("a ** b").map(x => x.s).join("") === "a ** b", "plain asterisks");
  assert(inlineRuns("snake_case_name").map(x => x.s).join("") === "snake_case_name" && !inlineRuns("snake_case_name").some(x => x.i), "underscores inside words");
});
await test("block parser matches the HTML renderer's reading", () => {
  const b = parseMd("# T\n\npara one\nsame para\n\n- a\n- [x] done\n1. n\n\n> q\n\n---\n\n```\ncode\n```");
  assert(b.map(x => x.t).join() === "h,p,li,li,li,quote,hr,code", b.map(x => x.t).join());
  assert(b[2].task !== true && b[3].task && b[3].done && b[4].ord === 1 && b[7].text === "code", JSON.stringify(b));
  assert(b[1].runs.map(r => r.s).join("") === "para one\nsame para", "paragraph keeps its line break");
});
await test("a note becomes a PDF with its title, text, checklist and footer", async () => {
  const n = note("Session 4: the Gullet", "# Recap\nWe found **Orin** in the cells.\n- [x] free the prisoner\n- [ ] find the key\n\n> The warden lies.\n\nSee [map](https://example.com).\n\n```\nroll 2d6\n```");
  const r = await buildNotesPdf(PDFLib, [n], { label: "Session notes" });
  assert(Buffer.from(r.bytes).slice(0, 5).toString() === "%PDF-" && r.pages === 1, "header and one page");
  const t = text(r.bytes); if (t === null) return console.log("      (pdftotext missing, text check skipped)");
  for (const s of ["Session 4: the Gullet", "Recap", "We found Orin in the cells.", "free the prisoner", "find the key", "The warden lies.", "https://example.com", "roll 2d6", "Page 1 of 1", "Session notes", "NPC"]) assert(t.includes(s), "missing: " + s + "\n" + t);
});
await test("long notes break across pages and each note starts a new page", async () => {
  const long = note("Long", Array.from({ length: 120 }, (_, i) => `Line ${i} of the long note with enough words to take space on the page.`).join("\n\n"));
  const r = await buildNotesPdf(PDFLib, [long, note("Short", "x")], {});
  assert(r.pages >= 4, "pages " + r.pages);
  const t = text(r.bytes); if (t) { assert(t.includes("Line 119") && t.includes(`Page ${r.pages} of ${r.pages}`), "last line and footer"); }
});
await test("unsupported characters print as ? and are counted; common punctuation is mapped", async () => {
  const r = await buildNotesPdf(PDFLib, [note("Café “quoted”", "Dragon \u{1F409} 龍 — done …")], {});
  assert(r.lost === 2, "lost " + r.lost); const t = text(r.bytes); if (t) assert(t.includes("Café") && t.includes('"quoted"') && t.includes("- done ..."), t);
});
await test("a word longer than the line and an empty note do not break layout", async () => {
  const r = await buildNotesPdf(PDFLib, [note("Wide", "x".repeat(400)), note("", "")], {});
  assert(r.pages === 2, "pages " + r.pages); const t = text(r.bytes); if (t) assert(t.includes("Untitled") && t.includes("xxxxxxxxxx"), "empty note titled");
});
await test("file names are safe", () => { assert(slug("Orin: the Smith / Loot?") === "Orin-the-Smith-Loot" && slug("") === "notes" && slug("龍") === "notes", slug("Orin: the Smith / Loot?")); });
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
