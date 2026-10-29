// The codex list: one pattern for Class, Species and Background.
// Sortable, filterable rows with a portrait thumbnail and a star. Opening a row shows the
// portrait, the key facts and every trait or ability (tap to read), then a Choose button.
// Book text is shown exactly as stored. The Trait / Ability tag and the usage line are the app's reading.
// ASCII only in this file.
import { esc, formatText } from "../ui.js";
import { portraitFor } from "../portraits.js";
import { emblem, emblemFor } from "../emblems.js";

const I = {
  chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
};

export const favKey = kind => kind === "species" ? "favSpecies" : kind === "class" ? "favClass" : "favBackground";
export const spUiDefault = () => ({
  k: { species: { sort: "az", filter: "All", open: null }, class: { sort: "az", filter: "All", open: null }, background: { sort: "az", filter: "All", open: null } },
  traits: new Set()
});
const favs = (app, kind) => app.prefs[favKey(kind)] || [];

// A saved portrait wins; otherwise the choice's own emblem (class, species and background each have a drawing).
function thumb(name, cls, kind) {
  const img = portraitFor(name);
  return img ? `<img class="${cls}" src="${img}" alt="" loading="lazy">` : `<span class="${cls} ph cx-thumb" aria-hidden="true">${emblem(kind, name)}</span>`;
}

export function renderControls(app, cfg) {
  const u = app.spUi.k[cfg.kind];
  return `<div class="sp-controls">
    <label class="sp-sel"><span>Sort by</span>
      <select class="f" data-a="cxSort" data-kind="${cfg.kind}" aria-label="Sort ${cfg.noun}">
        <option value="az" ${u.sort === "az" ? "selected" : ""}>A to Z</option>
        ${cfg.sources ? `<option value="source" ${u.sort === "source" ? "selected" : ""}>Source</option>` : ""}
        <option value="fav" ${u.sort === "fav" ? "selected" : ""}>Favorites first</option>
      </select></label>
    <label class="sp-sel"><span>${esc(cfg.filterLabel)}</span>
      <select class="f" data-a="cxFilter" data-kind="${cfg.kind}" aria-label="Filter ${cfg.noun}">
        ${cfg.filterOptions.map(o => `<option value="${esc(o)}" ${u.filter === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
      </select></label>
  </div>`;
}

function traitRow(app, o, t, kind) {
  const key = kind + ":" + o.name + ":" + t.name, open = app.spUi.traits.has(key);
  const act = t.kind === "active";
  return `<div class="sp-trait ${open ? "open" : ""} ${t.level > 1 ? "later" : ""}">
    <button class="sp-tbtn" data-a="cxTrait" data-key="${esc(key)}" aria-expanded="${open}">
      <span class="grow"><b>${esc(t.name)}</b><small>${esc(t.level > 1 ? "Level " + t.level + (act && t.usage !== "Always on" ? " · " + t.usage : "") : t.usage)}</small></span>
      <span class="flag ${act ? "act" : "pas"}">${act ? "Ability" : "Trait"}</span>
      <span class="chev">${I.chev}</span>
    </button>
    ${open ? `<div class="about">${formatText(t.body)}</div>` : ""}
  </div>`;
}
function plainRow(app, o, kind, key, title, text) {
  const k = kind + ":" + o.name + ":" + key, open = app.spUi.traits.has(k);
  return `<div class="sp-trait ${open ? "open" : ""}">
    <button class="sp-tbtn" data-a="cxTrait" data-key="${esc(k)}" aria-expanded="${open}">
      <span class="grow"><b>${esc(title)}</b></span><span class="chev">${I.chev}</span></button>
    ${open ? `<div class="about">${formatText(text)}</div>` : ""}</div>`;
}

function detail(app, cfg, o, chosenHtml) {
  const has = !!portraitFor(o.name), on = cfg.selected === o.name;
  const facts = cfg.facts(o);
  const all = cfg.traits(o);
  const now = cfg.laterCollapsed ? all.filter(t => t.level <= 1) : all;
  const later = cfg.laterCollapsed ? all.filter(t => t.level > 1) : [];
  const lk = cfg.kind + ":" + o.name + ":~later", lopen = app.spUi.traits.has(lk);
  const upload = `<label class="btn sm sp-up">${I.cam} ${has ? "Change image" : "Add image"}<input type="file" accept="image/*" data-sp-file="${esc(o.name)}" aria-label="Choose an image for ${esc(o.name)}"></label>${has ? `<button class="btn sm" data-a="cxPortraitClear" data-name="${esc(o.name)}">Remove</button>` : ""}`;
  return `<div class="sp-detail">
    <div class="chooserow top"><button class="btn pri block" data-a="cxChoose" data-kind="${cfg.kind}" data-name="${esc(o.name)}" ${on ? "disabled" : ""}>${on ? "Chosen" : "Choose " + esc(o.name)}</button></div>
    ${on && chosenHtml ? `<div class="sp-choices">${chosenHtml}</div>` : ""}
    ${has ? `<div class="sp-hero"><img src="${portraitFor(o.name)}" alt="Portrait of ${esc(o.name)}"><div class="sp-hero-act">${upload}</div></div>` : `<div class="sp-addimg cx-emhero" style="--eh:${emblemFor(cfg.kind, o.name).hue}"><span class="cx-embig">${emblem(cfg.kind, o.name, { motion: true })}</span><div class="grow">${cfg.synergy && cfg.synergy(o) ? `<p class="cx-syn"><b>For your ${esc(cfg.synergyFor || "character")}</b>${esc(cfg.synergy(o))}</p>` : ""}${upload}</div></div>`}
    ${facts.length ? `<dl class="sp-facts">${facts.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join("")}</dl>` : ""}
    <div class="sp-sechead"><h3>${esc(cfg.traitsTitle)}</h3><span class="sub2">Tap one to read it</span></div>
    <div class="sp-traits">
      ${cfg.intro(o) ? plainRow(app, o, cfg.kind, "~intro", "Overview", cfg.intro(o)) : ""}
      ${now.map(t => traitRow(app, o, t, cfg.kind)).join("")}
      ${later.length ? `<div class="sp-trait ${lopen ? "open" : ""}"><button class="sp-tbtn" data-a="cxTrait" data-key="${esc(lk)}" aria-expanded="${lopen}"><span class="grow"><b>Later levels</b><small>${later.length} more features, levels ${later[0].level} to ${later[later.length - 1].level}</small></span><span class="chev">${I.chev}</span></button>${lopen ? `<div class="sp-later">${later.map(t => traitRow(app, o, t, cfg.kind)).join("")}</div>` : ""}</div>` : ""}
      ${cfg.lore(o) ? plainRow(app, o, cfg.kind, "~lore", "About " + o.name, cfg.lore(o)) : ""}
    </div>
    ${cfg.note ? `<p class="sub2 sp-note">${cfg.note(o)}</p>` : ""}
  </div>`;
}

// cfg: { kind, noun, items, selected, query, sources, filterLabel, filterOptions, test(o, filter), sub(o),
//        facts(o), intro(o), lore(o), traits(o), traitsTitle, note(o), chosen() -> html for the picked entry }
export function renderCodexList(app, cfg) {
  const u = app.spUi.k[cfg.kind], fav = favs(app, cfg.kind);
  const q = (cfg.query || "").trim().toLowerCase();
  let items = cfg.items.filter(o => (u.filter === "All" || cfg.test(o, u.filter)) && (!q || o.name.toLowerCase().includes(q)));
  if (!items.length) return `<p class="muted small" style="padding:12px 0">Nothing matches.</p>`;
  const src = s => s || "No source";
  const by = (a, b) => a.name.localeCompare(b.name);
  const group = o => u.sort === "source" ? src(o.source) : u.sort === "fav" ? (fav.includes(o.name) ? "Favorites" : "All " + cfg.noun) : o.name[0].toUpperCase();
  items = items.sort((a, b) => {
    if (u.sort === "source") return src(a.source).localeCompare(src(b.source)) || by(a, b);
    if (u.sort === "fav") return (fav.includes(b.name) - fav.includes(a.name)) || by(a, b);
    return by(a, b);
  });
  let last = null, html = `<p class="sub2 sp-count">${items.length} ${esc(cfg.noun)}</p>`;
  for (const o of items) {
    const g = group(o);
    if (g !== last) { html += `<div class="sp-group">${esc(g)}</div>`; last = g; }
    const on = cfg.selected === o.name, open = u.open === o.name, isFav = fav.includes(o.name);
    html += `<div class="sp-row ${open ? "open" : ""} ${on ? "on" : ""}">
      <div class="sp-top">
        <button class="sp-main" data-a="cxOpen" data-kind="${cfg.kind}" data-name="${esc(o.name)}" aria-expanded="${open}">
          ${thumb(o.name, "sp-thumb", cfg.kind)}
          <span class="grow"><b>${esc(o.name)}</b><small>${esc(cfg.sub(o))}</small></span>
          ${on ? `<span class="tag amber">Chosen</span>` : ""}
          <span class="chev">${I.chev}</span>
        </button>
        <button class="sp-fav" data-pop="fav:${cfg.kind}:${esc(o.name)}" data-a="cxFav" data-kind="${cfg.kind}" data-name="${esc(o.name)}" aria-pressed="${isFav}" aria-label="${isFav ? "Remove " + esc(o.name) + " from favorites" : "Add " + esc(o.name) + " to favorites"}">${I.star}</button>
      </div>
      ${open ? detail(app, cfg, o, cfg.chosen ? cfg.chosen() : "") : ""}
    </div>`;
  }
  return html;
}
