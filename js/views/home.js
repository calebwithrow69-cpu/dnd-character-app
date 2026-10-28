// Home: the closed Tome, a Continue button, and Characters / Rules / Settings.
// Continue plays the book-opening scene (cover swings open, a leaf turns, the camera pushes into the
// character's page) and then hands over to the sheet. The art is drawn here, nothing is downloaded.
// ASCII only.
import { esc, topbar } from "../ui.js";
import { deriveCharacter } from "../rules.js";
import { listCharacters, getCharacter, normalize } from "../store.js";
import { rulesTab } from "./sheet.js";

const W = 266, H = 360;
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

function coverSvg() {
  return `<svg class="tcover" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
<defs><linearGradient id="tleather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A2A1C"/><stop offset=".5" stop-color="#341C13"/><stop offset="1" stop-color="#22120C"/></linearGradient></defs>
<rect width="${W}" height="${H}" rx="10" fill="url(#tleather)" stroke="#5A4730" stroke-width="2"/>
<rect width="24" height="${H}" rx="10" fill="#1A0E09"/><path d="M24 0V${H}" stroke="#0B0807" stroke-width="2"/>
<rect x="18" y="18" width="230" height="324" rx="4" fill="none" stroke="#C9A24B" stroke-width="1.5"/>
<rect x="24" y="24" width="218" height="312" rx="2" fill="none" stroke="#C9A24B" stroke-opacity=".5"/>
<g fill="#C9A24B"><circle cx="24" cy="24" r="4"/><circle cx="242" cy="24" r="4"/><circle cx="24" cy="336" r="4"/><circle cx="242" cy="336" r="4"/></g>
<g transform="translate(133 154)" fill="none" stroke="#C9A24B" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
<path d="M0 -78 L68 -40 L68 40 L0 78 L-68 40 L-68 -40Z"/><path d="M0 -78 L0 -34 M68 -40 L30 -17 M68 40 L30 17 M0 78 L0 34 M-68 40 L-30 17 M-68 -40 L-30 -17"/><path d="M0 -34 L30 17 L-30 17Z"/></g>
<text x="133" y="163" text-anchor="middle" font-family="Cinzel, serif" font-weight="700" font-size="17" fill="#C9A24B">20</text>
<text x="133" y="276" text-anchor="middle" font-family="Cinzel, serif" font-weight="700" font-size="22" letter-spacing="3" fill="#C9A24B">CHARACTER</text>
<text x="133" y="302" text-anchor="middle" font-family="Cinzel, serif" font-weight="700" font-size="22" letter-spacing="3" fill="#C9A24B">RUNNER</text>
<path d="M68 316 H198" stroke="#C9A24B" stroke-opacity=".6"/>
<path d="M214 336 L214 382 L226 368 L238 382 L238 336Z" fill="#7E2A22" transform="translate(0 -26)"/>
</svg>`;
}

export function renderHome(app) {
  const last = lastCharacter(app), n = listCharacters().length;
  return `<main class="home" aria-label="Home">
    <h1 class="sr">Character Runner</h1>
    <div class="home-slot"><button class="home-book" id="home-book" data-a="homeContinue" aria-label="${last ? "Open " + esc(last.name) : "Make a character"}">${coverSvg()}</button></div>
    <div class="home-bottom">
      ${app.needsNewPassword ? `<button class="hbtn warn" data-a="enterNewPassword">New rules are waiting. Tap to enter the new password.</button>` : ""}
      ${last
        ? `<button class="hbtn pri" data-a="homeContinue"><span class="grow"><small>CONTINUE</small><b>${esc(last.name || "Unnamed")}</b></span>${ic("arrow", 22)}</button>`
        : `<button class="hbtn pri" data-a="newChar"><span class="grow"><small>START</small><b>Make your first character</b></span>${ic("arrow", 22)}</button>`}
      <div class="htiles">
        <button class="htile" data-a="goRoster">${ic("people")}<span>Characters</span>${n ? `<em>${n}</em>` : ""}</button>
        <button class="htile" data-a="goRules">${ic("book")}<span>Rules</span></button>
        <button class="htile" data-a="openSettings">${ic("gear")}<span>Settings</span></button>
      </div>
    </div>
  </main>`;
}

export function renderRulesPage(app) {
  return `${topbar("Rules glossary", app.campaign?.name || "", { back: "goHome" })}
    <main class="wrap page">${rulesTab(app)}</main>`;
}

function pageHtml(c) {
  const d = deriveCharacter(c);
  const line = `Level ${c.level} ${c.species || ""} ${c.class || ""}`.replace(/\s+/g, " ").trim();
  return `<div class="tp-in">
    <div class="tp-med">${esc((c.name || "?").trim()[0] || "?")}</div>
    <div class="tp-name">${esc(c.name || "Unnamed")}</div>
    <div class="tp-line">${esc(line)}</div>${c.subclass ? `<div class="tp-line">${esc(c.subclass)}</div>` : ""}
    <div class="tp-rule"></div>
    <div class="tp-stats"><div><b>${esc(c.hp ? c.hp.max : "")}</b><span>HP</span></div><div><b>${d.ac}</b><span>AC</span></div><div><b>${esc(c.speed || "")}</b><span>Speed</span></div></div>
  </div>`;
}

// Plays the opening. onSwap() is called when the page fills the screen: put the sheet on screen then.
export function playTomeOpen(rawChar, library, onSwap) {
  const src = document.getElementById("home-book");
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!src || reduce || !document.body.animate) { onSwap(); return Promise.resolve(); }
  const c = normalize(rawChar, library);
  const vw = innerWidth, vh = innerHeight;
  const r = src.getBoundingClientRect();
  const k = r.width / W, dx = r.left + r.width / 2 - vw / 2, dy = r.top + r.height / 2 - vh / 2;
  const f = Math.min(1, (vw * 0.94) / (W * 2));
  const S = 1.02 * Math.max(vw / (W * f), vh / (H * f));
  const home = document.querySelector(".home");
  const ov = document.createElement("div");
  ov.className = "tome-anim";
  ov.innerHTML = `<div class="tome-cam"><div class="tome-shift"><div class="tome-book">
      <div class="tpage">${pageHtml(c)}</div>
      <div class="tleaf flip"><div class="tface tpaper"><div class="tp-lines"></div></div><div class="tface back tpaper"><div class="tp-lines"></div></div></div>
      <div class="tleaf cover"><div class="tface">${coverSvg()}</div><div class="tface back tend"><div class="tend-in"></div></div></div>
    </div></div></div><button class="tome-skip" aria-label="Skip">Skip</button>`;
  document.body.appendChild(ov);
  src.style.visibility = "hidden";
  if (home) home.classList.add("leaving");
  const cam = ov.querySelector(".tome-cam"), shift = ov.querySelector(".tome-shift");
  const cover = ov.querySelector(".cover"), flip = ov.querySelector(".flip");
  const ease = "cubic-bezier(.45,.05,.25,1)";
  const T = 1250, Z = 950;
  const opts = (dur, delay = 0) => ({ duration: dur, delay, easing: ease, fill: "forwards" });
  shift.animate([{ transform: `translate(${dx}px,${dy}px) rotate(-3deg) scale(${k})` }, { transform: `translate(${W / 2 * f}px,0) rotate(0deg) scale(${f})` }], opts(T));
  cover.animate([{ transform: "translateZ(8px) rotateY(0deg)" }, { transform: "translateZ(2px) rotateY(-178deg)" }], opts(T));
  flip.animate([{ transform: "translateZ(4px) rotateY(0deg)" }, { transform: "translateZ(10px) rotateY(-172deg)" }], opts(T - 250, 420));
  const camAnim = cam.animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${-W / 2 * f * S}px,0) scale(${S})` }], opts(Z, T + 150));
  return new Promise(res => {
    let done = false;
    const finish = () => { if (done) return; done = true;
      onSwap();
      ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: "ease-out", fill: "forwards" }).onfinish = () => { ov.remove(); res(); };
    };
    camAnim.onfinish = finish;
    ov.querySelector(".tome-skip").addEventListener("click", finish);
    setTimeout(finish, T + Z + 900); // safety net
  });
}
