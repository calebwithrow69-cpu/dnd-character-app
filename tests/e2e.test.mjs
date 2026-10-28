#!/usr/bin/env node
// Browser checks (Playwright + Chromium) for the whole app.
//
//   CR_PASSWORD=<group password> node tests/e2e.test.mjs
//
// The password is read from the environment only and never written anywhere.
// The suite copies the app to a temp folder, unlocks the rules there (the
// app accepts an unlocked library as-is) and serves THAT copy, so the repo's
// data/library.enc.json is never touched and nothing readable is left behind.
// Exit code 1 if any check fails. ASCII only.

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, extname, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.CR_PASSWORD) { console.error("Set CR_PASSWORD first."); process.exit(1); }

// ---- playwright (local, or the global install) ----
const req = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = req("playwright")); }
catch { ({ chromium } = req(join(execSync("npm root -g").toString().trim(), "playwright"))); }

// ---- throwaway unlocked copy ----
const tmp = mkdtempSync(join(tmpdir(), "cr-e2e-"));
cpSync(root, tmp, { recursive: true, filter: s => !/[\\/]\.git([\\/]|$)/.test(s) });
execSync("node tools/crypt.mjs unlock", { cwd: tmp, env: process.env, stdio: "pipe" });
writeFileSync(join(tmp, "data/library.enc.json"), readFileSync(join(tmp, "data/library.json")));
rmSync(join(tmp, "data/library.json"));

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".mp3": "audio/mpeg" };
const server = createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = join(tmp, p);
  if (!existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end("nf"); }
  r.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f));
});
await new Promise(ok => server.listen(0, ok));
const URL_ = "http://localhost:" + server.address().port + "/";

// ---- tiny harness ----
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push([true, name]); console.log("PASS", name); }
  catch (e) { results.push([false, name]); console.log("FAIL", name, "-", String(e.message || e).split("\n")[0]); }
};
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const IGNORE = /ERR_TUNNEL_CONNECTION_FAILED|fonts\.(googleapis|gstatic)|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED/;

const browser = await chromium.launch();
async function open(w, h, { touch = false, dark = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: dark ? "dark" : "light", serviceWorkers: "block" });
  const page = await ctx.newPage();
  page.errs = [];
  page.on("pageerror", e => page.errs.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !IGNORE.test(m.text())) page.errs.push("console: " + m.text()); });
  page.on("requestfailed", r => { if (!IGNORE.test(r.url() + " " + (r.failure()?.errorText || ""))) page.errs.push("request failed: " + r.url()); });
  await page.goto(URL_); await page.waitForSelector("#home-book", { timeout: 15000 });
  return page;
}
const hscroll = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const clickA = async (p, a, sel = "") => { await p.locator(`[data-a="${a}"]${sel}`).first().click(); await p.waitForTimeout(350); };
const openSample = async p => {
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await clickA(p, "openChar", '[data-id="gandork"]');
  await p.waitForSelector('[data-a="openHp"]', { timeout: 10000 });
};
const noErrs = p => assert(p.errs.length === 0, p.errs.join(" || "));

// Every top-level JS file parses.
await check("node --check on every JS file", async () => {
  const files = execSync("git ls-files '*.js' '*.mjs'", { cwd: root }).toString().trim().split("\n");
  for (const f of files) execSync(`node --check "${f}"`, { cwd: root });
});

// Boot + layout at every width we care about.
const VIEWS = [
  ["phone 390x844 touch", 390, 844, { touch: true }],
  ["tablet 1000x800", 1000, 800, {}],
  ["laptop 1100x800", 1100, 800, {}],
  ["desktop 1440x900 light", 1440, 900, {}],
  ["desktop 1440x900 dark", 1440, 900, { dark: true }],
];
for (const [name, w, h, o] of VIEWS) {
  await check(`boots with no errors, no sideways scroll: ${name}`, async () => {
    const p = await open(w, h, o); await p.waitForTimeout(500);
    noErrs(p); assert(await hscroll(p) <= 0, "horizontal scroll " + await hscroll(p)); await p.context().close();
  });
}

// Sample character on the sheet: classic + advanced, at phone and laptop.
for (const [name, w, h, o] of [VIEWS[0], VIEWS[2], VIEWS[4]]) {
  await check(`sample character sheet (classic) renders: ${name}`, async () => {
    const p = await open(w, h, o); await openSample(p);
    assert(await p.locator('[data-a="openAc"]').count() > 0, "no AC shield");
    assert(await hscroll(p) <= 0, "horizontal scroll"); noErrs(p); await p.context().close();
  });
}

await check("advanced sheet: every Character sub-tab opens (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  await clickA(p, "setPrefV");
  const subs = await p.locator('[data-a="charSub"]').evaluateAll(es => es.map(e => e.dataset.v || e.dataset.t || e.textContent.trim()));
  assert(subs.length >= 5, "expected 5 sub-tabs, got " + subs.length);
  for (let i = 0; i < subs.length; i++) { await p.locator('[data-a="charSub"]').nth(i).click(); await p.waitForTimeout(250); assert(await hscroll(p) <= 0, "hscroll on sub-tab " + i); }
  noErrs(p); await p.context().close();
});

await check("advanced sheet: every sheet tab opens, no sideways scroll (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await clickA(p, "setPrefV");
  const n = await p.locator('[data-a="sheetTab"]').count(); assert(n >= 3, "tabs: " + n);
  for (let i = 0; i < n; i++) { await p.locator('[data-a="sheetTab"]').nth(i).click(); await p.waitForTimeout(300); assert(await hscroll(p) <= 0, "hscroll on tab " + i); }
  noErrs(p); await p.context().close();
});

await check("advanced sheet: every sheet tab opens, no sideways scroll (laptop 1100)", async () => {
  const p = await open(1100, 800); await openSample(p); await clickA(p, "setPrefV");
  const n = await p.locator('[data-a="sheetTab"]').count(); assert(n >= 3, "tabs: " + n);
  for (let i = 0; i < n; i++) { await p.locator('[data-a="sheetTab"]').nth(i).click(); await p.waitForTimeout(300); assert(await hscroll(p) <= 0, "hscroll on tab " + i); }
  noErrs(p); await p.context().close();
});

await check("HP vial: tapping it opens the HP dialog", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  const before = await p.locator('[data-a="openHp"]').first().innerText();
  await clickA(p, "openHp"); await p.waitForTimeout(400);
  assert(await p.locator("#modal-root *").count() > 0, "HP modal did not open");
  noErrs(p); await p.context().close();
  assert(/78/.test(before), "unexpected starting HP: " + before);
});

await check("rests: short and long rest dialogs open and close", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  for (const a of ["openShortRest", "openLongRest"]) {
    await clickA(p, a); assert(await p.locator("#modal-root *").count() > 0, a + " did not open");
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    if (await p.locator('[data-a="closeModal"]').count()) await clickA(p, "closeModal");
  }
  noErrs(p); await p.context().close();
});

await check("death save marks toggle", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  const grab = () => p.locator('[data-a="deathSave"]').evaluateAll(es => es.map(e => e.className + "|" + e.getAttribute("aria-pressed") + "|" + e.innerHTML.length).join(","));
  const before = await grab(); await p.locator('[data-a="deathSave"]').first().click(); await p.waitForTimeout(300);
  assert(before !== await grab(), "death save mark did not change");
  noErrs(p); await p.context().close();
});

await check("level-up menu opens (laptop)", async () => {
  const p = await open(1100, 800); await openSample(p);
  await clickA(p, "openLevelMenu"); assert(await p.locator("#modal-root *").count() > 0, "level menu empty");
  assert(await hscroll(p) <= 0, "hscroll"); noErrs(p); await p.context().close();
});

await check("rolling a skill shows a result card", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  await p.locator('[data-a="rollSkill"]').first().click(); await p.waitForTimeout(500);
  assert(await p.locator("#roll-root *").count() > 0, "no roll card"); noErrs(p); await p.context().close();
});

await check("Rules screen (home > Rules) opens with no errors, phone", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRules"); await p.waitForTimeout(600);
  assert(await hscroll(p) <= 0, "hscroll"); noErrs(p); await p.context().close();
});

await check("Rules screen opens with no sideways scroll, laptop 1100", async () => {
  const p = await open(1100, 800); await clickA(p, "goRules"); await p.waitForTimeout(600);
  assert(await hscroll(p) <= 0, "hscroll"); noErrs(p); await p.context().close();
});

await check("Settings opens (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "openSettings"); await p.waitForTimeout(500);
  assert(await hscroll(p) <= 0, "hscroll"); noErrs(p); await p.context().close();
});

await check("new character: creation flow loads class list, picks a class, advances", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "newChar"); await p.waitForTimeout(500);
  assert(await p.locator('[data-a="cxOpen"]').count() >= 12, "class list short");
  await p.locator('[data-a="cxOpen"]').first().click(); await p.waitForTimeout(500);
  noErrs(p); await p.context().close();
});

await check("random character builds and lands on a sheet", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "newChar");
  await clickA(p, "randomAll"); await p.waitForTimeout(1500);
  for (let i = 0; i < 12 && !(await p.locator('[data-a="openHp"]').count()); i++) {
    const nxt = p.locator('[data-a="nextStep"], [data-a="finishCreate"]'); if (!(await nxt.count())) break;
    await nxt.first().click(); await p.waitForTimeout(500);
  }
  assert(await p.locator('[data-a="openHp"]').count() > 0, "random build did not reach a sheet");
  noErrs(p); await p.context().close();
});

await check("characters survive a reload", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  await p.reload(); await p.waitForSelector("#home-book", { timeout: 15000 }); await clickA(p, "goRoster");
  assert(await p.locator('[data-a="openChar"][data-id="gandork"]').count() === 1, "character gone after reload");
  noErrs(p); await p.context().close();
});

await browser.close(); server.close(); rmSync(tmp, { recursive: true, force: true });
const failed = results.filter(r => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
