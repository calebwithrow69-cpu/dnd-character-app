// "Content update" popup: three cards (New, Changed, Removed) with counts; a card opens its list and each entry
// opens to its before and after. Changed text is shown with the changed words marked.
import { esc, modalShell, formatText } from "../ui.js";
import { STATUS, EFFECT, groupItems, changeView, isLong, show, pendingUpdate, latestUpdate, rangeText, seenId } from "../contentupdate.js";

// What the popup shows: everything not yet checked on this device, or the newest update once it has been checked.
export function cuRecord(app) { return pendingUpdate(app.library, seenId()) || latestUpdate(app.library); }
export const cuPendingCount = app => { const u = pendingUpdate(app.library, seenId()); return u ? u.items.length : 0; };
export const cuState = app => app.cu || (app.cu = { open: "", items: new Set() });

const runs = rs => rs.map(r => (r.mark === "skip" ? `<span class="cu-skip">${esc(r.s)}</span>` : r.mark ? `<${r.mark}>${esc(r.s)}</${r.mark}>` : esc(r.s))).join("").replace(/\n/g, "<br>");
const badge = e => (e && EFFECT[e] ? `<span class="cu-eff ${e}"><i aria-hidden="true">${e === "buff" ? "▲" : e === "nerf" ? "▼" : e === "mixed" ? "◆" : "●"}</i>${EFFECT[e]}</span>` : "");

function pair(ch) {
  if (isLong(ch.before) || isLong(ch.after)) {
    const d = changeView(ch.before, ch.after);
    return `<div class="cu-ba"><div><span class="cu-lab">Before</span><p class="cu-text">${runs(d.before)}</p></div><div><span class="cu-lab">After</span><p class="cu-text">${runs(d.after)}</p></div></div>`;
  }
  return `<div class="cu-ba"><div><span class="cu-lab">Before</span><p class="cu-val">${esc(show(ch.before))}</p></div><div><span class="cu-lab">After</span><p class="cu-val">${esc(show(ch.after))}</p></div></div>`;
}

function metaOf(it, e) {
  if (it.kind === "spells") return [e.level ? `Level ${e.level}` : "Cantrip", e.school, e.time, e.range].filter(Boolean).join(" · ");
  if (it.kind === "feats") return e.type || "";
  return e.type || e.source || "";
}

function itemBody(it) {
  const lead = it.summary ? `<p class="cu-sum2">${esc(it.summary)}</p>` : "";
  if (it.status === "changed") return `<div class="cu-body">${lead}${it.changes.map(ch => `<div class="cu-ch"><h5>${esc(String(ch.label).replace(/\s*\(.*\)/, ""))}${badge(ch.effect)}</h5>${ch.note ? `<p class="cu-note">${esc(ch.note)}</p>` : ""}${pair(ch)}</div>`).join("")}</div>`;
  const e = it.status === "new" ? it.after : it.before;
  return `<div class="cu-body">${lead}<div class="cu-ch"><h5>${it.status === "new" ? "Now" : "Was"}</h5>${metaOf(it, e) ? `<p class="cu-note">${esc(metaOf(it, e))}</p>` : ""}<div class="cu-text">${formatText(e.text)}</div></div></div>`;
}

function itemHtml(it, open) {
  return `<div class="cu-item${open ? " open" : ""}"><button class="cu-ih" data-a="cuItem" data-key="${it.key}" aria-expanded="${open}">
      <span class="cu-top"><span class="cu-in">${esc(it.name)}</span><span class="cu-tags"><span class="tag">${esc(it.label)}</span>${badge(it.effect)}</span></span>
      ${it.summary && !open ? `<span class="cu-sum">${esc(it.summary)}</span>` : ""}</button>${open ? itemBody(it) : ""}</div>`;
}

export function renderContentUpdate(app) {
  const u = cuRecord(app);
  if (!u) return modalShell("Content update", `<p class="muted">No update.</p>`, `<button class="btn" data-a="closeModal">Done</button>`);
  const st = cuState(app), g = groupItems(u);
  const cards = STATUS.map(([k, l]) => `<button class="cu-card ${k}" data-a="cuOpen" data-k="${k}" aria-expanded="${st.open === k}"${g[k].length ? "" : " disabled"}><span class="cu-cl">${l}</span><b>${g[k].length}</b></button>`).join("");
  const list = st.open && g[st.open] ? `<div class="cu-list">${g[st.open].map(it => itemHtml(it, st.items.has(it.key))).join("")}</div>` : "";
  return modalShell("Content update", `<p class="cu-date">${esc(rangeText(u))}${u.older ? ` \u00b7 Earlier updates not listed` : ""}</p><div class="cu-cards">${cards}</div>${list}`, `<button class="btn pri" data-a="cuDone">Done</button>`);
}
