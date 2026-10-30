#!/usr/bin/env node
// Tests for the creation draft safety net: saving, repairing damaged drafts, score rules and names.
// Pure Node, no browser. Runs without the unlocked rules; the cap test uses a tiny stand-in library.
import { createRequire } from "node:module";
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
globalThis.window = globalThis; globalThis.localStorage = mem(); globalThis.sessionStorage = mem();
const C = await import("../js/creation.js");

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { failed++; console.log("  FAIL " + name + " - " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const KEY = "dnd-creation-draft-v1";

test("sanitizeDraft rejects things that are not drafts", () => {
  for (const bad of [null, undefined, 5, "x", [], true]) assert(C.sanitizeDraft(bad) === null, "accepted " + JSON.stringify(bad));
});
test("chapter number out of range is clamped", () => {
  assert(C.sanitizeDraft({ chapter: 99 }).chapter === C.CHAPTERS.length - 1);
  assert(C.sanitizeDraft({ chapter: -4 }).chapter === 0);
  assert(C.sanitizeDraft({ chapter: "two" }).chapter === 0);
});
test("a draft missing fields gets every field a current draft has", () => {
  const d = C.sanitizeDraft({ chapter: 3, class: "Fighter" }), blank = C.blankDraft();
  for (const k of Object.keys(blank)) assert(k in d, "missing " + k);
  assert(Array.isArray(d.classSkills) && typeof d.picks === "object" && typeof d.base.str === "number");
});
test("damaged values fall back instead of crashing later", () => {
  const d = C.sanitizeDraft({ base: { str: "abc", dex: 99, con: -1, int: 15.5, wis: NaN, cha: 12 }, classSkills: "oops", picks: [], lvl: { nope: 1 }, name: 42 });
  assert(d.base.str === 10 && d.base.dex === 10 && d.base.con === 10 && d.base.int === 10 && d.base.wis === 10 && d.base.cha === 12, JSON.stringify(d.base));
  assert(Array.isArray(d.classSkills) && !Array.isArray(d.picks) && d.lvl === null && d.name === "");
});
test("an old draft with changed scores counts as scores already set", () => {
  assert(C.sanitizeDraft({ base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } }).scoresSet === true);
  assert(C.sanitizeDraft({}).scoresSet === false);
});
test("draft survives a save and load through localStorage", () => {
  const d = C.blankDraft(); d.class = "Rogue"; d.name = "Sefa"; d.chapter = 2; C.saveDraft(d);
  const back = C.loadDraft(); assert(back && back.class === "Rogue" && back.name === "Sefa" && back.chapter === 2);
  C.clearDraft(); assert(C.loadDraft() === null && localStorage.getItem(KEY) === null);
});
test("a draft from older versions in sessionStorage is still found once", () => {
  sessionStorage.setItem(KEY, JSON.stringify({ chapter: 1, base: {}, picks: {}, class: "Wizard" }));
  assert(C.loadDraft().class === "Wizard"); C.clearDraft(); assert(sessionStorage.getItem(KEY) === null);
});
test("a draft older than 24 hours is dropped", () => {
  localStorage.setItem(KEY, JSON.stringify({ ...C.blankDraft(), class: "Bard", savedAt: Date.now() - 25 * 3600 * 1000 }));
  assert(C.loadDraft() === null && localStorage.getItem(KEY) === null);
});
test("unreadable saved text is cleared, not thrown", () => {
  localStorage.setItem(KEY, "{not json"); assert(C.loadDraft() === null && localStorage.getItem(KEY) === null);
});
test("cleanName strips invisible characters and collapses spaces", () => {
  assert(C.cleanName("​") === "" && C.cleanName("  ⁠ ﻿ ") === "" && C.cleanName("  Maren   Ash​combe ") === "Maren Ashcombe");
});
test("scores need a chosen method before the Ability Scores step passes", () => {
  const app = { library: { backgrounds: [], classes: [] }, campaign: {} }, d = C.blankDraft(); d.background = "";
  const r = C.validateChapter("abilities", d, app); assert(r.reasons.includes("Choose how to set your ability scores."), r.reasons.join("|"));
  d.scoresSet = true; assert(!C.validateChapter("abilities", d, app).reasons.includes("Choose how to set your ability scores."));
});
test("background increases cannot push a score past 20", () => {
  const app = { library: { backgrounds: [{ name: "B", effect: "Ability Scores: Strength, Dexterity, Constitution\n\nFeat: Alert" }] }, campaign: {} };
  const d = C.blankDraft(); d.background = "B"; d.base = { str: 20, dex: 20, con: 19, int: 10, wis: 10, cha: 10 };
  d.bonusMode = "111"; let f = C.finalAbilities(app, d); assert(f.str === 20 && f.dex === 20 && f.con === 20, JSON.stringify(f));
  d.bonusMode = "21"; d.plus2 = "str"; d.plus1 = "con"; f = C.finalAbilities(app, d); assert(f.str === 20 && f.con === 20, JSON.stringify(f));
});
test("point buy, roll, standard array and suggested array all mark scores as set", () => {
  const d = C.blankDraft(); C.startPointBuy(d); assert(d.scoresSet); d.scoresSet = false; C.pointBuyStep(d, "str", 1); assert(d.scoresSet);
  const e = C.blankDraft(); C.rollAndLock(e); assert(e.scoresSet);
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
