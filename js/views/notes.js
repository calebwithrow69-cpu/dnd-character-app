// Notes ledger screen: left sidebar (new, search, categories, sort, counters), note list, markdown editor.
// Phone: sidebar and list stack; an open note is its own page with Back. ASCII only.
import { esc, topbar, searchBox, ICONS } from "../ui.js";
import { renderMd } from "../markdown.js";
import * as N from "../notes.js";

export const nbState = app => app.nb || (app.nb = { cat: "all", sel: null, q: "", sort: "updated", desc: true, mode: "write", data: null, adding: false });
const when = ts => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const num = n => Number(n).toLocaleString();

export function nbVisible(app) {
  const s = nbState(app);
  return N.sortNotes(N.filterNotes(s.data.notes, { cat: s.cat, q: s.q }), s.sort, s.desc);
}
const current = app => { const s = nbState(app); return s.data.notes.find(n => n.id === s.sel) || null; };

export function nbCats(app) {
  const s = nbState(app), cnt = N.catCounts(s.data);
  const chip = (id, label) => `<button class="nb-cat" data-a="nbCat" data-cat="${esc(id)}" aria-pressed="${s.cat === id}">${esc(label)}<i>${cnt[id] || 0}</i></button>`;
  const custom = s.cat !== "all" && s.cat !== N.GENERAL && !N.DEFAULT_CATS.includes(s.cat);
  return chip("all", "All") + s.data.cats.map(c => chip(c, c)).join("") +
    (s.adding
      ? `<span class="nb-addcat"><input class="f" data-nb="newcat" maxlength="24" placeholder="Category" aria-label="New category"><button class="btn sm" data-a="nbAddCat">Add</button></span>`
      : `<button class="nb-cat add" data-a="nbCatForm" aria-label="Add category">${ICONS.plus}</button>`) +
    (custom ? `<button class="linkbtn nb-delcat" data-a="nbDelCat">Delete ${esc(s.cat)}</button>` : "");
}

export function nbList(app) {
  const s = nbState(app), rows = nbVisible(app);
  if (!rows.length) {
    return `<div class="gl-none">${ICONS.notes}<b>${s.q ? "No matches" : "No notes"}</b>${s.q ? "" : `<button class="btn pri" data-a="nbNew">New note</button>`}</div>`;
  }
  return rows.map(n => {
    const prev = (n.body || "").split("\n").map(l => l.replace(/^[#>\-*\s]+|\[[ xX]\]\s*|[*_`~]/g, "").trim()).find(Boolean) || "";
    return `<div class="nb-row${n.id === s.sel ? " sel" : ""}">
      <button class="nb-open" data-a="nbOpen" data-id="${esc(n.id)}"><span class="nb-t">${esc(N.titleOf(n))}</span><span class="nb-p">${esc(prev.slice(0, 90))}</span>
        <span class="nb-m"><span class="tag">${esc(n.cat)}</span><span>${num(N.noteLen(n))} chars</span><span>${when(n.updated)}</span></span></button>
      <button class="gl-star nb-pin" data-a="nbPin" data-id="${esc(n.id)}" aria-pressed="${n.pin}" aria-label="${n.pin ? "Unpin" : "Pin"} ${esc(N.titleOf(n))}">${ICONS.star}</button></div>`;
  }).join("");
}

export function nbStats(app) {
  const s = nbState(app), st = N.stats(s.data.notes), ms = N.milestoneText(st.chars), use = N.storageUse(localStorage);
  return `<div class="nb-card"><span class="nb-k">Ledger</span>
      <div class="nb-grid"><div><b>${num(st.notes)}</b><small>Notes</small></div><div><b>${num(st.chars)}</b><small>Characters</small></div><div><b>${num(st.words)}</b><small>Words</small></div></div></div>
    <div class="nb-card"><span class="nb-k">Length</span><b class="nb-ms">${esc(ms.head)}</b>
      <div class="nb-bar" role="progressbar" aria-valuenow="${Math.round(ms.pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress to next milestone"><i style="width:${ms.pct.toFixed(1)}%"></i></div>
      <small>Next: ${esc(ms.sub)}</small></div>
    <div class="nb-card"><span class="nb-k">Storage</span><b class="nb-ms">${N.fmtBytes(st.bytes)} notes</b>
      <div class="nb-bar" role="progressbar" aria-valuenow="${Math.round(use.pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Device storage used"><i style="width:${Math.max(1, use.pct).toFixed(1)}%"></i></div>
      <small>${N.fmtBytes(use.used)} of about ${N.fmtBytes(use.quota)} on this device</small></div>`;
}

export function nbFoot(n) {
  const t = (n.title + " " + n.body).trim();
  return `${num(N.noteLen(n))} characters · ${num(t ? t.split(/\s+/).length : 0)} words`;
}

export function nbEdit(app) {
  const s = nbState(app), n = current(app);
  if (!n) return `<div class="gl-empty">${ICONS.notes}<b>No note open</b></div>`;
  const tb = [["bold", "B", "Bold"], ["italic", "I", "Italic"], ["h", "H", "Heading"], ["ul", "•", "List"], ["check", "☑", "Checklist"], ["quote", "❝", "Quote"], ["code", "<>", "Code"], ["link", "↗", "Link"]];
  return `<div class="nb-head"><button class="gl-back" data-a="nbBack">${ICONS.back}Notes</button>
      <select class="nb-sel" data-nb="cat" aria-label="Category">${s.data.cats.map(c => `<option${c === n.cat ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <div class="seg nb-mode"><button data-a="nbMode" data-mode="write" aria-pressed="${s.mode === "write"}">Write</button><button data-a="nbMode" data-mode="preview" aria-pressed="${s.mode === "preview"}">Preview</button></div>
      <button class="gl-star big" data-a="nbPin" data-id="${esc(n.id)}" aria-pressed="${n.pin}" aria-label="${n.pin ? "Unpin" : "Pin"} note">${ICONS.star}</button>
      <button class="iconbtn nb-del" data-a="askRemove" data-do="nbDelete" data-what="note" data-name="${esc(N.titleOf(n))}" data-id="${esc(n.id)}" aria-label="Delete note">${ICONS.trash}</button></div>
    <input class="f nb-title" data-nb="title" value="${esc(n.title)}" maxlength="120" placeholder="Title" aria-label="Title">
    ${s.mode === "write"
      ? `<div class="nb-tb" role="toolbar" aria-label="Formatting">${tb.map(([k, l, a]) => `<button data-a="nbFmt" data-f="${k}" aria-label="${a}">${l}</button>`).join("")}</div>
         <textarea class="f nb-body" id="nb-body" data-nb="body" aria-label="Note text" placeholder="Markdown">${esc(n.body)}</textarea>`
      : `<div class="nb-md md" id="nb-md">${n.body.trim() ? renderMd(n.body) : `<p class="muted">Empty</p>`}</div>`}
    <div class="nb-foot" id="nb-foot">${nbFoot(n)}</div>`;
}

export function renderNotes(app) {
  const s = nbState(app);
  return `${topbar("Notes", "", { back: "nbExit" })}
    <main class="wrap page wide"><div class="nb" id="nb" data-sel="${s.sel && current(app) ? 1 : 0}">
      <div class="nb-side">
        <div class="nb-ctl">
          <button class="btn pri block" data-a="nbNew">${ICONS.plus}<span>New note</span></button>
          ${searchBox("notes", s.q, "Search notes")}
          <div class="nb-cats" id="nb-cats">${nbCats(app)}</div>
          <div class="nb-sort"><select data-nb="sort" aria-label="Sort by">${N.SORTS.map(([k, l]) => `<option value="${k}"${s.sort === k ? " selected" : ""}>${l}</option>`).join("")}</select>
            <button class="btn sm" data-a="nbDir" aria-label="${s.desc ? "Descending" : "Ascending"}">${s.desc ? "Newest first" : "Oldest first"}</button></div>
        </div>
        <div class="nb-stats" id="nb-stats">${nbStats(app)}</div>
        <div class="nb-ctl end"><button class="btn block" data-a="nbExport">Export notes</button></div>
      </div>
      <section class="nb-list nb-box" id="nb-list" aria-label="Notes">${nbList(app)}</section>
      <section class="nb-edit nb-box" id="nb-edit" aria-label="Editor">${nbEdit(app)}</section>
    </div></main>`;
}
