// Subclass choice: a list (stat chips, level strip, one recommendation from the character's scores) and a plain
// detail page with the full level template. Rules text is shown exactly as written; seal and colour come from
// the subclass's tone (js/subtone.js). Slots the class expects but the subclass lacks are shown as empty.
import { esc, formatText, ICONS } from "../ui.js";
import { subclassesFor } from "../data.js";
import { toneFor } from "../subtone.js";
import { assess, template, abShort, abLong } from "../subclassinfo.js";

const classOf = app => app.library.classes.find(x => x.name === app.char.class);
// Recommendation and stat needs for the subclasses on offer, from the character's current scores.
export function subInfo(app) {
  const subs = subclassesFor(app.library, app.char.class);
  return assess(subs, classOf(app), app.char.abilities);
}
// The recommended one first, then by name.
export function subList(app) {
  const info = subInfo(app);
  return subclassesFor(app.library, app.char.class).slice().sort((a, b) => (info.get(b.name).rec - info.get(a.name).rec) || a.name.localeCompare(b.name));
}
export function toneStyle(t) { return `--h:${t.h}`; }
export function seal(t, cls = "") {
  return `<span class="seal ${cls}" aria-hidden="true"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${t.sig}</svg></span>`;
}
function tagline(intro, name) {
  const first = String(intro?.text || "").split(/\n{2,}/)[0].trim();
  return first && first.length < 50 && !/[.!?\d]$|\d/.test(first) && !first.toLowerCase().includes(String(name).toLowerCase()) ? first : "";
}
const mod = s => { const m = Math.floor(((+s || 10) - 10) / 2); return (m >= 0 ? "+" : "") + m; };
function chips(needs, withMod = true) {
  return needs.map(n => `<span class="stchip ${n.tone}${n.off ? " off" : ""}" title="${esc(abLong(n.ab))} ${n.score}"><b>${abShort(n.ab)}</b>${n.score}${withMod ? ` <i>${mod(n.score)}</i>` : ""}</span>`).join("");
}
function strip(sc) {
  return template(sc).map(r => `<span class="lvp${r.missing ? " gap" : ""}" title="${r.missing ? "Level " + r.lv + ": not in the game yet" : "Level " + r.lv}"><i></i>${r.lv}</span>`).join("");
}

export function renderSubclassPage(app) {
  const c = app.char, d = app.lvl, m = app.modal;
  const subs = subList(app), i = Math.max(0, subs.findIndex(s => s.name === m.name));
  const sc = subs[i];
  if (!sc) return "";
  const info = subInfo(app).get(sc.name);
  const t = toneFor(sc, c.class);
  const intro = (sc.features || []).find(f => f.intro) || null;
  const tag = tagline(intro, sc.name);
  const rest0 = intro ? (tag ? String(intro.text).split(/\n{2,}/).slice(1).join("\n\n") : intro.text) : "";
  const rest = rest0.split("\n").filter(l => l.trim().toLowerCase() !== sc.name.toLowerCase() && !/^[A-Z]{2,6}$/.test(l.trim())).join("\n").replace(/^\n+/, "");
  const rows = template(sc), now = d ? d.next : 0, chosen = d && d.subclass === sc.name;
  const levels = rows.map(r => `<section class="lvgrp${r.missing ? " gap" : ""}"><h3 class="lvh"><span>Level ${r.lv}</span>${r.lv === now ? `<em>you gain these now</em>` : ""}</h3>` +
    (r.missing ? `<p class="gapnote">Not in the game yet. Tell your DM, or take a feat.</p>`
      : r.feats.map(f => `<article class="fe"><h4>${esc(f.name)}</h4>${formatText(f.text)}</article>`).join("")) + `</section>`).join("");
  return `<div class="scpage" style="${toneStyle(t)}" role="dialog" aria-modal="true" aria-label="${esc(sc.name)}" data-tex="${t.tex}">
    <div class="modal-body scscroll">
      <div class="scbar"><button class="iconbtn" data-a="closeModal" aria-label="Back to the list">${ICONS.back || "&larr;"}</button>
        <b class="scbt">${esc(sc.name)}</b>
        <span class="scnav"><button class="iconbtn" data-a="scStep" data-n="-1" aria-label="Previous subclass" ${i === 0 ? "disabled" : ""}>&lsaquo;</button><span class="sub2">${i + 1}/${subs.length}</span><button class="iconbtn" data-a="scStep" data-n="1" aria-label="Next subclass" ${i === subs.length - 1 ? "disabled" : ""}>&rsaquo;</button></span></div>
      <header class="schead">${seal(t)}
        <div><p class="kick">${esc(c.class)} subclass</p><h2>${esc(sc.name)}</h2>${tag ? `<p class="tagl">${esc(tag)}</p>` : ""}</div>
        ${info.rec ? `<span class="tag amber">Recommended</span>` : ""}</header>
      <div class="scbody">
        ${`<div class="scstats" aria-label="Ability score needed"><span class="lab">Ability score needed</span>${info.needs.length ? chips(info.needs) : `<span class="sub2">None</span>`}${info.needs.some(n => n.off) ? `<span class="tag">Not a ${esc(c.class)} stat</span>` : ""}</div>`}
        <div class="scstats" aria-label="Feature levels"><span class="lab">Features at level</span><span class="lvpstrip">${strip(sc)}</span></div>
        ${rest.trim() ? `<div class="about">${formatText(rest)}</div>` : ""}
        ${levels}
        ${app.library.credits && /srd|creative commons|CC-BY/i.test(sc.source || "") ? `<p class="sub2">Contains SRD 5.2 content, CC-BY-4.0.</p>` : ""}
      </div>
    </div>
    <div class="scdock">
      <button class="btn pri pick" data-a="scPick" data-name="${esc(sc.name)}">${chosen ? "Chosen" : "Choose " + esc(sc.name)}</button></div>
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

// One row of the level-up list: seal, name, one-line pitch, stat chips and the level strip.
export function subRow(app, sc) {
  const c = app.char, d = app.lvl, t = toneFor(sc, c.class), info = subInfo(app).get(sc.name);
  const on = d.subclass === sc.name, p = pitch(sc);
  return `<button class="scrow${on ? " on" : ""}" style="${toneStyle(t)}" data-a="scOpen" data-name="${esc(sc.name)}">
    ${seal(t)}<span class="scrt"><span class="scname"><b>${esc(sc.name)}</b>${info.rec ? `<span class="tag amber">Recommended</span>` : ""}${on ? `<span class="tag">Chosen</span>` : ""}</span>
      <span class="sub2 scpitch">${esc(p || (sc.source || ""))}</span>
      <span class="scmeta"><span class="scline"><span class="lab">Ability score needed</span>${info.needs.length ? chips(info.needs, false) : `<span class="sub2">None</span>`}</span><span class="scline"><span class="lab">Features at level</span><span class="lvpstrip">${strip(sc)}</span></span></span></span></button>`;
}
