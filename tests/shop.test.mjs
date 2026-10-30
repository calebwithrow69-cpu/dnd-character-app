#!/usr/bin/env node
// Tests for the creation shop: who can buy what, the gold, and what lands on the character.
// Needs the unlocked rules: CR_PASSWORD=<pw> node tools/crypt.mjs unlock, run this, then delete data/library.json.
import { readFileSync } from "node:fs";
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
globalThis.window = globalThis; globalThis.localStorage = mem(); globalThis.sessionStorage = mem();
const C = await import("../js/creation.js");
let library, campaign;
try { library = JSON.parse(readFileSync(new URL("../data/library.json", import.meta.url), "utf8")); campaign = JSON.parse(readFileSync(new URL("../data/campaign.json", import.meta.url), "utf8")); }
catch (e) { console.error("Cannot load library.json - unlock it first."); process.exit(1); }
const app = { library, campaign };
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { failed++; console.log("  FAIL " + name + " - " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const draftFor = (cls, bg = "Soldier", sp = "Human") => { const d = C.blankDraft(); d.class = cls; d.background = bg; d.species = sp; return d; };
const names = (d, group) => C.creationStock(app, d).filter(r => !group || r.group === group).map(r => r.name);

test("Wizard: simple weapons only, no armor, no shield", () => {
  const d = draftFor("Wizard"); const w = names(d, "Weapons"), a = names(d, "Armor");
  assert(w.includes("Dagger") && w.includes("Quarterstaff"), "missing simple weapons: " + w.join(","));
  assert(!w.includes("Longsword") && !w.includes("Rapier"), "martial weapon listed");
  assert(a.length === 0, "armor listed: " + a.join(","));
});
test("Fighter: martial weapons, all armor and shields", () => {
  const d = draftFor("Fighter"); const w = names(d, "Weapons"), a = names(d, "Armor");
  assert(w.includes("Longsword") && w.includes("Dagger"), "weapons: " + w.length);
  for (const n of ["Chain Mail", "Plate Armor", "Leather Armor", "Shield"]) assert(a.includes(n), n + " missing");
});
test("Rogue: simple weapons plus martial weapons with Finesse or Light, light armor only", () => {
  const d = draftFor("Rogue", "Criminal"); const w = names(d, "Weapons"), a = names(d, "Armor");
  assert(w.includes("Rapier") && w.includes("Shortsword") && w.includes("Dagger"), "missing finesse/light martial");
  assert(!w.includes("Longsword") && !w.includes("Greatsword"), "heavy martial listed");
  assert(a.includes("Leather Armor") && !a.includes("Chain Shirt") && !a.includes("Shield"), "armor: " + a.join(","));
  assert(names(d, "Tools").includes("Thieves' Tools"), "Thieves' Tools missing");
});
test("Cleric: medium armor and shields but no heavy armor", () => {
  const a = names(draftFor("Cleric", "Acolyte"), "Armor");
  assert(a.includes("Chain Shirt") && a.includes("Shield") && !a.includes("Plate Armor") && !a.includes("Chain Mail"), a.join(","));
});
test("tools: only the ones the class or background trains", () => {
  const t = names(draftFor("Fighter", "Criminal"), "Tools");
  assert(t.includes("Thieves' Tools") && !t.includes("Smith's Tools"), t.join(","));
});
test("no magic items are for sale at creation", () => {
  const magic = C.creationStock(app, draftFor("Fighter")).filter(r => r.magic || /magic|potion/i.test(r.cat || ""));
  assert(magic.length === 0, magic.map(r => r.name).join(","));
});
test("adventuring gear is listed for everyone", () => {
  assert(names(draftFor("Wizard"), "Gear").includes("Rope") || names(draftFor("Wizard"), "Gear").length > 5, "no gear");
});
test("starting gold adds the class and background options", () => {
  const d = draftFor("Fighter"); d.equipClass = "C"; d.equipBg = "B";
  assert(C.startCp(app, d) === 20500, "expected 205 gp, got " + C.startCp(app, d) / 100);
  d.equipClass = "A"; d.equipBg = "A"; assert(C.startCp(app, d) === 1800, "expected 18 gp, got " + C.startCp(app, d) / 100);
});
test("buying is limited by gold, and removing refunds", () => {
  const d = draftFor("Fighter"); d.equipClass = "A"; d.equipBg = "A"; // 18 gp
  assert(!C.cartAdd(app, d, "Plate Armor"), "bought plate armor with 18 gp");
  assert(C.cartAdd(app, d, "Longsword") && C.walletLeftCp(app, d) === 1800 - 1500, "longsword price");
  assert(C.cartRemove(d, "Longsword") && C.walletLeftCp(app, d) === 1800 && d.cart.length === 0);
});
test("something the class is not trained in cannot be bought", () => {
  const d = draftFor("Wizard"); d.equipClass = "B"; d.equipBg = "B";
  assert(!C.cartAdd(app, d, "Plate Armor") && !C.cartAdd(app, d, "Longsword"), "bought untrained gear");
});
test("changing class or equipment trims the list", () => {
  const d = draftFor("Fighter"); d.equipClass = "C"; d.equipBg = "B"; assert(C.cartAdd(app, d, "Chain Mail") && C.cartAdd(app, d, "Longsword"));
  d.class = "Wizard"; let n = C.pruneCart(app, d); assert(n >= 2 && d.cart.length === 0, "untrained gear stayed: " + JSON.stringify(d.cart));
  const e = draftFor("Fighter"); e.equipClass = "C"; e.equipBg = "B"; for (let i = 0; i < 5; i++) C.cartAdd(app, e, "Longsword");
  e.equipClass = "A"; e.equipBg = "A"; n = C.pruneCart(app, e); assert(n > 0 && C.walletLeftCp(app, e) >= 0, "still over budget");
});
test("the character gets the purchases and pays for them", () => {
  const d = draftFor("Fighter"); d.name = "Buyer"; d.equipClass = "C"; d.equipBg = "B"; d.scoresSet = true;
  assert(C.cartAdd(app, d, "Chain Mail") && C.cartAdd(app, d, "Longsword") && C.cartAdd(app, d, "Longsword"));
  const spent = C.cartCp(app, d), ch = C.buildCharacter(d, app);
  const gold = ch.coins.gp + ch.coins.sp / 10 + ch.coins.cp / 100;
  assert(Math.abs(gold * 100 - (C.startCp(app, d) - spent)) < 1, "gold " + gold + " expected " + (C.startCp(app, d) - spent) / 100);
  const lsw = ch.inventory.find(i => i.name === "Longsword"); assert(lsw && lsw.qty === 2 && ch.inventory.some(i => i.name === "Chain Mail"), "items missing");
});
test("a shopping list that costs more than the gold blocks Skills and Gear", () => {
  const d = draftFor("Fighter"); d.equipClass = "A"; d.equipBg = "A"; d.cart = [{ name: "Plate Armor", qty: 1 }];
  assert(C.validateChapter("classOpts", d, app).reasons.includes("Your shopping list costs more than your gold."));
});
test("prices are the 2024 Player's Handbook prices", () => {
  const price = n => { const i = library.items.find(x => x.name === n); return i && i.price; };
  const want = { Backpack: 2, Rope: 1, Torch: 0.01, "Thieves' Tools": 25, "Calligrapher's Supplies": 10, Lute: 35, "Burglar's Pack": 16, "Dungeoneer's Pack": 12, Acid: 25, Arrows: 1, Quiver: 1, Spyglass: 1000, "Potion of Healing": 50, "Chain Mail": 75, Longsword: 15 };
  for (const [n, gp] of Object.entries(want)) assert(price(n) === gp, n + " is " + price(n) + ", expected " + gp);
  const cross = library.weapons.filter(w => /crossbow/i.test(w.name)).map(w => w.name + "=" + w.price).join(",");
  assert(cross === "Crossbow, Light=25,Crossbow, Hand=75,Crossbow, Heavy=50", cross);
});
test("every weapon has a price and the crossbows are sold", () => {
  assert(library.weapons.every(w => w.price > 0), "unpriced weapon: " + library.weapons.filter(w => !(w.price > 0)).map(w => w.name));
  const w = names(draftFor("Fighter"), "Weapons"); assert(w.includes("Crossbow, Light") && w.includes("Crossbow, Heavy") && w.includes("Longbow"), "crossbows or bows missing");
});
test("each item is for sale once (no second name for the same gear)", () => {
  const rows = C.creationStock(app, draftFor("Fighter")).map(r => r.name), dup = rows.filter((n, i) => rows.indexOf(n) !== i);
  assert(dup.length === 0, "listed twice: " + dup.join(","));
  for (const n of ["Acid Vial", "Signal Wistle", "Iron Spike", "Battle Axe", "Light Crossbow"]) assert(!rows.includes(n), n + " is still listed");
});
test("missing gear was added and is for sale", () => {
  const rows = C.creationStock(app, draftFor("Fighter")).map(r => r.name);
  for (const n of ["Totem", "Wooden Staff", "Pack Saddle", "Riding Saddle", "Military Saddle", "Acid", "Arrows", "Quiver", "Spellbook"]) assert(rows.includes(n), n + " not for sale");
});
test("no item is named after an Elder Scrolls deity", () => {
  const re = /Akatosh|Arkay|Dibella|Julianos|Kynareth|\bMara\b|Stendarr|Zenithar|Talos|Azura|Boethiah|Hircine|Mehrunes|Molag|Sheogorath|Vivec|Almalexia/;
  const bad = library.items.filter(i => re.test(i.name)).map(i => i.name); assert(bad.length === 0, bad.join(", "));
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
