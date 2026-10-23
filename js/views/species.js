// The species picker: a sortable, searchable list of portrait cards. Opening a card
// shows the portrait, the level 1 choices, and every ability (tap to read it).
// The book text is shown exactly as stored; only the Passive/Active tag, the
// "Level" tag and the usage line are the app's own reading of it.
// ASCII only in this file.
import { esc, formatText } from "../ui.js";
import { enabledSpecies } from "../data.js";
import { speciesSize, speciesSpeed } from "../rules.js";
import { parseSpecies } from "../species.js";
import { portraitFor } from "../portraits.js";

const I = {
  chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
};

export const spUiDefault = () => ({ sort: "az", source: "All", open: null, traits: new Set() });
const favs = app => app.prefs.favSpecies || [];
const srcLabel = s => s || "No source";

// The two dropdowns (they sit outside the results so typing in search doesn't rebuild them)
export function renderSpeciesControls(app) {
  const u = app.spUi;
  const sources = [...new Set(enabledSpecies(app.library, app.campaign).map(s => s.source || ""))].sort((a, b) => srcLabel(a).localeCompare(srcLabel(b)));
  return `<div class="sp-controls">
    <label class="sp-sel"><span>Sort by</span>
      <select class="f" data-a="spSort" aria-label="Sort species">
        <option value="az" ${u.sort === "az" ? "selected" : ""}>A to Z</option>
        <option value="source" ${u.sort === "source" ? "selected" : ""}>Source</option>
        <option value="fav" ${u.sort === "fav" ? "selected" : ""}>Favorites first</option>
      </select></label>
    <label class="sp-sel"><span>Source</span>
      <select class="f" data-a="spSource" aria-label="Filter by source">
        <option value="All" ${u.source === "All" ? "selected" : ""}>All sources</option>
        ${sources.map(s => `<option value="${esc(s || "_none")}" ${u.source === (s || "_none") ? "selected" : ""}>${esc(srcLabel(s))}</option>`).join("")}
      </select></label>
  </div>`;
}

function thumb(name, cls) {
  const img = portraitFor(name);
  return img ? `<img class="${cls}" src="${img}" alt="" loading="lazy">` : `<span class="${cls} ph" aria-hidden="true">${esc(name[0] || "?")}</span>`;
}

function traitRow(app, sp, t) {
  const key = sp.name + ":" + t.name, open = app.spUi.traits.has(key);
  const act = t.kind === "active";
  return `<div class="sp-trait ${open ? "open" : ""} ${t.level > 1 ? "later" : ""}">
    <button class="sp-tbtn" data-a="spTrait" data-key="${esc(key)}" aria-expanded="${open}">
      <span class="grow"><b>${esc(t.name)}</b><small>${esc(t.level > 1 ? "Level " + t.level + (act && t.usage !== "Always on" ? " \u00b7 " + t.usage : "") : t.usage)}</small></span>
      <span class="flag ${act ? "act" : "pas"}">${act ? "Active" : "Passive"}</span>
      <span class="chev">${I.chev}</span>
    </button>
    ${open ? `<div class="about">${formatText(t.body)}</div>` : ""}
  </div>`;
}
function plainRow(app, sp, key, title, text) {
  const k = sp.name + ":" + key, open = app.spUi.traits.has(k);
  return `<div class="sp-trait ${open ? "open" : ""}">
    <button class="sp-tbtn" data-a="spTrait" data-key="${esc(k)}" aria-expanded="${open}">
      <span class="grow"><b>${esc(title)}</b></span><span class="chev">${I.chev}</span></button>
    ${open ? `<div class="about">${formatText(text)}</div>` : ""}</div>`;
}

function detail(app, sp, choicesHtml) {
  const p = parseSpecies(sp), has = !!portraitFor(sp.name);
  const abilities = p.traits.map(t => traitRow(app, sp, t)).join("");
  return `<div class="sp-detail">
    <div class="sp-hero ${has ? "" : "empty"}">
      ${has ? `<img src="${portraitFor(sp.name)}" alt="Portrait of ${esc(sp.name)}">` : `<span>No portrait yet</span>`}
      <div class="sp-hero-act">
        <label class="btn sm sp-up">${I.cam} ${has ? "Change image" : "Add image"}<input type="file" accept="image/*" data-sp-file="${esc(sp.name)}" aria-label="Choose an image for ${esc(sp.name)}"></label>
        ${has ? `<button class="btn sm" data-a="spPortraitClear" data-name="${esc(sp.name)}">Remove</button>` : ""}
      </div>
    </div>
    ${p.facts.length ? `<dl class="sp-facts">${p.facts.map(f => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join("")}</dl>` : ""}
    ${choicesHtml ? `<div class="sp-choices">${choicesHtml}</div>` : ""}
    <div class="sp-sechead"><h3>Abilities</h3><span class="sub2">Tap one to read it</span></div>
    <div class="sp-traits">
      ${p.intro.length ? plainRow(app, sp, "~intro", "Overview", p.intro.join("\n\n")) : ""}
      ${abilities}
      ${sp.desc ? plainRow(app, sp, "~lore", "About " + sp.name, sp.desc) : ""}
    </div>
    <p class="sub2 sp-note">Passive means always on. Active means it takes an action or has limited uses. Those two tags and the usage line are this app's reading of the text; the words inside each ability are the book's, unchanged.</p>
  </div>`;
}

export function renderCodex(app, choicesFor) {
  const d = app.createDraft, u = app.spUi, fav = favs(app);
  const q = (d.query || "").trim().toLowerCase();
  let items = enabledSpecies(app.library, app.campaign)
    .filter(s => (u.source === "All" || (s.source || "_none") === u.source) && (!q || s.name.toLowerCase().includes(q)));
  if (!items.length) return `<p class="muted small" style="padding:12px 0">Nothing matches.</p>`;
  const by = (a, b) => a.name.localeCompare(b.name);
  const group = s => u.sort === "source" ? srcLabel(s.source) : u.sort === "fav" ? (fav.includes(s.name) ? "Favorites" : "All species") : s.name[0].toUpperCase();
  items = items.sort((a, b) => {
    if (u.sort === "source") return srcLabel(a.source).localeCompare(srcLabel(b.source)) || by(a, b);
    if (u.sort === "fav") return (fav.includes(b.name) - fav.includes(a.name)) || by(a, b);
    return by(a, b);
  });
  let last = null, html = `<p class="sub2 sp-count">${items.length} species</p>`;
  for (const s of items) {
    const g = group(s);
    if (g !== last) { html += `<div class="sp-group">${esc(g)}</div>`; last = g; }
    const on = d.species === s.name, open = u.open === s.name, isFav = fav.includes(s.name);
    const sub = [speciesSize(s.traits), `speed ${speciesSpeed(s.traits)} ft`, s.source].filter(Boolean).join(" \u00b7 ");
    html += `<div class="sp-row ${open ? "open" : ""} ${on ? "on" : ""}">
      <div class="sp-top">
        <button class="sp-main" data-a="openSpecies" data-name="${esc(s.name)}" aria-expanded="${open}">
          ${thumb(s.name, "sp-thumb")}
          <span class="grow"><b>${esc(s.name)}</b><small>${esc(sub)}</small></span>
          ${on ? `<span class="tag amber">Chosen</span>` : ""}
          <span class="chev">${I.chev}</span>
        </button>
        <button class="sp-fav" data-a="spFav" data-name="${esc(s.name)}" aria-pressed="${isFav}" aria-label="${isFav ? "Remove " + esc(s.name) + " from favorites" : "Add " + esc(s.name) + " to favorites"}">${I.star}</button>
      </div>
      ${open ? detail(app, s, d.species === s.name ? choicesFor() : "") : ""}
    </div>`;
  }
  return html;
}
