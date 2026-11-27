// Home: the last character (tap to open) and floating Characters / Rules / Settings buttons. Fits one screen. ASCII only.
import { tourCard } from "../tour.js";
import { esc, topbar, ICONS } from "../ui.js";
import { deriveCharacter } from "../rules.js";
import { listCharacters, getCharacter, normalize, saveFailed } from "../store.js";
import { rulesTab } from "./glossary.js";
import { cuPendingCount } from "./contentupdate.js";
import { safariAtRisk } from "../kv.js";
import * as dm from "../dmmode.js";
import { emblem, emblemFor } from "../emblems.js";

const ICON = {
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 5a3.5 3.5 0 010 6.5M18 14c2 .6 3.3 2.4 3.6 6"/>',
  dm: '<path d="M3 20V9l4-3 5 3 5-3 4 3v11"/><path d="M12 9v11M7 6v14M17 6v14"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  book: '<path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M8 4v13"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const ic = (k, s = 30, col = "currentColor") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

// The last character the player opened (falls back to the first one on this device).
export function lastCharacter(app) {
  const all = listCharacters().filter(c => !c.dead);
  return all.find(c => c.id === app.prefs.lastChar) || all[0] || null;
}

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export const LOGO = '<svg class="hh-logo" viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="9" fill="#5E1621" stroke="#B98A2E" stroke-width="1.5"/><g transform="translate(20 20)" fill="none" stroke="#E3BD68" stroke-width="1.4" stroke-linejoin="round"><path d="M0-13l11 6.5v13L0 13l-11-6.5v-13z"/><path d="M0-5l5 8.5h-10z"/><path d="M0-13V-5M11-6.5L5 3.5M-11-6.5L-5 3.5M0 13V8M11 6.5L5 3.5M-11 6.5L-5 3.5" opacity=".7"/></g></svg>';
export const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

// Facts shown for a character on the home hero and the character cards.
export function glance(app, rawOrId) {
  let raw = null;
  try {
    raw = typeof rawOrId === "string" ? getCharacter(rawOrId) : rawOrId;
    const c = normalize(raw, app.library), d = deriveCharacter(c);
    return { c, hp: c.hp ? c.hp.cur : 0, max: c.hp ? c.hp.max : 0, ac: d.ac, speed: d.speed != null ? d.speed : c.speed, prof: Math.ceil((c.level || 1) / 4) + 1 };
  } catch (e) { return { c: raw || {}, hp: 0, max: 0, ac: "-", speed: "-", prof: 2 }; }
}

// Characters newest-opened first (prefs.recent holds the last open time per id); the rest keep roster order.
export function recentChars(app) {
  const rec = (app.prefs && app.prefs.recent) || {};
  return listCharacters().filter(c => !c.dead).map((c, i) => ({ c, i, t: Number(rec[c.id]) || 0 })).sort((x, y) => y.t - x.t || x.i - y.i).map(x => x.c);
}
export const GRID_SEARCH_MIN = 7;
const matches = (q, ...parts) => !q || parts.join(" ").toLowerCase().includes(String(q).toLowerCase());

export function homeGrid(app) {
  const mode = app.prefs.homeMode === "dm" ? "dm" : "player", q = (app.homeQ || "").trim();
  if (mode === "dm") {
    const ix = dm.readIndex(), list = ix.list.slice().sort((a, b) => b.at - a.at).map(c => dm.campaignGlance(c)).filter(c => matches(q, c.name));
    const cards = list.map(c => `<button class="hcard camp press" data-a="homeCampOpen" data-id="${esc(c.id)}" aria-label="${esc(c.name)}">
      <span class="hc-ic">${ic("dm", 26)}</span><span class="hc-b"><b>${esc(c.name)}</b><small>${c.n} ${c.n === 1 ? "character" : "characters"}${c.round ? ` \u00b7 Round ${c.round}` : ""}</small></span></button>`).join("");
    return cards + (q ? "" : `<button class="hcard new press" data-a="homeCampNew">${PLUS}<span>New campaign</span></button>`);
  }
  const cards = recentChars(app).map(r => { const g = glance(app, r.id), c = g.c; return { r, g, c }; }).filter(x => matches(q, x.c.name, x.c.class, x.c.species)).map(({ r, g, c }) => {
    const pct = g.max ? Math.max(0, Math.min(100, Math.round(100 * g.hp / g.max))) : 0, e = emblemFor("class", c.class);
    return `<button class="hcard press" data-a="openChar" data-id="${esc(r.id)}" aria-label="${esc(c.name || "Unnamed")}">
      <span class="hc-ic" style="--eh:${e.hue}">${emblem("class", c.class)}</span><span class="hc-b"><b>${esc(c.name || "Unnamed")}</b><small>${esc([`Lv ${c.level || 1}`, c.class].filter(Boolean).join(" "))}</small>
      <span class="cbar"><i class="${pct < 30 ? "low" : ""}" style="width:${pct}%"></i></span></span></button>`;
  }).join("");
  return cards + (q || !cards ? "" : `<button class="hcard new press" data-a="newCharHome">${PLUS}<span>New character</span></button>`);
}

export function renderHome(app) {
  const mode = app.prefs.homeMode === "dm" ? "dm" : "player", last = lastCharacter(app), n = listCharacters().filter(c => !c.dead).length;
  let hero;
  if (mode === "dm") {
    const ix = dm.readIndex(), cur = ix.list.find(x => x.id === ix.active) || ix.list[0], g = dm.campaignGlance(cur);
    hero = `<button class="hero dmh press" id="home-book" data-a="homeCampContinue" aria-label="Continue ${esc(cur.name)}">
      <span class="k">LAST RUN</span><h2>${esc(cur.name)}</h2><span class="s">${g.n} ${g.n === 1 ? "character" : "characters"}${g.round ? ` \u00b7 Round ${g.round}` : ""}</span>
      <span class="hgo">CONTINUE CAMPAIGN ${ARROW}</span></button>`;
  } else if (last) {
    const g = glance(app, last.id), c = g.c;
    const line = [`Level ${c.level || 1}`, c.species, c.class].filter(Boolean).join(" ");
    hero = `<button class="hero press" id="home-book" data-a="homeContinue" aria-label="Continue as ${esc(c.name || "character")}">
      <span class="k">LAST PLAYED</span><h2>${esc(c.name || "Unnamed")}</h2><span class="s">${esc(line)}${c.subclass ? " \u00b7 " + esc(c.subclass) : ""}</span>
      <span class="hstats"><div><b>${esc(g.hp)}</b><small>HP</small></div><div><b>${esc(g.ac)}</b><small>AC</small></div><div><b>${esc(g.speed)}</b><small>SPEED</small></div><div><b>+${g.prof}</b><small>PROF</small></div></span>
      <span class="hgo">CONTINUE AS ${esc((c.name || "character").toUpperCase())} ${ARROW}</span></button>`;
  } else {
    hero = `<button class="hero press" id="home-book" data-a="newCharHome"><span class="k">START</span><h2>${listCharacters().length ? "Make a new character" : "Make your first character"}</h2><span class="hgo">NEW CHARACTER ${ARROW}</span></button>`;
  }
  const count = mode === "dm" ? dm.readIndex().list.length : n;
  const bk = app.prefs && app.prefs.lastBackup, days = bk ? Math.floor((Date.now() - bk) / 864e5) : null;
  return `<main class="home" aria-label="Home">
    <header class="hh">${LOGO}<h1 class="hh-t">THE SHEET</h1><span class="hh-r"><button class="ibtn2" data-a="helpOpen" aria-label="Help">${ICONS.help}</button></span></header>
    <div class="hh-mid">
      ${storageBanner(app)}
      ${cuPendingCount(app) && !navigator.webdriver ? `<button class="hwarn" data-a="openUpdate">${cuPendingCount(app)} rule changes</button>` : ""}
      ${app.needsNewPassword ? `<button class="hwarn" data-a="enterNewPassword">New rules are waiting. Enter the new password.</button>` : ""}
      ${tourCard("home")}
      <div class="seg hmode" role="group" aria-label="Mode"><button data-a="homeMode" data-v="player" aria-pressed="${mode === "player"}">Player</button><button data-a="homeMode" data-v="dm" aria-pressed="${mode === "dm"}">DM</button></div>
      ${hero}
      <section class="hsec" aria-label="${mode === "dm" ? "Campaigns" : "Characters"}">
        <div class="hsec-h"><h2>${mode === "dm" ? "Campaigns" : "Characters"}<em>${count}</em></h2>${mode === "player" && listCharacters().length > 0 ? `<button class="btn sm ghost" data-a="goRoster">Manage</button>` : ""}</div>
        ${count >= GRID_SEARCH_MIN ? `<input class="f hsearch" id="home-q" data-query="homeq" type="search" placeholder="${mode === "dm" ? "Search campaigns" : "Search characters"}" value="${esc(app.homeQ || "")}" autocomplete="off">` : ""}
        <div class="hgrid" id="home-grid">${homeGrid(app)}</div>
      </section>
      <section class="hparts" aria-label="Reference">
        <button class="hpart press" data-a="goRules"><span class="hp-ic">${ic("book", 28)}</span><span class="hp-b"><b>Rules</b><small>Classes, spells, items, conditions</small></span></button>
        <button class="hpart press" data-a="goNotes"><span class="hp-ic">${ic("notes", 28)}</span><span class="hp-b"><b>Notes</b><small>Yours, not tied to one character</small></span></button>
        <button class="hpart press" data-a="rsOpen"><span class="hp-ic">${ic("sliders", 28)}</span><span class="hp-b"><b>Rulesets</b><small>Content allowed: ${esc(app.campaign && app.campaign.rulesetName || "Base game")}</small></span></button>
        <button class="hpart press" data-a="openSettings"><span class="hp-ic">${ic("gear", 28)}</span><span class="hp-b"><b>Settings</b><small>Look, play, backups, about</small></span></button>
      </section>
      <div class="hbk"><span>${bk ? `Backup ${days === 0 ? "today" : days + (days === 1 ? " day ago" : " days ago")}` : "No backup yet"}</span><button class="btn sm" data-a="exportAll">Back up</button></div>
      <p class="devnote" role="note">Under development. Expect issues.</p>
    </div>
  </main>`;
}

export function renderRulesPage(app) {
  return `${topbar("Rules glossary", app.campaign?.name || "", { back: "goHome" })}
    <main class="wrap page wide">${rulesTab(app)}</main>`;
}

// Data-loss warnings for players who have characters: Safari without the install, and no recent backup.
const BACKUP_DAYS = 14;
export function storageBanner(app, { now = Date.now(), nav = navigator } = {}) {
  if (typeof window !== "undefined" && window.__memStore) return `<div class="hwarn" role="status">Storage is blocked. Nothing will be saved.</div>`;
  if (saveFailed()) return `<button class="hwarn" data-a="exportAll">Storage full. Export now</button>`;
  if (nav.webdriver || !listCharacters().some(c => !c.dead)) return "";
  const standalone = !!(nav.standalone || (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches));
  if (safariAtRisk(nav, standalone)) return `<button class="hwarn" data-a="openStorageInfo">Safari erases data. Details</button>`;
  const last = app.prefs && app.prefs.lastBackup;
  const days = app.prefs && app.prefs.backupDays != null ? parseInt(app.prefs.backupDays, 10) : BACKUP_DAYS;
  if (days === 0) return "";
  if (!last || now - last > (days || BACKUP_DAYS) * 864e5) return `<button class="hwarn" data-a="exportAll">${last ? `Last backup ${Math.floor((now - last) / 864e5)} days ago. Back up now.` : "No backup yet. Back up now."}</button>`;
  return "";
}
