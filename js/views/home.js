// Home: the last character (tap to open) and floating Characters / Rules / Settings buttons. Fits one screen. ASCII only.
import { esc, topbar } from "../ui.js";
import { deriveCharacter } from "../rules.js";
import { listCharacters, getCharacter, normalize } from "../store.js";
import { rulesTab } from "./sheet.js";

const ICON = {
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 5a3.5 3.5 0 010 6.5M18 14c2 .6 3.3 2.4 3.6 6"/>',
  book: '<path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M8 4v13"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const ic = (k, s = 30, col = "currentColor") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

// The last character the player opened (falls back to the first one on this device).
export function lastCharacter(app) {
  const all = listCharacters();
  return all.find(c => c.id === app.prefs.lastChar) || all[0] || null;
}

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export const LOGO = '<svg class="hh-logo" viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="9" fill="#5E1621" stroke="#B98A2E" stroke-width="1.5"/><g transform="translate(20 20)" fill="none" stroke="#E3BD68" stroke-width="1.4" stroke-linejoin="round"><path d="M0-13l11 6.5v13L0 13l-11-6.5v-13z"/><path d="M0-5l5 8.5h-10z"/><path d="M0-13V-5M11-6.5L5 3.5M-11-6.5L-5 3.5M0 13V8M11 6.5L5 3.5M-11 6.5L-5 3.5" opacity=".7"/></g></svg>';
export const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

// Facts shown for a character on the home hero and the character cards.
export function glance(app, rawOrId) {
  try {
    const raw = typeof rawOrId === "string" ? getCharacter(rawOrId) : rawOrId;
    const c = normalize(raw, app.library), d = deriveCharacter(c);
    return { c, hp: c.hp ? c.hp.cur : 0, max: c.hp ? c.hp.max : 0, ac: d.ac, speed: d.speed != null ? d.speed : c.speed, prof: Math.ceil((c.level || 1) / 4) + 1 };
  } catch (e) { return { c: raw || {}, hp: 0, max: 0, ac: "-", speed: "-", prof: 2 }; }
}

export function renderHome(app) {
  const last = lastCharacter(app), n = listCharacters().filter(c => !c.dead).length;
  let hero;
  if (last) {
    const g = glance(app, last.id), c = g.c;
    const line = [`Level ${c.level || 1}`, c.species, c.class].filter(Boolean).join(" ");
    hero = `<button class="hero press" id="home-book" data-a="homeContinue" aria-label="Open ${esc(c.name || "character")}">
      <span class="k">CONTINUE</span><h2>${esc(c.name || "Unnamed")}</h2><span class="s">${esc(line)}${c.subclass ? " \u00b7 " + esc(c.subclass) : ""}</span>
      <span class="hstats"><div><b>${esc(g.hp)}</b><small>HP</small></div><div><b>${esc(g.ac)}</b><small>AC</small></div><div><b>${esc(g.speed)}</b><small>SPEED</small></div><div><b>+${g.prof}</b><small>PROF</small></div></span>
      <span class="hgo">OPEN SHEET ${ARROW}</span></button>`;
  } else {
    hero = `<button class="hero press" id="home-book" data-a="newCharHome"><span class="k">START</span><h2>Make your first character</h2><span class="hgo">NEW CHARACTER ${ARROW}</span></button>`;
  }
  return `<main class="home" aria-label="Home">
    <header class="hh">${LOGO}<h1 class="hh-t">THE SHEET</h1></header>
    <div class="hh-mid">
      ${app.needsNewPassword ? `<button class="hwarn" data-a="enterNewPassword">New rules are waiting. Enter the new password.</button>` : ""}
      ${hero}
      <div class="float">
        <button class="fbtn press" data-a="goRoster">${ic("people")}CHARACTERS${n ? `<em>${n}</em>` : ""}</button>
        <button class="fbtn press" data-a="goRules">${ic("book")}RULES</button>
        <button class="fbtn press" data-a="openSettings">${ic("gear")}SETTINGS</button>
      </div>
    </div>
  </main>`;
}

export function renderRulesPage(app) {
  return `${topbar("Rules glossary", app.campaign?.name || "", { back: "goHome" })}
    <main class="wrap page">${rulesTab(app)}</main>`;
}
