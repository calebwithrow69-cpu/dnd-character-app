// DM editor screen + its actions. ASCII-only.
import { esc, topbar, searchBox } from "../ui.js";
import { SCHEMA, KIND_ORDER, template, keyOf, labelOf, validate, loadPatch, savePatch, patchCount, checkPin } from "../dm.js";

export const dmUiDefault = () => ({ kind: "species", q: "", edit: null });

const csvOf = v => (Array.isArray(v) ? v.join(", ") : v || "");
function fieldHtml(f, v, attrs) {
  const a = attrs;
  if (f.t === "num") return `<input class="f" type="number" ${a} value="${esc(v ?? "")}">`;
  if (f.t === "area" || f.t === "code") return `<textarea class="f dm-ta ${f.t === "code" ? "mono" : ""}" rows="${f.rows || 4}" ${a} spellcheck="false">${esc(v ?? "")}</textarea>`;
  if (f.t === "csv") return `<input class="f" type="text" ${a} value="${esc(csvOf(v))}">`;
  if (f.t === "bool") return `<label class="dm-chk"><input type="checkbox" ${a} ${v ? "checked" : ""}> Yes</label>`;
  if (f.t === "select") {
    const opts = f.opts || (f.from ? (f.libOpts || []) : []);
    const all = opts.includes(v) || !v ? opts : [v, ...opts];
    return `<select class="f" ${a}><option value="">Choose...</option>${all.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  }
  return `<input class="f" type="text" ${a} value="${esc(v ?? "")}">`;
}
const wrap = (f, inner) => `<div class="dm-f"><label class="small muted">${esc(f.label)}</label>${inner}${f.hint ? `<div class="small muted dm-hint">${esc(f.hint)}</div>` : ""}</div>`;

function formHtml(app, ed) {
  const sc = SCHEMA[ed.kind], e = ed.entry;
  const body = sc.fields.map(f => {
    if (f.t === "list") {
      const rows = e[f.k] || [];
      return `<div class="dm-f"><label class="small muted">${esc(f.label)}</label>
        ${rows.map((r, i) => `<div class="panel dm-row" data-dmrow="${f.k}">
          ${f.cols.map(c => wrap(c, fieldHtml(c, r[c.k], `data-dmc="${c.k}"`))).join("")}
          <button class="btn sm ghost" data-a="dmRowDel" data-k="${f.k}" data-i="${i}">Remove this ${esc(f.k === "features" ? "feature" : "row")}</button></div>`).join("")}
        <button class="btn sm" data-a="dmRowAdd" data-k="${f.k}">Add a feature</button></div>`;
    }
    const ff = f.from === "classes" ? { ...f, libOpts: (app.library.classes || []).map(c => c.name) } : f;
    return wrap(f, fieldHtml(ff, e[f.k], `data-dmf="${f.k}"`));
  }).join("");
  return `<form id="dm-form" onsubmit="return false">${body}</form>
    <div class="stack" style="margin-top:12px">
      <button class="btn pri block" data-a="dmSave">Save ${esc(sc.one)}</button>
      <button class="btn block" data-a="dmCancel">Cancel</button>
      ${ed.isNew ? "" : `<button class="btn ghost block" data-a="dmCopy">Save as a copy (use this as a template)</button>
      <button class="btn ghost block" data-a="dmDelete">${ed.added ? "Delete this entry" : "Remove from the game"}</button>
      ${ed.edited ? `<button class="btn ghost block" data-a="dmRevert">Undo my edits to this entry</button>` : ""}`}
    </div>`;
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
  if (ui.edit) {
    return `${topbar((ui.edit.isNew ? "New " : "Edit ") + sc.one, sc.label, { back: "dmCancel" })}
      <main class="wrap page">${formHtml(app, ui.edit)}</main>`;
  }
  return `${topbar("DM editor", n ? `${n} change${n === 1 ? "" : "s"} on this device` : "No changes yet", { back: "dmExit" })}
    <main class="wrap page">
      <div class="dm-f"><select class="f" data-a="dmKind" aria-label="What to edit">${KIND_ORDER.map(k => `<option value="${k}" ${k === ui.kind ? "selected" : ""}>${esc(SCHEMA[k].label)} (${(app.library[k] || []).length})</option>`).join("")}</select></div>
      ${searchBox("dmq", ui.q, "Search " + sc.label.toLowerCase())}
      <button class="btn pri block" style="margin:10px 0" data-a="dmNew">New ${esc(sc.one)} from template</button>
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

export function dmPinPanel(app) {
  if (!app.dmAsk) return "";
  return `<div class="panel" style="padding:12px;margin-top:10px"><label class="small muted" for="f-dmpin">DM PIN</label>
    <input class="f" id="f-dmpin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN">
    ${app.dmErr ? `<div class="small" style="color:var(--bad,#c66);margin-top:6px">${esc(app.dmErr)}</div>` : ""}
    <button class="btn pri block" style="margin-top:8px" data-a="dmPinGo">Open the DM editor</button></div>`;
}

// ---- actions ----
function collect(kind, base, form) {
  const e = JSON.parse(JSON.stringify(base));
  const val = (f, el) => !el ? undefined : f.t === "num" ? (Number(el.value) || 0) : f.t === "csv" ? el.value.split(",").map(s => s.trim()).filter(Boolean) : f.t === "bool" ? (el.checked ? 1 : 0) : f.t === "text" || f.t === "select" ? el.value.trim() : el.value;
  for (const f of SCHEMA[kind].fields) {
    if (f.t === "list") {
      e[f.k] = [...form.querySelectorAll(`[data-dmrow="${f.k}"]`)].map((r, i) => {
        const o = { ...((base[f.k] || [])[i] || {}) };
        f.cols.forEach(c => { o[c.k] = val(c, r.querySelector(`[data-dmc="${c.k}"]`)); });
        return o;
      });
    } else { const v = val(f, form.querySelector(`[data-dmf="${f.k}"]`)); if (v !== undefined) e[f.k] = v; }
  }
  return e;
}

export function dmActions(APP, h) {
  const patch = () => loadPatch();
  const pk = (p, kind) => (p[kind] = p[kind] || { add: [], edit: {}, remove: [] });
  const commit = p => { if (!savePatch(p)) h.toast("This browser would not save the change"); h.setRules(); h.render(); };
  const sync = () => { const f = document.getElementById("dm-form"); if (f && APP.dm.edit) APP.dm.edit.entry = collect(APP.dm.edit.kind, APP.dm.edit.entry, f); };
  const origKey = (p, kind, key) => { const e = Object.entries(pk(p, kind).edit).find(([, v]) => keyOf(kind, v) === key); return e ? e[0] : key; };
  const ACT = {
    async dmPinGo() {
      const el = document.getElementById("f-dmpin"), ok = el && await checkPin(el.value);
      if (!ok) { APP.dmErr = "That PIN is not right."; h.render(); return; }
      APP.dmAsk = false; APP.dmErr = ""; APP.dm = dmUiDefault(); APP.screen = "dm"; h.render(); window.scrollTo(0, 0);
    },
    dmAsk() { APP.dmAsk = !APP.dmAsk; APP.dmErr = ""; h.render(); setTimeout(() => document.getElementById("f-dmpin")?.focus(), 30); },
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
    dmRowAdd(el) { sync(); const e = APP.dm.edit.entry, k = el.dataset.k; e[k] = [...(e[k] || []), { lv: 1, name: "", src: "Homebrew", text: "" }]; h.render(); },
    dmRowDel(el) { sync(); APP.dm.edit.entry[el.dataset.k].splice(+el.dataset.i, 1); h.render(); },
    dmSave() { ACT.save(false); },
    dmCopy() { ACT.save(true); },
    save(asCopy) {
      sync(); const ed = APP.dm.edit, kind = ed.kind, p = patch(), P = pk(p, kind);
      let e = ed.entry; if (asCopy) e = { ...e, name: e.name + " (copy)" };
      const asNew = ed.isNew || asCopy, oldKey = asNew ? null : origKey(p, kind, ed.key);
      const err = validate(kind, e, APP.rawLibrary, p, asNew ? null : ed.key);
      if (err) { h.toast(err); return; }
      const nk = keyOf(kind, e);
      if (asNew) P.add.push(e);
      else if (P.add.some(x => keyOf(kind, x) === ed.key)) P.add = P.add.map(x => keyOf(kind, x) === ed.key ? e : x);
      else P.edit[oldKey] = e;
      APP.dm.edit = null; commit(p); h.toast(`Saved ${e.name}`);
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
