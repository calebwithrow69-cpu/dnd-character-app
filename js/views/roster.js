import { esc } from "../ui.js";
import { listCharacters } from "../store.js";
import { emblem, emblemFor } from "../emblems.js";
import { glance, PLUS } from "./home.js";
const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';

export function renderRoster(app) {
  const all = listCharacters(), chars = all.filter(c => !c.dead), fallen = all.length - chars.length;
  const seedAvailable = app.seedGandork && !all.some(c => c.id === app.seedGandork.id);
  const cards = chars.map(r => {
    const g = glance(app, r.id), c = g.c, pct = g.max ? Math.max(0, Math.min(100, Math.round(100 * g.hp / g.max))) : 0;
    const e = emblemFor("class", c.class);
    return `<button class="ccard rosteritem press" data-a="openChar" data-id="${esc(r.id)}" aria-label="${esc(c.name || "Unnamed")}">
      <span class="cband" style="--eh:${e.hue}">${emblem("class", c.class)}</span>
      <span class="cbody"><h3>${esc(c.name || "Unnamed")}</h3>
        <span class="cl">${esc([`Level ${c.level || 1}`, c.species, c.class].filter(Boolean).join(" "))}</span>
        <span class="cbar"><i class="${pct < 30 ? "low" : ""}" style="width:${pct}%"></i></span>
        <span class="cbl"><span>HP</span><span>${esc(g.hp)}/${esc(g.max)}</span></span>
        <span class="cchips"><div><b>${esc(g.ac)}</b><small>AC</small></div><div><b>${esc(g.speed)}</b><small>SPEED</small></div><div><b>+${g.prof}</b><small>PROF</small></div></span>
        <span class="copen">OPEN SHEET</span></span></button>`;
  }).join("");
  const add = `<button class="ccard new press" data-a="newChar">${PLUS}NEW CHARACTER</button>`;
  return `<main class="rs" aria-label="Characters">
    <header class="hh"><button class="ibtn2" data-a="goHome" aria-label="Back">${BACK}</button><h1 class="hh-t">CHARACTERS</h1><button class="ibtn2" data-a="newChar" aria-label="New character">${PLUS}</button></header>
    ${app.needsNewPassword ? `<div class="rs-note"><button class="hwarn" data-a="enterNewPassword">New rules are waiting. Enter the new password.</button></div>` : ""}
    <div class="deck">${cards}${add}</div>
    <div class="rs-foot">
      ${fallen ? `<button class="btn" data-a="goGraveyard">Graveyard (${fallen})</button>` : ""}
      <button class="btn" data-a="importPrompt">Restore backup</button>
      <button class="btn" data-a="rsOpen">Rulesets</button>
      <button class="btn" data-a="dmOpen">DM editor</button>
      ${seedAvailable ? `<button class="btn" data-a="importGandork">Add Gandork</button>` : ""}
    </div>
  </main>`;
}

export function renderUnlock(app) {
  return `<main class="wrap page" style="max-width:460px">
    <div style="text-align:center;margin:56px 0 18px">
      <img src="icons/icon-192.png" alt="" width="72" height="72" style="border-radius:16px">
      <h1 style="font-size:1.4rem;margin-top:14px">The Sheet</h1>
      <p class="muted" style="margin-top:6px">Group password</p>
    </div>
    <form class="panel" data-form="unlock"><div class="panel-body stack">
      <div class="field"><label for="f-pass">Group password</label>
        <input class="f" id="f-pass" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" required></div>
      ${app.unlockError ? `<p class="small" style="color:var(--red)">${esc(app.unlockError)}</p>` : ""}
      <button class="btn pri block" type="submit" ${app.unlocking ? "disabled" : ""}>${app.unlocking ? "Unlocking…" : "Unlock"}</button>
      <p class="sub2">Don't know it? Ask your DM.</p>
    </div></form>
  </main>`;
}
