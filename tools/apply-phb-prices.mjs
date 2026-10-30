#!/usr/bin/env node
// Sets 2024 Player's Handbook prices on the unlocked rules file, adds missing gear, and applies item renames.
//   CR_PASSWORD=... node tools/crypt.mjs unlock
//   node tools/apply-phb-prices.mjs
//   CR_PASSWORD=... node tools/crypt.mjs lock     (then commit only data/library.enc.json)
// Prices come from tools/phb-2024-prices.json. Magic items keep their campaign prices. ASCII only.
import { readFileSync, writeFileSync } from "node:fs";

const LIB = "data/library.json", P = JSON.parse(readFileSync("tools/phb-2024-prices.json", "utf8"));
const L = JSON.parse(readFileSync(LIB, "utf8"));
const norm = s => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const report = { priced: 0, unpriced: [], added: [], renamed: [], weapons: 0, armor: 0 };
const setPrice = (it, gp) => { it.price = gp; it.base = gp; it.priceTxt = String(gp); };
const dropPrice = it => { delete it.price; delete it.base; delete it.priceTxt; };

// Renames: items named after Elder Scrolls deities get neutral names. The rules text is untouched.
const RENAMES = {
  "Crown of Talos": "Crown of Might", "Candle of Arkay": "Candle of Last Stand", "Coin of Zenithar": "Gambler's Coin",
  "Feather Of Kynareth": "Stormbreath Feather", "Rose of Dibella": "Inspiring Rose", "Scale of Akatosh": "Scale of Swiftness",
  "Scroll of Julianos": "Scroll of Wizardry", "Stendarr's Grenade": "Radiant Grenade", "Tear of Mara": "Tear of Mercy"
};
for (const it of L.items) if (RENAMES[it.name]) { report.renamed.push(it.name + " -> " + RENAMES[it.name]); it.name = RENAMES[it.name]; }

// Missing gear (2024 PHB / SRD 5.2 names). Added only when no item with that name exists.
const NEW_ITEMS = ["Totem", "Wooden Staff", "Pack Saddle", "Riding Saddle", "Military Saddle"];
const flat = {};
for (const g of ["gear", "packs", "ammunition", "focus", "tools", "mounts"]) Object.assign(flat, P[g]);
for (const n of NEW_ITEMS) if (!L.items.some(i => norm(i.name) === norm(n))) { L.items.push({ name: n, type: "Mundane Item", slots: "1", source: "SRD 5.2", text: "", price: flat[n].gp, base: flat[n].gp, priceTxt: String(flat[n].gp) }); report.added.push(n); }

// Gear prices: the exact PHB name wins, then the SRD-sourced entry, then the first match. Other names for the same item lose their price so the shop lists it once.
for (const [name, v] of Object.entries(flat)) {
  const names = [name, ...(v.aliases || [])].map(norm);
  const hits = L.items.filter(i => names.includes(norm(i.name)));
  if (!hits.length) continue;
  const keep = hits.find(i => norm(i.name) === norm(name)) || hits.find(i => i.source === "SRD 5.2") || hits[0];
  setPrice(keep, v.gp); report.priced++;
  for (const h of hits) if (h !== keep && h.price != null) { report.unpriced.push(h.name + " (same as " + keep.name + ")"); dropPrice(h); }
}
// Weapons and armor: prices on the weapon records, and on any same-named item record.
for (const w of L.weapons) if (P.weapons[w.name] != null) { w.price = P.weapons[w.name]; report.weapons++; }
for (const [name, gp] of [...Object.entries(P.weapons), ...Object.entries(P.armor)]) for (const it of L.items) if (it.type === "Mundane Item" && norm(it.name) === norm(name) && it.price != null) setPrice(it, gp);
report.armor = Object.keys(P.armor).length;
// Item records that repeat a weapon under another name would show up twice in the shop; the weapon record is the one that is sold.
const WEAPON_DUPES = { "Hand Crossbow": "Crossbow, Hand", "Heavy Crossbow": "Crossbow, Heavy", "Light Crossbow": "Crossbow, Light", "Battle Axe": "Battleaxe" };
for (const it of L.items) if (it.type === "Mundane Item" && WEAPON_DUPES[it.name] && it.price != null) { report.unpriced.push(it.name + " (same as " + WEAPON_DUPES[it.name] + ")"); dropPrice(it); }
// The one priced magic consumable the PHB lists
const heal = L.items.find(i => i.name === "Potion of Healing"); if (heal) { setPrice(heal, 50); report.priced++; }

writeFileSync(LIB, JSON.stringify(L));
console.log(JSON.stringify(report, null, 1));
