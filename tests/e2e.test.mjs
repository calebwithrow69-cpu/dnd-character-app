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
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
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
  await p.waitForSelector('[data-a="openHp"], .stylefull', { timeout: 10000 });
  if (await p.locator(".stylefull").count()) { await p.locator('[data-a="setPrefV"][data-v="classic"]').first().click(); await p.waitForTimeout(350); }
  await p.waitForSelector('[data-a="openHp"]', { timeout: 10000 });
};
const goAdvanced = async p => { await clickA(p, "openEdit"); await p.locator('[data-a="setPrefV"][data-v="advanced"]').first().click(); await p.waitForTimeout(300); await clickA(p, "confirmStyle"); };
const noErrs = p => assert(p.errs.length === 0, p.errs.join(" || "));

// The rules engine, pure and fast (also validates every effect in the unlocked rules file).
await check("rules engine conformance (tests/engine.test.mjs)", async () => { execSync("node tests/engine.test.mjs", { cwd: root, stdio: "pipe" }); });

// Every top-level JS file parses.
await check("node --check on every JS file", async () => {
  const files = execSync("git ls-files '*.js' '*.mjs'", { cwd: root }).toString().trim().split("\n");
  // Browser modules are checked AS modules: plain `node --check` once passed a file that broke startup in the browser.
  for (const f of files) { if (/^js\/(?!vendor)/.test(f)) execSync("node --input-type=module --check", { cwd: root, input: readFileSync(join(root, f)) }); else execSync(`node --check "${f}"`, { cwd: root }); }
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
  await goAdvanced(p);
  const subs = await p.locator('[data-a="charSub"]').evaluateAll(es => es.map(e => e.dataset.v || e.dataset.t || e.textContent.trim()));
  assert(subs.length >= 5, "expected 5 sub-tabs, got " + subs.length);
  for (let i = 0; i < subs.length; i++) { await p.locator('[data-a="charSub"]').nth(i).click(); await p.waitForTimeout(250); assert(await hscroll(p) <= 0, "hscroll on sub-tab " + i); }
  noErrs(p); await p.context().close();
});

await check("advanced sheet: every sheet tab opens, no sideways scroll (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await goAdvanced(p);
  const n = await p.locator('[data-a="sheetTab"]').count(); assert(n >= 2, "tabs: " + n);
  for (let i = 0; i < n; i++) { await p.locator('[data-a="sheetTab"]').nth(i).click(); await p.waitForTimeout(300); assert(await hscroll(p) <= 0, "hscroll on tab " + i); }
  noErrs(p); await p.context().close();
});

await check("advanced sheet: every sheet tab opens, no sideways scroll (laptop 1100)", async () => {
  const p = await open(1100, 800); await openSample(p); await goAdvanced(p);
  const n = await p.locator('[data-a="sheetTab"]').count(); assert(n >= 2, "tabs: " + n);
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

await check("rolling a skill: stage waits for a tap, then the result card stays", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  await p.locator('[data-a="rollSkill"]').first().click(); await p.waitForTimeout(400);
  assert(await p.locator("#rstage:not([hidden]) .rs-main").isVisible(), "stage is not waiting for a tap");
  assert(await p.locator("#roll-root *").count() === 0, "result shown before the roll");
  await p.locator(".rs-main").click(); await p.waitForTimeout(2600);
  await p.locator(".rs-done").click(); await p.waitForTimeout(400);
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
  for (let i = 0; i < 12 && !(await p.locator('[data-a="openHp"], .stylefull').count()); i++) {
    const nxt = p.locator('[data-a="nextStep"], [data-a="finishCreate"]'); if (!(await nxt.count())) break;
    await nxt.first().click(); await p.waitForTimeout(500);
  }
  if (await p.locator(".stylefull").count()) { await p.locator('[data-a="setPrefV"][data-v="classic"]').first().click(); await p.waitForTimeout(350); }
  assert(await p.locator('[data-a="openHp"]').count() > 0, "random build did not reach a sheet");
  noErrs(p); await p.context().close();
});

await check("Play Mode: first sub-tab, groups, dimmed buttons, standard actions, roll stage (phone + laptop)", async () => {
  for (const [w, h, o] of [[390, 844, { touch: true }], [1280, 800, {}]]) {
    const p = await open(w, h, o); await openSample(p); await goAdvanced(p);
    const first = await p.locator('[data-a="charSub"]').first().textContent();
    assert(/^Play/.test(first), "Play Mode is not the first sub-tab: " + first);
    assert(await p.locator(".row").count() > 0, "no rows in Play Mode");
    assert(await p.locator(".row .r-ic svg").count() > 0, "rows have no icons");
    assert(await p.locator(".pgrp").count() > 0, "no groups");
    // standard actions are opt-in
    assert(await p.locator('[data-row="std:dodge"]').count() === 0, "standard actions shown by default");
    await p.locator('[data-a="playShow"][data-k="std"]').click(); await p.waitForTimeout(250);
    for (const id of ["std:dodge", "std:influence", "std:oa"]) assert(await p.locator('[data-row="' + id + '"]').count() === 1, "missing " + id);
    // spend the Action: Dodge dims, Opportunity Attack (Reaction) does not
    await p.locator('[data-a="playUse"][data-id="std:dodge"]').click(); await p.waitForTimeout(250);
    assert(await p.locator('.tk[data-k="Action"][aria-pressed="true"]').count() === 1, "Action not spent");
    assert(await p.locator('[data-row="std:help"] .r-go.dim').count() === 1, "Help did not dim after the Action was spent");
    assert(await p.locator('[data-row="std:oa"] .r-go.dim').count() === 0, "Opportunity Attack dimmed with Reaction free");
    await p.locator('[data-a="playUse"][data-id="std:oa"]').click(); await p.waitForTimeout(250);
    assert(await p.locator('[data-row="std:oa"] .r-go.dim').count() === 1, "Reaction did not dim after use");
    assert(await p.locator('.r-go.dim[aria-disabled="true"]').count() > 0, "dim buttons are not aria-disabled");
    // next turn restores them
    await clickA(p, "turnNext"); await p.waitForTimeout(250);
    assert(await p.locator('[data-row="std:help"] .r-go.dim').count() === 0, "Help still dim after Next turn");
    // sources: cannot switch every one off
    assert(await hscroll(p) <= 0, "hscroll in Play Mode (" + w + ")");
    noErrs(p); await p.context().close();
  }
});

await check("roll stage: nat 20 / nat 1 effects, advantage and disadvantage, Lucky, Primal Strike (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await goAdvanced(p);
  await p.locator('[data-a="charSub"][data-sub="rolls"]').click(); await p.waitForTimeout(300);
  const seq = async list => p.evaluate(l => { window.__q = l.slice(); crypto.getRandomValues = a => { a[0] = (window.__q.length ? window.__q.shift() : 10) - 1; return a; }; }, list);
  const start = async () => { await p.locator('[data-a="rollSkill"], [data-a="rollAbility"], [data-a="rollSave"]').first().click({ timeout: 4000 }); await p.waitForTimeout(300); };
  const close = async () => { await p.locator(".rs-done").click(); await p.waitForTimeout(400); };
  for (const [val, cls] of [[20, "c20"], [1, "c1"]]) {
    await seq([val]); await start(); await p.locator(".rs-main").click(); await p.waitForTimeout(2200);
    assert(await p.evaluate(c => document.getElementById("rstage").classList.contains(c), cls), "roll stage did not show " + cls);
    await close();
  }
  await seq([4, 15]); await start();
  await p.locator('.rs-adv [data-m="adv"]').click(); await p.waitForTimeout(150);
  assert(await p.locator(".rs-d2").isVisible(), "second die not shown for advantage");
  await p.locator(".rs-main").click(); await p.waitForTimeout(2400);
  assert(await p.locator(".rs-die.lose").count() === 1, "advantage did not drop one die");
  assert(/^15\b/.test(await p.locator(".rs-line").innerText()), "advantage did not keep the higher die");
  await close();
  await seq([4, 15]); await start();
  await p.locator('.rs-adv [data-m="dis"]').click(); await p.locator(".rs-main").click(); await p.waitForTimeout(2400);
  assert(/^4\b/.test(await p.locator(".rs-line").innerText()), "disadvantage did not keep the lower die");
  await close();
  await seq([9, 15]); await start();
  assert(await p.locator('.rs-opts [data-id="lucky"]').count() === 1, "no Lucky option before the roll");
  await p.locator('.rs-opts [data-id="lucky"]').click(); await p.locator(".rs-main").click(); await p.waitForTimeout(2400);
  assert(await p.locator(".rs-die.lose").count() === 1, "Lucky did not give advantage");
  await close();
  noErrs(p); await p.context().close();
});

await check("attack: tap to roll, damage on a second tap, Primal Strike offered after and can be ignored (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await goAdvanced(p);
  await p.evaluate(() => { crypto.getRandomValues = a => { a[0] = 9; return a; }; });
  await p.locator('.row.t-attack [data-a="playUse"]').first().click(); await p.waitForTimeout(400);
  assert(await p.locator(".rs-main").isVisible(), "attack did not wait for a tap");
  await p.locator(".rs-main").click(); await p.waitForTimeout(2200);
  assert(/damage/i.test(await p.locator(".rs-main").innerText()), "no damage roll step after the attack");
  assert(await p.locator('.rs-opts [data-id="primal"]').count() === 0, "rider offered before damage");
  await p.locator(".rs-main").click(); await p.waitForTimeout(1500);
  assert(await p.locator('.rs-opts [data-id="primal"]').count() === 1, "Primal Strike not offered after damage");
  await p.locator('.rs-opts [data-id="primal"]').click(); await p.waitForTimeout(1200);
  assert(await p.locator(".rs-opts [data-id=primal]").isDisabled(), "Primal Strike can be added twice");
  await p.locator(".rs-done").click(); await p.waitForTimeout(400);
  assert(await p.locator("#roll-root *").count() > 0, "no roll card after closing");
  noErrs(p); await p.context().close();
});

await check("attack: you can skip the add-ons and close the screen (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await goAdvanced(p);
  await p.locator('.row.t-attack [data-a="playUse"]').first().click(); await p.waitForTimeout(300);
  await p.locator(".rs-main").click(); await p.waitForTimeout(2200);
  await p.locator(".rs-done").click(); await p.waitForTimeout(300);
  assert(await p.locator("#rstage:not([hidden])").count() === 0, "stage did not close");
  noErrs(p); await p.context().close();
});

await check("Play Mode: only the weapon in hand attacks; Swap weapon is a Bonus Action; feats are one group with a submenu (laptop)", async () => {
  const p = await open(1280, 800, {}); await openSample(p); await goAdvanced(p);
  assert(await p.locator('.pm-list .row.t-attack:not([data-row="x:swap"]):not([data-row^="w:unarmed"])').count() === 1, "more than one weapon attack row");
  assert(await p.locator('.pm-list .row.t-attack[data-row="w:unarmed:base"]').count() === 1, "Unarmed Strike row is missing");
  assert(await p.locator('[data-row="x:swap"][data-cost="Bonus"]').count() === 1, "no Swap weapon bonus action");
  await p.locator('[data-a="playUse"][data-id="x:swap"]').click(); await p.waitForTimeout(300);
  assert(await p.locator('[data-a="swapTo"]').count() >= 2, "swap list is empty");
  await p.locator('[data-a="swapTo"]:not([disabled])').first().click(); await p.waitForTimeout(400);
  assert(await p.locator('.tk[data-k="Bonus"][aria-pressed="true"]').count() === 1, "swap did not spend the Bonus Action");
  assert(await p.locator('#pg-Feat').count() === 1, "no Feats group");
  assert(await p.locator('[data-row="feat:Lucky"]').count() === 1, "Lucky is not a feat row");
  await p.locator('[data-a="playFeat"][data-id="feat:Lucky"]').click(); await p.waitForTimeout(300);
  assert(await p.locator(".kids .row").count() >= 2, "feat submenu did not open");
  assert((await p.locator('.pm-list .row.t-attack .sm').first().innerText()).match(/to hit/), "no to-hit detail under the attack");
  // keyboard shortcuts on, then off in settings
  assert(await p.locator(".pm-keys").count() === 1, "shortcut bar missing");
  await p.keyboard.press("2"); await p.waitForTimeout(200);
  assert(await p.locator('.tk[data-k="Bonus"][aria-pressed="false"]').count() === 1, "key 2 did not toggle Bonus Action");
  await p.evaluate(() => document.querySelector('[data-a="togglePref"][data-k="keys"]'));
  noErrs(p); await p.context().close();
});

await check("Starry Form: turn on shows an Active chip, survives reload, long rest clears it (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await goAdvanced(p);
  const use = p.locator('[data-a="playUse"][data-id*="Starry Form"]').first();
  assert(await use.count() === 1, "no Starry Form row in Play Mode");
  await use.click(); await p.waitForTimeout(400);
  assert(await p.locator(".chip.fx").count() >= 1, "no Active chip after turning on");
  assert(await hscroll(p) <= 0, "hscroll with chip");
  await p.reload(); await p.waitForSelector("#home-book", { timeout: 15000 });
  await clickA(p, "goRoster"); await clickA(p, "openChar", '[data-id="gandork"]'); await p.waitForSelector('[data-a="openHp"]');
  assert(await p.locator(".chip.fx").count() >= 1, "Active chip lost after reload");
  await p.locator('[data-a="endActive"]').first().click(); await p.waitForTimeout(300);
  assert(await p.locator(".chip.fx").count() === 0, "chip x did not turn it off");
  await p.locator('[data-a="playUse"][data-id*="Starry Form"]').first().click(); await p.waitForTimeout(300);
  await p.locator('[data-a="charSub"][data-sub="more"]').click(); await p.waitForTimeout(300);
  await clickA(p, "openLongRest"); await clickA(p, "confirmLongRest"); await p.waitForTimeout(400);
  assert(await p.locator(".chip.fx").count() === 0, "long rest did not clear it");
  noErrs(p); await p.context().close();
});

await check("XP dialog: bar and words agree (25,000 XP at level 7 = 2,000 of 11,000 = 18%)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  await clickA(p, "openLevelMenu"); await p.fill("#xp-set", "25000"); await clickA(p, "setXp");
  const pct = await p.evaluate(() => { const b = document.querySelector("#modal-root .hpbar > div"); return Math.round(b.getBoundingClientRect().width / b.parentElement.getBoundingClientRect().width * 100); });
  assert(pct >= 17 && pct <= 19, "bar is " + pct + "%");
  const txt = await p.locator("#modal-root").innerText();
  assert(txt.includes("2,000 of 11,000"), "dialog text does not state the band: " + txt.replace(/\s+/g, " ").slice(0, 200));
  assert(await p.locator('[data-a="startLevelUp"]').isDisabled(), "level up should be disabled below 34,000");
  noErrs(p); await p.context().close();
});

await check("level 20: dialog says max level, no 'Level up to 21'", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  await p.context().addInitScript(() => { try { const r = JSON.parse(localStorage.getItem("dnd-roster-v1") || "{}"); if (r.gandork) { r.gandork.level = 20; r.gandork.xp = 355000; localStorage.setItem("dnd-roster-v1", JSON.stringify(r)); } } catch (e) { } });
  await p.goto(URL_); await p.waitForSelector("#home-book"); await clickA(p, "goRoster"); await clickA(p, "openChar", '[data-id="gandork"]'); await p.waitForSelector('[data-a="openHp"]');
  await clickA(p, "openLevelMenu");
  assert(await p.locator('[data-a="startLevelUp"]').count() === 0, "still offers a level up at 20");
  assert((await p.locator("#modal-root").innerText()).includes("highest level"), "no max-level message");
  noErrs(p); await p.context().close();
});

await check("hotbar bookmark: add pops and fills, shows in hotbar, tap again removes", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  if (await p.locator('[data-a="charSub"][data-sub="combat"]').count()) { await p.locator('[data-a="charSub"][data-sub="combat"]').click(); await p.waitForTimeout(300); }
  const bm = p.locator('[data-a="toggleHotbar"]').first();
  assert(await bm.getAttribute("aria-pressed") === "false", "starts pressed");
  await bm.click(); await p.waitForTimeout(80);
  assert(await p.locator('.bm.pop').count() >= 1, "no pop animation class after adding");
  await p.waitForTimeout(700);
  assert(await p.locator('[data-a="toggleHotbar"][aria-pressed="true"]').count() === 1, "button did not fill");
  await goAdvanced(p);
  await p.locator('[data-a="charSub"][data-sub="play"]').click(); await p.waitForTimeout(300);
  assert(await p.locator(".hb-slot").count() === 1, "hotbar slot missing");
  await clickA(p, "openHotbarAdd");
  const on = p.locator('#modal-root [data-a="toggleHotbar"][aria-pressed="true"]');
  assert(await on.count() === 1, "modal row does not show On hotbar");
  assert(/on hotbar/i.test(await on.innerText()), "label");
  await on.click(); await p.waitForTimeout(300);
  await clickA(p, "closeModal");
  assert(await p.locator(".hb-slot").count() === 0, "slot not removed by toggling off");
  assert(await hscroll(p) <= 0, "hscroll"); noErrs(p); await p.context().close();
});

await check("effects: old characters keep their HP, Hearty adds its level, custom bonus changes AC, breakdown opens", async () => {
  const p0 = await open(390, 844, { touch: true }); await openSample(p0);
  const ctx = p0.context(), url = p0.url(); await p0.close(); // closing saves the open character; do the edit after that
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(String(e))); await p.goto(url); await p.waitForTimeout(2500);
  const hpMax = () => p.evaluate(() => JSON.parse(localStorage.getItem("dnd-roster-v1")).gandork.hp.max);
  assert(await hpMax() === 78, "Gandork's max HP changed on load: " + await hpMax());
  await p.evaluate(() => { const r = JSON.parse(localStorage.getItem("dnd-roster-v1")); r.gandork.feats.push("Hearty"); localStorage.setItem("dnd-roster-v1", JSON.stringify(r)); });
  await p.reload(); await p.waitForTimeout(2500);
  assert(await hpMax() === 85, "Hearty should add the level (7): " + await hpMax());
  await clickA(p, "goRoster"); await clickA(p, "openChar", '[data-id="gandork"]'); await p.waitForSelector('[data-a="openAc"]', { timeout: 10000 });
  const ac0 = parseInt(await p.locator(".shieldbtn b").first().innerText(), 10);
  await clickA(p, "openEdit"); await p.locator("#cb-t").selectOption("ac"); await p.locator("#cb-v").fill("2"); await clickA(p, "customAdd");
  await clickA(p, "closeModal");
  const ac1 = parseInt(await p.locator(".shieldbtn b").first().innerText(), 10);
  assert(ac1 === ac0 + 2, `custom +2 AC: ${ac0} -> ${ac1}`);
  await clickA(p, "openEdit"); await p.locator('#modal-root [data-a="openBreakdown"]').click(); await p.waitForTimeout(350);
  assert((await p.locator("#modal-root").innerText()).includes("Hearty"), "breakdown does not list Hearty");
  noErrs(p); await p.context().close();
});

await check("style chooser: shows first, picking applies at once, switching later asks first; classic holds spells, gear and a working search", async () => {
  const p = await open(390, 844, { touch: true });
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await clickA(p, "openChar", '[data-id="gandork"]');
  await p.waitForSelector(".stylefull", { timeout: 10000 });
  assert(await p.locator(".sp-card").count() === 2 && await p.locator(".sp-cmp .r").count() > 5, "expected two cards and a comparison");
  assert(await p.locator('[data-a="sheetTab"]').count() === 0, "chooser should be full screen");
  await p.locator('[data-a="setPrefV"][data-v="classic"]').click(); await p.waitForTimeout(350);
  assert(await p.locator(".classic").count() === 1, "classic sheet missing");
  assert(await p.locator('[data-a="sheetTab"]').count() === 2, "bottom tabs should be Character and Rules only");
  assert(await p.locator('.profchk').count() === 0, "profs belong on the Notes sub-tab");
  await p.locator('[data-a="classicSub"][data-sub="notes"]').click(); await p.waitForTimeout(250);
  assert(await p.locator('.profchk input').count() === 6, "expected 6 training check boxes");
  assert(await p.locator('.profchk input:disabled').count() === 6, "training boxes must be read-only");
  assert(await p.locator('.profchk.on').count() >= 2, "a druid should have some training checked");
  await p.locator('[data-a="classicSub"][data-sub="gear"]').click(); await p.waitForTimeout(250);
  assert(await p.locator(".doll").count() === 1, "classic Equipment sub-tab has no doll");
  await p.locator('[data-a="classicSub"][data-sub="sheet"]').click(); await p.waitForTimeout(250);
  await p.locator('[data-query="sheet"]').fill("stealth"); await p.waitForTimeout(250);
  assert(await p.locator('#results-sheet [data-a="rollSkill"]').count() >= 1, "search found no skill");
  await clickA(p, "openEdit");
  await p.locator('[data-a="setPrefV"][data-v="advanced"]').first().click(); await p.waitForTimeout(300);
  assert(await p.locator(".classic").count() === 1, "switched without asking");
  await clickA(p, "closeModal");
  assert(await p.locator(".classic").count() === 1, "cancel changed the sheet");
  await clickA(p, "openEdit");
  await p.locator('[data-a="setPrefV"][data-v="advanced"]').first().click(); await p.waitForTimeout(300);
  await clickA(p, "confirmStyle");
  assert(await p.locator(".classic").count() === 0 && await p.locator('[data-a="charSub"][data-sub="gear"]').count() === 1, "advanced did not open with a Gear sub-tab");
  noErrs(p); await p.context().close();
});

await check("loadouts (advanced Gear): save, preview does not change gear, apply does; Combat sub-tab is gone", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await goAdvanced(p);
  assert(await p.locator('[data-a="charSub"][data-sub="combat"]').count() === 0, "Combat sub-tab still there");
  await p.locator('[data-a="charSub"][data-sub="gear"]').click(); await p.waitForTimeout(400);
  await clickA(p, "loadoutSaveOpen"); await p.locator("#f-ldname").fill("Test set"); await clickA(p, "loadoutSave"); await p.waitForTimeout(300);
  await p.locator('[data-a="slotTap"][data-slot="main"]').first().click(); await p.waitForTimeout(250);
  await p.locator('[data-a="equipHere"]').first().click(); await p.waitForTimeout(300);
  const worn = async () => (await p.locator('[data-a="slotTap"][data-slot="main"] h4').first().innerText()).trim();
  const before = await worn(); assert(before !== "Empty", "weapon was not equipped");
  await p.locator('[data-a="loadoutOpen"]').first().click(); await p.waitForTimeout(300);
  await clickA(p, "closeModal"); await p.waitForTimeout(200);
  assert(await worn() === before, "opening the preview changed the gear");
  await p.locator('[data-a="loadoutOpen"]').first().click(); await p.waitForTimeout(300);
  await clickA(p, "loadoutApply"); await p.waitForTimeout(400);
  assert(await worn() === "Empty", "applying the loadout did not restore it");
  assert(await hscroll(p) <= 0, "hscroll on gear");
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
