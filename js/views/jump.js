// Jump palette: one search for tabs, tools and everything on the character (like a quick switcher).
import { esc, ICONS } from "../ui.js";
import { TOOLS } from "./tools.js";
import { sheetHits } from "./classic.js";
import { CASTER_TYPE } from "../rules.js";

export function parseAttrs(str) {
  const data = {}; let a = "";
  for (const m of String(str || "").matchAll(/data-([\w-]+)="([^"]*)"/g)) {
    const v = m[2].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    if (m[1] === "a") a = v; else data[m[1].replace(/-(\w)/g, (x, ch) => ch.toUpperCase())] = v;
  }
  return { a, data };
}

// Every place a player can go, in the order shown when the box is empty.
function places(app, c) {
  const adv = app.prefs.sheetStyle === "advanced", caster = !!CASTER_TYPE[c.class] || (c.spellcasting.spells || []).length > 0;
  const sub = (id, label) => ({ g: "Go to", label, sub: "Character", stats: true, a: adv ? "charSub" : "classicSub", data: { sub: id } });
  const out = adv
    ? [sub("play", "Play"), caster ? sub("spells", "Spells") : null, sub("gear", "Gear"), sub("rolls", "Rolls"), sub("features", "Features"), sub("stats", "Stats")]
    : [sub("play", "Play"), sub("sheet", "Sheet"), sub("features", "Features"), caster ? sub("spells", "Spells") : null, sub("gear", "Gear")];
  [["notes", "Notes"], ["rules", "Rules"], ["shop", "Shop"], ["settings", "Settings"]].forEach(([t, l]) => out.push({ g: "Go to", label: l, sub: "Page", a: "sheetTab", data: { tab: t } }));
  return out.filter(Boolean);
}

export function jumpItems(app, qRaw) {
  const c = app.char, q = String(qRaw || "").trim().toLowerCase();
  const match = it => !q || it.label.toLowerCase().includes(q) || (it.kw || "").includes(q);
  const items = places(app, c).filter(match);
  TOOLS.forEach(([id, label]) => { const it = { g: "Tools", label, sub: "Tool", a: "hubGo", data: { id } }; if (match(it)) items.push(it); });
  if (q.length >= 2) {
    sheetHits(app, qRaw).slice(0, 12).forEach(([g, n, v, attrs]) => { const p = parseAttrs(attrs); items.push({ g: "On your character", label: n, sub: [g, v].filter(Boolean).join(" · "), a: p.a, data: p.data }); });
    items.push({ g: "Rules", label: `Search all rules for “${String(qRaw).trim()}”`, sub: "Glossary", a: "searchRules", data: {}, q: String(qRaw).trim() });
  }
  return items;
}

export function jumpResults(app) {
  const q = app.jumpQ || "", items = jumpItems(app, q);
  app._jumpItems = items;
  if (!(app.jumpSel >= 0 && app.jumpSel < items.length)) app.jumpSel = 0;
  let last = "";
  const html = items.map((it, i) => {
    const head = it.g !== last ? `<h3 class="jp-g">${esc(it.g)}</h3>` : ""; last = it.g;
    return `${head}<button class="jp-row ${i === app.jumpSel ? "on" : ""}" data-a="jumpGo" data-i="${i}"><span class="jp-n">${esc(it.label)}</span><span class="jp-s">${esc(it.sub)}</span></button>`;
  }).join("");
  return html || `<p class="muted" style="padding:16px 4px">Nothing matches.</p>`;
}

export function renderJump(app) {
  return `<div class="modal-back jump-back" data-a="closeModalBackdrop"><div class="modal jump" role="dialog" aria-label="Search">
    <div class="jp-box">${ICONS.search}<input id="jump-q" type="search" value="${esc(app.jumpQ || "")}" placeholder="Search tabs, tools, skills, features, items" autocomplete="off" enterkeyhint="go" aria-label="Search"></div>
    <div class="jp-list" id="results-jump" role="listbox">${jumpResults(app)}</div></div></div>`;
}
