// Rulesets screen: make, copy, share and edit sets of allowed books and entries. ASCII only.
import { esc, topbar, searchBox } from "../ui.js";
import { KINDS, listBooks, allowed, allowedBy, entryKey, blankRuleset, copyRuleset, groupRuleset, findSet, saveSets, clean, encodeRuleset, decodeRuleset, countAllowed, problems, GROUP_ID, bookName } from "../rulesets.js";

export const rsUiDefault = () => ({ edit: null, tab: "books", kind: "classes", q: "", filter: "all", share: null, confirmDel: null, msg: "" });
const LIMIT = 120;

function summary(rs, L) {
  return countAllowed(rs, L).filter(r => r[2]).map(([label, on, all]) => `${on} of ${all} ${label.toLowerCase()}`).join(" · ");
}

export function renderRulesets(app) {
  const ui = app.rs, L = app.library;
  if (ui.edit) return editor(app, ui, L);
  const C = app.campaignRaw, sets = app.rulesets, group = groupRuleset(C, L);
  const card = rs => {
    const active = (sets.active || GROUP_ID) === rs.id || (!sets.sets.some(x => x.id === sets.active) && rs.id === GROUP_ID);
    const bad = problems(rs, L);
    return `<div class="panel rs-card"><div class="panel-head"><h2>${esc(rs.name)}</h2>${active ? `<span class="chip">In use</span>` : ""}</div>
      <div class="panel-body"><p class="sub2">${rs.builtin ? "Your group's rules (set by your DM, updates by itself). " : ""}${esc(summary(rs, L))}</p>
        ${bad.length ? `<p class="sub2 lrwarn">${esc(bad[0])}</p>` : ""}
        <div class="btnrow">
          ${active ? "" : `<button class="btn pri" data-a="rsUse" data-id="${esc(rs.id)}" ${bad.length ? "disabled" : ""}>Use</button>`}
          <button class="btn" data-a="rsEdit" data-id="${esc(rs.id)}">${rs.builtin ? "View" : "Edit"}</button>
          <button class="btn" data-a="rsCopy" data-id="${esc(rs.id)}">Copy</button>
          <button class="btn" data-a="rsShare" data-id="${esc(rs.id)}">Share</button>
          ${rs.builtin ? "" : `<button class="btn ghost" data-a="rsDelete" data-id="${esc(rs.id)}">${ui.confirmDel === rs.id ? "Tap again to delete" : "Delete"}</button>`}
        </div>
        ${ui.share === rs.id ? `<label class="field"><span class="lab">Send this code. Anyone can paste it into Import to get the same ruleset.</span><textarea class="f mono" rows="4" readonly data-rs-code onfocus="this.select()">${esc(encodeRuleset(rs))}</textarea></label><button class="btn sm" data-a="rsCopyCode" data-id="${esc(rs.id)}">Copy code</button>` : ""}
      </div></div>`;
  };
  return `${topbar("Rulesets", "What players on this device can pick", { back: "rsExit" })}
    <main class="wrap page">
      
      ${[group, ...sets.sets].map(card).join("")}
      <div class="stack" style="margin-top:12px">
        <button class="btn pri block" data-a="rsNew">New ruleset (everything on)</button>
        <label class="field"><span class="lab">Import a ruleset code</span><textarea class="f mono" id="rs-import" rows="3" placeholder="CRR1...." spellcheck="false"></textarea></label>
        <button class="btn block" data-a="rsImport">Import</button>
        ${ui.msg ? `<p class="small">${esc(ui.msg)}</p>` : ""}
        <button class="btn ghost block" data-a="dmOpen">DM editor</button>
      </div>
    </main>`;
}

function editor(app, ui, L) {
  const rs = findSet(app.rulesets, app.campaignRaw, ui.edit, L);
  if (!rs) { ui.edit = null; return renderRulesets(app); }
  const ro = !!rs.builtin, dis = ro ? "disabled" : "";
  let body = "";
  if (ui.tab === "books") {
    const books = listBooks(L);
    body = `<div class="btnrow" style="margin:8px 0"><button class="btn sm" data-a="rsAllBooks" data-v="1" ${dis}>All books on</button><button class="btn sm" data-a="rsAllBooks" data-v="0" ${dis}>All books off</button></div>
      <div class="panel"><div class="panel-body flush">${books.map(b => {
        const on = typeof rs.books[b.key] === "boolean" ? rs.books[b.key] : rs.defaultBooks !== false;
        const parts = KINDS.filter(k => b.counts[k[0]]).map(k => `${b.counts[k[0]]} ${k[1].toLowerCase()}`).join(", ");
        return `<div class="rowline"><span class="nm" style="flex-direction:column;align-items:flex-start;gap:0"><span>${esc(b.name)}${b.key === "unlabelled" ? " (no book recorded)" : ""}</span><span class="sub2">${esc(parts)}</span></span>
          <button class="btn sm ${on ? "pri" : ""}" data-a="rsBook" data-key="${esc(b.key)}" aria-pressed="${on}" ${dis}>${on ? "On" : "Off"}</button></div>`;
      }).join("")}</div></div>
      <p class="sub2">A single entry set under Entries beats its book.</p>`;
  } else {
    const kinds = KINDS, list = (L[ui.kind] || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const q = ui.q.trim().toLowerCase();
    const rows = list.filter(e => (!q || e.name.toLowerCase().includes(q) || bookName(e).toLowerCase().includes(q))).filter(e => {
      const on = allowed(rs, ui.kind, e), by = allowedBy(rs, ui.kind, e);
      return ui.filter === "all" || (ui.filter === "on" && on) || (ui.filter === "off" && !on) || (ui.filter === "set" && by === "entry");
    });
    body = `<div class="dm-f"><select class="f" data-a="rsKind" aria-label="What to list">${kinds.map(([k, l]) => `<option value="${k}" ${k === ui.kind ? "selected" : ""}>${l} (${countAllowed(rs, L).find(r => r[0] === l)[1]} of ${(L[k] || []).length} on)</option>`).join("")}</select></div>
      ${searchBox("rsq", ui.q, "Search by name or book")}
      <div class="seg" role="group" aria-label="Show" style="margin:8px 0">${[["all", "All"], ["on", "On"], ["off", "Off"], ["set", "Set by hand"]].map(([v, l]) => `<button data-a="rsFilter" data-v="${v}" aria-pressed="${ui.filter === v}">${l}</button>`).join("")}</div>
      <div class="panel"><div class="panel-body flush">${rows.slice(0, LIMIT).map(e => {
        const on = allowed(rs, ui.kind, e), by = allowedBy(rs, ui.kind, e);
        return `<div class="rowline"><span class="nm" style="flex-direction:column;align-items:flex-start;gap:0"><span>${esc(e.name)}${ui.kind === "subclasses" ? ` <span class="sub2">${esc(e.cls)}</span>` : ""}</span><span class="sub2">${esc(bookName(e))}${by === "entry" ? " · set by hand" : ""}</span></span>
          <button class="btn sm ${on ? "pri" : ""}" data-a="rsEntry" data-kind="${ui.kind}" data-key="${esc(entryKey(ui.kind, e))}" aria-pressed="${on}" ${dis}>${on ? "On" : "Off"}</button></div>`;
      }).join("") || `<p class="muted small" style="padding:12px 0">Nothing matches.</p>`}
      ${rows.length > LIMIT ? `<p class="sub2" style="padding:8px 0">Showing ${LIMIT} of ${rows.length}. Search to narrow it down.</p>` : ""}</div></div>
      
      ${ro ? "" : `<button class="btn ghost block" data-a="rsClearEntries">Clear my changes to ${esc((KINDS.find(k => k[0] === ui.kind) || [])[1] || "")}</button>`}`;
  }
  const bad = problems(rs, L);
  return `${topbar(rs.name, ro ? "Built in: copy it to change it" : summary(rs, L), { back: "rsBack" })}
    <main class="wrap page">
      ${ro ? "" : `<label class="field"><span class="lab">Name</span><input class="f" data-rs-name maxlength="60" value="${esc(rs.name)}" autocomplete="off"></label>`}
      <div class="seg" role="group" aria-label="Section" style="margin:8px 0">${[["books", "Books"], ["entries", "Entries"]].map(([v, l]) => `<button data-a="rsTab" data-v="${v}" aria-pressed="${ui.tab === v}">${l}</button>`).join("")}</div>
      ${bad.length ? `<p class="sub2 lrwarn">${esc(bad[0])}</p>` : ""}
      ${body}
    </main>`;
}

export function rsActions(APP, h) {
  const sets = () => APP.rulesets;
  const persist = (applyNow) => { if (!saveSets(sets())) h.toast("This browser would not save the change"); if (applyNow) h.setRules(); h.render(); };
  const mine = id => sets().sets.find(x => x.id === id);
  const editing = () => (APP.rs.edit && mine(APP.rs.edit)) || null;
  const touched = () => (sets().active === APP.rs.edit); // the change is live at once when it is the ruleset in use
  const ACT = {
    rsOpen() { APP.rs = rsUiDefault(); APP.screen = "rulesets"; h.render(); window.scrollTo(0, 0); },
    rsExit() { APP.screen = "roster"; APP.rs = null; h.render(); window.scrollTo(0, 0); },
    rsBack() { APP.rs.edit = null; h.render(); window.scrollTo(0, 0); },
    rsEdit(el) { APP.rs.edit = el.dataset.id; APP.rs.tab = "books"; APP.rs.q = ""; h.render(); window.scrollTo(0, 0); },
    rsUse(el) {
      const rs = el.dataset.id === GROUP_ID ? groupRuleset(APP.campaignRaw, APP.library) : mine(el.dataset.id);
      if (!rs || problems(rs, APP.library).length) return;
      sets().active = rs.id; persist(true); h.toast(`Using ${rs.name}`);
    },
    rsNew() { const rs = blankRuleset("My ruleset"); sets().sets.push(rs); APP.rs.edit = rs.id; APP.rs.tab = "books"; persist(false); window.scrollTo(0, 0); },
    rsCopy(el) {
      const src = el.dataset.id === GROUP_ID ? groupRuleset(APP.campaignRaw, APP.library) : mine(el.dataset.id); if (!src) return;
      const rs = copyRuleset(src, src.builtin ? "My copy of " + src.name : src.name + " copy"); sets().sets.push(rs); APP.rs.edit = rs.id; persist(false); window.scrollTo(0, 0);
    },
    rsDelete(el) {
      if (APP.rs.confirmDel !== el.dataset.id) { APP.rs.confirmDel = el.dataset.id; h.render(); return; }
      sets().sets = sets().sets.filter(x => x.id !== el.dataset.id); const was = sets().active === el.dataset.id; if (was) sets().active = GROUP_ID;
      APP.rs.confirmDel = null; persist(was);
    },
    rsShare(el) { APP.rs.share = APP.rs.share === el.dataset.id ? null : el.dataset.id; h.render(); },
    async rsCopyCode(el) {
      const rs = el.dataset.id === GROUP_ID ? groupRuleset(APP.campaignRaw, APP.library) : mine(el.dataset.id);
      try { await navigator.clipboard.writeText(encodeRuleset(rs)); h.toast("Code copied"); } catch (e) { h.toast("Select the code and copy it"); }
    },
    rsImport() {
      const rs = decodeRuleset((document.getElementById("rs-import") || {}).value);
      if (!rs) { APP.rs.msg = "That is not a ruleset code. It starts with CRR1."; h.render(); return; }
      sets().sets.push(rs); APP.rs.msg = `Added "${rs.name}". Tap Use to switch to it.`; persist(false);
    },
    rsTab(el) { APP.rs.tab = el.dataset.v; h.render(); },
    rsKind(el) { APP.rs.kind = el.value; APP.rs.q = ""; h.render(); },
    rsFilter(el) { APP.rs.filter = el.dataset.v; h.render(); },
    rsBook(el) {
      const rs = editing(); if (!rs) return;
      const cur = typeof rs.books[el.dataset.key] === "boolean" ? rs.books[el.dataset.key] : rs.defaultBooks !== false;
      rs.books[el.dataset.key] = !cur; persist(touched());
    },
    rsAllBooks(el) {
      const rs = editing(); if (!rs) return;
      const on = el.dataset.v === "1"; rs.defaultBooks = on; listBooks(APP.library).forEach(b => { rs.books[b.key] = on; }); persist(touched());
    },
    rsEntry(el) {
      const rs = editing(); if (!rs) return;
      const kind = el.dataset.kind, key = el.dataset.key, e = (APP.library[kind] || []).find(x => entryKey(kind, x) === key); if (!e) return;
      const m = (rs.entries[kind] = rs.entries[kind] || {}); const now = allowed(rs, kind, e); m[key] = !now;
      // setting it back to what its book says is the same as clearing it
      const without = { ...rs, entries: { ...rs.entries, [kind]: { ...m } } }; delete without.entries[kind][key];
      if (allowed(without, kind, e) === m[key]) delete m[key];
      persist(touched());
    },
    rsClearEntries() { const rs = editing(); if (!rs) return; delete rs.entries[APP.rs.kind]; persist(touched()); },
    rsRename(value) { const rs = editing(); if (!rs) return; rs.name = String(value).slice(0, 60); saveSets(sets()); if (touched()) h.setRules(); }
  };
  return ACT;
}
