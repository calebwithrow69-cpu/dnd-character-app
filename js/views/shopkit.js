// Shared shop look (sheet shop and creation shop): purse card, shelf tabs, aisle groups, priced item rows.
// Pure markup helpers; each shop supplies its own stock, prices and actions. ASCII only in this file.
import { esc, ICONS, kGroup, kRow } from "../ui.js";
import { ARMOR } from "../gear.js";
import { allWeapons } from "../data.js";
import { rowGroup } from "../creation.js";

export const SHELVES = [
  { k: "All", label: "All" },
  { k: "Weapons", label: "Weapons", icon: "sword", tone: "amber" },
  { k: "Armor", label: "Armor", icon: "shield", tone: "blue" },
  { k: "Tools", label: "Tools", icon: "settings", tone: "green" },
  { k: "Gear", label: "Gear", icon: "gear", tone: "faint" },
  { k: "Magic", label: "Magic", icon: "flask", tone: "feat" },
];
const TONE = Object.fromEntries(SHELVES.map(s => [s.k, s.tone || "faint"]));
const AISLE_ORDER = ["Simple Melee", "Simple Ranged", "Martial Melee", "Martial Ranged", "Light armor", "Medium armor", "Heavy armor", "Shield"];

function acText(name) {
  if (name === "Shield") return "+2 AC";
  const a = ARMOR[name]; if (!a) return "";
  return `AC ${a.base}${a.dexCap == null ? " + Dex" : a.dexCap ? ` + Dex (max ${a.dexCap})` : ""}${a.str ? ` · Str ${a.str}` : ""}${a.stealth ? " · Stealth disadvantage" : ""}`;
}

// Adds group (shelf), aisle (sub-shelf), icon, tone and the stat line to a stock row.
export function shopDecorator(L, C) {
  const W = new Map(allWeapons(L, C).map(w => [w.name, w]));
  return r => {
    const group = r.group || rowGroup(r);
    let aisle = group, icon = "gear", sub = r.sub || "";
    if (group === "Weapons") {
      const w = W.get(r.name) || {};
      aisle = [w.cat, w.kind].filter(Boolean).join(" ") || "Weapons";
      icon = /ranged/i.test(w.kind || "") ? "bow" : "sword";
    } else if (group === "Armor") {
      aisle = r.name === "Shield" ? "Shield" : `${ARMOR[r.name]?.cat || "Other"} armor`;
      icon = "shield"; sub = acText(r.name);
    } else {
      aisle = r.sub || group; sub = "";
      if (group === "Tools") icon = "settings";
      else if (group === "Magic") { const t = `${r.name} ${r.sub || ""}`; icon = /potion|elixir|philter|oil/i.test(t) ? "flask" : /\bring\b/i.test(t) ? "ring" : /scroll/i.test(t) ? "scroll" : "star"; }
    }
    return { ...r, group, aisle, icon, tone: TONE[group] || "faint", sub };
  };
}

export function shelfCounts(rows) {
  const n = { All: rows.length };
  for (const r of rows) n[r.group] = (n[r.group] || 0) + 1;
  return n;
}

export function purseCard({ label, big, id = "", tag = "", cells = [], bar = null }) {
  return `<div class="purse"><div class="purse-l"><span class="purse-k">${esc(label)}</span><b class="num purse-n"${id ? ` id="${id}"` : ""}>${esc(big)}</b>${tag}</div>
    <div class="purse-c">${cells.map(c => `<span class="${c.v ? "" : "z"}"><i>${esc(c.k)}</i><b>${esc(String(c.v))}</b></span>`).join("")}</div>
    ${bar != null ? `<div class="purse-bar" role="img" aria-label="Spent ${Math.round(bar)}%"><i style="width:${Math.max(0, Math.min(100, bar))}%"></i></div>` : ""}</div>`;
}

export function shelfTabs(action, counts, active, skip = []) {
  return `<div class="shelf" role="group" aria-label="Shelf">${SHELVES.filter(s => !skip.includes(s.k)).map(s =>
    `<button data-a="${action}" data-cat="${s.k}" aria-pressed="${active === s.k}">${s.icon ? ICONS[s.icon] : ""}<span>${esc(s.label)}</span><em>${counts[s.k] || 0}</em></button>`).join("")}</div>`;
}

export function shopRow(r, o) {
  const b = o.buy;
  const minus = o.minus ? `<button class="btn sm shop-minus" data-a="${o.minus.action}" data-name="${esc(r.name)}" aria-label="${esc(o.minus.label)}">${ICONS.minus}</button>` : "";
  const buy = `<button class="btn sm shop-buy ${b.ok ? "pri" : ""}" data-a="${b.action}" data-name="${esc(r.name)}" ${b.ok ? "" : "disabled"} aria-label="${esc(b.label)}">${ICONS.coin}<span>${esc(b.text)}</span></button>`;
  return kRow({ icon: ICONS[r.icon] || "", tone: r.tone, title: r.name, cap: o.cap || "", sub: r.sub || "", status: o.status ? esc(o.status) : "",
    mainAttrs: o.mainAttrs || "", actions: minus + buy, extra: o.detail || "", off: !b.ok && !o.listed, cls: `shopitem${o.listed ? " on" : ""}${o.open ? " open" : ""}` });
}

// Rows grouped like aisles: by shelf on All, by aisle inside one shelf, one flat list while searching.
export function shopList(rows, { cat = "All", q = "", row, limit = 300, empty = "Nothing matches." }) {
  if (!rows.length) return `<div class="shop-empty">${ICONS.search}<span>${esc(empty)}</span></div>`;
  const shown = rows.slice(0, limit);
  const capOf = r => r.aisle === r.group ? r.group : `${r.group} · ${r.aisle}`;
  let html = "";
  if (q) html = kGroup("Results", rows.length) + shown.map(r => row(r, capOf(r))).join("");
  else {
    const byShelf = cat === "All", by = new Map();
    for (const r of shown) { const k = byShelf ? r.group : r.aisle; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
    const order = byShelf ? SHELVES.map(s => s.k) : AISLE_ORDER;
    const keys = [...by.keys()].sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });
    for (const k of keys) { const g = by.get(k); html += kGroup(k, g.length, { tone: TONE[byShelf ? k : cat] || "faint", sticky: true }) + g.map(r => row(r, byShelf ? r.aisle === r.group ? "" : r.aisle : "")).join(""); }
  }
  return html + (rows.length > limit ? `<p class="sub2">Showing ${limit} of ${rows.length}. Search to narrow it down.</p>` : "");
}
