// The Features page (Advanced Features tab and Classic Features sub-tab): shelves, one sort button, bookmarks, detail pane.
import { esc, kRow, kGroup, searchBox, ICONS } from "../ui.js";
import { findByName, subclassesFor } from "../data.js";
import { needsFirstChoices } from "./sheet.js";
import { trackHtml } from "./play.js";
import { featureEntries, ftCounts, ftActive, ftApply, ftDefault, FT_TABS, FT_USES, FT_GROUPS, FT_SORTS } from "../featurelist.js";

export const ftState = app => app.ft || (app.ft = ftDefault());
const USE_LABEL = { Passive: "Passive", Action: "Action", Bonus: "Bonus action", Reaction: "Reaction", Other: "Special" };

function pips(t) {
  return t.max <= 6 ? `<span class="ft-pips" aria-label="${t.cur} of ${t.max} uses left">${Array.from({ length: t.max }, (_, k) => `<i class="${k < t.cur ? "" : "used"}"></i>`).join("")}</span>`
    : `<span class="ft-uses">${t.cur}/${t.max}</span>`;
}

function row(e, c, st) {
  const marked = (c.featMarks || []).includes(e.key);
  const meta = [e.parent || e.label, e.lv ? "Lv " + e.lv : "", e.limited && !e.track ? e.usage : ""].filter(Boolean).join(" · ");
  const chip = `<span class="ft-use u-${e.use.toLowerCase()}">${esc(USE_LABEL[e.use] || e.use)}</span>`;
  const status = `${e.isNew ? `<span class="ft-new" aria-label="New this level">New</span>` : ""}${e.track ? pips(e.track) : ""}${chip}`;
  return kRow({ glyph: e.name[0], tone: e.src === "class" ? "amber" : e.src === "subclass" ? "blue" : e.src === "feat" ? "feat" : "green", title: e.name, cap: meta,
    status, off: e.upcoming, cls: st.sel === e.key ? "sel" : "",
    mainAttrs: `data-a="ftOpen" data-key="${esc(e.key)}" data-kind="${e.kind}" data-name="${esc(e.dn || e.name)}" ${e.from ? `data-from="${esc(e.from)}"` : ""} ${e.i != null ? `data-i="${e.i}"` : ""}`,
    actions: `<button class="iconbtn ft-star ${marked ? "on" : ""}" data-a="ftMark" data-key="${esc(e.key)}" aria-pressed="${marked}" aria-label="Bookmark ${esc(e.name)}">${ICONS.star}</button>` });
}

export function ftResults(app, c) {
  const st = ftState(app), list = featureEntries(app, c), marks = c.featMarks || [];
  const groups = ftApply(list, st, marks);
  if (!groups.some(g => g[1].length)) return `<p class="muted" style="padding:20px 4px">${st.tab === "saved" ? "No bookmarks." : "No features match."}</p>`;
  return groups.map(([k, es]) => (k ? kGroup(k, es.length, { tone: "amber" }) : "") + `<div class="k-list">${es.map(e => row(e, c, st)).join("")}</div>`).join("");
}

function pane(app, c) {
  const st = ftState(app), e = st.sel && featureEntries(app, c).find(x => x.key === st.sel);
  if (!e) return `<aside class="ft-pane"><p class="muted" style="padding:20px 4px">Select a feature.</p></aside>`;
  const marked = (c.featMarks || []).includes(e.key);
  const body = e.text ? e.text.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("") : `<p class="muted">No rules text.</p>`;
  return `<aside class="ft-pane"><h3>${esc(e.name)}</h3><div class="ft-chips"><span class="ft-use u-${e.use.toLowerCase()}">${esc(USE_LABEL[e.use] || e.use)}</span><span class="ft-use">${esc(e.parent || e.label)}</span>${e.lv ? `<span class="ft-use">Level ${e.lv}</span>` : ""}${e.limited ? `<span class="ft-use">${esc(e.usage)}</span>` : ""}${e.track ? pips(e.track) : ""}</div>
    <div class="ft-text">${body}</div>
    <div class="btnrow"><button class="btn sm" data-a="ftMark" data-key="${esc(e.key)}" aria-pressed="${marked}">${marked ? "Remove bookmark" : "Bookmark"}</button>
    ${e.use !== "Passive" && !e.upcoming ? `<button class="btn sm" data-a="ftHotbar" data-key="${esc(e.key)}">Add to hotbar</button>` : ""}
    <button class="btn sm ghost" data-a="showDetail" data-kind="${e.kind}" data-name="${esc(e.dn || e.name)}" ${e.from ? `data-from="${esc(e.from)}"` : ""} ${e.i != null ? `data-i="${e.i}"` : ""}>Full text</button></div></aside>`;
}

export function featuresView(app, c) {
  const st = ftState(app), L = app.library, list = featureEntries(app, c), counts = ftCounts(list, c.featMarks || []), nAct = ftActive(st);
  const cls = findByName(L.classes, c.class);
  const warn = [
    !c.subclass && c.level >= 3 && subclassesFor(L, c.class).length ? `<div class="rowline"><span class="nm" style="color:var(--amber)">No subclass chosen yet</span><button class="btn sm" data-a="openEdit">Choose</button></div>` : "",
    needsFirstChoices(app, c) ? `<div class="rowline"><span class="nm" style="color:var(--amber)">Level 1 choices not made yet</span><button class="btn sm pri" data-a="startFirstChoices">Choose</button></div>` : "",
    (c.masteries || []).length ? `<div class="rowline"><span class="nm">Weapon mastery</span><span class="sub2" style="text-align:right">${esc(c.masteries.join(", "))}</span></div>` : "",
    c.level >= 11 && !((cls && cls.features) || []).some(x => x.lv > 10) ? `<p class="sub2" style="padding:8px 0">Rules data ends at level 10.</p>` : ""
  ].join("");
  return `<div class="panel"><div class="panel-head"><h2>Level ${c.level} ${esc(c.class)}</h2>
      <button class="btn sm pri" data-a="openLevelMenu" ${c.level >= 20 ? "disabled" : ""}>Level up</button></div>
      ${warn ? `<div class="panel-body flush">${warn}</div>` : ""}</div>
    <div class="shelf ft-tabs" role="group" aria-label="Feature shelves">${FT_TABS.map(([k, l]) =>
      `<button data-a="ftTab" data-v="${k}" aria-pressed="${st.tab === k}"><span>${l}</span><em>${counts[k]}</em></button>`).join("")}</div>
    <div class="shop-find">${searchBox("ft", st.q, "Search features")}
      <button class="btn shop-sortbtn" data-a="ftFilterOpen" aria-label="Sort and filter${nAct ? `, ${nAct} on` : ""}">${ICONS.sort}${nAct ? `<em>${nAct}</em>` : ""}</button></div>
    <div class="ft-wrap"><div class="ft-main"><div class="ft-list" id="results-ft">${ftResults(app, c)}</div>${pane(app, c)}</div></div>
    <details class="ft-track"><summary>Level track</summary><div class="pm prog-wrap">${trackHtml(app, c)}</div></details>`;
}

export function ftFilterModal(app) {
  const st = ftState(app), seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-a="ftSet" data-k="${k}" data-v="${v}" aria-pressed="${st[k] === v}">${l}</button>`).join("")}</div>`;
  const body = `<div class="stack">
    <div class="field"><label>Group by</label>${seg("group", FT_GROUPS)}</div>
    <div class="field"><label>Sort</label>${seg("sort", FT_SORTS)}</div>
    <div class="field"><label>Show only</label><div class="shop-filters">${FT_USES.map(([k, l]) => `<button class="chipbtn" data-a="ftOnly" data-k="${k}" aria-pressed="${!!st.only[k]}">${l}</button>`).join("")}</div></div>
    <button class="optcard" data-a="ftUpcoming" aria-pressed="${st.upcoming}"><span class="grow"><b>Show upcoming</b><span>Features of levels you have not reached</span></span></button></div>`;
  return { title: "Sort and filter", body, foot: `<button class="btn" data-a="ftReset">Reset</button><button class="btn pri" data-a="closeModal">Done</button>` };
}
