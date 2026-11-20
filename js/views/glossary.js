// Rules glossary screen: search, category tabs, filters and a sortable list; the chosen entry opens
// beside the list on a laptop and as its own page on a phone. Entries can be saved (per device).
import { esc, ICONS, searchBox, formatText, conditionIcon } from "../ui.js";
import { enabledSpells, enabledFeats, allItems, allWeapons, findByName, subclassesAll } from "../data.js";
import { bookName } from "../rulesets.js";
import { CATS, TAG, DEFAULT_CAT, buildEntries, view, counts, loadMarks } from "../glossary.js";
import { detailFor } from "./sheet.js";

const MORE = 150;

export function glState(app) {
  return app.gl || (app.gl = { cat: DEFAULT_CAT, picked: false, sel: null, f: {}, sort: "", desc: false, limit: MORE });
}
// Until a tab is chosen: Rules, or everything once a search is typed.
export function effCat(app) { const g = glState(app); return g.picked ? g.cat : (String(app.rulesQuery || "").trim() ? "all" : DEFAULT_CAT); }

export function glEntries(app) {
  if (app._rulesIndex) return app._rulesIndex;
  const L = app.library, C = app.campaign || {};
  const book = e => (e && e.source ? bookName(e) : "");
  const list = buildEntries({
    classes: L.classes, subclasses: L.subclasses, species: L.species, backgrounds: L.backgrounds,
    feats: enabledFeats(L, C), spells: enabledSpells(L, C), items: allItems(L, C), weapons: allWeapons(L, C),
    rules: [...(L.rules || []), ...(C.homebrew?.rules || [])], glossary: L.glossary || [], terms: app.terms || []
  }, book);
  const label = e => e.cat === "rule" || e.cat === "condition" ? e.meta : [TAG[e.cat], e.meta].filter(Boolean).join(" · ");
  list.forEach(e => { e.lab = label(e); });
  return (app._rulesIndex = list);
}
const byId = (app, id) => glEntries(app).find(e => e.id === id) || null;
export const marksOf = app => app.marks || (app.marks = loadMarks());

function star(app, e, big) {
  const on = marksOf(app).includes(e.id);
  return `<button class="gl-star${big ? " big" : ""}" data-a="glMark" data-id="${esc(e.id)}" aria-pressed="${on}" aria-label="${on ? "Remove" : "Save"} ${esc(e.name)}">${ICONS.star}</button>`;
}

// ---------------- screen
export function rulesTab(app) {
  const g = glState(app);
  return `<div class="gl" id="gl" data-sel="${g.sel && byId(app, g.sel) ? 1 : 0}">
    <div class="gl-bar">
      ${searchBox("rules", app.rulesQuery, "Search rules, spells, items, feats")}
      <div class="gl-tabs" id="gl-tabs" role="tablist">${glTabs(app)}</div>
      <div class="gl-filters" id="gl-filters">${glFilters(app)}</div>
    </div>
    <div class="gl-body">
      <section class="gl-list" id="results-rules" aria-label="Results">${renderRulesResults(app)}</section>
      <aside class="gl-pane" id="gl-pane" aria-label="Entry">${glPane(app)}</aside>
    </div>
  </div>`;
}

export function glTabs(app) {
  const cat = effCat(app), n = counts(glEntries(app), marksOf(app), app.rulesQuery), q = String(app.rulesQuery || "").trim();
  return CATS.map(([id, label]) => `<button class="gl-tab${n[id] === 0 && q ? " none" : ""}" role="tab" data-a="glCat" data-cat="${id}" aria-selected="${cat === id}">${label}<i>${n[id]}</i></button>`).join("");
}

export function glFilters(app) {
  const g = glState(app), cat = effCat(app);
  const { filters } = view(glEntries(app), marksOf(app), { cat, q: "", f: {}, sort: "", desc: false });
  const active = Object.values(g.f).some(Boolean);
  if (!filters.length) return "";
  return filters.map(f => `<label class="gl-filter"><span>${esc(f.label)}</span><select data-a="glFilter" data-id="${f.id}" aria-label="${esc(f.label)}">
      <option value="">All</option>${f.opts.map(o => `<option value="${esc(o.v)}"${g.f[f.id] === o.v ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>`).join("")
    + (active ? `<button class="gl-clear" data-a="glClear">Clear</button>` : "");
}

const COL2 = { class: "Hit die · Primary", subclass: "Class", background: "Feat", feat: "Type", item: "Type", weapon: "Kind", feature: "Source", condition: "", rule: "Type", spell: "Level · School", species: "", all: "Type", marks: "Type" };

export function renderRulesResults(app) {
  const g = glState(app), cat = effCat(app), q = String(app.rulesQuery || "").trim();
  const { list, pool } = view(glEntries(app), marksOf(app), { cat, q, f: g.f, sort: g.sort, desc: g.desc });
  const label = CATS.find(c => c[0] === cat)[1];
  if (!list.length) {
    if (cat === "marks" && !q) return `<div class="gl-empty">${ICONS.star}<b>Nothing saved</b></div>`;
    return `<div class="gl-empty"><b>${q ? `Nothing in ${esc(label)} matches "${esc(q)}"` : "No entries"}</b>${cat !== "all" && q ? `<button class="btn sm" data-a="glCat" data-cat="all">Search everything</button>` : ""}</div>`;
  }
  const arrow = k => g.sort === k ? (g.desc ? " ▾" : " ▴") : "";
  const cols = `<div class="gl-cols"><div class="gl-hh"><button data-a="glSort" data-k="name" class="c1${g.sort === "name" ? " on" : ""}">Name${arrow("name")}</button>
      <button data-a="glSort" data-k="meta" class="c2${g.sort === "meta" ? " on" : ""}">${COL2[cat] || ""}${COL2[cat] ? arrow("meta") : ""}</button>
      <button data-a="glSort" data-k="src" class="c3${g.sort === "src" ? " on" : ""}">Book${arrow("src")}</button></div><span class="gl-sp"></span></div>`;
  const shown = list.slice(0, g.limit);
  let rows = "", last = "";
  const heads = !g.sort && !q && (cat === "spell" || cat === "feature" || list.length > 80);
  for (const e of shown) {
    if (heads) {
      const h = cat === "spell" ? (e.lv === 0 ? "Cantrips" : `Level ${e.lv}`) : cat === "feature" ? (e.classes[0] || "") : (cat === "marks" ? "" : e.name[0].toUpperCase());
      if (h && h !== last) { rows += `<div class="gl-letter">${esc(h)}</div>`; last = h; }
    }
    rows += `<div class="gl-row${g.sel === e.id ? " sel" : ""}"><button class="gl-open" data-a="glOpen" data-id="${esc(e.id)}"><span class="gl-name">${esc(e.name)}</span><span class="gl-meta">${esc(cat === "condition" ? "" : cat === "all" || cat === "marks" ? e.lab : e.meta)}</span><span class="gl-src">${esc(e.src)}</span></button>${star(app, e)}</div>`;
  }
  const more = list.length > shown.length ? `<button class="btn gl-more" data-a="glMore">Show ${Math.min(MORE, list.length - shown.length)} more</button>` : "";
  return `<div class="gl-count" aria-live="polite">${list.length === pool.length ? `${list.length} entries` : `${list.length} of ${pool.length}`}</div>${cols}${rows}${more}`;
}

// ---------------- detail
export function glPane(app) {
  const e = glState(app).sel && byId(app, glState(app).sel);
  if (!e) return `<div class="gl-none">${ICONS.book}<b>Nothing selected</b></div>`;
  const ruleish = e.cat === "rule" || e.cat === "condition";
  const sub = [ruleish ? "" : e.meta, e.src].filter(Boolean).join(" · ");
  return `<header class="gl-head">
      <button class="gl-back" data-a="glBack">${ICONS.back}Results</button>
      <div class="gl-ttl"><span class="gl-kind">${esc(ruleish ? e.group : TAG[e.cat] || "")}</span><h2>${e.kind === "condition" ? conditionIcon(e.name) : ""}${esc(e.name)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div>
      ${star(app, e, true)}
    </header>
    <div class="gl-text">${paneBody(app, e)}</div>`;
}

function link(e, label) { return `<button class="gl-link" data-a="glOpen" data-id="${esc(e.id)}">${esc(label || e.name)}</button>`; }
const idOf = (kind, name, from, lv) => `${kind}|${from || ""}|${name}${lv != null ? "#" + lv : ""}`;

function paneBody(app, e) {
  const L = app.library;
  if (e.kind === "rule" || e.kind === "condition") return formatText(e.text);
  if (e.kind === "class") return classBody(app, e.name);
  if (e.kind === "subclass") return subclassBody(app, e);
  if (e.kind === "classFeature" || e.kind === "subclassFeature") {
    const src = e.kind === "classFeature" ? findByName(L.classes, e.from) : findByName(L.subclasses, e.from);
    const f = (src?.features || []).find(x => x.name === e.name && x.lv === e.lv) || (src?.features || []).find(x => x.name === e.name);
    const parent = e.kind === "classFeature" ? byId(app, idOf("class", e.from)) : byId(app, idOf("subclass", e.from, src?.cls));
    return `<p class="sub2">${parent ? link(parent, e.from) : esc(e.from)} · level ${e.lv}</p>${formatText(f?.text)}`;
  }
  return detailFor(app, e.kind, e.name, null, e.from).body;
}

function featureBlocks(app, owner, features, kind) {
  const byLv = {};
  for (const f of features) (byLv[f.lv] || (byLv[f.lv] = [])).push(f);
  return Object.keys(byLv).map(Number).sort((a, b) => a - b).map(lv =>
    `<div class="gl-lv">Level ${lv}</div>` + byLv[lv].map(f => `<div class="gl-feat"><h4>${esc(f.name)}</h4>${formatText(f.text)}</div>`).join("")).join("");
}

function classBody(app, name) {
  const L = app.library, cls = findByName(L.classes, name);
  if (!cls) return `<p class="muted">Class not found.</p>`;
  const subs = subclassesAll(L, name).slice().sort((a, b) => a.name.localeCompare(b.name));
  const kv = [["Hit die", cls.hd ? `d${String(cls.hd).replace(/^d/i, "")}` : ""], ["Primary ability", cls.primary], ["Saving throws", Array.isArray(cls.saves) ? cls.saves.join(", ") : cls.saves], ["Armor", cls.armorProf], ["Weapons", cls.weaponProf]]
    .filter(r => r[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  return `${cls.desc ? `<div class="gl-desc">${formatText(cls.desc)}</div>` : ""}
    <dl class="kv">${kv}</dl>
    ${cls.table ? `<div class="gl-sec">Progression</div><div class="gloss-table-wrap">${classTable(cls.table)}</div>` : ""}
    <div class="gl-sec">Features</div>${featureBlocks(app, name, cls.features || [], "classFeature")}
    ${subs.length ? `<div class="gl-sec">Subclasses (${subs.length})</div><div class="gl-links">${subs.map(sc => { const e = byId(app, idOf("subclass", sc.name, name)); return e ? link(e) : ""; }).join("")}</div>` : ""}`;
}

function subclassBody(app, e) {
  const sc = (app.library.subclasses || []).find(s => s.name === e.name && s.cls === e.from);
  if (!sc) return `<p class="muted">Subclass not found.</p>`;
  const parent = byId(app, idOf("class", sc.cls));
  return `<p class="sub2">Subclass of ${parent ? link(parent, sc.cls) : esc(sc.cls)}</p>${featureBlocks(app, sc.name, sc.features || [], "subclassFeature")}`;
}

// The class table is plain text: header columns are separated by runs of spaces.
function classTable(tableStr) {
  const lines = String(tableStr || "").split("\n").filter(l => l.trim());
  if (!lines.length) return "";
  const header = lines[0], parts = header.split(/\s{2,}/), starts = []; let pos = 0;
  for (const p of parts) { const i = header.indexOf(p, pos); starts.push(i); pos = i + p.length; }
  let html = `<table class="gloss-table"><thead><tr>${parts.map(h => `<th>${esc(h.trim())}</th>`).join("")}</tr></thead><tbody>`;
  for (const line of lines.slice(1)) html += `<tr>${starts.map((s, c) => `<td>${esc((line.substring(s, c + 1 < starts.length ? starts[c + 1] : line.length) || "").trim())}</td>`).join("")}</tr>`;
  return html + `</tbody></table>`;
}
