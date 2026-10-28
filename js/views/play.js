// Play Mode: one list of everything you can do this turn, from every source, grouped
// by the kind of action it takes. Tap a row to read it; the button on the right does
// it. Buttons dim when something is missing (the action itself, a spell slot, a use).
import { esc, ICONS, turnBar } from "../ui.js";
import { playEntries, playShow, levelTrack, SOURCES } from "../play.js";
import { COST_LABEL } from "../combat.js";

const GROUPS = [["Action", "Action"], ["Bonus", "Bonus Action"], ["Reaction", "Reaction"], ["Other", "Other"], ["Passive", "Passive"]];
const FILTERS = [["All", "All"], ["Action", "Action"], ["Bonus", "Bonus Action"], ["Reaction", "Reaction"], ["Avail", "Available"]];
const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

function typeIcon(e) {
  if (e.type === "attack") return ICONS.sword;
  if (e.type === "spell") return e.level ? ICONS.spell : ICONS.bolt;
  if (e.type === "item") return e.src === "Scroll" ? ICONS.scroll : ICONS.flask;
  if (e.type === "std") return ICONS.flag;
  return ICONS.star;
}
const TYPE_WORD = { attack: "Attack", spell: "Spell", feature: "Feature", item: "Item", std: "Standard action" };

function caption(e) {
  if (e.type === "attack") return "Attack" + (e.note ? " · " + e.note : "");
  if (e.type === "spell") return (e.level ? ORD[e.level] + "-level spell" : "Cantrip") + (e.conc ? " · Concentration" : "");
  if (e.type === "item") return e.src;
  if (e.type === "std") return "Standard action";
  const m = /^(.*) (\d+)$/.exec(e.src || "");
  return m ? `${m[1]} · Lv ${m[2]}` : (e.src || "Feature");
}

function status(e, d, c) {
  if (e.res) return e.res.max != null ? `${e.res.cur}/${e.res.max}` : `${e.res.cur} ${esc(e.res.label)}`;
  if (e.type === "spell") {
    if (!e.level) return "At will";
    const info = d.spellInfo;
    if (!info) return "";
    const n = info.slots.reduce((t, r) => t + (r.level >= e.level ? Math.max(0, r.max - (c.spellcasting.slotsUsed[r.level - 1] || 0)) : 0), 0);
    return `${n} slot${n === 1 ? "" : "s"}`;
  }
  return "";
}

function verb(e) {
  if (e.type === "attack") return "Attack";
  if (e.type === "spell") return "Cast";
  return "Use";
}

function row(e, d, c, on) {
  const active = on.has(e.id), dim = !!e.block && !active;
  const st = status(e, d, c);
  const toggle = e.type === "feature" && e.cost !== "Passive" && !e.spell
    ? `<button class="p-tg ${active ? "on" : ""}" data-a="playToggle" data-id="${esc(e.id)}" aria-pressed="${active}" aria-label="${active ? "Turn off" : "Turn on"} ${esc(e.name)}" ${dim ? 'aria-disabled="true"' : ""}>${ICONS.power}</button>` : "";
  const go = e.cost === "Passive" ? ""
    : `<button class="btn sm ${dim ? "" : "pri"} p-go ${dim ? "dim" : ""}" data-a="playUse" data-id="${esc(e.id)}" ${dim ? `aria-disabled="true" aria-label="${esc(verb(e))} ${esc(e.name)}, unavailable: ${esc(e.block)}"` : `aria-label="${esc(verb(e))} ${esc(e.name)}"`}>${active ? "Active" : verb(e)}</button>`;
  return `<div class="prow ${e.cost.toLowerCase()} ${dim ? "off" : ""} ${active ? "fxon" : ""}" data-row="${esc(e.id)}">
    <button class="p-main" data-a="openTile" data-id="${esc(e.id)}" aria-label="${esc(e.name)}, ${COST_LABEL[e.cost]}, ${TYPE_WORD[e.type] || "Feature"}${dim ? ", unavailable: " + esc(e.block) : ""}">
      <span class="p-ic" aria-hidden="true">${typeIcon(e)}</span>
      <span class="p-tx"><b>${esc(e.name)}</b><small>${esc(caption(e))}</small>${dim ? `<small class="p-why">${esc(e.block)}</small>` : ""}</span>
      ${st ? `<span class="p-st">${st}</span>` : ""}
    </button>${toggle}${go}</div>`;
}

function slotsPanel(app, c, d) {
  const info = d.spellInfo;
  const slots = info && info.slots.length ? `<div class="ps-col"><h3 class="sec2">Spell slots</h3>${info.slots.map(r => {
    const used = c.spellcasting.slotsUsed[r.level - 1] || 0;
    return `<div class="ps-row"><span>${r.pact ? "Pact " + ORD[r.level] : ORD[r.level]}</span><span class="gems">${Array.from({ length: r.max }, (_, i) =>
      `<button class="pip ${i < r.max - used ? "" : "used"}" data-a="toggleSlot" data-lvl="${r.level}" data-i="${i}" data-max="${r.max}" aria-label="${ORD[r.level]} level slot ${i + 1}, ${i < r.max - used ? "available" : "used"}"><i></i></button>`).join("")}</span></div>`;
  }).join("")}</div>` : "";
  const res = (c.resources || []).length ? `<div class="ps-col"><h3 class="sec2">Trackers</h3>${c.resources.map((r, i) => `<div class="ps-row"><span>${esc(r.name)}</span>${r.max <= 8
    ? `<span class="gems">${Array.from({ length: r.max }, (_, k) => `<button class="pip ${k < r.max - r.used ? "" : "used"}" data-a="toggleResource" data-i="${i}" data-k="${k}" aria-label="${esc(r.name)} ${k + 1}"><i></i></button>`).join("")}</span>`
    : `<span class="stepper"><button data-a="resStep" data-i="${i}" data-n="1" aria-label="Use one">−</button><b>${r.max - r.used}</b><button data-a="resStep" data-i="${i}" data-n="-1" aria-label="Regain one">+</button></span>`}</div>`).join("")}</div>` : "";
  return slots || res ? `<div class="panel"><div class="panel-body pstrip">${slots}${res}</div></div>` : "";
}

function trackPanel(app, c) {
  const trk = levelTrack(app, c), cur = app.playLv || c.level, node = trk.find(t => t.lv === cur) || trk[0];
  return `<div class="panel ptrack"><div class="panel-head"><h2>Level progression</h2><span class="sub2">Tap a level</span></div><div class="panel-body">
    <div class="ptrk" role="group" aria-label="Levels">${trk.map(t => `<button class="${t.lv <= c.level ? "done" : ""} ${t.lv === c.level ? "cur" : ""}" data-a="playLv" data-lv="${t.lv}" aria-pressed="${t.lv === cur}" aria-label="Level ${t.lv}, ${t.features.length} feature${t.features.length === 1 ? "" : "s"}${t.lv > c.level ? ", not reached" : ""}"><b>${t.lv}</b><i>${t.features.length || "–"}</i></button>`).join("")}</div>
    <div class="ptrk-read"><b>Level ${node.lv}</b> <span class="sub2">${node.lv > c.level ? "Unlocks at this level" : node.features.length ? "Gained at this level" : "No new features"}</span>
      <div class="chips" style="margin:8px 0 0">${node.features.map(f => `<button class="chip ptrk-f ${node.lv > c.level ? "locked" : ""}" data-a="showDetail" data-kind="${f.kind}" data-name="${esc(f.name)}" data-from="${esc(f.from)}">${esc(f.name)}</button>`).join("") || ""}</div></div></div></div>`;
}

export function playTab(app, c, d) {
  const show = playShow(app), filter = app.playFilter || "All";
  const onIds = new Set((c.active || []).map(a => a.id));
  const all = playEntries(app, c, d).filter(e => show[e.type === "std" ? "std" : e.type]);
  const matches = e => filter === "All" ? true : filter === "Avail" ? (!e.block && e.cost !== "Passive") : e.cost === filter;
  const shown = all.filter(matches);
  const count = k => all.filter(e => k === "All" ? true : k === "Avail" ? (!e.block && e.cost !== "Passive") : e.cost === k).length;
  const rank = { attack: 0, spell: 1, feature: 2, item: 3, std: 4 };
  const order = (a, b) => (onIds.has(b.id) - onIds.has(a.id)) || (!!a.block - !!b.block) || ((rank[a.type] || 0) - (rank[b.type] || 0)) || (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name);
  const passiveOpen = !!app.playPassive || filter === "Passive";
  const groups = GROUPS.map(([k, label]) => {
    const list = shown.filter(e => e.cost === k).sort(order);
    if (!list.length) return "";
    if (k === "Passive") return `<div class="pgrp passive"><button class="pgh tg" data-a="playPassive" aria-expanded="${passiveOpen}"><span>${label}</span><span class="ct">${list.length}</span><span class="pgh-x">${passiveOpen ? "−" : "+"}</span></button>${passiveOpen ? list.map(e => row(e, d, c, onIds)).join("") : ""}</div>`;
    return `<div class="pgrp ${k.toLowerCase()}"><div class="pgh"><span>${label}</span><span class="ct">${list.length}</span></div>${list.map(e => row(e, d, c, onIds)).join("")}</div>`;
  }).join("");
  const dying = c.hp.cur <= 0;
  return `
    ${app.turn.on ? turnBar(app) : `<div class="turnbar"><span class="sub2">Turn tracker is off, so Action, Bonus Action and Reaction won't dim.</span><button class="btn sm" data-a="togglePref" data-k="turns">Turn it on</button></div>`}
    ${dying ? `<div class="tilewhy" role="note"><b>You're at 0 HP</b><span>You can't take actions or reactions. Death saves are on the Combat tab.</span></div>` : ""}
    ${slotsPanel(app, c, d)}
    <div class="pshow" role="group" aria-label="Show in the list"><span class="sub2">Show</span>${SOURCES.map(([k, l]) => `<button class="pchk" data-a="playShow" data-k="${k}" role="checkbox" aria-checked="${show[k]}"><i>${ICONS.check || ""}</i>${l}<span>${all.length >= 0 ? (k === "std" ? 15 : playEntries(app, c, d).filter(e => e.type === k).length) : ""}</span></button>`).join("")}</div>
    ${show.feature ? trackPanel(app, c) : ""}
    <div class="pfilter" role="group" aria-label="Filter by action type">${FILTERS.map(([k, l]) => `<button data-a="playFilter" data-k="${k}" aria-pressed="${filter === k}">${l}<span>${count(k)}</span></button>`).join("")}</div>
    ${groups || `<p class="muted small" style="padding:18px 0">Nothing matches. <button class="linkbtn" data-a="playFilter" data-k="All">Show everything</button></p>`}
    <p class="sub2" style="margin-top:12px">Tap a name to read it. Dimmed buttons can't be used right now; tap one to see why. Action types are the app's reading of the rules text.</p>`;
}
