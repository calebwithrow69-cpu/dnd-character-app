// DM editor screen + its actions. ASCII-only.
import { esc, topbar, searchBox } from "../ui.js";
import { SCHEMA, KIND_ORDER, BLOCKS, PICK_FIELDS, extraKeys, template, keyOf, labelOf, validate, loadPatch, savePatch, patchCount } from "../dm.js";
import { listBooks, bookName } from "../rulesets.js";
import { subclassSpellTables } from "../subclassspells.js";
import { subclassGaps, SUBCLASS_LEVELS } from "../data.js";
import { validateEffect } from "../effects.js";

export const dmUiDefault = () => ({ kind: "species", q: "", edit: null, open: {}, bulk: false, bulkFilter: "none", gaps: false });

const csvOf = v => (Array.isArray(v) ? v.join(", ") : v || "");
function fieldHtml(f, v, attrs) {
  const a = attrs;
  if (f.t === "num") return `<input class="f" type="number" ${a} value="${esc(v ?? "")}">`;
  if (f.t === "area" || f.t === "code") return `<textarea class="f dm-ta ${f.t === "code" ? "mono" : ""}" rows="${f.rows || 4}" ${a} spellcheck="false">${esc(v ?? "")}</textarea>`;
  if (f.t === "csv") return `<input class="f" type="text" ${a} value="${esc(csvOf(v))}">`;
  if (f.t === "json") return `<textarea class="f dm-ta mono" rows="${f.rows || 3}" ${a} spellcheck="false" placeholder="${esc(f.hint || "")}">${esc(v == null || (Array.isArray(v) && !v.length) ? "" : JSON.stringify(v, null, 1))}</textarea>`;
  if (f.t === "bool") return `<label class="dm-chk"><input type="checkbox" ${a} ${v ? "checked" : ""}> Yes</label>`;
  if (f.t === "select") {
    const opts = f.opts || (f.from ? (f.libOpts || []) : []);
    const all = opts.includes(v) || !v ? opts : [v, ...opts];
    return `<select class="f" ${a}><option value="">Choose...</option>${all.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  }
  if (f.pickOpts) return `<div class="dm-combo"><input class="f" type="text" ${a} value="${esc(v ?? "")}" autocomplete="off">
    <select class="f dm-pick" data-dm-pick aria-label="Pick one that already exists"><option value="">Pick existing...</option>${f.pickOpts.map(o => `<option>${esc(o)}</option>`).join("")}</select></div>`;
  return `<input class="f" type="text" ${a} value="${esc(v ?? "")}">`;
}
const wrap = (f, inner) => `<div class="dm-f"><label class="small muted">${esc(f.label)}</label>${inner}${f.hint ? `<div class="small muted dm-hint">${esc(f.hint)}</div>` : ""}</div>`;

// values already in the rules for a field: books for "source", otherwise what other entries of this kind use
function pickOptions(app, kind, f) {
  const rule = PICK_FIELDS[f.k]; if (!rule) return null;
  if (rule === "*") return listBooks(app.library).filter(b => b.key !== "unlabelled").map(b => b.name);
  const src = rule === "feats" ? (app.library.feats || []).map(x => x.name) : (app.library[kind] || []).map(x => x[f.k]);
  return [...new Set(src.filter(x => typeof x === "string" && x.trim()))].sort((a, b) => a.localeCompare(b)).slice(0, 400);
}
const withPicks = (app, kind, f) => {
  const ff = f.from === "classes" ? { ...f, libOpts: (app.library.classes || []).map(c => c.name) } : f;
  const po = pickOptions(app, kind, f); return po && f.t === "text" ? { ...ff, pickOpts: po } : ff;
};
const summaryOf = (e, keys) => keys.map(k => e[k]).filter(v => v != null && v !== "" && !(Array.isArray(v) && !v.length)).map(v => Array.isArray(v) ? (typeof v[0] === "object" ? `${v.length} item${v.length === 1 ? "" : "s"}` : v.join(", ")) : String(v).replace(/\s+/g, " ")).join(" \u00b7 ").slice(0, 80);

function listField(app, kind, f, e) {
  const rows = e[f.k] || [];
  return `<div class="dm-f" data-dmlist="${f.k}">
    ${rows.map((r, i) => `<div class="panel dm-row" data-dmrow="${f.k}">
      <div class="small muted">${esc(f.k === "features" ? "Feature" : "Row")} ${i + 1}${r.lv ? " \u00b7 level " + esc(r.lv) : ""}${r.name ? " \u00b7 " + esc(r.name) : ""}</div>
      ${f.cols.map(c => wrap(c, fieldHtml(withPicks(app, kind, c), r[c.k], `data-dmc="${c.k}"`))).join("")}
      <button class="btn sm ghost" data-a="dmRowDel" data-k="${f.k}" data-i="${i}">Remove this ${esc(f.k === "features" ? "feature" : "row")}</button></div>`).join("")}
    <button class="btn sm" data-a="dmRowAdd" data-k="${f.k}">Add a feature</button></div>`;
}

// Subclass tools: levels the class expects but this subclass lacks, and what the app reads from its spell tables
function subclassTools(app, e) {
  const L = app.library, gaps = subclassGaps({ cls: e.cls, features: e.features || [] });
  const t = e.cls ? subclassSpellTables({ cls: e.cls, name: e.name, features: e.features || [] }, L) : { grants: [], choices: [] };
  const missing = [...t.grants.flatMap(g => g.missing), ...t.choices.flatMap(o => o.rows.flatMap(r => r.missing))];
  return `<div class="dm-f"><label class="small muted">Levels this class expects (${(SUBCLASS_LEVELS[e.cls] || []).join(", ") || "pick a class first"})</label>
      ${gaps.length ? `<p class="small">Missing: ${gaps.map(l => `<button class="btn sm" data-a="dmAddLevel" data-lv="${l}">Add level ${l}</button>`).join(" ")}</p>` : `<p class="small muted">Every expected level has a feature.</p>`}</div>
    <div class="dm-f"><label class="small muted">Spell list the app reads from this subclass</label>
      ${t.grants.length || t.choices.length ? `<ul class="small">${t.grants.map(g => `<li>Level ${g.lv}: ${esc(g.spells.join(", ") || "none found")}</li>`).join("")}${t.choices.map(o => `<li>Option ${esc(o.name)}: ${o.rows.map(r => `${r.lv}: ${esc(r.spells.join(", "))}`).join("; ")}</li>`).join("")}</ul>` : `<p class="small muted">No spell table found.</p>`}
      ${missing.length ? `<p class="small lrwarn">Not in your spell list yet: ${missing.map(esc).join(", ")}. Add them under Spells.</p>` : ""}
      <button class="btn sm" data-a="dmAddSpellTable">Add a spell table feature</button></div>`;
}

function formHtml(app, ed) {
  const sc = SCHEMA[ed.kind], e = ed.entry, byKey = Object.fromEntries(sc.fields.map(f => [f.k, f]));
  const open = ed.open || (ed.open = { [(BLOCKS[ed.kind][0] || [])[0]]: true });
  const fieldsOf = keys => keys.map(k => byKey[k]).filter(Boolean).map(f => f.t === "list" ? listField(app, ed.kind, f, e) : wrap(f, fieldHtml(withPicks(app, ed.kind, f), e[f.k], `data-dmf="${f.k}"`))).join("");
  const blocks = BLOCKS[ed.kind].map(([title, keys]) => {
    const on = !!open[title], extra = ed.kind === "subclasses" && title === "Features" ? subclassTools(app, e) : "";
    return `<section class="panel dm-block"><button type="button" class="dm-bh" data-a="dmBlock" data-b="${esc(title)}" aria-expanded="${on}"><span class="ttl">${esc(title)}</span><span class="sub2">${on ? "" : esc(summaryOf(e, keys))}</span><span aria-hidden="true">${on ? "\u2212" : "+"}</span></button>
      ${on ? `<div class="dm-bb">${fieldsOf(keys)}${extra}</div>` : ""}</section>`;
  }).join("");
  const xk = extraKeys(ed.kind, e), xon = !!open["Other data"];
  const xobj = Object.fromEntries(xk.map(k => [k, e[k]]));
  const other = `<section class="panel dm-block"><button type="button" class="dm-bh" data-a="dmBlock" data-b="Other data" aria-expanded="${xon}"><span class="ttl">Other data (counters, effects, fixes)</span><span class="sub2">${xon ? "" : esc(xk.join(", ") || "none")}</span><span aria-hidden="true">${xon ? "\u2212" : "+"}</span></button>
    ${xon ? `<div class="dm-bb"><p class="small muted">Everything else stored on this entry, as data. Remove a line to remove that data. Leave it as {} if there is none. Counters are <code>trackers</code>, sheet changes are <code>effects</code>.</p>
      <textarea class="f dm-ta mono" rows="8" data-dmx spellcheck="false">${esc(JSON.stringify(xobj, null, 1))}</textarea></div>` : ""}</section>`;
  return `<form id="dm-form" onsubmit="return false">${blocks}${other}</form>
    <div class="stack" style="margin-top:12px">
      <button class="btn pri block" data-a="dmSave">Save ${esc(sc.one)}</button>
      ${ed.kind === "spells" ? `<button class="btn block" data-a="dmSaveNext">Save and add another spell</button>` : ""}
      <button class="btn block" data-a="dmCancel">Cancel</button>
      ${ed.isNew ? "" : `<button class="btn ghost block" data-a="dmCopy">Save as a copy (use this as a template)</button>
      <button class="btn ghost block" data-a="dmDelete">${ed.added ? "Delete this entry" : "Remove from the game"}</button>
      ${ed.edited ? `<button class="btn ghost block" data-a="dmRevert">Undo my edits to this entry</button>` : ""}`}
    </div>`;
}

function bulkRows(app) {
  const ui = app.dm, kinds = KIND_ORDER.filter(k => SCHEMA[k].fields.some(f => f.k === "source"));
  const kind = kinds.includes(ui.bulkKind) ? ui.bulkKind : kinds[0], q = (ui.q || "").trim().toLowerCase();
  return { kinds, kind, all: (app.library[kind] || []).filter(x => (ui.bulkFilter === "all" || !x.source || bookName(x) === "Unlabelled") && (!q || labelOf(kind, x).toLowerCase().includes(q))) };
}
// Spells that subclass tables name but the rules do not have, with who asks for them
function missingSpells(app) {
  const by = new Map();
  (app.library.subclasses || []).forEach(sc => {
    const t = subclassSpellTables(sc, app.library);
    [...t.grants.flatMap(g => g.missing), ...t.choices.flatMap(o => o.rows.flatMap(r => r.missing))].forEach(n => {
      const k = n.toLowerCase(), cur = by.get(k) || { name: n, subs: [], classes: new Set() }; cur.subs.push(sc.name); cur.classes.add(sc.cls); by.set(k, cur);
    });
  });
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function missingHtml(app) {
  const list = missingSpells(app);
  return `${topbar("Missing spells", `${list.length} named in subclass spell lists`, { back: "dmMissingExit" })}
    <main class="wrap page"><p class="small muted">These spells appear in a subclass spell table but are not in your spell list, so characters do not get them yet. Tap Add to open a new spell with the name filled in.</p>
      <div class="panel">${list.map(x => `<div class="rowline"><span class="nm" style="flex-direction:column;align-items:flex-start;gap:0"><span>${esc(x.name)}</span><span class="sub2">${esc([...new Set(x.subs)].join(", "))}</span></span>
        <button class="btn sm pri" data-a="dmAddSpell" data-name="${esc(x.name)}" data-cls="${esc([...x.classes].join(","))}">Add</button></div>`).join("") || `<p class="muted small" style="padding:12px">Nothing missing. Every spell the tables name is in your list.</p>`}</div></main>`;
}

// Bulk fixing of the book (source) of many entries at once
function bulkHtml(app) {
  const ui = app.dm, { kinds, kind, all } = bulkRows(app);
  const books = listBooks(app.library).filter(b => b.key !== "unlabelled").map(b => b.name);
  const rows = all.slice(0, 80);
  const dl = `<datalist id="dm-books">${books.map(b => `<option value="${esc(b)}"></option>`).join("")}</datalist>`;
  return `${topbar("Fix books", "Set the book each entry comes from", { back: "dmBulkExit" })}
    <main class="wrap page">${dl}
      <div class="dm-f"><select class="f" data-a="dmBulkKind" aria-label="What to fix">${kinds.map(k => `<option value="${k}" ${k === kind ? "selected" : ""}>${esc(SCHEMA[k].label)}</option>`).join("")}</select></div>
      <div class="seg" role="group" aria-label="Show" style="margin:8px 0"><button data-a="dmBulkFilter" data-v="none" aria-pressed="${ui.bulkFilter !== "all"}">No book yet</button><button data-a="dmBulkFilter" data-v="all" aria-pressed="${ui.bulkFilter === "all"}">All</button></div>
      ${searchBox("dmq", ui.q, "Search")}
      <div class="panel" style="padding:10px;margin:8px 0"><label class="small muted" for="dm-bulk-all">Set every one shown below (${all.length}) to:</label>
        <input class="f" id="dm-bulk-all" list="dm-books" placeholder="Book name" autocomplete="off"><button class="btn pri block" style="margin-top:8px" data-a="dmBulkAll" data-kind="${kind}">Set all ${all.length}</button></div>
      <div class="panel">${rows.map(x => `<div class="rowline"><span class="nm" style="flex-direction:column;align-items:flex-start;gap:0"><span>${esc(labelOf(kind, x))}</span><span class="sub2">${esc(x.source || "no book")}</span></span>
        <input class="f dm-src" list="dm-books" data-dm-bulk data-kind="${kind}" data-key="${esc(keyOf(kind, x))}" value="${esc(x.source || "")}" placeholder="Book" aria-label="Book for ${esc(labelOf(kind, x))}" autocomplete="off"></div>`).join("") || `<p class="muted small" style="padding:12px">Nothing to fix here.</p>`}
        ${all.length > 80 ? `<p class="sub2" style="padding:8px">Showing 80 of ${all.length}. Search or set them in groups.</p>` : ""}</div>
    </main>`;
}

export function dmListHtml(app) {
  const ui = app.dm, p = loadPatch()[ui.kind] || {}, q = ui.q.trim().toLowerCase();
  const addK = new Set((p.add || []).map(x => keyOf(ui.kind, x))), edK = new Set(Object.values(p.edit || {}).map(x => keyOf(ui.kind, x)));
  let rows = (app.library[ui.kind] || []).filter(x => !q || labelOf(ui.kind, x).toLowerCase().includes(q));
  const total = rows.length; rows = rows.slice(0, 60);
  const removed = (p.remove || []);
  return `<div class="panel">${rows.map(x => { const k = keyOf(ui.kind, x); return `<button class="rosteritem" data-a="dmEdit" data-key="${esc(k)}">
      <div class="grow"><div class="ttl">${esc(labelOf(ui.kind, x))}</div><div class="sub">${addK.has(k) ? "Added by you" : edK.has(k) ? "Edited by you" : esc(x.source || x.type || "")}</div></div><span class="muted" aria-hidden="true">&rsaquo;</span></button>`; }).join("") || `<div class="small muted" style="padding:12px">Nothing matches.</div>`}</div>
    ${total > 60 ? `<div class="small muted" style="margin:6px 2px">Showing 60 of ${total}. Search to narrow it down.</div>` : ""}
    ${removed.length ? `<h3 style="margin-top:14px">Removed by you</h3><div class="panel">${removed.map(k => `<div class="rosteritem"><div class="grow"><div class="ttl">${esc(k.replace("|", " / "))}</div></div><button class="btn sm" data-a="dmRestore" data-key="${esc(k)}">Restore</button></div>`).join("")}</div>` : ""}`;
}

export function renderDm(app) {
  const ui = app.dm, sc = SCHEMA[ui.kind], n = patchCount(loadPatch());
  if (ui.bulk && !ui.edit) return bulkHtml(app);
  if (ui.missing && !ui.edit) return missingHtml(app);
  if (ui.edit) {
    return `${topbar((ui.edit.isNew ? "New " : "Edit ") + sc.one, sc.label, { back: "dmCancel" })}
      <main class="wrap page">${formHtml(app, ui.edit)}</main>`;
  }
  return `${topbar("DM editor", n ? `${n} change${n === 1 ? "" : "s"} on this device` : "Anyone can use this. Changes stay on this device.", { back: "dmExit" })}
    <main class="wrap page">
      <button class="btn block" data-a="rsOpen" style="margin-bottom:10px">Rulesets: choose which books and entries are allowed</button>
      <div class="dm-f"><select class="f" data-a="dmKind" aria-label="What to edit">${KIND_ORDER.map(k => `<option value="${k}" ${k === ui.kind ? "selected" : ""}>${esc(SCHEMA[k].label)} (${(app.library[k] || []).length})</option>`).join("")}</select></div>
      ${searchBox("dmq", ui.q, "Search " + sc.label.toLowerCase())}
      <button class="btn pri block" style="margin:10px 0" data-a="dmNew">New ${esc(sc.one)} from template</button>
      <button class="btn block" data-a="dmBulkOpen" style="margin-bottom:10px">Fix books in bulk</button>
      <button class="btn block" data-a="dmMissing" style="margin-bottom:10px">Spells the books name that are missing</button>
      <div id="dm-list">${dmListHtml(app)}</div>
      <h3 style="margin-top:18px">Share with your players</h3>
      <p class="small muted">Edits show up on this device right away. To send them to everyone, export the file, then ask Claude to apply it (or run <code>node tools/apply-dm.mjs</code>). It goes into the locked rules and the app updates itself on every device.</p>
      <div class="stack">
        <button class="btn block" data-a="dmExport" ${n ? "" : "disabled"}>Export my changes</button>
        <label class="btn block" style="text-align:center">Import a changes file<input type="file" accept="application/json,.json" data-dm-file hidden></label>
        ${n ? `<button class="btn ghost block" data-a="dmReset">Clear all my changes on this device</button>` : ""}
      </div>
    </main>`;
}

// ---- actions ----
// Reads the open blocks of the form back into the entry (blocks that are closed are left exactly as they were).
// Returns the entry; problems with data fields are put in e.__err so saving can refuse them.
function collect(kind, base, form) {
  const e = JSON.parse(JSON.stringify(base)); delete e.__err;
  const errs = [];
  const val = (f, el, label) => {
    if (!el) return undefined;
    if (f.t === "num") return Number(el.value) || 0;
    if (f.t === "csv") return el.value.split(",").map(s => s.trim()).filter(Boolean);
    if (f.t === "bool") return el.checked ? 1 : 0;
    if (f.t === "json") {
      const t = el.value.trim(); if (!t) return null;
      try { return JSON.parse(t); } catch (x) { errs.push(`${label || f.label} is not valid data (${x.message}).`); return undefined; }
    }
    return f.t === "text" || f.t === "select" ? el.value.trim() : el.value;
  };
  for (const f of SCHEMA[kind].fields) {
    if (f.t === "list") {
      if (!form.querySelector(`[data-dmlist="${f.k}"]`)) continue; // block is closed: keep the saved list
      e[f.k] = [...form.querySelectorAll(`[data-dmrow="${f.k}"]`)].map((r, i) => {
        const o = { ...((base[f.k] || [])[i] || {}) };
        f.cols.forEach(c => { const v = val(c, r.querySelector(`[data-dmc="${c.k}"]`), `${c.label} of feature ${i + 1}`); if (v === null) delete o[c.k]; else if (v !== undefined) o[c.k] = v; });
        return o;
      });
    } else { const v = val(f, form.querySelector(`[data-dmf="${f.k}"]`)); if (v !== undefined) e[f.k] = v; }
  }
  const x = form.querySelector("[data-dmx]");
  if (x) {
    try {
      const o = JSON.parse(x.value.trim() || "{}");
      if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("it must be an object");
      extraKeys(kind, base).forEach(k => { delete e[k]; });
      Object.entries(o).forEach(([k, v]) => { e[k] = v; });
    } catch (err) { errs.push(`Other data is not valid (${err.message}).`); }
  }
  if (errs.length) e.__err = errs[0];
  return e;
}

// Problems in counters and effects the editor can check before saving
function dataProblems(e) {
  const bad = [];
  const check = (where, o) => {
    (o.effects == null ? [] : Array.isArray(o.effects) ? o.effects : [null]).forEach((fx, i) => { const p = fx ? validateEffect(fx) : ["effects must be a list"]; if (p.length) bad.push(`${where}: effect ${i + 1}: ${p[0]}`); });
    (o.trackers == null ? [] : Array.isArray(o.trackers) ? o.trackers : [null]).forEach((t, i) => { if (!t || typeof t.name !== "string" || !t.name) bad.push(`${where}: counter ${i + 1} needs a name`); else if (!["long", "short"].includes(t.reset || "long")) bad.push(`${where}: counter "${t.name}" must reset on "long" or "short"`); });
  };
  check(e.name || "this entry", e); (e.features || []).forEach(f => check(f.name || "a feature", f));
  return bad[0] || "";
}

export function dmActions(APP, h) {
  const patch = () => loadPatch();
  const pk = (p, kind) => (p[kind] = p[kind] || { add: [], edit: {}, remove: [] });
  const commit = p => { if (!savePatch(p)) h.toast("This browser would not save the change"); h.setRules(); h.render(); };
  const sync = () => { const f = document.getElementById("dm-form"); if (f && APP.dm.edit) APP.dm.edit.entry = collect(APP.dm.edit.kind, APP.dm.edit.entry, f); };
  const put = (p, kind, key, entry) => { const P = pk(p, kind); if (P.add.some(x => keyOf(kind, x) === key)) P.add = P.add.map(x => keyOf(kind, x) === key ? entry : x); else P.edit[origKey(p, kind, key)] = entry; };
  const origKey = (p, kind, key) => { const e = Object.entries(pk(p, kind).edit).find(([, v]) => keyOf(kind, v) === key); return e ? e[0] : key; };
  const ACT = {
    dmOpen() { APP.dm = dmUiDefault(); APP.screen = "dm"; h.render(); window.scrollTo(0, 0); },
    dmExit() { APP.screen = "roster"; APP.dm = null; h.render(); window.scrollTo(0, 0); },
    dmKind(el) { APP.dm.kind = el.value; APP.dm.q = ""; h.render(); },
    dmNew() { APP.dm.edit = { kind: APP.dm.kind, key: null, entry: template(APP.dm.kind), isNew: true }; h.render(); window.scrollTo(0, 0); },
    dmEdit(el) {
      const kind = APP.dm.kind, key = el.dataset.key, p = patch(), cur = (APP.library[kind] || []).find(x => keyOf(kind, x) === key);
      if (!cur) return;
      const added = (pk(p, kind).add || []).some(x => keyOf(kind, x) === key), edited = Object.values(pk(p, kind).edit).some(x => keyOf(kind, x) === key);
      APP.dm.edit = { kind, key, entry: JSON.parse(JSON.stringify(cur)), added, edited }; h.render(); window.scrollTo(0, 0);
    },
    dmCancel() { APP.dm.edit = null; h.render(); window.scrollTo(0, 0); },
    dmBlock(el) { sync(); const o = APP.dm.edit.open || (APP.dm.edit.open = {}); o[el.dataset.b] = !o[el.dataset.b]; h.render(); },
    dmAddLevel(el) { sync(); const e = APP.dm.edit.entry; e.features = [...(e.features || []), { lv: +el.dataset.lv, name: "", src: e.source || "Homebrew", text: "" }]; (APP.dm.edit.open = APP.dm.edit.open || {}).Features = true; h.render(); },
    dmAddSpellTable() {
      sync(); const e = APP.dm.edit.entry, half = ["Paladin", "Ranger"].includes(e.cls), lv = half ? [3, 5, 9, 13, 17] : [3, 5, 7, 9];
      e.features = [...(e.features || []), { lv: 3, name: `${e.name || "Subclass"} Spells`, src: e.source || "Homebrew",
        text: `When you reach a ${e.cls || "class"} level specified in the ${e.name || "Subclass"} Spells table, you thereafter always have the listed spells prepared.\n\n${e.name || "Subclass"} Spells\n${e.cls || "Class"} Level\tSpells\n${lv.map(l => l + "\t").join("\n")}` }];
      (APP.dm.edit.open = APP.dm.edit.open || {}).Features = true; h.render();
    },
    dmSaveNext() { ACT.save(false, true); },
    dmMissing() { APP.dm.missing = true; h.render(); window.scrollTo(0, 0); },
    dmMissingExit() { APP.dm.missing = false; h.render(); window.scrollTo(0, 0); },
    dmAddSpell(el) {
      const cls = (el.dataset.cls || "").split(",").filter(Boolean);
      APP.dm.missing = false; APP.dm.kind = "spells";
      APP.dm.edit = { kind: "spells", key: null, entry: { ...template("spells"), name: el.dataset.name, classes: cls }, isNew: true, open: { Basics: true, "Rules text": true } }; h.render(); window.scrollTo(0, 0);
    },
    dmBulkOpen() { APP.dm.bulk = true; APP.dm.q = ""; h.render(); window.scrollTo(0, 0); },
    dmBulkExit() { APP.dm.bulk = false; APP.dm.q = ""; h.render(); window.scrollTo(0, 0); },
    dmBulkKind(el) { APP.dm.bulkKind = el.value; h.render(); },
    dmBulkFilter(el) { APP.dm.bulkFilter = el.dataset.v; h.render(); },
    dmBulkSet(kind, key, value) { const p = patch(); const cur = (APP.library[kind] || []).find(x => keyOf(kind, x) === key); if (!cur) return; put(p, kind, key, { ...cur, source: String(value).trim() }); if (!savePatch(p)) h.toast("This browser would not save the change"); h.setRules(); },
    dmBulkAll(el) {
      const v = (document.getElementById("dm-bulk-all") || {}).value || ""; if (!v.trim()) { h.toast("Type or pick a book first"); return; }
      const { kind, all } = bulkRows(APP), p = patch(); all.forEach(x => put(p, kind, keyOf(kind, x), { ...x, source: v.trim() }));
      commit(p); h.toast(`Set ${all.length} to ${v.trim()}`);
    },
    dmRowAdd(el) { sync(); const e = APP.dm.edit.entry, k = el.dataset.k; e[k] = [...(e[k] || []), { lv: 1, name: "", src: "Homebrew", text: "" }]; h.render(); },
    dmRowDel(el) { sync(); APP.dm.edit.entry[el.dataset.k].splice(+el.dataset.i, 1); h.render(); },
    dmSave() { ACT.save(false); },
    dmCopy() { ACT.save(true); },
    save(asCopy, next) {
      sync(); const ed = APP.dm.edit, kind = ed.kind, p = patch(), P = pk(p, kind);
      let e = ed.entry; if (e.__err) { h.toast(e.__err); return; }
      const dp = dataProblems(e); if (dp) { h.toast(dp); return; }
      if (asCopy) e = { ...e, name: e.name + " (copy)" };
      const asNew = ed.isNew || asCopy, oldKey = asNew ? null : origKey(p, kind, ed.key);
      const err = validate(kind, e, APP.rawLibrary, p, asNew ? null : ed.key);
      if (err) { h.toast(err); return; }
      if (asNew) P.add.push(e);
      else put(p, kind, ed.key, e);
      APP.dm.edit = next ? { kind, key: null, isNew: true, open: { Basics: true, "Rules text": true }, entry: { ...template(kind), source: e.source, level: e.level, school: e.school, classes: e.classes || [], time: e.time, range: e.range, dur: e.dur } } : null;
      commit(p); h.toast(`Saved ${e.name}`); if (next) window.scrollTo(0, 0);
    },
    dmDelete() {
      const ed = APP.dm.edit, kind = ed.kind, p = patch(), P = pk(p, kind);
      if (!window.confirm(ed.added ? "Delete this entry?" : "Remove this from the game for everyone once you share the changes?")) return;
      if (ed.added) P.add = P.add.filter(x => keyOf(kind, x) !== ed.key);
      else { const ok = origKey(p, kind, ed.key); delete P.edit[ok]; if (!P.remove.includes(ok)) P.remove.push(ok); }
      APP.dm.edit = null; commit(p);
    },
    dmRevert() { const ed = APP.dm.edit, p = patch(); delete pk(p, ed.kind).edit[origKey(p, ed.kind, ed.key)]; APP.dm.edit = null; commit(p); h.toast("Back to the original"); },
    dmRestore(el) { const p = patch(), P = pk(p, APP.dm.kind); P.remove = P.remove.filter(k => k !== el.dataset.key); commit(p); },
    dmReset() { if (window.confirm("Clear every DM change on this device? Anything you have not exported is lost.")) { commit({}); h.toast("Cleared"); } },
    dmExport() {
      const blob = new Blob([JSON.stringify(patch(), null, 1)], { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "character-runner-dm-changes.json"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000); h.toast("Changes file saved");
    },
    async dmImportFile(file) {
      try {
        const inc = JSON.parse(await file.text()), p = patch();
        for (const kind of Object.keys(inc)) {
          if (!SCHEMA[kind]) continue;
          const P = pk(p, kind), I = inc[kind];
          (I.add || []).forEach(a => { if (!P.add.some(x => keyOf(kind, x) === keyOf(kind, a))) P.add.push(a); });
          Object.assign(P.edit, I.edit || {});
          (I.remove || []).forEach(r => { if (!P.remove.includes(r)) P.remove.push(r); });
        }
        commit(p); h.toast("Changes imported");
      } catch (e) { h.toast("That file is not a changes file"); }
    }
  };
  return ACT;
}
