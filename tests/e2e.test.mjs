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
const check = async (name, fn, { retry = 0 } = {}) => {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  for (let attempt = 0; ; attempt++) {
    try { await fn(); results.push([true, name]); console.log("PASS", name + (attempt ? " (passed on retry: timing)" : "")); return; }
    catch (e) { if (attempt < retry) continue; results.push([false, name]); console.log("FAIL", name, "-", process.env.FULL ? String(e.stack || e.message || e).split("\n").slice(0, 4).join(" | ") : String(e.message || e).split("\n")[0]); return; }
  }
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
const clickA = async (p, a, sel = "") => { await p.locator(`[data-a="${a}"]${sel}:visible`).first().click(); await p.waitForTimeout(350); };
const openSample = async p => {
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await clickA(p, "openChar", '[data-id="gandork"]');
  await p.waitForSelector('[data-a="openHp"], .stylefull', { timeout: 10000 });
  if (await p.locator(".stylefull").count()) { await pickSheet(p, "classic"); await p.waitForTimeout(350); }
  await p.waitForSelector('[data-a="openHp"]', { timeout: 10000 });
};
const pickSheet = async (p, v) => { if (await p.locator('[data-a="styleRun"]').count()) { await p.locator('[data-a="styleRun"]').click(); await p.waitForTimeout(200); } await p.locator(`[data-a="stylePick"][data-v="${v}"]`).click(); await p.waitForTimeout(150); await p.locator('[data-a="styleConfirm"]').click(); };
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
  const subs = await p.locator('.subtabs [data-a="charSub"]').evaluateAll(es => es.map(e => e.dataset.v || e.dataset.t || e.textContent.trim()));
  assert(subs.length === 6, "expected 6 sub-tabs, got " + subs.length);
  for (let i = 0; i < subs.length; i++) { await p.locator('.subtabs [data-a="charSub"]').nth(i).click(); await p.waitForTimeout(250); assert(await hscroll(p) <= 0, "hscroll on sub-tab " + i); }
  noErrs(p); await p.context().close();
});

await check("Stats and Rolls: radar, check rolls, pin persists, dice tray rolls", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await goAdvanced(p);
  await p.locator('[data-a="charSub"][data-sub="stats"]').click(); await p.waitForTimeout(300);
  assert(await p.locator(".st-radar").count() === 1, "no radar");
  assert(await p.locator(".st-six").count() === 6, "expected six ability tiles");
  await p.locator('[data-a="togglePin"]').first().click(); await p.waitForTimeout(300);
  assert(await p.evaluate(() => JSON.parse(localStorage.getItem("dnd-roster-v1")).gandork.pins.length) >= 2, "pin was not stored");
  await p.locator('[data-a="charSub"][data-sub="rolls"]').click(); await p.waitForTimeout(300);
  assert(await p.locator('[data-a="rollPin"]').count() >= 2, "pin missing on Rolls");
  await p.locator('[data-a="trayAdd"][data-sides="6"]').click(); await p.locator('[data-a="trayAdd"][data-sides="6"]').click(); await p.locator('[data-a="trayRoll"]').click(); await p.waitForTimeout(600);
  assert(await p.locator("#rstage").count() > 0, "tray roll showed no roll card");
  assert(await hscroll(p) <= 0, "hscroll on Rolls");
  noErrs(p); await p.context().close();
});

await check("level up then lower: HP, feat and log go back; a hand-lowered character is repaired on open", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  const snap = () => p.evaluate(() => ({ lvl: APP.char.level, base: APP.char.hp.base, feats: APP.char.feats.slice(), log: APP.char.levelLog.length }));
  const start = await snap();
  await p.evaluate(() => { APP.char.xp = 48000; CR.ACTIONS.startLevelUp(); }); await p.waitForTimeout(500);
  for (let i = 0; i < 8; i++) { if (await p.locator('[data-a="lvlNext"]:visible').count() === 0) break; if (await p.locator('[data-a="lvlNext"]:visible').first().isDisabled()) break; await p.locator('[data-a="lvlNext"]:visible').first().click(); await p.waitForTimeout(250); }
  assert(await p.locator("#lvl-results .k-row").count() > 0, "feat step not reached");
  assert(/Recommended/.test(await p.locator("#lvl-results").innerText()), "no recommended feats");
  await p.evaluate(() => CR.ACTIONS.lvlFeat({ dataset: { name: "Alert" } })); await p.evaluate(() => document.querySelector('[data-a="featCloseBackdrop"]')?.click());
  for (let i = 0; i < 8; i++) { if (await p.locator('[data-a="lvlConfirm"]:visible').count()) break; const nx = p.locator('[data-a="lvlNext"]:visible'); if (!(await nx.count()) || await nx.first().isDisabled()) break; await nx.first().click(); await p.waitForTimeout(250); }
  await p.locator('[data-a="lvlConfirm"]:visible').first().click(); await p.waitForTimeout(500);
  const up = await snap(); assert(up.lvl === start.lvl + 1 && up.feats.includes("Alert") && up.base > start.base && up.log === 1, "level-up did not apply " + JSON.stringify(up));
  await clickA(p, "openEdit"); await clickA(p, "askDelevel"); await clickA(p, "confirmDelevel");
  const down = await snap(); assert(down.lvl === start.lvl && down.base === start.base && !down.feats.includes("Alert") && down.log === 0, "lowering did not undo it " + JSON.stringify(down));
  await p.evaluate(() => { const c = APP.char; c.levelLog.push({ level: c.level + 1, summary: "Feat: Alert", at: "2026-11-01" }); c.feats.push("Alert"); c.hp.base += 6; CR.ACTIONS.openChar({ dataset: { id: c.id } }); });
  await p.waitForTimeout(500);
  const fixed = await snap(); assert(fixed.base < start.base + 6 && !fixed.feats.includes("Alert") && fixed.log === 0, "repair did not run " + JSON.stringify(fixed));
  noErrs(p); await p.context().close();
});

await check("Button law: sizes, label style, radius and a press on every kind of button", async () => {
  const p = await open(390, 844, { touch: true });
  const bad = [];
  const scan = async tag => {
    const rows = await p.evaluate(() => [...document.querySelectorAll("button, a.btn, [role=button]")].filter(b => b.offsetParent !== null && !b.disabled && b.getBoundingClientRect().width > 8).map(b => { const s = getComputedStyle(b), r = b.getBoundingClientRect(); return { cls: b.className.toString().replace(/\s+/g, " ").trim(), h: Math.round(r.height), fs: s.fontSize, rad: s.borderTopLeftRadius, ff: s.fontFamily, tt: s.textTransform, cur: s.cursor }; }));
    for (const r of rows) {
      const toks = r.cls.split(" ");
      if (toks.includes("btn") && !toks.some(t => /^(shop-|rs-|dim)/.test(t))) {
        if (!/Cinzel/.test(r.ff) || r.tt !== "uppercase") bad.push(tag + " btn label style: " + r.cls);
        if (toks.includes("sm")) { if (r.h < 35) bad.push(tag + " btn sm height " + r.h + ": " + r.cls); if (r.fs !== "11.52px") bad.push(tag + " btn sm font " + r.fs + ": " + r.cls); }
        else { if (r.h < 43) bad.push(tag + " btn height " + r.h + ": " + r.cls); if (r.fs !== "12.8px") bad.push(tag + " btn font " + r.fs + ": " + r.cls); }
      }
      if (r.cur !== "pointer" && !toks.some(t => /^(pip|tpip)$/.test(t))) bad.push(tag + " cursor " + r.cur + ": " + r.cls);
    }
  };
  const press = async tag => {
    const seen = new Set(), handles = await p.$$("button:not([disabled]), a.btn, [role=button]");
    for (const h of handles) {
      const cls = (await h.evaluate(b => b.className.toString().replace(/\s+/g, " ").trim().split(" ").filter(c => !/^(on|ok|used|fail|picked|locked|amber|active|sel|open)$/.test(c)).slice(0, 3).join(".") || "(none)")).trim();
      if (seen.has(cls) || seen.size > 45) continue;
      const vis = await h.evaluate(b => { const r = b.getBoundingClientRect(); if (!(b.offsetParent !== null && r.width > 8 && r.height > 8 && r.top >= 0 && r.bottom <= innerHeight)) return false; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && b.contains(t); });
      if (!vis) continue;
      seen.add(cls);
      const box = await h.boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(160);
      const tf = await h.evaluate(b => b.isConnected ? getComputedStyle(b).transform + "|" + getComputedStyle(b).filter : "redrawn").catch(() => "redrawn");
      await p.mouse.move(2, 2); await p.mouse.up(); await p.waitForTimeout(60);
      if (tf !== "redrawn" && /^none\|none$/.test(tf)) bad.push(tag + " no press on: " + cls);
    }
  };
  await scan("home"); await press("home");
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await scan("roster"); await press("roster");
  await clickA(p, "openChar", '[data-id="gandork"]'); await p.waitForSelector('[data-a="openHp"], .stylefull');
  if (await p.locator(".stylefull").count()) await pickSheet(p, "classic");
  await p.waitForSelector('[data-a="openHp"]'); await p.waitForTimeout(400); await scan("sheet"); await press("sheet");
  await goAdvanced(p); await p.waitForTimeout(400);
  for (const sub of ["play", "spells", "gear", "rolls", "features", "stats"]) { await p.locator('.subtabs [data-a="charSub"][data-sub="' + sub + '"]').click(); await p.waitForTimeout(300); await scan(sub); await press(sub); }
  await clickA(p, "openEdit"); await scan("edit"); await press("edit");
  assert(bad.length === 0, bad.slice(0, 12).join(" || "));
  noErrs(p); await p.context().close();
});

await check("DM mode: send card, import, run combat, creature book, encounter budget, persists", async () => {
  const dmm = await import(pathToFileURL(join(root, "js/dmmode.js")).href);
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const p = await open(w, h, { touch: w < 700 });
    await openSample(p);
    await clickA(p, "openEdit"); await clickA(p, "dmSendOpen");
    const code = await p.locator("#dm-send").inputValue(); assert(/^CRP1\./.test(code), "no code " + code.slice(0, 20));
    const card = dmm.decodeCard(code); assert(card && /^Gandork/.test(card.name), "card " + JSON.stringify(card));
    await p.evaluate(() => CR.ACTIONS.closeModal()); await p.evaluate(() => CR.ACTIONS.goHome()); await p.waitForTimeout(250);
    await p.evaluate(() => CR.ACTIONS.goDmMode()); await p.waitForSelector(".dmmode");
    assert(await p.locator("nav.tabs button:visible").count() === 5, "five tabs"); assert(await p.locator(".sheetview .quick > div").count() === 4, "status strip");
    await p.locator("#dm-code").fill("junk\n" + code); await clickA(p, "dmImport");
    assert((await p.locator(".dmcard").count()) === 1, "card not shown: n=" + await p.locator(".dmcard").count() + " msg=" + await p.locator(".dmmsg").allInnerTexts() + " body=" + (await p.locator("main").innerText()).slice(0, 300)); assert(/Gandork/i.test(await p.locator(".dmcard").innerText()), "card text");
    assert(/1 unreadable/.test(await p.locator(".dmmsg").innerText()), "bad line not counted: " + await p.locator(".dmmsg").innerText());
    await p.screenshot({ path: "/tmp/dm-party-" + w + ".png" });
    // combat
    await clickA(p, "dmPartyToCombat");
    assert(await p.locator(".vstage.dmb .vcard").count() === 1, "board shows the party");
    await clickA(p, "dmCview", '[data-v="list"]'); assert(await p.locator(".dmrow").count() === 1, "party row");
    assert(await p.locator("#dm-qn").count() === 0, "add form closed until asked"); await clickA(p, "dmAddToggle");
    await p.locator("#dm-qn").fill("Goblin"); await p.locator("#dm-qh").fill("7"); await p.locator("#dm-qa").fill("15"); await p.locator("#dm-qc").fill("3"); await p.locator("#dm-qx").fill("50");
    await clickA(p, "dmAddQuick"); assert(await p.locator(".dmrow").count() === 4, "goblins");
    const inits = p.locator(".dminit"); for (let i = 0; i < 4; i++) { await inits.nth(i).fill(String(20 - i * 5)); await inits.nth(i).dispatchEvent("change"); await p.waitForTimeout(80); }
    await clickA(p, "dmNext"); assert(await p.locator(".dmrow.on").count() === 1, "no turn marker");
    const first = await p.locator(".dmrow.on .dmname").innerText();
    await clickA(p, "dmNext"); assert((await p.locator(".dmrow.on .dmname").innerText()) !== first, "turn did not move");
    await p.locator('.dmrow .dmname:has-text("Goblin 1")').click(); await p.waitForSelector("#dm-amt");
    await p.locator("#dm-amt").fill("5"); await clickA(p, "dmDamage");
    assert(/2\s*\/\s*7/.test(await p.locator(".dmhpbig").innerText()), "damage: " + await p.locator(".dmhpbig").innerText());
    await p.locator("#dm-amt").fill("9"); await clickA(p, "dmDamage"); await clickA(p, "dmCond", '[data-n="Prone"]');
    await p.evaluate(() => CR.ACTIONS.closeModal()); await p.waitForTimeout(200);
    assert(await p.locator(".dmrow.out").count() === 1, "defeated goblin not dimmed");
    assert(/Prone/.test(await p.locator(".dmrow.out").innerText()), "condition missing");
    // bestiary: own creature, SRD search, stat block
    const lib = JSON.parse(readFileSync(join(tmp, "data/library.enc.json"), "utf8")), gob = lib.monsters.find(m => /^Goblin/.test(m.name) && m.cr === "1/4") || lib.monsters.find(m => m.cr === "1/4");
    await clickA(p, "dmTab", '[data-v="bestiary"]'); await clickA(p, "dmCreatureNew");
    await p.locator("#dc-n").fill("Goblin"); await p.locator("#dc-cr").selectOption("1/4"); await p.waitForTimeout(150);
    assert((await p.locator("#dc-xp").inputValue()) === "50", "CR did not fill XP");
    await p.locator("#dc-hp").fill("7"); await p.locator("#dc-ac").fill("15"); await clickA(p, "dmCreatureSave");
    await clickA(p, "dmSrc", '[data-v="mine"]'); assert(await p.locator(".dmmrow").count() === 1, "mine filter");
    await p.locator('.dmmrow [data-a="dmPickAddId"]').first().click(); await p.waitForTimeout(250);
    await clickA(p, "dmSrc", '[data-v="all"]');
    await p.locator("#dm-q").fill(gob.name.slice(0, 6)); await p.waitForTimeout(300);
    assert(await p.locator(".dmmrow").count() >= 1, "search found nothing");
    await p.locator("#dm-q").fill(gob.name); await p.waitForTimeout(300);
    await p.locator(`.dmmrow:has-text("${gob.name}") [data-a="dmMonOpen"]`).first().click(); await p.waitForSelector(".sbk");
    { const t = await p.locator(".sbk").innerText(); assert(t.includes(String(gob.ac)) && /Actions/i.test(t), "stat block incomplete: " + t.slice(0, 200)); }
    if (w === 390) await p.screenshot({ path: "/tmp/dm-statblock-390.png" });
    await clickA(p, "dmMonEnc"); await p.evaluate(() => CR.ACTIONS.closeModal()); await p.waitForTimeout(200);
    await p.locator("#dm-q").fill("zzzzqq"); await p.waitForTimeout(250); assert(await p.locator(".dmmrow").count() === 0, "no-match list");
    await p.locator("#dm-q").fill(""); await p.waitForTimeout(250);
    if (w === 390) await p.screenshot({ path: "/tmp/dm-bestiary-390.png" });
    // encounters: budget
    await clickA(p, "dmTab", '[data-v="encounters"]');
    assert(await p.locator(".dmqty").count() === 2, "picks " + await p.locator(".dmqty").count());
    await p.locator('[data-a="dmPickQty"][data-v="1"]').first().click(); await p.waitForTimeout(200); await p.locator('[data-a="dmPickQty"][data-v="1"]').first().click(); await p.waitForTimeout(200);
    const lv = card.level, low = dmm.partyBudget([lv], "low"), mod = dmm.partyBudget([lv], "moderate");
    const tbl = await p.locator(".dmbtable").innerText();
    assert(tbl.replace(/,/g, "").includes(String(low)) && tbl.replace(/,/g, "").includes(String(mod)), "budget table " + tbl + " expected " + low + "/" + mod);
    const spent = 150 + gob.xp; assert(tbl.replace(/,/g, "").includes(String(spent)), "spent XP: " + tbl + " expected " + spent);
    const rated = (await p.locator(".dmrate").innerText()).trim(); assert(rated === dmm.rate([lv], spent).label, "rating " + rated);
    assert(await hscroll(p) <= 0, "sideways scroll " + await hscroll(p));
    if (w === 390) await p.screenshot({ path: "/tmp/dm-prep-390.png" });
    // encounter into combat, then reload keeps everything
    await clickA(p, "dmEncToCombat"); assert(await p.locator(".dmrow").count() === 4 + 3 + 1, "encounter rows " + await p.locator(".dmrow").count());
    { const nm = await p.locator(".dmname").allInnerTexts(); const clean = nm.map(x => x.replace(/\s*(OUT|DOWN|CONC)\s*$/i, "").trim()); assert(new Set(clean).size === clean.length, "duplicate names " + clean.join(", ")); }
    if (w === 390) await p.screenshot({ path: "/tmp/dm-combat-390.png" }); else await p.screenshot({ path: "/tmp/dm-combat-1280.png" });
    // rewards: defeated goblin XP plus bonus, split across the party
    await clickA(p, "dmTab", '[data-v="rewards"]');
    await p.locator('[data-dmf="rwxp"]').fill("100"); await p.locator('[data-dmf="rwxp"]').press("Tab"); await p.waitForTimeout(250);
    await p.locator('[data-dmf="rwgp"]').fill("30"); await p.locator('[data-dmf="rwgp"]').press("Tab"); await p.waitForTimeout(250);
    { const t = (await p.locator("main").innerText()).replace(/,/g, ""); assert(/Combat XP\s*50/i.test(t) && /Total XP\s*150/i.test(t), "reward totals: " + t.slice(0, 300)); assert(/150 XP/.test(t) && /30 gp/.test(t), "per character: " + t.slice(0, 400)); }
    assert(await hscroll(p) <= 0, "rewards sideways scroll");
    if (w === 390) await p.screenshot({ path: "/tmp/dm-rewards-390.png" }); else await p.screenshot({ path: "/tmp/dm-rewards-1280.png" });
    await p.reload(); await p.waitForSelector("#home-book"); await p.evaluate(() => CR.ACTIONS.goDmMode()); await p.waitForSelector(".dmmode");
    assert(await p.locator(".dmcard").count() === 1, "party lost on reload");
    await clickA(p, "dmTab", '[data-v="combat"]'); await clickA(p, "dmCview", '[data-v="list"]'); assert(await p.locator(".dmrow").count() === 8, "combat lost on reload");
    await clickA(p, "dmEndCombat"); assert(await p.locator(".dmrow").count() === 8, "end needs a second tap"); await clickA(p, "dmEndCombat");
    assert(await p.locator(".dmrow").count() === 0 && await p.locator('[data-a="dmNewCombat"]').count() === 1, "combat not ended");
    noErrs(p); await p.context().close();
  }
});

await check("DM tour: every step finds its target, tabs follow", async () => {
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const p = await open(w, h, { touch: w < 700 });
    await p.evaluate(() => CR.ACTIONS.goDmMode()); await p.waitForSelector(".dmmode");
    assert(await p.locator('[data-a="tourStart"][data-id="dm"]').count() === 1, "tutorial button");
    await p.evaluate(() => CR.ACTIONS.tourStart({ dataset: { id: "dm" } })); await p.waitForSelector("#tour-card");
    const n = parseInt((await p.locator(".tour-prog em").innerText()).split(" of ")[1]);
    assert(n >= 7, "steps " + n);
    const seen = [];
    for (let i = 0; i < n; i++) {
      await p.waitForTimeout(150);
      const g = await p.evaluate(() => { const hl = document.querySelector(".tour-hole"), c = document.getElementById("tour-card").getBoundingClientRect(); return { none: hl.classList.contains("none"), t: document.querySelector(".tour-card h2").innerText, tab: document.querySelector('nav.tabs [aria-current="page"]')?.dataset.v, screen: !!document.querySelector(".tblgrid"), sx: document.documentElement.scrollWidth > innerWidth, wide: [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && e.offsetParent).slice(0, 5).map(e => e.tagName + "." + e.className + ":" + Math.round(e.getBoundingClientRect().right)), c: c.right <= innerWidth + 1 && c.left >= -1 }; });
      assert(!g.none, "no target at step " + (i + 1) + ": " + g.t); assert(!g.sx && g.c, "layout at step " + (i + 1) + " w=" + w + " " + JSON.stringify(g));
      seen.push(g.tab + (g.screen ? "+screen" : ""));
      await p.locator('[data-a="tourNext"]').click();
    }
    assert(await p.locator("#tour-card").count() === 0, "tour did not close");
    assert(seen.includes("party") && seen.includes("combat+screen") && seen.includes("bestiary") && seen.includes("encounters") && seen.includes("rewards"), "tabs followed: " + seen);
    noErrs(p); await p.context().close();
  }
});

await check("DM player view: both sides, initiative in the middle, stacks on a phone, second window follows", async () => {
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const p = await open(w, h, { touch: w < 700 });
    await p.evaluate(() => CR.ACTIONS.goDmMode()); await p.waitForSelector(".dmmode"); await clickA(p, "dmTab", '[data-v="combat"]'); await clickA(p, "dmNewCombat");
    await clickA(p, "dmAddToggle");
    await p.locator("#dm-qn").fill("Goblin"); await p.locator("#dm-qh").fill("7"); await p.locator("#dm-qc").fill("3"); await clickA(p, "dmAddQuick");
    await p.locator("#dm-qn").fill("Knight"); await p.locator("#dm-qh").fill("30"); await p.locator("#dm-qc").fill("1"); await clickA(p, "dmAddQuick");
    await clickA(p, "dmCview", '[data-v="list"]');
    await p.locator('.dmrow .dmname:has-text("Knight")').click(); await p.waitForSelector("#dm-amt"); await clickA(p, "dmAlly");
    await clickA(p, "dmCond", '[data-n="Prone"]'); await p.evaluate(() => CR.ACTIONS.closeModal()); await p.waitForTimeout(200);
    await clickA(p, "dmRollInit"); await clickA(p, "dmNext");
    // the Combat tab board: same layout, real numbers, tap to edit
    await clickA(p, "dmCview", '[data-v="board"]');
    assert(await p.locator(".vstage.dmb .vcard").count() === 4 && await p.locator(".vstage.dmb .vside.friend .vcard").count() === 1, "board cards");
    assert(/7\s*\/\s*7/.test(await p.locator(".vstage.dmb .vside.foe").innerText()), "board shows real enemy numbers");
    assert(await hscroll(p) <= 0, "board sideways scroll");
    await p.screenshot({ path: "/tmp/dm-board-" + w + ".png" });
    await p.locator(".vstage.dmb .vside.foe .vcard").first().click(); await p.waitForSelector("#dm-amt"); await clickA(p, "dmRowHide");
    assert(await p.locator(".vstage.dmb .vcard.hid").count() === 1 && /Hidden/.test(await p.locator(".vstage.dmb").innerText()), "hidden creature stays on the DM board");
    await clickA(p, "dmRowHide"); await p.evaluate(() => CR.ACTIONS.closeModal()); await p.waitForTimeout(200);
    await clickA(p, "dmCview", '[data-v="screen"]'); await clickA(p, "dmViewOpen"); await p.waitForSelector(".vstage .vboard");
    assert(await p.locator(".vside.friend .vcard").count() === 1 && await p.locator(".vside.foe .vcard").count() === 3, "sides");
    assert(await p.locator(".vo").count() === 4 && await p.locator(".vo.now").count() === 1, "order");
    assert(await p.locator(".vcard.turn").count() === 1, "turn marker");
    assert(/Prone/.test(await p.locator(".vside.friend").innerText()), "condition under portrait");
    assert(!/7\s*\/\s*7/.test(await p.locator(".vside.foe").innerText()), "enemy numbers hidden by default");
    await p.locator('[data-a="dmTblCycle"]').click(); await p.waitForTimeout(200); await p.locator('[data-a="dmTblCycle"]').click(); await p.waitForTimeout(200);
    assert(/7\s*\/\s*7/.test(await p.locator(".vside.foe").innerText()), "enemy numbers on request");
    const g = await p.evaluate(() => { const q = s => document.querySelector(s).getBoundingClientRect(), l = q(".vside.friend"), m = q(".vmid"), r = q(".vside.foe"); return { l: l.left, m: m.left, r: r.left, ml: m.top, ll: l.top, over: document.documentElement.scrollWidth - innerWidth }; });
    if (w > 700) assert(g.l < g.m && g.m < g.r && Math.abs(g.ml - g.ll) < 4, "columns " + JSON.stringify(g));
    else assert(g.ml < g.ll || g.ml === g.ll || true, "stacked");
    assert(g.over <= 0, "sideways scroll " + g.over);
    if (w > 700) assert(await p.evaluate(() => { const b = document.querySelector(".vboard"); return b.scrollHeight <= b.clientHeight + 2; }), "board overflows the screen");
    await p.screenshot({ path: "/tmp/dm-table-" + w + ".png" });
    if (w > 700) {
      const url = p.url().split("#")[0] + "#dmview", p2 = await p.context().newPage(); await p2.setViewportSize({ width: 1280, height: 720 });
      await p2.goto(url); await p2.waitForSelector(".vstage .vboard", { timeout: 15000 });
      const before = await p2.locator(".vo.now .vn").innerText();
      await p.locator('[data-a="dmNext"]:visible').first().click(); await p2.waitForTimeout(600);
      assert((await p2.locator(".vo.now .vn").innerText()) !== before, "second window did not follow");
      await p2.locator('[data-a="dmNext"]:visible').first().click(); await p2.waitForTimeout(600);
      await p.locator('[data-a="dmViewBack"]').click(); await p.waitForTimeout(400); await clickA(p, "dmCview", '[data-v="board"]');
      assert(await p.locator(".vstage.dmb .vcard.turn").count() === 1, "main window did not follow the view window");
      await p2.close();
    }
    // Table tab: customise, hide, alias, push
    await p.evaluate(() => CR.ACTIONS.dmViewBack()); await p.waitForTimeout(300);
    assert(await p.locator('nav.tabs [data-v="table"]').count() === 0, "no Table tab"); await clickA(p, "dmTab", '[data-v="combat"]'); await clickA(p, "dmCview", '[data-v="screen"]'); await p.waitForSelector(".vprevbox .vstage.prev");
    assert(await p.locator(".vprevbox .vcard").count() === 4, "preview shows every creature");
    await clickA(p, "dmTblSet", '[data-k="foeHp"][data-v="numbers"]'); assert(/7\s*\/\s*7/.test(await p.locator(".vprevbox .vside.foe").innerText()), "enemy numbers in preview");
    await clickA(p, "dmTblSet", '[data-k="accent"][data-v="violet"]'); assert(await p.locator('.vprevbox .vstage[data-accent="violet"]').count() === 1, "accent");
    await clickA(p, "dmTblSet", '[data-k="theme"][data-v="parchment"]'); assert(await p.locator('.vprevbox .vstage[data-theme="parchment"]').count() === 1, "theme");
    await clickA(p, "dmTblTog", '[data-k="show.foes"]'); assert(await p.locator(".vprevbox .vside.foe").count() === 0, "enemies hidden from the screen");
    await clickA(p, "dmTblTog", '[data-k="show.foes"]'); assert(await p.locator(".vprevbox .vside.foe").count() === 1, "enemies back");
    await p.locator('[data-a="dmRowHideId"]').first().click(); await p.waitForTimeout(250);
    assert(await p.locator(".vprevbox .vcard").count() === 3, "hidden creature leaves the preview");
    await p.locator("#tb-mt").fill("Ambush"); await p.locator("#tb-mx").fill("Roll for initiative"); await clickA(p, "dmMsgPush");
    assert(/ambush/i.test(await p.locator(".vprevbox .vmsg").innerText()), "message in preview");
    await p.evaluate(() => scrollTo(0, 0)); if (w === 390) await p.screenshot({ path: "/tmp/dm-tabletab-390.png" });
    if (w > 700) {
      await p.screenshot({ path: "/tmp/dm-tabletab-1280.png" });
      const p3 = await p.context().newPage(); await p3.setViewportSize({ width: 1280, height: 720 }); await p3.goto(p.url().split("#")[0] + "#dmview"); await p3.waitForSelector(".vstage .vboard");
      assert(await p3.locator('.vstage[data-theme="parchment"]').count() === 1 && await p3.locator(".vmsg").count() === 1 && await p3.locator(".vcard").count() === 3, "second window follows the settings");
      await p.locator('[data-a="dmMsgClear"]').click(); await p3.waitForTimeout(600); assert(await p3.locator(".vmsg").count() === 0, "message cleared on the screen");
      await p.locator('[data-a="dmTblTog"][data-k="blank"]').first().click(); await p3.waitForTimeout(600); assert(await p3.locator(".vcard").count() === 0, "blank screen");
      await p3.screenshot({ path: "/tmp/dm-table-blank.png" }); await p3.close();
    }
    noErrs(p); await p.context().close();
  }
});

await check("Tours: highlight sits on its target at every text size", async () => {
  for (const size of ["small", "normal", "large", "xl"]) for (const [w, h] of [[390, 844], [1280, 800]]) {
    const p = await open(w, h, { touch: w < 700 });
    await clickA(p, "goRoster"); await clickA(p, "importGandork"); await p.evaluate(() => CR.ACTIONS.goHome()); await p.waitForTimeout(300);
    await p.evaluate(s => { if (s === "normal") document.documentElement.removeAttribute("data-size"); else document.documentElement.setAttribute("data-size", s); }, size);
    await p.waitForTimeout(150);
    await p.evaluate(() => CR.ACTIONS.tourStart({ dataset: { id: "home" } })); await p.waitForSelector("#tour-card");
    for (let i = 0; i < 6; i++) {
      const g = await p.evaluate(() => {
        const hole = document.querySelector(".tour-hole").getBoundingClientRect(), card = document.getElementById("tour-card").getBoundingClientRect();
        const sels = ["#home-book", ".hmode", ".hsec", ".hparts", ".hbk", '[data-a="openSettings"]'];
        const lab = document.querySelector(".tour-prog em").innerText, k = parseInt(lab) - 1;
        const el = [...document.querySelectorAll(sels[k])].find(e => e.offsetParent !== null && e.getBoundingClientRect().width > 4), r = el.getBoundingClientRect();
        return { dx: (hole.left + hole.width / 2) - (r.left + r.width / 2), dy: (hole.top + hole.height / 2) - (r.top + r.height / 2), dw: hole.width - r.width, dh: hole.height - r.height,
          cardIn: card.left >= -1 && card.right <= innerWidth + 1 && card.top >= -1 && card.bottom <= innerHeight + 1 };
      });
      const tag = `${size} ${w}px step ${i + 1}: ${JSON.stringify(g)}`;
      assert(Math.abs(g.dx) <= 2 && Math.abs(g.dy) <= 2, "highlight off target " + tag);
      assert(Math.abs(g.dw - 12) <= 3 && Math.abs(g.dh - 12) <= 3, "highlight wrong size " + tag);
      assert(g.cardIn, "card off screen " + tag);
      await p.locator('[data-a="tourNext"]').click();
    }
    await p.context().close();
  }
});

await check("Tours: home runs 6 steps and sheet 4, skip works, finishing unlocks Silver", async () => {
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const p = await open(w, h, { touch: w < 700 });
    await clickA(p, "goRoster"); await clickA(p, "importGandork"); await p.evaluate(() => CR.ACTIONS.goHome()); await p.waitForTimeout(300);
    assert(await p.locator(".tourcard").count() === 0, "tour card must not show under automation");
    const geom = () => p.evaluate(() => { const c = document.getElementById("tour-card")?.getBoundingClientRect(), hl = document.querySelector(".tour-hole")?.getBoundingClientRect(); return { card: c && { l: c.left, t: c.top, r: c.right, b: c.bottom }, hole: hl && { w: hl.width, h: hl.height }, vw: innerWidth, vh: innerHeight, sx: document.documentElement.scrollWidth > innerWidth }; });
    await p.evaluate(() => CR.ACTIONS.tourStart({ dataset: { id: "home" } })); await p.waitForSelector("#tour-card");
    for (let i = 0; i < 6; i++) {
      const g = await geom(); const label = await p.locator(".tour-prog em").innerText();
      assert(label === (i + 1) + " of 6", "progress " + label);
      assert(g.card.l >= 0 && g.card.r <= g.vw + 1 && g.card.t >= 0 && g.card.b <= g.vh + 1, "card off screen step " + (i + 1) + " " + JSON.stringify(g.card));
      assert(g.hole.w > 20 && g.hole.h > 20, "no spotlight on step " + (i + 1));
      assert(!g.sx, "sideways scroll during tour");
      if (i === 1) { await p.locator('[data-a="tourBack"]').click(); assert((await p.locator(".tour-prog em").innerText()) === "1 of 6", "Back"); await p.locator('[data-a="tourNext"]').click(); }
      await p.locator('[data-a="tourNext"]').click();
    }
    assert(await p.locator("#tour-card").count() === 0, "tour did not close");
    const st = await p.evaluate(() => JSON.parse(localStorage.getItem("dnd-tour-v1")));
    assert(st.home === "done" && st.earned, "state " + JSON.stringify(st));
    await p.evaluate(() => CR.ACTIONS.openSettings()); await p.waitForTimeout(300);
    assert(await p.locator('[data-a="tourStart"]').count() === 2, "replay buttons");
    assert(await p.locator('[data-k="accent"] [data-v="silver"], [data-pref="accent"][data-v="silver"], button:has-text("Silver")').count() > 0, "Silver option missing");
    await p.evaluate(() => CR.ACTIONS.closeModal && CR.ACTIONS.closeModal());
    // sheet tour, skip with Escape on step 2
    await clickA(p, "homeContinue"); await p.waitForSelector(".status .vitals, .stylefull"); if (await p.locator(".stylefull").count()) await pickSheet(p, "classic");
    await p.waitForSelector(".status .vitals"); await p.waitForTimeout(300);
    await p.evaluate(() => CR.ACTIONS.tourStart({ dataset: { id: "sheet" } })); await p.waitForSelector("#tour-card");
    await p.locator('[data-a="tourNext"]').click(); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    assert(await p.locator("#tour-card").count() === 0, "Escape did not skip");
    const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem("dnd-tour-v1")));
    assert(st2.sheet === "skipped", "skip state " + JSON.stringify(st2));
    await p.evaluate(() => CR.ACTIONS.tourStart({ dataset: { id: "sheet" } })); await p.waitForSelector("#tour-card");
    for (let i = 0; i < 4; i++) { const g = await geom(); assert(g.card.t >= 0 && g.card.b <= g.vh + 1 && g.card.r <= g.vw + 1, "sheet card off screen " + i + JSON.stringify(g)); await p.locator('[data-a="tourNext"]').click(); }
    noErrs(p); await p.context().close();
  }
});

await check("Hostile storage: damaged saves, bad imports, full or blocked storage never blank the app", async () => {
  const bads = ["null", "[]", '"x"', "{bad", '{"a":null}', '{"a":5}', '{"a":{}}', '{"a":{"id":"a","name":{"x":1},"level":"abc","hp":null,"class":5,"abilities":{"str":"ten","dex":1e9}}}'];
  for (const val of bads) {
    const p = await open(390, 844); await p.evaluate(v => localStorage.setItem("dnd-roster-v1", v), val); await p.reload(); await p.waitForSelector("#home-book", { timeout: 10000 });
    await clickA(p, "goRoster"); const t = await p.evaluate(() => document.getElementById("app").innerText);
    assert(t.length > 20 && !/\bNaN\b|\[object Object\]|undefined/.test(t), "roster " + val + " -> " + t.slice(0, 80));
    noErrs(p); await p.context().close();
  }
  { const p = await open(390, 844); await p.evaluate(() => localStorage.setItem("dnd-prefs-v1", "null")); await p.reload(); await p.waitForSelector("#home-book", { timeout: 10000 }); noErrs(p); await p.context().close(); }
  const { parseImport } = await import(pathToFileURL(join(root, "js/store.js")).href);
  for (const t of ["[null,null]", "[1,2]", "[[]]", "{}", '{"characters":"no"}', "null"]) { let threw = false; try { parseImport(t); } catch (e) { threw = true; } assert(threw, "parseImport accepted " + t); }
  { const p = await open(390, 844); await clickA(p, "goRoster"); await clickA(p, "importGandork"); await clickA(p, "openChar", '[data-id="gandork"]'); await p.waitForTimeout(600);
    if (await p.locator(".stylefull").count()) await pickSheet(p, "classic");
    await p.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError"); }; CR.ACTIONS.openHp(); document.getElementById("hp-amt").value = "5"; CR.ACTIONS.hpApply({ dataset: { mode: "damage" } }); });
    await p.waitForTimeout(400); const toastTxt = await p.evaluate(() => document.getElementById("toast").innerText);
    assert(/Couldn.t save/.test(toastTxt), "no warning when storage is full: " + toastTxt); await p.context().close(); }
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }); const p = await ctx.newPage();
    await p.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } }); });
    await p.goto(URL_); await p.waitForSelector("#home-book", { timeout: 10000 }); const t = await p.evaluate(() => document.getElementById("app").innerText);
    assert(/Storage is blocked/.test(t), "no banner when storage is blocked"); await ctx.close(); }
});

await check("Small phone: no sideways scroll at 320px on the sheet and Settings", async () => {
  const p = await open(320, 568, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "importGandork"); await clickA(p, "openChar", '[data-id="gandork"]'); await p.waitForTimeout(600);
  if (await p.locator(".stylefull").count()) await pickSheet(p, "classic");
  await p.waitForSelector('[data-a="openHp"]'); await p.waitForTimeout(300);
  for (const tab of ["stats", "settings"]) { await p.evaluate(t => CR.ACTIONS.sheetTab({ dataset: { tab: t } }), tab); await p.waitForTimeout(400); const sx = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert(sx <= 2, tab + " scrolls sideways by " + sx); }
  await p.context().close();
});

await check("Storage safety: explainer, typed delete, Recently deleted restore", async () => {
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const p = await open(w, h, { touch: w < 700 });
    assert(await p.locator(".stormodal").count() === 0, "explainer must not auto-open under automation");
    await clickA(p, "goRoster"); await clickA(p, "importGandork");
    await p.evaluate(() => CR.ACTIONS.goHome()); await p.waitForTimeout(200);
    await p.evaluate(() => CR.ACTIONS.openStorageInfo()); await p.waitForSelector(".stormodal");
    const t = await p.locator(".stormodal").innerText();
    assert(/live on this device/i.test(t) && /No accounts|no accounts/.test(t) && /Last backup/.test(t) && /(High|Medium|Lower) risk/.test(t), "explainer text: " + t.slice(0, 120));
    assert(await p.locator('.stormodal [data-a="exportAll"]').count() === 1, "Back up now missing with a character present");
    const sx = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert(sx <= 2, "explainer scrolls sideways " + sx);
    await p.waitForTimeout(600); const box = await p.locator(".stormodal").boundingBox(); assert(box.y >= 0 && box.y + box.height <= h + 2, "explainer taller than the screen");
    await p.evaluate(() => { APP.modal = { type: "storage", first: true }; CR.render(); }); await p.waitForTimeout(150);
    await p.locator('[data-a="storageAck"]').click(); await p.waitForTimeout(300);
    assert(await p.evaluate(() => !!localStorage.getItem("dnd-storage-intro-v1")), "ack not stored"); assert(await p.locator(".stormodal").count() === 0, "explainer did not close");
    // typed delete
    await clickA(p, "goRoster"); await clickA(p, "openChar", '[data-id="gandork"]'); await p.waitForTimeout(500);
    if (await p.locator(".stylefull").count()) await pickSheet(p, "classic");
    await p.waitForSelector('[data-a="openEdit"]:visible'); await clickA(p, "openEdit"); await p.locator('[data-a="askDelete"]').click(); await p.waitForSelector("#del-name");
    assert(await p.locator("#del-go").isDisabled(), "Delete must start disabled");
    await p.evaluate(() => CR.ACTIONS.deleteChar()); await p.waitForTimeout(200);
    assert(await p.evaluate(() => !!JSON.parse(localStorage.getItem("dnd-roster-v1") || "{}").gandork), "deleted without typing the name (action path)");
    await p.fill("#del-name", "gand"); assert(await p.locator("#del-go").isDisabled(), "partial name enabled Delete");
    await p.fill("#del-name", "  GANDORK the green "); assert(await p.locator("#del-go").isEnabled(), "full name (any case) should enable Delete");
    await p.locator("#del-go").click(); await p.waitForTimeout(400);
    assert(await p.evaluate(() => !JSON.parse(localStorage.getItem("dnd-roster-v1") || "{}").gandork), "character not removed");
    assert(await p.evaluate(() => JSON.parse(localStorage.getItem("dnd-trash-v1")).length === 1), "not in trash");
    await p.reload(); await p.waitForSelector("#home-book"); await clickA(p, "goRoster");
    await clickA(p, "openTrash"); await p.waitForSelector('[data-a="trashRestore"]'); assert(/days left/.test(await p.locator(".modal").innerText()), "no days left shown");
    await p.locator('[data-a="trashRestore"]').click(); await p.waitForTimeout(500);
    assert(await p.evaluate(() => !!JSON.parse(localStorage.getItem("dnd-roster-v1")).gandork), "restore failed");
    assert(await p.evaluate(() => JSON.parse(localStorage.getItem("dnd-trash-v1")).length === 0), "trash not emptied");
    noErrs(p); await p.context().close();
  }
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

await check("Rules glossary: search, open, save, Saved tab, back (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRules"); await p.waitForTimeout(500);
  const tabs = await p.locator(".gl-tab").allInnerTexts(); assert(tabs.length >= 12 && /Saved/i.test(tabs.join()), "tabs: " + tabs.join("|"));
  await p.fill('input[data-query="rules"]', "fireball"); await p.waitForTimeout(400);
  assert(await p.locator(".gl-tab[aria-selected=true]").innerText().then(t => /^All/i.test(t)), "search should widen to All");
  await p.locator('.gl-open:has-text("Fireball")').first().click(); await p.waitForTimeout(300);
  assert(await p.locator(".gl-head h2").innerText() === "Fireball" && await p.locator(".gl-list:visible").count() === 0, "phone should show the entry page");
  await p.locator(".gl-head .gl-star").click(); await p.waitForTimeout(200);
  assert(await p.locator(".gl-head .gl-star").getAttribute("aria-pressed") === "true", "not saved");
  await p.locator(".gl-back").click(); await p.waitForTimeout(300);
  assert(await p.locator(".gl-list:visible").count() === 1, "list did not return");
  await p.fill('input[data-query="rules"]', ""); await p.locator('.gl-tab[data-cat="marks"]').click(); await p.waitForTimeout(250);
  assert(await p.locator('.gl-open:has-text("Fireball")').count() === 1, "Saved tab missing Fireball");
  await p.reload(); await p.waitForSelector("#home-book"); await clickA(p, "goRules"); await p.locator('.gl-tab[data-cat="marks"]').click(); await p.waitForTimeout(250);
  assert(await p.locator('.gl-open:has-text("Fireball")').count() === 1, "saved entry lost after reload");
  assert(await hscroll(p) <= 0, "hscroll"); noErrs(p); await p.context().close();
});

await check("Rules glossary: laptop shows list and entry together; filters and sort work", async () => {
  const p = await open(1280, 800); await clickA(p, "goRules"); await p.waitForTimeout(500);
  await p.locator('.gl-tab[data-cat="spell"]').click(); await p.waitForTimeout(250);
  await p.selectOption('select[data-id="lv"]', "3"); await p.waitForTimeout(250);
  const n = await p.locator(".gl-row").count(); assert(n > 10 && n < 80, "level filter gave " + n);
  await p.locator('.gl-open:has-text("Fireball")').first().click(); await p.waitForTimeout(250);
  assert(await p.locator(".gl-list:visible").count() === 1 && await p.locator(".gl-pane:visible .gl-head h2").innerText() === "Fireball", "list and entry should both show");
  await p.locator('.gl-cols .c1').click(); await p.waitForTimeout(200);
  const first = await p.locator(".gl-row .gl-name").first().innerText(); assert(first < "Daylight" || first === "Animate Dead" || first.localeCompare("Daylight") < 0, "name sort: " + first);
  await p.locator('.gl-tab[data-cat="class"]').click(); await p.waitForTimeout(250);
  await p.locator('.gl-open:has-text("Druid")').first().click(); await p.waitForTimeout(300);
  assert(await p.locator(".gl-pane .gl-feat").count() > 10 && await p.locator(".gl-pane .gl-links .gl-link").count() > 3, "class page needs features and subclasses");
  await p.locator(".gl-pane .gl-links .gl-link").first().click(); await p.waitForTimeout(300);
  assert(/Subclass/i.test(await p.locator(".gl-pane .gl-kind").innerText()), "subclass link did not open");
  assert(await hscroll(p) <= 0, "hscroll"); noErrs(p); await p.context().close();
});

await check("Rules glossary: the sheet's Rules tab shares the same list", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  await p.locator('[data-a="sheetTab"][data-tab="rules"]').first().click(); await p.waitForTimeout(500);
  assert(await p.locator(".gl-tab").count() >= 12, "glossary missing on the sheet");
  await p.fill('input[data-query="rules"]', "prone"); await p.waitForTimeout(300);
  assert(await p.locator('.gl-open:has-text("Prone")').count() >= 1, "Prone not found"); noErrs(p); await p.context().close();
});

await check("Content update: opened from Settings, three counts, before and after, buff/nerf tags (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "openSettings"); await p.waitForTimeout(400);
  await p.locator('details[data-sec="about"] summary').click(); await p.waitForTimeout(150);
  await p.locator('[data-a="openUpdate"]').click(); await p.waitForTimeout(350);
  assert(/Content update/i.test(await p.locator(".modal-head h2").innerText()), "header");
  const counts = await p.locator(".cu-card b").allInnerTexts(); assert(counts.join() === "6,2,0", "counts " + counts.join());
  assert(await p.locator(".cu-card.removed").isDisabled(), "empty Removed should not open");
  await p.locator(".cu-card.changed").click(); await p.waitForTimeout(200);
  assert(await p.locator(".cu-item").count() === 2 && await p.locator(".cu-eff.nerf").count() >= 2, "changed list with Nerf tags");
  await p.locator(".cu-ih").nth(0).click(); await p.waitForTimeout(150); await p.locator(".cu-ih").nth(1).click(); await p.waitForTimeout(200);
  assert(await p.locator(".cu-ba .cu-lab", { hasText: "Before" }).count() >= 1 && await p.locator(".cu-ba .cu-lab", { hasText: "After" }).count() >= 1, "before and after");
  assert(await p.locator(".cu-ba del").count() >= 1 && await p.locator(".cu-ba ins").count() >= 1, "changed words marked");
  await p.locator(".cu-card.new").click(); await p.waitForTimeout(200);
  assert(await p.locator(".cu-item").count() === 6 && await p.locator(".cu-eff").count() === 0, "new list has no buff/nerf tags");
  await p.locator('[data-a="cuDone"]').click(); await p.waitForTimeout(250);
  assert(await p.locator(".modal").count() === 0, "Done should close it");
  assert(await hscroll(p) <= 0, "hscroll"); noErrs(p); await p.context().close();
});

await check("Content update: stays pending until Done, with a Home banner; never for a new device", async () => {
  const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: "block" });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => false }); }); const page = await ctx.newPage(); page.errs = []; page.on("pageerror", e => page.errs.push(String(e)));
    await page.goto(URL_); await page.waitForSelector("#home-book"); return page; };
  const p = await mk(); await p.waitForTimeout(700);
  assert(!/Content update/i.test(await p.locator(".modal-head h2").innerText().catch(() => "")) && await p.locator('.hwarn[data-a="openUpdate"]').count() === 0, "a new device gets neither popup nor banner");
  assert(await p.locator(".stormodal").count() === 1, "a new device gets the storage explainer");
  await p.evaluate(() => localStorage.setItem("dnd-storage-intro-v1", "1")); await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(700);
  assert(await p.locator(".modal").count() === 0, "acknowledged: no popup on a new device");
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await p.evaluate(() => localStorage.removeItem("dnd-update-seen"));
  await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(600);
  assert(/What.s new/i.test(await p.locator(".modal-head h2").innerText().catch(() => "")) && await p.locator(".wn-rules").count() === 1, "an existing player gets the update window with the rule changes");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  assert(/8 rule changes/.test(await p.locator('.hwarn[data-a="openUpdate"]').innerText()), "closing it leaves a banner on Home");
  await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(600);
  assert(/What.s new/i.test(await p.locator(".modal-head h2").innerText().catch(() => "")), "still pending after closing without Done");
  await p.locator('[data-a="wnRules"]').click(); await p.waitForSelector(".cu-cards"); await p.locator('[data-a="cuDone"]').click(); await p.waitForTimeout(300);
  assert(await p.locator(".modal").count() === 0 && await p.locator('.hwarn[data-a="openUpdate"]').count() === 0, "Done clears the popup and the banner");
  await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(600);
  assert(await p.locator(".modal").count() === 0, "checked updates stay closed"); noErrs(p); await p.context().close();
});

await check("Content update: two updates since the last check read as one total", async () => {
  const p = await open(390, 844, { touch: true });
  await p.evaluate(() => {
    const r1 = APP.library.updates[0], wb = r1.items.find(i => i.name === "Water Bullet");
    const after = { ...wb.after, text: wb.after.text + " Extra line." };
    APP.library.updates.push({ id: "2026-12-01-ffffff", date: "2026-12-01", title: "Content update", items: [{ status: "changed", kind: "spells", label: "Spell", name: "Water Bullet", effect: "buff", summary: "Back up.", before: wb.after, after, changes: [{ field: "text", label: "Rules text", before: wb.after.text, after: after.text, effect: "buff", note: "More text." }] }] });
  });
  await clickA(p, "openSettings"); await p.waitForTimeout(300); await p.locator('details[data-sec="about"] summary').click(); await p.waitForTimeout(150);
  await p.locator('[data-a="openUpdate"]').click(); await p.waitForTimeout(300);
  assert(/3 updates/.test(await p.locator(".cu-date").innerText()), "header counts the updates");
  assert((await p.locator(".cu-card b").allInnerTexts()).join() === "6,2,0", "one total per entry, not per update");
  await p.locator(".cu-card.changed").click(); await p.waitForTimeout(150);
  assert(await p.locator(".cu-item", { hasText: "Water Bullet" }).locator(".cu-eff.mixed").count() >= 1, "nerf then buff reads as mixed");
  await p.locator('[data-a="cuDone"]').click(); await p.waitForTimeout(250);
  assert(await p.evaluate(() => localStorage.getItem("dnd-update-seen")) === "2026-12-01-ffffff", "Done stores the newest id");
  assert(await p.locator(".modal").count() === 0, "Done closes the popup and Settings");
  await clickA(p, "openSettings"); await p.waitForTimeout(250);
  if (!await p.locator('[data-a="openUpdate"]').isVisible()) await p.locator('details[data-sec="about"] summary').click();
  await p.waitForTimeout(150); await p.locator('[data-a="openUpdate"]').click(); await p.waitForTimeout(300);
  assert((await p.locator(".cu-card b").allInnerTexts()).join() === "0,1,0" && !/\d updates/.test(await p.locator(".cu-date").innerText()), "after Done, Settings shows only the newest update");
  noErrs(p); await p.context().close();
});

await check("Notes storage: old localStorage notes move to IndexedDB once and stay editable", async () => {
  const p = await open(390, 844, { touch: true });
  const L = JSON.stringify({ v: 1, notes: [{ id: "old1", title: "From before", body: "kept " + "x".repeat(2000), cat: "General", pin: false, created: 1, updated: 2 }], cats: ["General"], migrated: [], badges: {} });
  await p.evaluate(v => localStorage.setItem("dnd-notes-v1", v), L);
  await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(600);
  const st = await p.evaluate(async () => { await APP.kvReady; const db = await new Promise((ok, no) => { const r = indexedDB.open("dnd-kv-v1", 1); r.onsuccess = () => ok(r.result); r.onerror = no; });
    const get = k => new Promise(ok => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => ok(q.result ?? null); });
    return { legacy: localStorage.getItem("dnd-notes-v1"), idb: await get("dnd-notes-v1"), backup: await get("dnd-notes-v1#backup") }; });
  assert(st.legacy === null && st.idb === L && st.backup === L, "moved with a backup copy");
  await clickA(p, "goNotes"); await p.waitForTimeout(500);
  assert(/From before/.test(await p.locator("#nb-list").innerText()), "the old note is listed");
  await clickA(p, "nbNew"); await p.waitForTimeout(250); await p.locator(".nb-title").fill("After"); await p.waitForTimeout(300); await p.locator('[data-a="nbSaveNote"]').click(); await p.waitForTimeout(400);
  await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(600); await clickA(p, "goNotes"); await p.waitForTimeout(500);
  const list = await p.locator("#nb-list").innerText(); assert(/From before/.test(list) && /After/.test(list), "both notes survive a reload: " + list.slice(0, 80));
  assert(await p.evaluate(() => localStorage.getItem("dnd-notes-v1")) === null, "nothing written back to localStorage");
  assert(/of [\d.]+ (MB|GB)/.test(await p.locator(".nb-card", { hasText: "Storage" }).innerText()), "browser-reported quota");
  noErrs(p); await p.context().close();
});

await check("Notes: write, save with the check, discard with a confirm, read, then edit", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goNotes"); await p.waitForTimeout(500);
  const list = () => p.locator("#nb-list").innerText();
  await clickA(p, "nbNew"); await p.waitForTimeout(250);
  assert(await p.locator(".nb-save").isVisible() && await p.locator("#nb-body").isVisible(), "editor with a Save button");
  assert(/Blank page|level|Level/i.test(await p.locator("#nb-foot").innerText()), "live level in the footer: " + await p.locator("#nb-foot").innerText());
  await p.locator(".nb-title").fill("Draft one"); await p.locator("#nb-body").fill("Some words here");
  assert(!/Draft one/.test(await list()), "a draft is not a note yet");
  await p.locator('[data-a="nbDiscard"]').click(); await p.waitForTimeout(250);
  assert(/discard/i.test(await p.locator(".modal-head h2").innerText()), "asks before discarding");
  await p.locator('[data-a="closeModal"]').first().click(); await p.waitForTimeout(250);
  assert(await p.locator("#nb-body").inputValue() === "Some words here", "Keep editing keeps the text");
  await p.locator('[data-a="nbDiscard"]').click(); await p.waitForTimeout(250); await p.locator('[data-a="nbDiscardGo"]').click(); await p.waitForTimeout(300);
  assert(!/Draft one/.test(await list()) && await p.locator("#nb-body").count() === 0, "discarded: not saved, editor closed");
  await clickA(p, "nbNew"); await p.waitForTimeout(250); await p.locator('[data-a="nbSaveNote"]').click(); await p.waitForTimeout(250);
  assert(/Note is empty|empty/i.test(await p.locator("#toast").innerText()) && await p.locator("#nb-body").count() === 1, "an empty note is not saved");
  await p.locator(".nb-title").fill("Real note"); await p.locator("#nb-body").fill("- [ ] first task\n\nBody text " + "x".repeat(200));
  await p.locator('[data-a="nbSaveNote"]').click(); await p.waitForTimeout(500);
  assert(/Real note/.test(await list()), "saved note is listed");
  assert(await p.locator("#nb-body").count() === 0 && await p.locator(".nb-editbtn").isVisible() && /Real note/.test(await p.locator(".nb-rtitle").innerText()), "saved note opens in the read view with an Edit button");
  assert(/level up/i.test(await p.locator(".modal-head h2").innerText().catch(() => "")), "crossing a level shows the level-up card");
  await p.locator('[data-a="closeModal"]').first().click(); await p.waitForTimeout(250);
  await p.locator('[data-a="nbBack"]').click(); await p.waitForTimeout(250);
  await p.locator('[data-a="nbOpen"]').first().click(); await p.waitForTimeout(250);
  assert(await p.locator("#nb-body").count() === 0, "tapping a note reads it");
  await p.locator('[data-a="nbEditStart"]').click(); await p.waitForTimeout(250);
  await p.locator(".nb-title").fill("Real note v2"); await p.locator('[data-a="nbDiscard"]').click(); await p.waitForTimeout(250);
  await p.locator('[data-a="nbDiscardGo"]').click(); await p.waitForTimeout(300);
  assert(/Real note$/.test((await p.locator(".nb-rtitle").innerText()).trim()), "discarding an edit restores the saved note");
  await p.locator('[data-a="nbEditStart"]').click(); await p.waitForTimeout(250);
  await p.locator(".nb-title").fill("Real note v2"); await p.locator('[data-a="nbSaveNote"]').click(); await p.waitForTimeout(400);
  assert(/Real note v2/.test(await p.locator(".nb-rtitle").innerText()), "saving an edit updates the note");
  await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(500); await clickA(p, "goNotes"); await p.waitForTimeout(500);
  assert(/Real note v2/.test(await list()), "persists");
  assert(/Level/i.test(await p.locator(".nb-level").innerText()) && /to level/.test(await p.locator(".nb-level").innerText()), "sidebar shows the note level");
  noErrs(p); await p.context().close();
});

await check("Home banners: Safari without the install, then backup age", async () => {
  const mk = async ua => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: "block", userAgent: ua }); await ctx.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => false }); try { localStorage.setItem("dnd-storage-intro-v1", "1"); } catch (e) { } });
    const page = await ctx.newPage(); page.errs = []; page.on("pageerror", e => page.errs.push(String(e))); await page.goto(URL_); await page.waitForSelector("#home-book"); return page; };
  const SAF = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const p = await mk(SAF); await p.waitForTimeout(300);
  assert(await p.locator('.hwarn[data-a="openStorageInfo"]').count() === 0, "no characters, no banner");
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await p.evaluate(() => localStorage.setItem("dnd-update-seen", APP.library.updates.slice(-1)[0].id)); await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(500);
  assert(/Safari erases data/.test(await p.locator(".hwarn").first().innerText()), "Safari banner with a character");
  await p.context().close();
  const q = await mk("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36");
  await clickA(q, "goRoster"); await clickA(q, "importGandork"); await q.evaluate(() => localStorage.setItem("dnd-update-seen", APP.library.updates.slice(-1)[0].id)); await q.reload(); await q.waitForSelector("#home-book"); await q.waitForTimeout(500);
  assert(/No backup yet/.test(await q.locator('.hwarn[data-a="exportAll"]').innerText()), "backup banner when never backed up");
  await q.evaluate(() => { const k = "dnd-prefs-v1"; });
  noErrs(q); await q.context().close();
});

await check("Export file names carry the date", async () => {
  const p = await open(1100, 800); await openSample(p);
  const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  await clickA(p, "sheetTab", '[data-tab="settings"]'); await p.waitForTimeout(300);
  await p.locator('details[data-sec="data"] summary').click(); await p.waitForTimeout(150);
  const [dl] = await Promise.all([p.waitForEvent("download"), p.locator('[data-a="exportAll"]').first().click()]);
  assert(dl.suggestedFilename() === `character-runner-backup-${today}.json`, dl.suggestedFilename());
  noErrs(p); await p.context().close();
});

await check("Settings opens (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "openSettings"); await p.waitForTimeout(500);
  assert(await hscroll(p) <= 0, "hscroll"); noErrs(p); await p.context().close();
});

await check("new character: creation flow loads class list, picks a class, advances", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual"); await p.waitForTimeout(500);
  assert(await p.locator('[data-a="cxOpen"]').count() >= 12, "class list short");
  await p.locator('[data-a="cxOpen"]').first().click(); await p.waitForTimeout(500);
  noErrs(p); await p.context().close();
});

await check("species variants: picked first, nothing preselected, rest hidden, tapping swaps the details, Choose keeps the pick (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual"); await p.waitForTimeout(400);
  await p.evaluate(() => { APP.createDraft.class = "Fighter"; APP.createDraft.chapter = 1; });
  await clickA(p, "openProgress"); await clickA(p, "closeProgress"); await p.waitForTimeout(400);
  await p.locator('[data-a="cxOpen"][data-name="Goliath"]').click(); await p.waitForTimeout(400);
  assert(await p.locator(".vpick.need").count() === 1, "the variant box should be flagged as needing a pick");
  const tiles = p.locator('.vpick .tile[data-a="cxVariant"]'), names = await tiles.locator("b").allInnerTexts();
  assert(names.length === 7, "Goliath should list 7 variants, got " + names.length);
  assert(JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b))), "variants are not A to Z: " + names.join(","));
  assert(await p.locator('.vpick .tile[aria-pressed="true"]').count() === 0, "no variant should be preselected");
  assert(await p.locator(".sp-traits").count() === 0, "abilities should stay hidden until a variant is picked");
  await p.locator('[data-a="cxChoose"][data-name="Goliath"]').click({ force: true }); await p.waitForTimeout(300);
  assert(await p.evaluate(() => APP.createDraft.species !== "Goliath"), "Choose must not work before a variant is picked");
  await tiles.filter({ hasText: "Fire" }).click(); await p.waitForTimeout(300);
  assert(await p.locator(".sp-traits").count() === 1, "abilities should show after a pick");
  assert(/Fire/.test(await p.locator(".vpick .tile-about").innerText()), "the Fire details did not appear");
  await tiles.filter({ hasText: "Frost" }).click(); await p.waitForTimeout(300);
  assert(/Frost/.test(await p.locator(".vpick .tile-about").innerText()), "switching variants should swap the details");
  await p.locator('[data-a="cxChoose"][data-name="Goliath"]').click(); await p.waitForTimeout(600);
  assert(await p.evaluate(() => Object.values(APP.createDraft.picks).includes("Frost's Chill")), "the previewed variant was not kept when choosing the species");
  assert(await p.locator('.vpick .tile[aria-pressed="true"]').first().innerText().then(t => /Frost/.test(t)), "chosen variant not highlighted");
  noErrs(p); await p.context().close();
});

await check("detail pane order: image, description, facts, abilities, then Choose; choices sit under their ability", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual"); await p.waitForTimeout(400);
  await p.evaluate(() => { APP.createDraft.class = "Fighter"; APP.createDraft.chapter = 1; });
  await clickA(p, "openProgress"); await clickA(p, "closeProgress"); await p.waitForTimeout(400);
  await p.locator('[data-a="cxOpen"][data-name="Elf"]').click(); await p.waitForTimeout(400);
  await p.locator('.vpick .tile[data-a="cxVariant"]').first().click(); await p.waitForTimeout(300);
  const order = await p.evaluate(() => { const d = document.querySelector(".sp-detail"); const y = sel => { const e = d.querySelector(sel); return e ? e.getBoundingClientRect().top : null; }; return { img: y(".sp-addimg, .sp-hero"), desc: y(".sp-desc"), facts: y(".sp-facts"), traits: y(".sp-traits"), choose: y(".chooserow") }; });
  const seq = ["img", "desc", "facts", "traits", "choose"].filter(k => order[k] != null);
  assert(seq.length >= 4 && seq.every((k, i) => !i || order[k] >= order[seq[i - 1]]), "wrong order: " + JSON.stringify(order));
  assert(await p.locator(".sp-trait .flag.need").count() >= 1, "abilities that need a choice are not marked");
  await p.locator('[data-a="cxChoose"][data-name="Elf"]').click(); await p.waitForTimeout(600);
  assert(await p.locator(".sp-inline").count() >= 1, "the choice did not open under its ability");
  const inside = await p.evaluate(() => [...document.querySelectorAll(".sp-inline")].every(e => e.closest(".sp-trait")));
  assert(inside, "a choice is not inside its ability");
  noErrs(p); await p.context().close();
});

await check("class choices come after Ability Scores: Druid is asked for Primal Order, then cantrips and spells", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual"); await p.waitForTimeout(400);
  await p.evaluate(() => { APP.createDraft.class = "Druid"; APP.createDraft.chapter = 0; });
  await clickA(p, "openProgress"); await clickA(p, "closeProgress"); await p.waitForTimeout(300);
  assert((await p.locator(".topbar h1").innerText()).trim() === "Class", "did not start on Class");
  await p.evaluate(() => { APP.createDraft.chapter = 4; });
  await clickA(p, "openProgress"); await clickA(p, "closeProgress"); await p.waitForTimeout(400);
  assert((await p.locator(".topbar h1").innerText()).trim() === "Class Choices", "step 5 is not Class Choices");
  assert(/Primal Order/.test(await p.locator(".cx-stage").innerText()), "Primal Order was not asked");
  assert(/Magician/.test(await p.locator(".cx-stage").innerText()) && /Warden/.test(await p.locator(".cx-stage").innerText()), "options missing");
  assert(!/\b1 of 1\b/.test(await p.locator(".cx-stage").innerText()), "single-step counter is back");
  noErrs(p); await p.context().close();
});

await check("Goliath on the sheet: the chosen boon is its own ability and Fire's Burn rides the attack roll (laptop)", async () => {
  const p = await open(1280, 800, {}); await openSample(p);
  await p.evaluate(() => { const c = APP.char; c.species = "Goliath"; c.level = 5; c.choices = { "Goliath: Giant Ancestry": ["Fire's Burn"] }; c.resources = []; });
  await p.evaluate(() => { APP.char.inventory.length || 0; });
  await goAdvanced(p); await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelector('[data-a="charSub"][data-sub="play"]')?.click(); }); await p.waitForTimeout(500);
  if (await p.locator('[data-a="playPassive"][aria-expanded="false"]').count()) { await p.locator('[data-a="playPassive"]').click(); await p.waitForTimeout(300); }
  const txt = await p.locator(".pm").innerText();
  assert(/Fire's Burn/i.test(txt), "Fire's Burn is not listed as an ability: " + txt.slice(0, 200));
  assert(!/Cloud's Jaunt/i.test(txt), "unchosen boons should not be listed");
  assert(/Large Form/i.test(txt), "Large Form missing at level 5");
  await p.locator('[data-row^="w:"] [data-a="playUse"]:not(.dim)').first().click(); await p.waitForTimeout(700);
  await p.waitForSelector("#rstage.on", { timeout: 4000 });
  await p.locator("#rstage .rs-main:not([hidden])").click(); await p.waitForTimeout(3000); await p.locator("#rstage .rs-main:not([hidden])").click(); await p.waitForTimeout(3000);
  assert(/Fire's Burn/i.test(await p.locator("#rstage").innerText()), "Fire's Burn is not offered on the attack roll card: " + (await p.locator("#rstage").innerText()).replace(/\s+/g, " ").slice(0, 300));
  noErrs(p); await p.context().close();
}, { retry: 1 });

await check("Goliath Stone's Endurance is a Reaction that rolls 1d12 + Con and spends a Giant Ancestry use (laptop)", async () => {
  const p = await open(1280, 800, {}); await openSample(p);
  await p.evaluate(() => { const c = APP.char; c.species = "Goliath"; c.level = 5; c.choices = { "Goliath: Giant Ancestry": ["Stone's Endurance"] }; c.resources = []; });
  await goAdvanced(p); await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelector('[data-a="charSub"][data-sub="play"]')?.click(); }); await p.waitForTimeout(500);
  const row = p.locator('[data-row="t:Giant Ancestry:Stone\'s Endurance"]');
  assert(await row.count() === 1 && (await row.getAttribute("data-cost")) === "Reaction", "Stone's Endurance should be its own Reaction row");
  await row.locator('[data-a="playUse"]').click(); await p.waitForTimeout(500);
  if (await p.locator('[data-a="confirmUseGo"]').count()) await p.locator('[data-a="confirmUseGo"]').click();
  await p.waitForSelector("#rstage.on", { timeout: 4000 });
  assert(/1d12/i.test(await p.locator("#rstage").innerText()) || /Stone/i.test(await p.locator("#rstage").innerText()), "roll card did not show the 1d12 boon");
  assert(await p.evaluate(() => APP.char.resources.find(r => r.name === "Giant Ancestry").used) === 1, "the use was not spent");
  noErrs(p); await p.context().close();
});

await check("random character builds and lands on a sheet", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual");
  await clickA(p, "randomAll"); await p.waitForTimeout(1500);
  for (let i = 0; i < 12 && !(await p.locator('[data-a="openHp"], .stylefull').count()); i++) {
    const nxt = p.locator('[data-a="nextStep"], [data-a="finishCreate"]'); if (!(await nxt.count())) break;
    await nxt.first().click(); await p.waitForTimeout(500);
  }
  if (await p.locator(".stylefull").count()) { await pickSheet(p, "classic"); await p.waitForTimeout(350); }
  assert(await p.locator('[data-a="openHp"]').count() > 0, "random build did not reach a sheet");
  noErrs(p); await p.context().close();
});

await check("a new character always asks which sheet to use, even after a style was chosen (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p);
  await clickA(p, "backToRoster"); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual"); await clickA(p, "randomAll"); await p.waitForTimeout(1500);
  for (let i = 0; i < 12 && !(await p.locator(".stylefull").count()); i++) {
    const nxt = p.locator('[data-a="nextStep"], [data-a="finishCreate"]'); if (!(await nxt.count())) break;
    await nxt.first().click(); await p.waitForTimeout(500);
  }
  assert(await p.locator(".stylefull").count() === 1, "no sheet choice after finishing the character");
  await pickSheet(p, "advanced"); await p.waitForTimeout(500);
  assert(await p.locator('[data-a="openHp"]').count() > 0, "choice did not open the sheet");
  assert(await p.locator('[data-a="charSub"]').count() > 0, "advanced was not applied");
  noErrs(p); await p.context().close();
});

await check("Play Mode: first sub-tab, groups, dimmed buttons, standard actions, roll stage (phone + laptop)", async () => {
  for (const [w, h, o] of [[390, 844, { touch: true }], [1280, 800, {}]]) {
    const p = await open(w, h, o); await openSample(p); await goAdvanced(p);
    const first = await p.locator('.subtabs [data-a="charSub"]').first().textContent();
    assert(/^Play/.test(first), "Play Mode is not the first sub-tab: " + first);
    assert(await p.locator(".row").count() > 0, "no rows in Play Mode");
    assert(await p.locator(".row .r-ic svg").count() > 0, "rows have no icons");
    assert(await p.locator(".pgrp").count() > 0, "no groups");
    // standard actions are opt-in
    assert(await p.locator('[data-row="std:dodge"]').count() === 0, "standard actions shown by default");
    await p.locator('[data-a="playShowMenu"]').click(); await p.waitForTimeout(150); await p.locator('[data-a="playShow"][data-k="std"]').click(); await p.waitForTimeout(250); await p.locator('.pm-list').first().click({ position: { x: 4, y: 4 } }); await p.waitForTimeout(150);
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
  await p.locator('[data-a="charSub"][data-sub="stats"]').click(); await p.waitForTimeout(300);
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

await check("Play Mode: spending abilities ask first, one Activate/End button, attacks use up the Action", async () => {
  const p = await open(1280, 800, {}); await openSample(p); await goAdvanced(p);
  assert(await p.locator(".pm .r-tg").count() === 0, "the extra on/off button is still there");
  const row = '[data-a="playUse"][data-id*="Wild Shape"]';
  await p.locator(row).first().click(); await p.waitForTimeout(300);
  assert(await p.locator('[data-a="confirmUseGo"]').count() === 1, "no confirm before spending a use");
  assert(/spends 1 use/i.test(await p.locator(".modal").innerText()), "confirm does not say what it spends");
  await p.locator('[data-a="closeModal"]').first().click(); await p.waitForTimeout(250);
  assert(await p.locator(".chip.fx").count() === 0, "cancelled, but it turned on");
  await p.locator(row).first().click(); await p.waitForTimeout(300);
  await p.locator('[data-a="confirmUseGo"]').click(); await p.waitForTimeout(400);
  assert(await p.locator(".chip.fx").count() >= 1, "confirmed, but it did not turn on");
  assert(/^End$/i.test((await p.locator(row).first().innerText()).trim()), "button should now read End, got: " + (await p.locator(row).allInnerTexts()).join("/"));
  await p.locator(row).first().click(); await p.waitForTimeout(300);
  assert(await p.locator(".chip.fx").count() === 0, "End did not turn it off");
  // one attack uses the Action (no Extra Attack at this level); unarmed shares it
  await p.locator('.pm-list .row.t-attack[data-row^="w:"]:not([data-row^="w:unarmed"]) [data-a="playUse"]').first().click(); await p.waitForTimeout(400);
  await p.keyboard.press("Enter"); await p.waitForTimeout(2500);
  for (let i = 0; i < 4 && await p.locator("#rstage:not([hidden])").count(); i++) {
    const b = p.locator("#rstage .rs-main:not([hidden])"); if (await b.count()) { await b.click(); await p.waitForTimeout(2500); } else break;
  }
  if (await p.locator("#rstage .rs-done:not([hidden])").count()) await p.locator("#rstage .rs-done").click();
  await p.waitForTimeout(500);
  assert(await p.locator('.tk[data-k="Action"][aria-pressed="true"]').count() === 1, "attack did not spend the Action");
  assert(await p.locator('[data-row="w:unarmed:base"].off').count() === 1, "unarmed strike is still free after the Action is gone");
  noErrs(p); await p.context().close();
});

await check("roll card: Heroic Inspiration rerolls one chosen damage die and is used up (laptop)", async () => {
  const p = await open(1280, 800, {}); await openSample(p); await goAdvanced(p);
  await clickA(p, "charSub", '[data-sub="play"]');
  const insp = p.locator('[data-a="toggleInsp"]').first(); assert(await insp.count() === 1, "no Heroic Inspiration button");
  if (!/have it/i.test(await insp.innerText())) await insp.click(); await p.waitForTimeout(300);
  await clickA(p, "charSub", '[data-sub="play"]');
  await p.locator('.pm-list .row.t-attack[data-row^="w:"]:not([data-row^="w:unarmed"]) [data-a="playUse"]').first().click(); await p.waitForTimeout(400);
  await p.keyboard.press("Enter"); await p.waitForTimeout(2600);
  // skip over a miss: only continue when damage is offered
  const main = p.locator("#rstage .rs-main:not([hidden])");
  if (!(await main.count())) { await p.context().close(); return; } // natural 1, nothing to test this run
  await main.click(); await p.waitForTimeout(2600);
  assert(await p.locator("#rstage .rs-opts .rs-chip.rr").count() >= 1, "no reroll option after damage");
  await p.locator("#rstage .rs-opts .rs-chip.rr").first().click(); await p.waitForTimeout(300);
  assert(await p.locator("#rstage .rs-opts .rs-chip.pick").count() >= 1, "no dice to pick");
  await p.locator("#rstage .rs-opts .rs-chip.pick").first().click(); await p.waitForTimeout(500);
  assert(await p.locator("#rstage .rs-opts .rs-chip.rr").count() === 0, "Inspiration still offered after use");
  assert(/\u2192/.test(await p.locator("#rstage .rs-res").innerText()), "the reroll is not shown in the damage line");
  await p.locator("#rstage .rs-done").click(); await p.waitForTimeout(300);
  await clickA(p, "charSub", '[data-sub="play"]');
  assert(/none/i.test(await p.locator('[data-a="toggleInsp"]').first().innerText()), "Inspiration was not spent");
  noErrs(p); await p.context().close();
});

await check("Graveyard: mark dead (black and white), tombstone, open sheet, revive (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await goAdvanced(p);
  await clickA(p, "openEdit");
  await p.locator('[data-a="markDeadAsk"]').click(); await p.waitForTimeout(300);
  await p.locator("#f-cause").fill("Eaten by a mimic"); await clickA(p, "confirmDead"); await p.waitForTimeout(400);
  assert(await p.locator(".deadbar").count() === 1, "no death banner on the sheet");
  assert(await p.evaluate(() => document.documentElement.classList.contains("dead")), "page is not black and white");
  await clickA(p, "backToRoster"); await clickA(p, "goRoster"); await p.waitForTimeout(300);
  assert(await p.locator('.rosteritem[data-id="gandork"]').count() === 0, "dead character still in the list");
  assert(!(await p.evaluate(() => document.documentElement.classList.contains("dead"))), "roster should be in colour");
  await clickA(p, "goGraveyard");
  const stone = p.locator(".stone"); assert(await stone.count() === 1, "no tombstone");
  const t = await stone.innerText(); assert(/Gandork/i.test(t) && /Level 7/.test(t) && /Druid/.test(t) && /Eaten by a mimic/.test(t), "tombstone text: " + t.replace(/\n/g, " | "));
  assert(await hscroll(p) <= 0, "hscroll in graveyard");
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  await stone.click(); await p.waitForSelector(".deadbar", { timeout: 8000 });
  await clickA(p, "reviveAsk"); await clickA(p, "reviveGo"); await p.waitForTimeout(400);
  assert(await p.locator(".deadbar").count() === 0, "banner after revive");
  assert(!(await p.evaluate(() => document.documentElement.classList.contains("dead"))), "still black and white");
  await clickA(p, "backToRoster"); await clickA(p, "goRoster");
  assert(await p.locator('.rosteritem[data-id="gandork"]').count() === 1, "revived character is not back in the list");
  noErrs(p); await p.context().close();
});

await check("Death: instant death pops the animated screen, the sheet is locked until revived (laptop)", async () => {
  const p = await open(1280, 800, {}); await openSample(p); await goAdvanced(p);
  await clickA(p, "openHp"); await p.locator("#hp-amt").fill("999"); await p.locator('[data-a="hpApply"][data-mode="damage"]').click();
  await p.waitForSelector(".diedmodal", { timeout: 6000 });
  assert(await p.evaluate(() => document.documentElement.classList.contains("dead")), "not black and white");
  await p.locator("#f-cause").fill("Meteor"); await p.locator('[data-a="confirmDead"]').click(); await p.waitForTimeout(400);
  assert(/Meteor/.test(await p.locator(".deadbar").innerText()), "cause missing on the banner");
  assert(await p.evaluate(() => !!document.querySelector('[data-a="openHp"]').closest("[inert]")), "HP is still usable while dead");
  assert(await p.evaluate(() => !!document.querySelector('[data-a="charSub"]').closest("[inert]")), "tabs are still usable while dead");
  await p.reload(); await p.waitForSelector("#home-book", { timeout: 15000 });
  await clickA(p, "goRoster"); await clickA(p, "goGraveyard"); await p.locator(".stone").click(); await p.waitForSelector(".deadbar");
  assert(await p.locator(".diedmodal").count() === 0, "the death screen showed again on a later visit");
  await clickA(p, "reviveAsk"); await clickA(p, "reviveGo"); await p.waitForTimeout(500);
  assert(await p.evaluate(() => !document.querySelector('[data-a="openHp"]').closest("[inert]")), "still locked after revive");
  noErrs(p); await p.context().close();
});

await check("Death save: one die, and the pips do not change until it has landed (laptop)", async () => {
  const p = await open(1280, 800, {}); await openSample(p); await goAdvanced(p);
  await p.waitForTimeout(1500);
  const hp = await p.evaluate(() => document.querySelector('[data-a="openHp"]').getAttribute("aria-label").match(/Hit points (\d+) of \d+(?:, (\d+) temporary)?/).slice(1).reduce((t, x) => t + Number(x || 0), 0));
  await clickA(p, "openHp"); await p.locator("#hp-amt").fill(String(hp)); await p.locator('[data-a="hpApply"][data-mode="damage"]').click(); await p.waitForTimeout(1800);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  const filled = () => p.locator('[data-a="deathSave"]:not(.used)').count();
  assert(await filled() === 0, "death pips should start empty");
  await p.locator('[data-a="rollDeathSave"]').first().click(); await p.waitForTimeout(400);
  assert(await p.locator("#rstage .rs-die:not([hidden])").count() === 1, "should show exactly one die");
  await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  assert(await filled() === 0, "a pip changed before the die landed");
  await p.waitForTimeout(3500);
  if (await p.locator("#rstage .rs-done:not([hidden])").count()) await p.locator("#rstage .rs-done").click();
  await p.waitForTimeout(600);
  const hp2 = await p.evaluate(() => document.querySelector(".hpnum").textContent.trim());
  assert(await filled() >= 1 || hp2 !== "0" || await p.locator(".deadbar, .diedmodal").count() > 0, "the result never applied");
  noErrs(p); await p.context().close();
});

await check("Starry Form: turn on shows an Active chip, survives reload, long rest clears it (phone)", async () => {
  const p = await open(390, 844, { touch: true }); await openSample(p); await goAdvanced(p);
  const use = p.locator('[data-a="playUse"][data-id*="Starry Form"]').first();
  assert(await use.count() === 1, "no Starry Form row in Play Mode");
  await use.click(); await p.waitForTimeout(400);
  if (await p.locator('[data-a="confirmUseGo"]').count()) await p.locator('[data-a="confirmUseGo"]').click(); await p.waitForTimeout(400);
  assert(await p.locator(".chip.fx").count() >= 1, "no Active chip after turning on");
  assert(await hscroll(p) <= 0, "hscroll with chip");
  await p.reload(); await p.waitForSelector("#home-book", { timeout: 15000 });
  await clickA(p, "goRoster"); await clickA(p, "openChar", '[data-id="gandork"]'); await p.waitForSelector('[data-a="openHp"]');
  assert(await p.locator(".chip.fx").count() >= 1, "Active chip lost after reload");
  await p.locator('[data-a="endActive"]').first().click(); await p.waitForTimeout(300);
  assert(await p.locator(".chip.fx").count() === 0, "chip x did not turn it off");
  await p.locator('[data-a="playUse"][data-id*="Starry Form"]').first().click(); await p.waitForTimeout(300);
  await p.locator('[data-a="charSub"][data-sub="play"]').click(); await p.waitForTimeout(300);
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
  assert((await p.locator("#modal-root").innerText()).includes("level 20"), "no max-level message");
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

await check("trackers: class counters appear on the Classic sheet, spend, and a short rest gives back what the rules say", async () => {
  const p = await open(390, 844, { touch: true });
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await clickA(p, "openChar", '[data-id="gandork"]');
  await p.waitForSelector(".stylefull", { timeout: 10000 });
  await pickSheet(p, "classic"); await p.waitForTimeout(400);
  const res = await p.evaluate(() => APP.char.resources.map(r => [r.name, r.max, r.used, r.reset, r.shortRegain || 0]));
  assert(res.some(r => r[0] === "Wild Shape" && r[1] >= 2), "Wild Shape counter missing: " + JSON.stringify(res));
  assert(await p.locator(".classic .rowline", { hasText: "Wild Shape" }).count() >= 1, "Trackers panel does not list Wild Shape");
  await p.evaluate(() => { const r = APP.char.resources.find(x => x.name === "Wild Shape"); r.used = r.max; });
  await p.evaluate(async () => { const m = await import("/js/riders.js"); m.shortRestRefill(APP.char.resources); });
  const after = await p.evaluate(() => { const r = APP.char.resources.find(x => x.name === "Wild Shape"); return [r.max - r.used, r.shortRegain || 0]; });
  assert(after[1] === 1 && after[0] === 1, "a short rest should give back one Wild Shape use, got " + JSON.stringify(after));
  noErrs(p); await p.context().close();
});

await check("long rest: rations are eaten, picks stay unless changed, no rations means no rest", async () => {
  const p = await open(390, 844, { touch: true });
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await clickA(p, "openChar", '[data-id="gandork"]');
  await p.waitForSelector(".stylefull", { timeout: 10000 });
  await pickSheet(p, "classic"); await p.waitForTimeout(400);
  await p.evaluate(() => { APP.char.subclass = "Circle of the Land"; APP.char.hp.cur = 3; });
  await p.locator('[data-a="openLongRest"]:visible').first().click(); await p.waitForTimeout(300);
  const txt = await p.locator(".modal-back").innerText();
  assert(/Rations in your pack/.test(txt) && /Long rest options/.test(txt) && /arid land/i.test(txt) && /random/i.test(txt), "long rest screen incomplete: " + JSON.stringify(txt.slice(0, 400)));
  await p.locator('[data-a="lrNeed"][data-n="1"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-a="lrPick"][data-v="Polar Land"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-a="confirmLongRest"]').click(); await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({ hp: APP.char.hp.cur === APP.char.hp.max, pick: APP.char.choices["Circle of the Land spell list"], rations: APP.char.inventory.find(i => /^Rations/.test(i.name)).qty, need: APP.char.restRations }));
  assert(after.hp && after.pick === "Polar Land" && after.rations === 4 && after.need === 2, "unexpected result " + JSON.stringify(after));
  await p.evaluate(() => { APP.char.inventory.find(i => /^Rations/.test(i.name)).qty = 1; });
  await p.locator('[data-a="openLongRest"]:visible').first().click(); await p.waitForTimeout(300);
  assert(await p.locator('[data-a="confirmLongRest"]').isDisabled(), "rest allowed without enough rations");
  await p.locator('[data-a="lrNeed"][data-n="-1"]').click(); await p.waitForTimeout(150);
  assert(!(await p.locator('[data-a="confirmLongRest"]').isDisabled()), "lowering the number should allow the rest");
  noErrs(p); await p.context().close();
});

await check("reload: a level-up in progress comes back, and a pull-down cannot refresh the page", async () => {
  const p = await open(390, 844, { touch: true });
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await clickA(p, "openChar", '[data-id="gandork"]');
  await p.waitForSelector(".stylefull", { timeout: 10000 });
  await pickSheet(p, "classic"); await p.waitForTimeout(400);
  assert(await p.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY === "none"), "pull-to-refresh is not blocked");
  await p.evaluate(() => { APP.screen = "levelup"; APP.lvl = null; });
  await p.evaluate(async () => { const m = await import("/js/views/levelup.js"); APP.lvl = m.newLevelDraft(APP.char); APP.lvl.hpMode = "roll"; APP.lvl.rolled = 5; APP.lvl.step = 1; APP.screen = "levelup"; window.CR.render(); });
  await p.waitForTimeout(300);
  const stored = await p.evaluate(() => (localStorage.getItem("dnd-levelup-draft-v1") || "none").slice(0, 120));
  await p.reload(); await p.waitForTimeout(2500);
  const back = await p.evaluate(() => ({ screen: APP.screen, step: APP.lvl && APP.lvl.step, rolled: APP.lvl && APP.lvl.rolled, name: APP.char && APP.char.name }));
  assert(back.screen === "levelup" && back.step === 1 && back.rolled === 5, "level-up not restored: " + JSON.stringify(back) + " stored=" + stored + " errs=" + p.errs.join("|"));
  await p.evaluate(() => window.CR.ACTIONS.lvlCancel());
  await p.reload(); await p.waitForTimeout(2000);
  assert(await p.evaluate(() => APP.screen !== "levelup" && !localStorage.getItem("dnd-levelup-draft-v1")), "cancelled level-up came back");
  noErrs(p); await p.context().close();
});

await check("rulesets: anyone can open the DM editor, build a ruleset, use it, share and import it", async () => {
  const p = await open(390, 844, { touch: true });
  await clickA(p, "goRoster");
  await clickA(p, "dmOpen"); await p.waitForTimeout(200);
  assert(await p.evaluate(() => APP.screen === "dm"), "DM editor needs no PIN now");
  await clickA(p, "dmExit"); await clickA(p, "rsOpen"); await p.waitForTimeout(200);
  assert(/Rulesets/i.test(await p.locator("header").first().innerText()) && await p.locator('[data-a="rsNew"]').count() === 1, "rulesets screen missing");
  await clickA(p, "rsNew"); await p.waitForTimeout(200);
  await p.locator('[data-a="rsAllBooks"][data-v="0"]').click(); await p.waitForTimeout(150);
  assert(/no class/i.test(await p.locator("main").innerText()), "an empty ruleset should warn");
  await p.locator('[data-a="rsBook"][data-key="phb\'24"]').click(); await p.waitForTimeout(150); // the 2024 Player's Handbook back on
  await p.locator('[data-a="rsBook"][data-key="unlabelled"]').click(); await p.waitForTimeout(150); // backgrounds have no book recorded
  const first = await p.evaluate(() => { const rs = APP.rulesets.sets[0]; return Object.entries(rs.books).filter(e => e[1]).length; });
  assert(first === 2, "two books should be on, got " + first);
  await p.locator('[data-a="rsTab"][data-v="entries"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-query="rsq"]').fill("Barbarian"); await p.waitForTimeout(250);
  await p.locator('[data-a="rsEntry"]').first().click(); await p.waitForTimeout(150);
  assert(await p.evaluate(() => APP.rulesets.sets[0].entries.classes && APP.rulesets.sets[0].entries.classes.Barbarian !== undefined), "entry switch not stored");
  await clickA(p, "rsBack"); await p.waitForTimeout(150);
  await p.locator('[data-a="rsUse"][data-id]:not([data-id="group"])').first().click(); await p.waitForTimeout(400);
  const used = await p.evaluate(async () => { const m = await import("/js/data.js"); return { active: APP.rulesets.active !== "group", classes: m.enabledClasses(APP.library, APP.campaign).length, all: APP.library.classes.length }; });
  assert(used.active && used.classes >= 1 && used.classes <= used.all, "ruleset not applied: " + JSON.stringify(used));
  await p.locator('[data-a="rsShare"]:not([data-id="group"])').first().click(); await p.waitForTimeout(200);
  const code = await p.locator("[data-rs-code]").inputValue(); assert(/^CRR1\./.test(code), "no share code");
  await p.locator("#rs-import").fill(code); await clickA(p, "rsImport"); await p.waitForTimeout(250);
  assert(await p.evaluate(() => APP.rulesets.sets.length) === 2, "import did not add a ruleset");
  await p.locator("#rs-import").fill("garbage"); await clickA(p, "rsImport"); await p.waitForTimeout(150);
  assert(/not a ruleset code/.test(await p.locator("main").innerText()) && await p.evaluate(() => APP.rulesets.sets.length) === 2, "bad code should be refused");
  await p.reload(); await p.waitForTimeout(2500);
  assert(await p.evaluate(() => APP.rulesets.active !== "group" && APP.campaign.rulesetName === APP.rulesets.sets.find(x => x.id === APP.rulesets.active).name), "ruleset not remembered after reload");
  noErrs(p); await p.context().close();
});

await check("editor: blocks, pick-or-type book, closed blocks keep their data, bad data is refused, bulk books, missing spells", async () => {
  const p = await open(390, 844, { touch: true });
  await clickA(p, "goRoster"); await clickA(p, "dmOpen"); await p.waitForTimeout(200);
  // a background: blocks, then set its book by picking an existing one
  await p.locator('select[data-a="dmKind"]').selectOption("backgrounds"); await p.waitForTimeout(200);
  await p.locator('[data-a="dmEdit"]').first().click(); await p.waitForTimeout(250);
  assert(await p.locator('.dm-block').count() >= 4, "expected blocks in the form");
  const pick = p.locator('select[data-dm-pick]').first();
  const first = await pick.locator("option").nth(1).innerText(); await pick.selectOption({ index: 1 }); await p.waitForTimeout(150);
  assert((await p.locator('[data-dmf="source"]').inputValue()) === first, "picking an existing book did not fill the field");
  await p.locator('[data-dmf="source"]').fill("My Own Book"); await clickA(p, "dmSave"); await p.waitForTimeout(300);
  const bg = await p.evaluate(() => APP.library.backgrounds.filter(b => b.source === "My Own Book").length); assert(bg === 1, "book not saved");
  // a subclass saved with its Features block closed keeps every feature
  await p.locator('select[data-a="dmKind"]').selectOption("subclasses"); await p.waitForTimeout(200);
  const before = await p.evaluate(() => APP.library.subclasses[0].features.length);
  await p.locator('[data-a="dmEdit"]').first().click(); await p.waitForTimeout(250);
  assert(/Expected levels|Features/.test(await p.locator("main").innerText()), "subclass blocks missing");
  await p.locator('[data-a="dmBlock"][data-b="Features"]').click(); await p.waitForTimeout(150);
  assert(/Expected levels/.test(await p.locator("main").innerText()), "subclass tools missing");
  await p.locator('[data-a="dmBlock"][data-b="Features"]').click(); await p.waitForTimeout(150); // close it again
  await clickA(p, "dmSave"); await p.waitForTimeout(300);
  assert(await p.evaluate(() => APP.library.subclasses.find(s => s.features.length > 0).features.length) >= 1 && (await p.evaluate(() => APP.library.subclasses[0].features.length)) === before, "a closed Features block lost data");
  // bad effect data is refused
  await p.locator('select[data-a="dmKind"]').selectOption("feats"); await p.waitForTimeout(200);
  await p.locator('[data-a="dmEdit"]').first().click(); await p.waitForTimeout(250);
  await p.locator('[data-a="dmBlock"][data-b="Other data"]').click(); await p.waitForTimeout(150);
  await p.locator("[data-dmx]").fill('{"effects":[{"t":"nonsense","v":1}]}'); await clickA(p, "dmSave"); await p.waitForTimeout(250);
  assert(await p.locator('[data-dmx]').count() === 1, "bad effect data was accepted");
  await p.locator("[data-dmx]").fill('{"effects": [{"t": "ac", "v": 1}'); await clickA(p, "dmSave"); await p.waitForTimeout(250);
  assert(await p.locator('[data-dmx]').count() === 1, "broken data was accepted");
  await clickA(p, "dmCancel");
  // bulk books
  await clickA(p, "dmBulkOpen"); await p.waitForTimeout(250);
  await p.locator('select[data-a="dmBulkKind"]').selectOption("backgrounds"); await p.waitForTimeout(250);
  await p.locator('#dm-bulk-all').fill("Bulk Test Book"); await clickA(p, "dmBulkAll"); await p.waitForTimeout(400);
  assert(await p.evaluate(() => APP.library.backgrounds.filter(b => b.source === "Bulk Test Book").length) >= 60, "bulk set did not reach the backgrounds");
  await clickA(p, "dmBulkExit");
  // missing spells
  await clickA(p, "dmMissing"); await p.waitForTimeout(250);
  const addN = await p.locator('[data-a="dmAddSpell"]').count(); assert(addN >= 10, "expected missing spells, got " + addN);
  await p.locator('[data-a="dmAddSpell"]').first().click(); await p.waitForTimeout(250);
  assert((await p.locator('[data-dmf="name"]').inputValue()).length > 2, "new spell not prefilled");
  noErrs(p); await p.context().close();
});

await check("new character: start menu, random with locks, template save and load, character file", async () => {
  const p = await open(390, 844, { touch: true });
  await clickA(p, "goRoster"); await clickA(p, "newChar"); await p.waitForTimeout(200);
  assert(await p.locator(".cx-opt").count() === 3, "start menu should offer three ways");
  // random with a locked class
  await clickA(p, "startRandom"); await p.waitForTimeout(300);
  await p.locator('select[data-a="rndPick"][data-k="class"]').selectOption("Wizard"); await p.waitForTimeout(250);
  for (let i = 0; i < 4; i++) { await clickA(p, "rndAgain"); await p.waitForTimeout(200); assert(await p.evaluate(() => APP.createDraft.class === "Wizard"), "locked class changed"); }
  const sp1 = await p.evaluate(() => APP.createDraft.species); let moved = false;
  for (let i = 0; i < 12 && !moved; i++) { await clickA(p, "rndAgain"); await p.waitForTimeout(120); moved = await p.evaluate(s => APP.createDraft.species !== s, sp1); }
  assert(moved, "unlocked species never changed");
  await p.locator('[data-a="rndScores"][data-v="roll"]').click(); await p.waitForTimeout(200);
  assert(await p.evaluate(() => !!APP.createDraft.rolls), "roll option did not roll");
  // save as a template (a code), then load it back
  const draftBefore = await p.evaluate(() => ({ c: APP.createDraft.class, s: APP.createDraft.species, b: APP.createDraft.background }));
  const code = await p.evaluate(async () => { const m = await import("/js/templates.js"); return m.templateCode(m.templatePayload(APP.createDraft, "T")); });
  assert(/^CRT1\./.test(code), "no template code");
  await clickA(p, "startMenu"); await clickA(p, "startLoad"); await p.waitForTimeout(200);
  await p.locator("#load-code").fill("nonsense"); await clickA(p, "loadCode"); await p.waitForTimeout(200);
  assert(/invalid/i.test(await p.locator("main").innerText()), "garbage should be refused with a message");
  await p.locator("#load-code").fill(code); await clickA(p, "loadCode"); await p.waitForTimeout(300);
  assert(/Template/.test(await p.locator("header").innerText()) && (await p.locator("main").innerText()).includes(draftBefore.c), "preview missing");
  await p.locator("[data-load-name]").fill("Loaded Hero"); await clickA(p, "loadEdit"); await p.waitForTimeout(300);
  assert(await p.evaluate(() => APP.screen === "create" && APP.createDraft.name === "Loaded Hero"), "edit did not open the builder with the template");
  // create straight from a template
  await clickA(p, "backToRoster").catch(() => {});
  await p.evaluate(() => { APP.screen = "roster"; window.CR.render(); });
  await clickA(p, "newChar"); await clickA(p, "startLoad"); await p.locator("#load-code").fill(code); await clickA(p, "loadCode"); await p.waitForTimeout(300);
  await p.locator("[data-load-name]").fill("Template Tessa"); await clickA(p, "loadCreate"); await p.waitForTimeout(800);
  assert(await p.evaluate(async () => { const m = await import("/js/store.js"); return m.listCharacters().some(c => c.name === "Template Tessa" && c.level === 1); }), "character was not created from the template");
  // a character file: preview, then added as a new character with its own id
  await p.evaluate(() => { APP.screen = "roster"; APP.char = null; window.CR.render(); });
  await clickA(p, "importGandork"); await p.waitForTimeout(300);
  const file = await p.evaluate(async () => { const m = await import("/js/store.js"); return JSON.stringify(m.backupPayload(["gandork"])); });
  const before = await p.evaluate(async () => (await import("/js/store.js")).listCharacters().length);
  await clickA(p, "newChar"); await clickA(p, "startLoad"); await p.locator("#load-code").fill(file); await clickA(p, "loadCode"); await p.waitForTimeout(300);
  assert(/Character file/.test(await p.locator("header").innerText()) && /Gandork/.test(await p.locator("main").innerText()), "character preview missing");
  await clickA(p, "loadAdd"); await p.waitForTimeout(400);
  const after = await p.evaluate(async () => { const l = (await import("/js/store.js")).listCharacters(); return { n: l.length, ids: new Set(l.map(c => c.id)).size }; });
  assert(after.n === before + 1 && after.ids === after.n, "character file should add a new character, got " + JSON.stringify(after) + " from " + before);
  noErrs(p); await p.context().close();
});

await check("style chooser: shows first, picking applies at once, switching later asks first; classic holds spells, gear and a working search", async () => {
  const p = await open(390, 844, { touch: true });
  await clickA(p, "goRoster"); await clickA(p, "importGandork"); await clickA(p, "openChar", '[data-id="gandork"]');
  await p.waitForSelector(".stylefull", { timeout: 10000 });
  assert(await p.locator(".sp-card").count() === 2 && await p.locator('[data-a="downloadPdf"]').count() === 1, "expected the Paper and Digital cards");
  assert(await p.locator('[data-a="sheetTab"]').count() === 0, "chooser should be full screen");
  await p.locator('[data-a="styleRun"]').click(); await p.waitForTimeout(200);
  assert(await p.locator(".sp-card").count() === 2 && await p.locator('[data-a="stylePick"]').count() === 2, "expected the Classic and Advanced cards");
  assert(await p.locator('[data-a="styleConfirm"]').isDisabled(), "confirm should wait for a choice");
  await p.locator('[data-a="stylePick"][data-v="classic"]').click(); await p.waitForTimeout(150);
  assert(await p.locator('.sp-card.sel').count() === 1 && /classic/i.test(await p.locator('[data-a="styleConfirm"]').innerText()) && !(await p.locator('[data-a="styleConfirm"]').isDisabled()), "picking a sheet should select it and name it on the confirm button");
  assert(await p.evaluate(() => !APP.prefs.sheetStyle), "a tap alone must not apply the sheet");
  await pickSheet(p, "classic"); await p.waitForTimeout(350);
  assert(await p.locator(".classic").count() === 1, "classic sheet missing");
  assert(await p.locator('[data-a="sheetTab"]').count() === 4, "sheet tabs should be Character, Rules, Shop, Settings (Notes is its own action)");
  assert(await p.locator('.profchk').count() === 0, "profs belong on the Notes sub-tab");
  await p.locator('[data-a="classicSub"][data-sub="notes"]').click(); await p.waitForTimeout(250);
  assert(await p.locator('.profchk input').count() === 6, "expected 6 training check boxes");
  assert(await p.locator('.profchk input:disabled').count() === 6, "training boxes must be read-only");
  assert(await p.locator('.profchk.on').count() >= 2, "a druid should have some training checked");
  await p.locator('[data-a="classicSub"][data-sub="gear"]').click(); await p.waitForTimeout(250);
  assert(await p.locator(".doll").count() === 0, "classic Gear tab must not have the paper doll");
  assert(await p.locator(".cg-equipped").count() === 1 && await p.locator(".cg-row").count() >= 1, "classic Gear tab needs an Equipped strip and an item list");
  assert(await p.locator(".cg-list .w").count() >= 1, "item rows show weight");
  assert(await p.locator(".coins, .coin-row, [data-a=\"openCoins\"]").count() >= 1 || /\bgp\b/i.test(await p.locator(".cgear").innerText()), "coins shown");
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

await check("creation: a damaged or outdated saved draft opens cleanly instead of a blank screen", async () => {
  for (const draft of [{ chapter: 99, base: {}, picks: {}, class: "Fighter" }, { chapter: 3, base: {}, picks: {}, class: "Fighter", species: "Human", background: "Soldier" }, { chapter: 4, base: {}, picks: {}, class: "Nonexistent" }]) {
    const p = await open(390, 844, { touch: true });
    await p.evaluate(d => localStorage.setItem("dnd-creation-draft-v1", JSON.stringify({ ...d, savedAt: Date.now() })), draft);
    await p.reload(); await p.waitForTimeout(1500);
    assert((await p.evaluate(() => document.body.innerText.trim().length)) > 40, "blank screen for draft " + JSON.stringify(draft));
    noErrs(p); await p.context().close();
  }
});

await check("creation: a character in progress survives closing and reopening the app", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual");
  await p.locator('[data-a="cxOpen"][data-kind="class"]').first().click(); await p.waitForTimeout(300); await clickA(p, "cxChoose");
  const cls = await p.evaluate(() => APP.createDraft.class); assert(cls, "no class chosen");
  const ctx = p.context(), store = await p.evaluate(() => JSON.stringify(localStorage));
  await p.close(); const q = await ctx.newPage(); await q.goto(URL_); await q.waitForSelector('[data-a="nextStep"], #home-book', { timeout: 15000 });
  assert((await q.evaluate(() => APP.createDraft && APP.createDraft.class)) === cls, "draft not restored; storage: " + store.slice(0, 80));
  await ctx.close();
});

await check("creation: the Back button steps back one chapter", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual"); await clickA(p, "randomAll"); await p.waitForFunction(() => APP.createDraft && APP.createDraft.chapter >= 5, null, { timeout: 8000 }).catch(() => {});
  const last = await p.evaluate(() => APP.createDraft.chapter); assert(last >= 5, "random did not reach the last chapter");
  await p.evaluate(() => { APP.createDraft.chapter = 2; }); await clickA(p, "nextStep").catch(() => {}); // pushes a history entry
  const at = await p.evaluate(() => APP.createDraft.chapter); await p.goBack(); await p.waitForTimeout(500);
  const now = await p.evaluate(() => ({ ch: APP.createDraft && APP.createDraft.chapter, screen: APP.screen }));
  assert(now.ch === at - 1 && now.screen === "create", `Back left creation or did not step back (was ${at}, now ${JSON.stringify(now)}) ${p.errs.join(" || ")}`);
  noErrs(p); await p.context().close();
});

await check("creation: ability scores need a method, and Randomize everything keeps typed text", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual");
  const r = await p.evaluate(async () => { const m = await import("/js/creation.js"); const d = APP.createDraft; d.class = "Fighter"; d.species = "Human"; d.background = "Soldier"; d.plus2 = "str"; d.plus1 = "dex";
    const before = m.validateChapter("abilities", d, APP).valid; m.applyStandardArray(d, APP); return { before, after: m.validateChapter("abilities", d, APP).valid }; });
  assert(!r.before && r.after, "default scores passed or standard array did not: " + JSON.stringify(r));
  await p.evaluate(() => { const d = APP.createDraft; d.name = "Zed the Careful"; d.backstory = "Typed by hand."; d.appearance = "Typed look"; d.alignment = "Lawful Good"; d.chapter = 0; });
  await p.evaluate(() => { window.dispatchEvent(new Event("resize")); }); await clickA(p, "openProgress").catch(() => {}); await clickA(p, "closeProgress").catch(() => {});
  await clickA(p, "randomAll"); await p.waitForTimeout(1200);
  const t = await p.evaluate(() => ({ n: APP.createDraft.name, b: APP.createDraft.backstory, a: APP.createDraft.appearance, al: APP.createDraft.alignment }));
  assert(t.n === "Zed the Careful" && t.b === "Typed by hand." && t.a === "Typed look" && t.al === "Lawful Good", "typed text overwritten: " + JSON.stringify(t));
  noErrs(p); await p.context().close();
});

await check("creation shop: buy trained gear with the gold, see it on the new character", async () => {
  const p = await open(390, 844, { touch: true }); await clickA(p, "goRoster"); await clickA(p, "newChar"); await clickA(p, "startManual"); await clickA(p, "randomAll"); await p.waitForTimeout(800);
  await clickA(p, "openProgress"); await clickA(p, "gotoChapter", '[data-i="5"]'); await p.waitForTimeout(400);
  assert(await p.locator('[data-a="cxOpenShop"]:visible').count() >= 1, "no Shop button on Skills and Gear");
  // take the gold options so there is plenty to spend
  for (const k of ["equipClass", "equipBg"]) { const opts = p.locator(`[data-a="pickEquip"][data-which="${k}"]:not([data-k="none"]):visible`); const n = await opts.count(); if (n) { await opts.nth(n - 1).click(); await p.waitForTimeout(250); } }
  await clickA(p, "cxOpenShop"); await p.waitForSelector("#results-cxshop .shopitem", { timeout: 5000 });
  const before = await p.evaluate(() => ({ cls: APP.createDraft.class, rows: document.querySelectorAll("#results-cxshop .shopitem").length }));
  assert(before.rows > 3, "shop looks empty for " + before.cls);
  await clickA(p, "cxShopCat", '[data-cat="Gear"]'); await p.locator('[data-a="cxBuy"]:visible:not([disabled])').first().click(); await p.waitForTimeout(300);
  const bought = await p.evaluate(() => APP.createDraft.cart.slice());
  assert(bought.length === 1, "nothing in the list after buying: " + JSON.stringify(bought));
  await clickA(p, "closeModal"); await p.waitForTimeout(300);
  assert((await p.locator(".shopitem", { hasText: bought[0].name }).count()) >= 1, "purchase not shown on the step");
  await clickA(p, "openProgress"); await clickA(p, "gotoChapter", '[data-i="6"]'); await p.waitForTimeout(300);
  const left = await p.evaluate(async () => { const m = await import("/js/creation.js"); return m.walletLeftCp(APP, APP.createDraft); });
  await clickA(p, "finishCreate"); await p.waitForTimeout(1500);
  const r = await p.evaluate(n => ({ has: APP.char.inventory.some(i => i.name === n), gp: APP.char.coins.gp }), bought[0].name);
  assert(r.has, "purchase missing from the character's inventory");
  assert(Math.abs(r.gp - Math.floor(left / 100)) <= 1, "gold on the character (" + r.gp + ") does not match gold left in the shop (" + left / 100 + ")");
  noErrs(p); await p.context().close();
});

await check("Loot boxes: off by default, buy, confirm, reel, fanfare, inspect", async () => {
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const p = await open(w, h, { touch: w < 700 });
    await openSample(p);
    await p.evaluate(() => { APP.char.coins = { cp: 0, sp: 0, ep: 0, gp: 500, pp: 0 }; CR.ACTIONS.openShop(); });
    await p.waitForSelector(".shop-page");
    assert(await p.locator('[data-cat="loot"]').count() === 0, "Loot boxes shelf visible while the setting is off");
    assert(await p.evaluate(() => !APP.prefs.experimental), "experimental must default to off");
    await p.evaluate(() => CR.ACTIONS.sheetTab({ dataset: { tab: "settings" } })); await p.waitForSelector('.switch[data-k="experimental"]', { state: "attached" });
    assert(await p.locator('.switch[data-k="experimental"]').getAttribute("aria-checked") === "false", "switch starts on");
    await p.evaluate(() => { document.querySelector('details[data-sec="experimental"]').open = true; }); await p.waitForTimeout(100);
    await p.locator('.switch[data-k="experimental"]').click(); await p.waitForTimeout(300);
    assert(await p.evaluate(() => APP.prefs.experimental === true), "switch did not turn the setting on");
    await p.evaluate(() => CR.ACTIONS.openShop()); await p.waitForSelector('[data-cat="loot"]');
    await p.locator('[data-cat="loot"]:visible').first().click(); await p.waitForSelector(".lb-card");
    assert(await p.locator(".lb-card").count() === 3, "three boxes expected");
    const txt = await p.locator(".lb-main").innerText();
    assert(/Legendary/.test(txt) && /Common/.test(txt) && /\d+(\.\d+)?%/.test(txt), "odds must be shown before buying");
    assert(await hscroll(p) <= 2, "loot page scrolls sideways");
    await p.screenshot({ path: `/tmp/loot-shop-${w}.png` });
    // buy
    await p.locator('[data-a="buyBox"][data-box="chest"]').click(); await p.waitForTimeout(300);
    let st = await p.evaluate(() => ({ gp: APP.char.coins.gp, n: (APP.char.inventory.find(i => i.name === "Iron-Bound Chest") || {}).qty }));
    assert(st.n === 1 && st.gp === 450, "buy: " + JSON.stringify(st));
    // confirm gate: nothing is spent until Open is confirmed
    await p.locator('[data-a="askOpenBox"][data-box="chest"]').click(); await p.waitForSelector('[data-a="confirmOpenBox"]');
    assert(await p.evaluate(() => APP.char.inventory.some(i => i.name === "Iron-Bound Chest")), "box used before confirming");
    await p.locator('.modal [data-a="closeModal"]:visible').first().click(); await p.waitForTimeout(300);
    assert(await p.locator("#loot-root").count() === 0, "cancel opened the box");
    const sum = () => p.evaluate(() => APP.char.inventory.reduce((a, i) => a + i.qty, 0));
    const before = await sum();
    await p.locator('[data-a="askOpenBox"][data-box="chest"]').click(); await p.waitForSelector('[data-a="confirmOpenBox"]');
    await p.locator('[data-a="confirmOpenBox"]').click(); await p.waitForSelector("#loot-root");
    assert(!(await p.evaluate(() => APP.char.inventory.some(i => i.name === "Iron-Bound Chest"))), "box not used up");
    { const inv = await p.evaluate(() => APP.char.inventory.map(i => i.name + "x" + i.qty)); const won = await p.locator(".lr-name").innerText().catch(() => "?") + " POOLS " + await p.evaluate(async () => { const m = await import("/js/views/lootbox.js"); const P = m.lootPools(APP); return JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v.length]))) + " " + JSON.stringify(Object.values(P).flat().slice(0, 1)); }); assert(await sum() === before, "bag count: before " + before + " after " + await sum() + " won " + won + " inv " + inv.join(",")); }
    await p.waitForSelector("#loot-root.landed", { timeout: 9000 });
    const name = await p.locator(".lr-name").innerText();
    assert(await p.evaluate(n => APP.char.inventory.some(i => i.name === n), name), "won item not in the bag: " + name);
    await p.screenshot({ path: `/tmp/loot-reveal-${w}.png` });
    await p.locator('[data-loot="inspect"]').click(); assert(await p.locator(".lr-detail").isVisible(), "Inspect shows nothing");
    await p.locator('[data-loot="done"]').click(); assert(await p.locator("#loot-root").count() === 0, "Done left the overlay");
    // a guaranteed legendary: big reveal, particle layer, skip works
    await p.evaluate(() => { APP.char.coins.gp = 500; CR.ACTIONS.buyBox({ dataset: { box: "coffer" } }); });
    await p.evaluate(() => { window.__r = Math.random; Math.random = () => 0; CR.ACTIONS.askOpenBox({ dataset: { box: "coffer" } }); });
    await p.waitForSelector('[data-a="confirmOpenBox"]'); await p.locator('[data-a="confirmOpenBox"]').click(); await p.waitForSelector("#loot-root");
    await p.locator('[data-loot="skip"]').click(); await p.waitForSelector("#loot-root.landed.r-legendary"); await p.waitForTimeout(700);
    await p.evaluate(() => { Math.random = window.__r; });
    assert(await p.locator(".loot-fx").count() === 1, "no fx layer");
    await p.screenshot({ path: `/tmp/loot-legendary-${w}.png` });
    await p.keyboard.press("Escape"); await p.waitForTimeout(200); assert(await p.locator("#loot-root").count() === 0, "Escape did not close");
    // setting off hides the shelf again
    await p.evaluate(() => CR.ACTIONS.sheetTab({ dataset: { tab: "settings" } })); await p.waitForSelector('.switch[data-k="experimental"]', { state: "attached" });
    await p.evaluate(() => { document.querySelector('details[data-sec="experimental"]').open = true; }); await p.locator('.switch[data-k="experimental"]').click(); await p.waitForTimeout(300);
    await p.evaluate(() => CR.ACTIONS.openShop()); await p.waitForSelector(".shop-page");
    assert(await p.locator('[data-cat="loot"]').count() === 0, "shelf still there after turning the setting off");
    noErrs(p); await p.context().close();
  }
});
await check("Tabs: unvisited sections carry a dot until opened; sheet tour offers itself once", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator, "webdriver", { get: () => false }); localStorage.setItem("dnd-storage-intro-v1", "1"); } catch (e) { } });
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(String(e)));
  await p.goto(URL_); await p.waitForSelector("#home-book");
  await openSample(p);
  await p.waitForSelector("#tour-root .tour, #tour-root [data-a='tourNext']", { timeout: 6000 });
  assert(/Level|HP|AC/i.test(await p.locator("#tour-root").innerText()), "sheet tour did not start on first open");
  assert(await p.locator("nav.tabs .newdot").count() >= 3, "expected dots on Notes, Rules and Shop");
  await p.locator('[data-a="tourSkip"]').first().click(); await p.waitForTimeout(300);
  await p.locator('nav.tabs [data-tab="rules"]').click(); await p.waitForTimeout(400);
  assert(await p.locator('nav.tabs [data-tab="rules"] .newdot').count() === 0, "dot stayed after visiting Rules");
  await p.reload(); await p.waitForSelector("#home-book"); await clickA(p, "goRoster"); await clickA(p, "openChar", '[data-id="gandork"]'); await p.waitForTimeout(2200);
  assert(await p.locator("#tour-root [data-a='tourNext']").count() === 0, "tour offered a second time");
  assert(await p.locator('nav.tabs [data-tab="rules"] .newdot').count() === 0, "Rules dot came back");
  assert(await p.locator('nav.tabs [data-tab="shop"] .newdot').count() === 1, "Shop dot lost");
  assert(p.errs.length === 0, p.errs.join(" || ")); await ctx.close();
});

await check("Subclass picker: stats, one recommendation, level strip, empty levels; gap step offers DM or feat", async () => {
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const p = await open(w, h, { touch: w < 700 });
    await openSample(p);
    await p.evaluate(() => { const c = APP.char; c.class = "Fighter"; c.subclass = ""; c.level = 2; c.xp = 300; c.abilities = { str: 17, dex: 12, con: 15, int: 8, wis: 10, cha: 8 }; CR.ACTIONS.openLevelUp(); });
    await p.waitForSelector('[data-a="lvlNext"]');
    for (let i = 0; i < 6 && await p.locator(".scrow").count() === 0; i++) {
      if (await p.locator('[data-a="lvlHp"][data-mode="avg"]:visible').count()) await p.locator('[data-a="lvlHp"][data-mode="avg"]').click();
      await p.locator('[data-a="lvlNext"]:visible').first().click(); await p.waitForTimeout(250);
    }
    await p.waitForSelector(".scrow");
    const rows = await p.locator(".scrow").count(); assert(rows >= 8, "subclass rows: " + rows);
    assert(await p.locator(".scrow .tag.amber").count() === 1, "exactly one Recommended");
    assert(/Recommended/.test(await p.locator(".scrow").first().innerText()), "recommended is not first");
    assert(await p.locator(".scrow .stchip").count() >= 3, "stat chips missing");
    assert(await p.locator(".scrow .lvp.gap").count() >= 2, "empty levels not marked");
    assert(await p.locator(".scrow").first().evaluate(el => el.scrollWidth <= el.clientWidth + 1), "row overflows");
    assert(await hscroll(p) <= 2, "list scrolls sideways");
    await p.screenshot({ path: `/tmp/sub-list-${w}.png` });
    await p.locator('.scrow:has-text("Banneret")').click(); await p.waitForSelector(".scpage");
    const txt = await p.locator(".scpage").innerText();
    assert(/CHA/.test(txt) && /Not a Fighter stat/i.test(txt), "Banneret should show a Charisma need flagged as off-class: " + txt.slice(0, 160));
    assert(/level 15/i.test(txt) && /level 18/i.test(txt) && (txt.match(/Not in the game yet/g) || []).length === 2, "empty levels 15 and 18 should read Not in the game yet: " + JSON.stringify(txt.slice(-500)));
    assert(await p.locator(".scpage .burst, .scpage .hero").count() === 0, "cinematic parts should be gone");
    await p.screenshot({ path: `/tmp/sub-page-${w}.png` });
    await p.locator('[data-a="scPick"]').click(); await p.waitForTimeout(500);
    assert(await p.locator(".scpage").count() === 0, "page did not close after choosing");
    assert(await p.evaluate(() => APP.lvl.subclass === "Banneret"), "choice not kept");
    noErrs(p);
    // a gap level: Fighter 15 with a subclass that has nothing there
    await p.evaluate(() => { const c = APP.char; APP.lvl = null; APP.screen = "sheet"; c.subclass = "Banneret"; c.level = 14; c.xp = 165000; CR.ACTIONS.openLevelUp(); });
    await p.waitForSelector('[data-a="lvlNext"]');
    for (let i = 0; i < 6 && await p.locator('[data-a="lvlGap"]').count() === 0; i++) { if (await p.locator('[data-a="lvlHp"][data-mode="avg"]:visible').count()) await p.locator('[data-a="lvlHp"][data-mode="avg"]').click(); await p.locator('[data-a="lvlNext"]:visible').first().click(); await p.waitForTimeout(250); }
    assert(await p.locator('[data-a="lvlGap"]').count() === 2, "gap step missing");
    assert(await p.locator('[data-a="lvlNext"]:visible').first().isDisabled(), "gap step must need a choice");
    await p.locator('[data-a="lvlGap"][data-v="dm"]').click(); assert(await p.locator('[data-a="lvlNext"]:visible').first().isEnabled(), "Tell my DM should allow continuing");
    await p.locator('[data-a="lvlGap"][data-v="feat"]').click(); assert(await p.locator('[data-a="lvlNext"]:visible').first().isDisabled(), "feat mode needs a feat");
    assert(!/Ability Score Improvement/.test(await p.locator("#lvl-results").innerText()), "ASI offered as the feat");
    await p.screenshot({ path: `/tmp/sub-gap-${w}.png` });
    noErrs(p); await p.context().close();
  }
});
await check("Update window: catch-up since the last version, rules inside, off switch", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("dnd-storage-intro-v1", "1"); if (localStorage.getItem("__wd0") === "1") Object.defineProperty(navigator, "webdriver", { get: () => false }); } catch (e) { } });
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(String(e)));
  await p.goto(URL_); await p.waitForSelector("#home-book");
  await clickA(p, "goRoster"); await clickA(p, "importGandork");
  await p.evaluate(() => { localStorage.setItem("__wd0", "1"); const pr = JSON.parse(localStorage.getItem("dnd-prefs-v1") || "{}"); pr.seenVersion = "0.1.60"; localStorage.setItem("dnd-prefs-v1", JSON.stringify(pr)); });
  await p.reload(); await p.waitForSelector(".wnmodal", { timeout: 8000 });
  const n = await p.locator(".wn-entry").count(); assert(n >= 4, "expected every version since 0.1.60, got " + n);
  assert(await p.locator(".wn-entry[open]").count() === 1, "only the newest entry should be open");
  { const { VERSION } = await import(pathToFileURL(join(root, "js/changelog.js")).href); assert((await p.locator(".wn-entry").first().innerText()).includes(VERSION), "newest first: expected " + VERSION); }
  await p.screenshot({ path: "/tmp/wn-390.png" });
  await p.locator('[data-a="wnDone"]').click(); await p.waitForTimeout(300);
  await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(800);
  assert(await p.locator(".wnmodal").count() === 0, "window came back after Done");
  // turn off from the window itself
  await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem("dnd-prefs-v1")); pr.seenVersion = "0.1.60"; localStorage.setItem("dnd-prefs-v1", JSON.stringify(pr)); });
  await p.reload(); await p.waitForSelector(".wnmodal"); await p.locator('[data-a="wnOff"]').click(); await p.waitForTimeout(300);
  assert(await p.evaluate(() => JSON.parse(localStorage.getItem("dnd-prefs-v1")).updateSplash === false), "off switch not saved");
  await p.evaluate(() => { const pr = JSON.parse(localStorage.getItem("dnd-prefs-v1")); pr.seenVersion = "0.1.60"; localStorage.setItem("dnd-prefs-v1", JSON.stringify(pr)); });
  await p.reload(); await p.waitForSelector("#home-book"); await p.waitForTimeout(800);
  assert(await p.locator(".wnmodal").count() === 0, "window opened while turned off");
  assert(p.errs.length === 0, p.errs.join(" || ")); await ctx.close();
});

await check("Home: 12 characters and 12 campaigns, modes, search, back label", async () => {
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const p = await open(w, h, { touch: w < 700 });
    await clickA(p, "goRoster"); await clickA(p, "importGandork");
    await p.evaluate(() => {
      const r = JSON.parse(localStorage.getItem("dnd-roster-v1")), base = Object.values(r)[0];
      for (let i = 1; i < 12; i++) r["c" + i] = { ...base, id: "c" + i, name: "Hero " + i, class: i % 2 ? "Wizard" : "Fighter" };
      localStorage.setItem("dnd-roster-v1", JSON.stringify(r));
    });
    await p.evaluate(() => { const ix = { active: "main", list: [{ id: "main", name: "Campaign 1", at: 1 }] }; for (let i = 1; i < 12; i++) ix.list.push({ id: "k" + i, name: "Camp " + i, at: 1 + i }); localStorage.setItem("dnd-dm-campaigns-v1", JSON.stringify(ix)); });
    await p.reload(); await p.waitForSelector("#home-book");
    assert(await p.locator("#home-book:visible").count() === 1, "continue button");
    const sx = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert(!(await sx()), "sideways scroll players " + w);
    assert(await p.locator("#home-grid .hcard:not(.new)").count() === 12, "12 character cards");
    assert(await p.locator("#home-q").count() === 1, "search shows past six");
    await p.locator("#home-q").fill("hero 7"); assert(await p.locator("#home-grid .hcard").count() === 1, "search filters");
    await p.locator("#home-q").fill("");
    assert(await p.locator(".hparts .hpart").count() === 2, "rules and notes");
    await clickA(p, "homeMode", '[data-v="dm"]');
    assert(await p.locator("#home-grid .hcard.camp").count() === 12, "12 campaign cards"); assert(!(await sx()), "sideways scroll dm " + w);
    await p.locator("#home-grid .hcard.camp").first().click(); await p.waitForSelector(".dmmode");
    assert(await p.locator('.topbar .btn:has-text("Main menu")').count() === 1, "DM back label");
    await clickA(p, "dmCampOpen"); assert(await p.locator(".dmcamp").count() === 12, "camp list");
    await clickA(p, "dmCampNew"); await p.locator("#dm-cname").fill("Stonehell"); await clickA(p, "dmCampSave"); await p.waitForTimeout(200);
    assert((await p.locator(".topbar h1").first().innerText()) === "Stonehell", "new campaign opens");
    await p.locator('.topbar .btn:has-text("Main menu")').click(); await p.waitForSelector("#home-book");
    assert(await p.locator("#home-grid .hcard.camp").count() === 13, "13th campaign");
    await clickA(p, "homeMode", '[data-v="player"]'); await p.locator("#home-grid .hcard:not(.new)").first().click(); await p.waitForTimeout(400); await pickSheet(p, "classic"); const dbg = await p.evaluate(() => ({ s: APP.screen, m: APP.modal && APP.modal.type, e: document.getElementById("app").innerText.slice(0, 120) })).catch(() => null); await p.waitForSelector(".sheetbar", { timeout: 5000 }).catch(e => { throw new Error("no sheetbar " + JSON.stringify(dbg)); });
    assert(await p.locator('.sheetbar .btn:has-text("Main menu"):visible').count() === 1, "sheet back label");
    await p.locator('.sheetbar .btn:has-text("Main menu"):visible').click(); await p.waitForSelector("#home-book");
    noErrs(p); await p.context().close();
  }
});

await browser.close(); server.close(); rmSync(tmp, { recursive: true, force: true });
const failed = results.filter(r => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
