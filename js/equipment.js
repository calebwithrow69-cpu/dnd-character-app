// Starting equipment packages ("Choose A or B: (A) …, 8 GP; or (B) 50 GP"),
// prices, and paying with coins. Pure functions.

// 2024 Player's Handbook prices in gold pieces (weapons and armor aren't priced in the rules file).
export const WEAPON_PRICES = {
  Club: 0.1, Dagger: 2, Greatclub: 0.2, Handaxe: 5, Javelin: 0.5, "Light Hammer": 2, Mace: 5, Quarterstaff: 0.2,
  Sickle: 1, Spear: 1, Dart: 0.05, "Light Crossbow": 25, Shortbow: 25, Sling: 0.1,
  Battleaxe: 10, Flail: 10, Glaive: 20, Greataxe: 30, Greatsword: 50, Halberd: 20, Lance: 10, Longsword: 15,
  Maul: 10, Morningstar: 15, Pike: 5, Rapier: 25, Scimitar: 25, Shortsword: 10, Trident: 5, Warhammer: 15,
  "War Pick": 5, Whip: 2, Blowgun: 10, "Hand Crossbow": 75, "Heavy Crossbow": 50, Longbow: 50, Musket: 500, Pistol: 250
};
export const ARMOR_PRICES = {
  "Padded Armor": 5, "Leather Armor": 10, "Studded Leather Armor": 45, "Hide Armor": 10, "Chain Shirt": 50,
  "Scale Mail": 50, "Breastplate": 400, "Half Plate Armor": 750, "Ring Mail": 30, "Chain Mail": 75,
  "Splint Armor": 200, "Plate Armor": 1500, "Shield": 10
};

const norm = s => String(s || "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

// -> [{ key: "A", items: [{ name, qty, note }], gp }]
export function parseEquipment(text) {
  let t = norm(text).replace(/^Equipment:\s*/i, "");
  if (!t) return [];
  t = t.replace(/^Choose [A-C](?:,? (?:or )?[A-C])*?(?::\s*(?=\()|\s+(?=[A-C]:))/i, "");
  const marks = [...t.matchAll(/(?:^|[\s;,]+(?:or\s+)?)(?:\(([A-C])\)|\b([A-C]):)\s*/g)];
  const out = [];
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : t.length;
    const body = t.slice(m.index + m[0].length, end).replace(/[;,]?\s*(?:or)?\s*$/i, "");
    out.push({ key: m[1] || m[2], ...parseItems(body) });
  });
  if (!out.length && t) out.push({ key: "A", ...parseItems(t) });
  return out;
}

function splitTop(s) { // split on commas that aren't inside parentheses
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && !depth) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

function parseItems(body) {
  const items = []; let gp = 0;
  for (let raw of splitTop(body)) {
    raw = raw.replace(/^and\s+/i, "");
    const tail = /^(.*\S)\s+(\d+\s*GP)$/i.exec(raw); // "Waterskin 26 GP" (missing comma)
    if (tail) { gp += +tail[2].replace(/\D/g, ""); raw = tail[1]; }
    const coin = /^(\d+)\s*(GP|SP|CP|EP|PP)$/i.exec(raw);
    if (coin) { gp += +coin[1] * ({ gp: 1, sp: 0.1, cp: 0.01, ep: 0.5, pp: 10 }[coin[2].toLowerCase()]); continue; }
    const m = /^(\d+)\s+(.+)$/.exec(raw);
    const qty = m ? +m[1] : 1;
    const name = m ? m[2] : raw;
    items.push({ name, qty });
  }
  return { items, gp: Math.round(gp * 100) / 100 };
}

// Find the library name for an equipment line: "8 Javelins" -> Javelin,
// "Druidic Focus (Quarterstaff)" -> Quarterstaff (noted as a focus).
export function resolveItem(line, weapons, items) {
  const all = new Map([...weapons, ...items].map(x => [x.name.toLowerCase(), x.name]));
  const tryName = n => all.get(n.toLowerCase());
  const n = norm(line.name);
  const singular = [n.replace(/ies$/, "y"), n.replace(/es$/, ""), n.replace(/s$/, "")];
  let name = tryName(n) || singular.map(tryName).find(Boolean);
  let note = "";
  const paren = /^(.+?)\s*\(([^)]+)\)$/.exec(n);
  if (!name && paren) {
    const inner = tryName(paren[2]);
    if (inner && weapons.some(w => w.name === inner)) { name = inner; note = paren[1]; }
    else { name = tryName(paren[1]); note = paren[2]; }
  }
  return { name: name || n, qty: line.qty, note: name ? note : "", known: !!name };
}

// ---- coins
const RATE = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
export const walletCp = c => Object.entries(RATE).reduce((t, [k, r]) => t + (Number(c?.[k]) || 0) * r, 0);
// Pay `costCp`, spending small coins first and making change; returns new coins or null if short.
export function pay(coins, costCp) {
  const have = walletCp(coins);
  if (costCp > have) return null;
  const left = { cp: +coins.cp || 0, sp: +coins.sp || 0, ep: +coins.ep || 0, gp: +coins.gp || 0, pp: +coins.pp || 0 };
  let due = Math.round(costCp);
  for (const k of ["cp", "sp", "ep", "gp", "pp"]) {
    const use = Math.min(left[k], Math.ceil(due / RATE[k]));
    left[k] -= use; due -= use * RATE[k];
    if (due <= 0) break;
  }
  // overpaid: give change in gp/sp/cp
  let change = -due;
  for (const k of ["gp", "sp", "cp"]) { const n = Math.floor(change / RATE[k]); left[k] += n; change -= n * RATE[k]; }
  return left;
}
export function fmtPrice(gp) {
  if (gp == null) return "";
  if (gp >= 1) return `${+gp.toFixed(2)} gp`;
  if (gp >= 0.1) return `${Math.round(gp * 10)} sp`;
  return `${Math.round(gp * 100)} cp`;
}

// Everything the shop can sell: priced library items, weapons, armor.
export function shopStock(L, C, weapons, items, armorNames) {
  const allow = C?.enabled?.items ? new Set(C.enabled.items) : null;
  const out = [];
  for (const w of weapons) if (WEAPON_PRICES[w.name] != null || w.price != null) out.push({ name: w.name, gp: w.price ?? WEAPON_PRICES[w.name], cat: "Weapons", sub: [w.dice, w.dtype, w.props].filter(Boolean).join(" · ") });
  for (const a of armorNames) if (ARMOR_PRICES[a] != null) out.push({ name: a, gp: ARMOR_PRICES[a], cat: "Armor", sub: "" });
  out.push({ name: "Shield", gp: ARMOR_PRICES.Shield, cat: "Armor", sub: "+2 AC" });
  for (const it of items) {
    if (it.price == null || !(it.price > 0)) continue;
    if (allow && !allow.has(it.name)) continue;
    if (out.some(x => x.name === it.name)) continue;
    const magic = /magic|potion/i.test(it.type || "");
    out.push({ name: it.name, gp: it.price, cat: magic ? "Magic & potions" : "Gear", sub: it.type || "", magic });
  }
  return out.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
}
