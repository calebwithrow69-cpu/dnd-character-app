// Notes ledger screen: left sidebar (new, search, categories, sort, counters), note list, markdown editor.
// Phone: sidebar and list stack; an open note is its own page with Back. ASCII only.
import { esc, topbar, searchBox, modalShell, ICONS } from "../ui.js";
import { renderMd } from "../markdown.js";
import * as N from "../notes.js";

export const nbState = app => app.nb || (app.nb = { cat: "all", sel: null, q: "", sort: "updated", desc: true, mode: "write", data: null, adding: false, edit: null });
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
  const s = nbState(app), st = N.stats(s.data.notes), ms = N.milestoneText(st.chars), lv = N.levelInfo(s.data, st.chars), use = app.est || N.storageUse(localStorage);
  return `<div class="nb-card nb-level"><span class="nb-k">Note level</span>
      <div class="nb-lv"><span class="bd-seal t${lv.tier}">${lv.level}</span><div><b>${esc(lv.rank)}</b><small>${esc(ms.head)}</small></div></div>
      <div class="nb-bar" role="progressbar" aria-valuenow="${Math.round(lv.pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress to level ${lv.level + 1}"><i style="width:${lv.pct.toFixed(1)}%"></i></div>
      <small>${lv.next ? `${num(lv.left)} to level ${lv.level + 1}: ${esc(lv.next.short)}` : "Top level"}</small>
      <button class="btn sm block" data-a="nbBadges">All levels <b>${lv.level}/${lv.max}</b></button></div>
    <div class="nb-card"><span class="nb-k">Ledger</span>
      <div class="nb-grid"><div><b>${num(st.notes)}</b><small>Notes</small></div><div><b>${num(st.chars)}</b><small>Characters</small></div><div><b>${num(st.words)}</b><small>Words</small></div></div></div>
    <div class="nb-card"><span class="nb-k">Storage</span><b class="nb-ms">${N.fmtBytes(st.bytes)} notes</b>
      <div class="nb-bar" role="progressbar" aria-valuenow="${Math.round(use.pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Device storage used"><i style="width:${Math.max(1, use.pct).toFixed(1)}%"></i></div>
      <small>${N.fmtBytes(use.used)} of ${use.est ? "" : "about "}${N.fmtBytes(use.quota)} on this device</small></div>`;
}

// Footer under the note. While writing it counts the draft live and shows the level it is heading for.
export function nbFoot(app) {
  const s = nbState(app), e = s.edit;
  if (!e) { const n = current(app); if (!n) return ""; const t = (n.title + " " + n.body).trim(); return `${num(N.noteLen(n))} characters \u00b7 ${num(t ? t.split(/\s+/).length : 0)} words`; }
  const d = e.draft, t = (d.title + " " + d.body).trim(), own = e.id ? N.noteLen(s.data.notes.find(n => n.id === e.id) || { title: "", body: "" }) : 0;
  const proj = N.stats(s.data.notes).chars - own + N.noteLen(d), lv = N.levelInfo(s.data, proj);
  return `${num(N.noteLen(d))} characters \u00b7 ${num(t ? t.split(/\s+/).length : 0)} words \u00b7 ${lv.next ? `${num(lv.left)} to level ${lv.level + 1}` : "Top level"}`;
}

const dirty = e => e && (e.draft.title !== e.base.title || e.draft.body !== e.base.body || e.draft.cat !== e.base.cat);
export const nbDirty = dirty;

export function nbEdit(app) {
  const s = nbState(app), e = s.edit, n = current(app);
  if (e) {
    const tb = [["bold", "B", "Bold"], ["italic", "I", "Italic"], ["h", "H", "Heading"], ["ul", "\u2022", "List"], ["check", "\u2611", "Checklist"], ["quote", "\u275d", "Quote"], ["code", "<>", "Code"], ["link", "\u2197", "Link"]];
    return `<div class="nb-head"><button class="iconbtn" data-a="nbDiscard" aria-label="Discard">${ICONS.close}</button>
      <select class="nb-sel" data-nb="cat" aria-label="Category">${s.data.cats.map(c => `<option${c === e.draft.cat ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <div class="seg nb-mode"><button data-a="nbMode" data-mode="write" aria-pressed="${s.mode === "write"}">Write</button><button data-a="nbMode" data-mode="preview" aria-pressed="${s.mode === "preview"}">Preview</button></div>
      <button class="btn pri nb-save" data-a="nbSaveNote" aria-label="Save note">${ICONS.check}<span>Save</span></button></div>
    <input class="f nb-title" data-nb="title" value="${esc(e.draft.title)}" maxlength="120" placeholder="Title" aria-label="Title">
    ${s.mode === "write"
      ? `<div class="nb-tb" role="toolbar" aria-label="Formatting">${tb.map(([k, l, a]) => `<button data-a="nbFmt" data-f="${k}" aria-label="${a}">${l}</button>`).join("")}</div>
         <textarea class="f nb-body" id="nb-body" data-nb="body" aria-label="Note text" placeholder="Markdown">${esc(e.draft.body)}</textarea>`
      : `<div class="nb-md md" id="nb-md">${e.draft.body.trim() ? renderMd(e.draft.body) : `<p class="muted">Empty</p>`}</div>`}
    <div class="nb-foot" id="nb-foot">${nbFoot(app)}</div>`;
  }
  if (!n) return `<div class="gl-empty">${ICONS.notes}<b>No note open</b></div>`;
  return `<div class="nb-head"><button class="gl-back" data-a="nbBack">${ICONS.back}Notes</button>
      <span class="tag nb-cattag">${esc(n.cat)}</span>
      <button class="iconbtn" data-a="nbPdf" data-id="${esc(n.id)}" aria-label="Download PDF">${ICONS.download}</button>
      <button class="gl-star big" data-a="nbPin" data-id="${esc(n.id)}" aria-pressed="${n.pin}" aria-label="${n.pin ? "Unpin" : "Pin"} note">${ICONS.star}</button>
      <button class="iconbtn nb-del" data-a="askRemove" data-do="nbDelete" data-what="note" data-name="${esc(N.titleOf(n))}" data-id="${esc(n.id)}" aria-label="Delete note">${ICONS.trash}</button>
      <button class="btn nb-editbtn" data-a="nbEditStart" aria-label="Edit note">${ICONS.edit}<span>Edit</span></button></div>
    <h2 class="nb-rtitle">${esc(N.titleOf(n))}</h2>
    <div class="nb-md md" id="nb-md">${n.body.trim() ? renderMd(n.body) : `<p class="muted">Empty</p>`}</div>
    <div class="nb-foot" id="nb-foot">${nbFoot(app)}</div>`;
}

export function notesBody(app) {
  const s = nbState(app);
  return `<div class="nb" id="nb" data-sel="${s.edit || (s.sel && current(app)) ? 1 : 0}">
      <div class="nb-side">
        <div class="nb-ctl">
          <button class="btn pri block" data-a="nbNew">${ICONS.plus}<span>New note</span></button>
          ${searchBox("notes", s.q, "Search notes")}
          <div class="nb-cats" id="nb-cats">${nbCats(app)}</div>
          <div class="nb-sort"><select data-nb="sort" aria-label="Sort by">${N.SORTS.map(([k, l]) => `<option value="${k}"${s.sort === k ? " selected" : ""}>${l}</option>`).join("")}</select>
            <button class="btn sm" data-a="nbDir" aria-label="${s.desc ? "Descending" : "Ascending"}">${s.desc ? "Newest first" : "Oldest first"}</button></div>
        </div>
        <div class="nb-stats" id="nb-stats">${nbStats(app)}</div>
        <div class="nb-ctl end"><button class="btn block" data-a="nbPdfAll">${ICONS.download}<span>Export PDF</span></button><button class="btn block" data-a="nbExport">Export Markdown</button></div>
      </div>
      <section class="nb-list nb-box" id="nb-list" aria-label="Notes">${nbList(app)}</section>
      <section class="nb-edit nb-box" id="nb-edit" aria-label="Editor">${nbEdit(app)}</section>
    </div>`;
}
export function renderNotes(app) {
  return `${topbar("Notes", "", { back: "nbExit" })}
    <main class="wrap page wide">${notesBody(app)}</main>`;
}

export function renderBadges(app) {
  const s = nbState(app), got = N.badgeCount(s.data), next = N.BADGES.find(b => !s.data.badges[b.id]);
  const chars = N.stats(s.data.notes).chars;
  const rows = N.BADGES.map((b, i) => {
    const ts = s.data.badges[b.id], open = s.bopen === b.id, words = b.words || Math.round(b.n / 5.7);
    const state = ts ? "Earned" : next && next.id === b.id ? "Next" : "Locked";
    const body = open ? `<div class="bd-body"><p>${esc(b.about)}</p>
        <p class="bd-len">${num(b.n)} characters${b.n >= 1000 ? " \u00b7 about " + num(words) + " words" : ""}</p>
        ${ts ? `<ul class="bd-facts">${b.facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p class="bd-left">${num(Math.max(0, b.n - chars))} to go</p>`}</div>` : "";
    return `<div class="bd-item ${state.toLowerCase()}${open ? " open" : ""}"><button class="bd-h" data-a="nbBadge" data-id="${esc(b.id)}" aria-expanded="${open}">
      <span class="bd-seal t${b.tier}">${i + 1}</span>
      <span class="bd-n"><b>${esc(b.short)}</b><small>${ts ? "Earned " + new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : num(b.n) + " characters"}</small></span>
      <span class="bd-st">${state}</span></button>${body}</div>`;
  }).join("");
  return modalShell("Note levels", `<p class="bd-sum"><b>Level ${got}</b> of ${N.BADGES.length} \u00b7 ${num(chars)} characters written</p><div class="bd-list">${rows}</div>`, `<button class="btn pri" data-a="closeModal">Done</button>`);
}

// Shown after a save that crossed one or more level thresholds.
export function renderLevelUp(app) {
  const u = nbState(app).levelUp || { won: [] }, b = N.BADGES.find(x => x.id === u.last) || N.BADGES[0], i = N.BADGES.indexOf(b), next = N.BADGES[i + 1];
  return modalShell("Level up", `<div class="lu"><span class="bd-seal big t${b.tier}">${i + 1}</span><b class="lu-n">${esc(b.short)}</b>
      <p class="lu-a">${esc(b.about)}</p>${b.facts[0] ? `<p class="lu-f">${esc(b.facts[0])}</p>` : ""}
      <small>${u.won.length > 1 ? `${u.won.length} levels at once \u00b7 ` : ""}${next ? `${num(Math.max(0, next.n - u.chars))} to level ${i + 2}: ${esc(next.short)}` : "Top level"}</small></div>`,
    `<button class="btn pri" data-a="closeModal">Keep writing</button>`);
}

export function renderDiscard(app) {
  const e = nbState(app).edit || {}, name = (e.draft && e.draft.title.trim()) || "this note";
  return modalShell("Discard?", `<p>${e.id ? `Changes to <b>${esc(name)}</b> are lost.` : `<b>${esc(name)}</b> is not saved.`}</p>`,
    `<button class="btn" data-a="closeModal">Keep editing</button><button class="btn danger" data-a="nbDiscardGo">Discard</button>`);
}
