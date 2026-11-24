// Update splash: the app changelog since this device last opened a new version, with any waiting rule changes
// in the same window. Newest entry open, older ones folded. The data rules are in js/whatsnew.js.
import { esc, modalShell } from "../ui.js";
import { STATUS, groupItems } from "../contentupdate.js";

const entry = (r, open) => `<details class="wn-entry"${open ? " open" : ""}><summary><b>${esc(r.v)}</b><span class="tag amber">${esc(r.stage)}</span><span class="sub2">${esc(r.date)}</span></summary>
  <p class="small muted">${esc(r.blurb)}</p>
  ${r.groups.map(g => `<div class="clog-group"><div class="clog-title">${esc(g.title)}</div><ul>${g.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}</details>`;

export function renderWhatsNew(app) {
  const w = app.wn || { list: [], more: 0, content: null }, u = w.content, g = u ? groupItems(u) : null;
  const rules = u ? `<div class="wn-rules"><div><b>Rule changes</b><span class="sub2">${STATUS.filter(([k]) => g[k].length).map(([k, l]) => `${g[k].length} ${l.toLowerCase()}`).join(" · ")}</span></div><button class="btn sm" data-a="wnRules">Details</button></div>` : "";
  const body = rules + w.list.map((r, i) => entry(r, i === 0)).join("") + (w.more ? `<p class="sub2">${w.more} older updates in Settings.</p>` : "");
  return modalShell("What's new", body || `<p class="muted">No changes.</p>`,
    `<button class="btn ghost" data-a="wnOff">Turn off</button><button class="btn pri" data-a="wnDone">Done</button>`, "wnmodal");
}
