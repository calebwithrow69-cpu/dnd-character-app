// Full-screen subclass page for the level-up choice: one scroll, every feature
// visible, nothing to expand. Rules text is shown exactly as written; the
// seal, colour and texture come from the subclass's tone (js/subtone.js).
import { esc, formatText, ICONS } from "../ui.js";
import { subclassesFor } from "../data.js";
import { toneFor } from "../subtone.js";

export function subList(app) {
  return subclassesFor(app.library, app.char.class).slice().sort((a, b) => a.name.localeCompare(b.name));
}
export function toneStyle(t) { return `--h:${t.h}`; }
export function seal(t, cls = "") {
  return `<span class="seal ${cls}" aria-hidden="true"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${t.sig}</svg></span>`;
}
function tagline(intro, name) {
  const first = String(intro?.text || "").split(/\n{2,}/)[0].trim();
  return first && first.length < 50 && !/[.!?\d]$|\d/.test(first) && !first.toLowerCase().includes(String(name).toLowerCase()) ? first : "";
}

export function renderSubclassPage(app) {
  const c = app.char, d = app.lvl, m = app.modal;
  const subs = subList(app), i = Math.max(0, subs.findIndex(s => s.name === m.name));
  const sc = subs[i];
  if (!sc) return "";
  const t = toneFor(sc, c.class);
  const intro = (sc.features || []).find(f => f.intro) || null;
  const feats = (sc.features || []).filter(f => !f.intro).slice().sort((a, b) => a.lv - b.lv);
  const tag = tagline(intro, sc.name);
  const rest = intro ? (tag ? String(intro.text).split(/\n{2,}/).slice(1).join("\n\n") : intro.text) : "";
  const levels = [...new Set(feats.map(f => f.lv))];
  const chosen = d && d.subclass === sc.name, now = d ? d.next : 0;
  const dots = levels.map(lv => `<span class="lvd${lv <= now ? " on" : ""}"><i></i>${lv}</span>`).join("");
  const byLv = levels.map(lv => `<section class="lvgrp"><h3 class="lvh"><span>Level ${lv}</span>${lv === now ? `<em>you gain these now</em>` : ""}</h3>` +
    feats.filter(f => f.lv === lv).map(f => `<article class="fe"><h4>${esc(f.name)}</h4>${formatText(f.text)}</article>`).join("") + `</section>`).join("");
  return `<div class="scpage" style="${toneStyle(t)}" role="dialog" aria-modal="true" aria-label="${esc(sc.name)}" data-tex="${t.tex}">
    <div class="modal-body scscroll">
      <div class="scbar"><button class="iconbtn" data-a="closeModal" aria-label="Back to the list">${ICONS.back || "&larr;"}</button>
        <b class="scbt">${esc(sc.name)}</b>
        <span class="scnav"><button class="iconbtn" data-a="scStep" data-n="-1" aria-label="Previous subclass" ${i === 0 ? "disabled" : ""}>&lsaquo;</button><span class="sub2">${i + 1}/${subs.length}</span><button class="iconbtn" data-a="scStep" data-n="1" aria-label="Next subclass" ${i === subs.length - 1 ? "disabled" : ""}>&rsaquo;</button></span></div>
      <header class="hero"><div class="wash" aria-hidden="true"></div>
        ${seal(t, "big")}
        <p class="kick">${esc(c.class)} subclass</p>
        <h2>${esc(sc.name)}</h2>
        ${tag ? `<p class="tagl">${esc(tag)}</p>` : ""}
        <div class="rail" aria-label="Levels with features">${dots}</div>
        <p class="sub2">${feats.length} feature${feats.length === 1 ? "" : "s"}${sc.source ? " &middot; " + esc(sc.source) : ""}</p>
      </header>
      <div class="scbody">
        ${rest.trim() ? `<div class="about">${formatText(rest)}</div>` : ""}
        ${byLv}
        ${app.library.credits && /srd|creative commons|CC-BY/i.test(sc.source || "") ? `<p class="sub2">Contains SRD 5.2 content, CC-BY-4.0.</p>` : ""}
      </div>
    </div>
    <div class="scdock"><div class="burst" aria-hidden="true"></div><span class="ring" aria-hidden="true"></span>
      <button class="btn pri pick" data-a="scPick" data-name="${esc(sc.name)}">${chosen ? "Chosen &middot; tap to undo" : "Choose " + esc(sc.name)}</button></div>
  </div>`;
}

// One short pitch of the subclass idea: the first descriptive sentence of its intro.
const SKIP = /published on|different game edition|updated by|^\s*[“"‘—-]|\bhomebrew\b|^(?:[A-Z]{2,6}|[A-Z]{2,}[:'A-Za-z0-9 ]{0,12})\s*$/i;
export function pitch(sc) {
  const intro = (sc.features || []).find(f => f.intro);
  if (!intro) return "";
  for (const line of String(intro.text || "").split("\n").map(x => x.trim())) {
    if (line.length < 50 || SKIP.test(line) || /^Level \d+:/.test(line)) continue;
    const m = /^(.+?[.!?])(?:\s|$)/.exec(line); let t = m ? m[1] : line;
    if (t.length > 120) { const cut = t.slice(0, 120), k = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(" — "), cut.lastIndexOf("; ")); t = (k > 60 ? cut.slice(0, k) : cut.replace(/\s+\S*$/, "")) + "..."; }
    return t;
  }
  return "";
}

// One row of the level-up list: seal, name, one-line pitch.
export function subRow(app, sc) {
  const c = app.char, d = app.lvl, t = toneFor(sc, c.class);
  const on = d.subclass === sc.name, p = pitch(sc);
  return `<button class="scrow${on ? " on" : ""}" style="${toneStyle(t)}" data-a="scOpen" data-name="${esc(sc.name)}">
    ${seal(t)}<span class="scrt"><b>${esc(sc.name)}</b><span class="sub2">${esc(p || (sc.source || ""))}</span></span>
    ${on ? `<span class="tag amber">Chosen</span>` : ""}</button>`;
}
