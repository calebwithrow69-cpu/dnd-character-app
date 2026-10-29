// Play Mode: everything you can do this turn in one list, grouped by the kind of action
// it takes. Laptop: sections rail | list | detail panel with a roll log. Phone: one column.
// Tap a name to read it; the button on the right does it. Buttons dim when something
// is missing (the action itself, a spell slot, a use) and tapping one says why.
import { esc, ICONS, formatText } from "../ui.js";
import { playEntries, playShow, levelTrack, SOURCES } from "../play.js";
import { COST_LABEL } from "../combat.js";
import { detailFor, hotbar } from "./sheet.js";

const GROUPS = [["Action", "Action"], ["Bonus", "Bonus Action"], ["Reaction", "Reaction"], ["Other", "Other"], ["Feat", "Feats"], ["Passive", "Passive"]];
const FILTERS = [["All", "All"], ["Action", "Action"], ["Bonus", "Bonus Action"], ["Reaction", "Reaction"], ["Avail", "Available"]];
const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
const CHECK = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function typeIcon(e) {
  if (e.type === "attack") return e.id === "x:swap" ? ICONS.dice : ICONS.sword;
  if (e.type === "spell") return e.level ? ICONS.spell : ICONS.bolt;
  if (e.type === "item") return e.src === "Scroll" ? ICONS.scroll : ICONS.flask;
  if (e.type === "std") return ICONS.flag;
  if (e.type === "feat") return ICONS.book;
  return ICONS.star;
}
const TYPE_WORD = { attack: "Attack", spell: "Spell", feature: "Feature", feat: "Feat", item: "Item", std: "Standard action" };

function caption(e) {
  if (e.type === "attack") return e.src === "Attack" ? (e.id === "x:swap" ? "Weapon" : "Attack") : e.src;
  if (e.type === "spell") return (e.level ? ORD[e.level] + " level" : "Cantrip") + (e.conc ? " · Conc." : "");
  if (e.type === "item") return e.src;
  if (e.type === "std") return "Standard action";
  if (e.type === "feat") return "Feat";
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
const verb = e => e.type === "attack" ? (e.id === "x:swap" ? "Swap" : "Attack") : e.type === "spell" ? "Cast" : "Use";

function row(e, d, c, ctx, kid) {
  const active = ctx.on.has(e.id), dim = !!e.block && !active, sel = ctx.sel === e.id;
  const st = status(e, d, c), open = ctx.open.has(e.id), kids = e.kids || [];
  const toggle = e.type === "feature" && e.cost !== "Passive" && !e.spell && e.kind === "Ability"
    ? `<button class="r-tg ${active ? "on" : ""}" data-a="playToggle" data-id="${esc(e.id)}" aria-pressed="${active}" aria-label="${active ? "Turn off" : "Turn on"} ${esc(e.name)}" title="${active ? "Turn off" : "Turn on"}">${ICONS.power}</button>` : "";
  const go = e.type === "feat"
    ? (kids.length ? `<button class="btn sm r-go" data-a="playFeat" data-id="${esc(e.id)}" aria-expanded="${open}">${open ? "Hide" : "Abilities"}</button>` : "")
    : e.cost === "Passive" ? ""
    : `<button class="btn sm ${dim ? "" : "pri"} r-go ${dim ? "dim" : ""}" data-a="playUse" data-id="${esc(e.id)}" ${dim ? `aria-disabled="true" aria-label="${esc(verb(e))} ${esc(e.name)}, unavailable: ${esc(e.block)}"` : `aria-label="${esc(verb(e))} ${esc(e.name)}"`}>${active ? "Active" : verb(e)}</button>`;
  const html = `<div class="row ${e.cost.toLowerCase()} t-${e.type} ${dim ? "off" : ""} ${active ? "fxon" : ""} ${sel ? "sel" : ""} ${kid ? "kid" : ""}" data-row="${esc(e.id)}" data-cost="${e.cost}">
    <button class="r-main" data-a="playSel" data-id="${esc(e.id)}" aria-label="${esc(e.name)}, ${COST_LABEL[e.cost] || e.cost}, ${TYPE_WORD[e.type] || "Feature"}${dim ? ", unavailable: " + esc(e.block) : ""}">
      <span class="r-ic" aria-hidden="true">${typeIcon(e)}</span>
      <span class="nmw"><h4>${esc(e.name)}</h4><span class="cap">${esc(caption(e))}</span></span>
      ${e.sub ? `<span class="sm">${esc(e.sub)}</span>` : `<span class="sm"></span>`}
      <span class="st">${st}</span>
    </button><span class="go">${toggle}${go}</span>
    ${dim ? `<span class="why">${esc(e.block)}</span>` : ""}</div>`;
  if (e.type === "feat" && open && kids.length) return html + `<div class="kids">${kids.map(k => row(k, d, c, ctx, true)).join("")}</div>`;
  return html;
}

// Death saves live here now that the old Combat tab is gone: they appear whenever you are at 0 HP.
function deathPanel(c) {
  const pips = (n, kind, cls) => Array.from({ length: 3 }, (_, i) =>
    `<button class="pip ${cls} ${i < n ? "" : "used"}" data-a="deathSave" data-kind="${kind}" data-i="${i}" aria-label="${kind} ${i + 1}"><i></i></button>`).join("");
  return `<div class="panel" style="margin:10px 0"><div class="panel-head"><h2>Death saves</h2><span class="sub2">You are at 0 HP</span></div><div class="panel-body">
    <div class="rowline"><span class="nm">Successes</span><span class="pips">${pips(c.deathSaves.success, "success", "ok")}</span></div>
    <div class="rowline"><span class="nm">Failures</span><span class="pips">${pips(c.deathSaves.fail, "fail", "fail")}</span></div>
    <button class="btn pri block" data-a="rollDeathSave" ${c.deathSaves.fail >= 3 || c.deathSaves.success >= 3 ? "disabled" : ""}>Roll death save</button>
    <p class="small muted" style="margin-top:8px">You can't take actions or reactions. Damage at 0 HP adds a failure automatically. Healing brings you back.</p></div></div>`;
}
// Great Weapon Master: shown only when it applies (feat taken and a Heavy weapon in the bag).
function gwmRow(app, c) {
  if (!c.feats.includes("Great Weapon Master") || !c.inventory.some(i => /heavy/i.test((i.weapon && i.weapon.props) || ""))) return "";
  return `<div class="panel" style="margin:10px 0"><div class="panel-body" style="padding:0 14px"><div class="setrow"><div class="setinfo"><div class="setlabel">Great Weapon Master</div><div class="sethint">On: Heavy weapon attacks add your Proficiency Bonus to damage.</div></div>
    <button class="switch" role="switch" aria-checked="${app.gwm ? "true" : "false"}" aria-label="Great Weapon Master" data-a="togglePref" data-k="gwm"><i></i></button></div></div></div>`;
}

function slotsRail(c, d) {
  const info = d.spellInfo;
  const slots = info && info.slots.length ? `<section><h3>Spell slots</h3><div class="res">${info.slots.map(r => {
    const used = c.spellcasting.slotsUsed[r.level - 1] || 0, left = r.max - used;
    return `<div class="r"><div class="n"><span>${r.pact ? "Pact " + ORD[r.level] : ORD[r.level]}</span><b>${left}/${r.max}</b></div><div class="pips">${Array.from({ length: r.max }, (_, i) =>
      `<button class="pip ${i < left ? "" : "used"}" data-a="toggleSlot" data-lvl="${r.level}" data-i="${i}" data-max="${r.max}" aria-label="${ORD[r.level]} level slot ${i + 1}, ${i < left ? "available" : "used"}"></button>`).join("")}</div></div>`;
  }).join("")}</div></section>` : "";
  const res = (c.resources || []).length ? `<section><h3>Trackers</h3><div class="res">${c.resources.map((r, i) => `<div class="r"><div class="n"><span>${esc(r.name)}</span><b>${r.max - r.used}/${r.max}</b></div>${r.max <= 8
    ? `<div class="pips">${Array.from({ length: r.max }, (_, k) => `<button class="pip ${k < r.max - r.used ? "" : "used"}" data-a="toggleResource" data-i="${i}" data-k="${k}" aria-label="${esc(r.name)} ${k + 1}, ${k < r.max - r.used ? "available" : "used"}"></button>`).join("")}</div>`
    : `<span class="stepper"><button data-a="resStep" data-i="${i}" data-n="1" aria-label="Use one">−</button><b>${r.max - r.used}</b><button data-a="resStep" data-i="${i}" data-n="-1" aria-label="Regain one">+</button></span>`}</div>`).join("")}</div></section>` : "";
  return slots + res;
}

function trackHtml(app, c) {
  const trk = levelTrack(app, c), cur = app.playLv || c.level, node = trk.find(t => t.lv === cur) || trk[0];
  const tp = Math.max(0, Math.min(1, (c.level - 1) / (trk.length - 1)));
  const tip = t => `<span class="tip"><b>Level ${t.lv}</b>${t.features.length ? t.features.map(f => esc(f.name)).join(", ") + "<br>" : ""}${t.extra.slice(0, 4).map(esc).join("<br>")}</span>`;
  return `<div class="trackwrap"><div class="track" style="--tp:${tp};--n:${trk.length}" role="group" aria-label="Level progression">${trk.map(t => `<button class="tn ${t.lv <= c.level ? "done" : ""} ${t.lv === c.level ? "cur" : ""}" data-a="playLv" data-lv="${t.lv}" aria-pressed="${t.lv === cur}" aria-label="Level ${t.lv}, ${t.features.length} feature${t.features.length === 1 ? "" : "s"}${t.pbUp ? ", proficiency bonus increases" : ""}${t.spellUp ? ", new spell options" : ""}${t.lv > c.level ? ", not reached" : ""}"><span class="d">${t.lv}</span><span class="c">${t.features.length || "\u2013"}</span><span class="mk">${t.pbUp ? "<i class=\"p\">P</i>" : ""}${t.spellUp ? "<i class=\"s\">\u2726</i>" : ""}</span>${tip(t)}</button>`).join("")}</div></div>
    <div class="trk-read"><b>Level ${node.lv}</b> <span class="sub2">${node.lv > c.level ? "Unlocks at this level" : "Reached"} \u00b7 numbers under each level are features, <b>P</b> = proficiency bonus goes up, \u2726 = new spell options</span>
      <ul class="trk-ex">${node.extra.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="chips" style="margin:6px 0 0">${node.features.map(f => `<button class="chip ptrk-f ${node.lv > c.level ? "locked" : ""}" data-a="showDetail" data-kind="${f.kind}" data-name="${esc(f.name)}" data-from="${esc(f.from)}">${esc(f.name)}</button>`).join("") || `<span class="sub2">No new class features at this level.</span>`}</div></div>`;
}

function sideHtml(app, c, d, e) {
  const log = (app.history || []).slice(0, 6).map(h => `<li><b>${esc(h.title)}</b><span>${esc(h.summary)}</span></li>`).join("") || `<li class="none">No rolls yet.</li>`;
  let body = `<p class="sub2" style="padding:20px 0">Select an entry to read it here.</p>`;
  if (e) {
    const active = (c.active || []).some(a => a.id === e.id), dim = !!e.block && !active;
    const text = e.detail && e.detail.kind ? detailFor(app, e.detail.kind, e.detail.name, null, e.detail.from).body : formatText(e.text || "");
    const st = status(e, d, c);
    const act = e.type === "feat" || e.cost === "Passive" ? "" : `<button class="btn lg ${dim ? "" : "pri"} ${dim ? "dim" : ""}" data-a="playUse" data-id="${esc(e.id)}" ${dim ? 'aria-disabled="true"' : ""}>${active ? "Turn off" : verb(e)}</button>`;
    const kids = (e.kids || []).map(k => `<div class="opt"><b>${esc(k.name)}</b><p>${esc(k.sub || "")}</p>${k.cost !== "Passive" ? `<button class="btn sm ${k.block ? "dim" : ""}" data-a="playUse" data-id="${esc(k.id)}" ${k.block ? 'aria-disabled="true"' : ""}>${verb(k)}</button>` : ""}</div>`).join("");
    body = `<div class="kick">${esc(caption(e))} · <span class="tagc">${esc(COST_LABEL[e.cost] || e.cost)}</span></div><h2>${esc(e.name)}</h2>
      ${(st || act) ? `<div class="usebox"><div>${st ? `<span class="sub2">Available</span><b class="num">${st}</b>` : ""}</div>${act}</div>` : ""}
      ${dim ? `<div class="tilewhy" role="note"><b>Can't use this right now</b><span>${esc(e.block)}</span></div>` : ""}
      ${kids ? `<div class="kidlist">${kids}</div>` : ""}
      <div class="stext">${text}</div>`;
  }
  return `<aside class="pm-side" aria-label="Details"><div class="det">${body}</div><div class="rlog"><h3>Roll log</h3><ul>${log}</ul></div></aside>`;
}

const KEYS = [["/", "Search"], ["J", "K", "Move"], ["Enter", "Use or activate"], ["N", "Next turn"], ["1", "2", "3", "Mark Action, Bonus Action, Reaction spent"]];
function keysBar() {
  return `<div class="pm-keys" aria-label="Keyboard shortcuts">${KEYS.map(k => `<span>${k.slice(0, -1).map(x => `<kbd>${x}</kbd>`).join("")} ${k[k.length - 1]}</span>`).join("")}</div>`;
}

export function playTab(app, c, d) {
  const show = playShow(app), filter = app.playFilter || "All", q = (app.playQ || "").trim().toLowerCase();
  const onIds = new Set((c.active || []).map(a => a.id));
  const all = playEntries(app, c, d);
  const inShow = e => show[e.type === "std" ? "std" : e.type === "feat" ? "feat" : e.type];
  const pool = all.filter(inShow);
  const matches = e => (filter === "All" || (filter === "Avail" ? (!e.block && e.cost !== "Passive") : e.cost === filter))
    && (!q || (e.name + " " + (e.sub || "") + " " + e.src).toLowerCase().includes(q) || (e.kids || []).some(k => k.name.toLowerCase().includes(q)));
  const shown = pool.filter(matches);
  const count = k => pool.filter(e => k === "All" ? true : k === "Avail" ? (!e.block && e.cost !== "Passive") : e.cost === k).length;
  const rank = { attack: 0, spell: 1, feature: 2, feat: 3, item: 4, std: 5 };
  const order = (a, b) => (onIds.has(b.id) - onIds.has(a.id)) || (!!a.block - !!b.block) || ((rank[a.type] || 0) - (rank[b.type] || 0)) || (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name);
  const open = new Set(app.playFeatOpen || []);
  const passiveOpen = !!app.playPassive || filter === "Passive" || !!q;
  const flat = [];
  const ctxFor = sel => ({ on: onIds, sel, open });
  // selection: the chosen row if it is still visible, else the first available one
  const vis = GROUPS.flatMap(([k]) => shown.filter(e => e.cost === k).sort(order).flatMap(e => k === "Passive" && !passiveOpen ? [] : [e, ...(open.has(e.id) ? e.kids || [] : [])]));
  const selId = vis.some(e => e.id === app.playSel) ? app.playSel : (vis.find(e => !e.block && e.cost !== "Passive") || vis[0] || {}).id;
  const selE = vis.find(e => e.id === selId) || null;
  const ctx = ctxFor(selId);
  const groups = GROUPS.map(([k, label]) => {
    const list = shown.filter(e => e.cost === k).sort(order);
    if (!list.length) return "";
    flat.push([k, label, list.length]);
    const head = k === "Passive"
      ? `<button class="gh tg" id="pg-${k}" data-a="playPassive" aria-expanded="${passiveOpen}"><span>${label}</span><span class="ct">${list.length}</span></button>`
      : `<div class="gh" id="pg-${k}"><span>${label}</span><span class="ct">${list.length}</span></div>`;
    return `<section class="pgrp ${k.toLowerCase()}">${head}${k === "Passive" && !passiveOpen ? "" : list.map(e => row(e, d, c, ctx)).join("")}</section>`;
  }).join("");
  const dying = c.hp.cur <= 0, t = app.turn;
  const tk = (k, label, col) => `<button class="tk" style="--c:var(${col})" data-a="turnPip" data-k="${k}" aria-pressed="${!!t.spent[k]}" aria-label="${label} ${t.spent[k] ? "used" : "available"}"><i></i>${label}</button>`;
  const tracker = t.on
    ? `<div class="tracker" role="group" aria-label="This turn">${tk("Action", "Action", "--amber")}${tk("Bonus", "Bonus Action", "--green")}${tk("Reaction", "Reaction", "--blue")}
        <button class="tk next" data-a="turnNext">${t.round ? "Next turn" : "Start combat"}</button>${t.round ? `<button class="tk" data-a="turnEnd">End</button><span class="rnd">Round <b>${t.round}</b></span>` : ""}</div>`
    : `<div class="tracker"><span class="sub2">Turn tracker is off, so Action, Bonus Action and Reaction won't dim.</span><button class="tk next" data-a="togglePref" data-k="turns">Turn it on</button></div>`;
  const keys = app.prefs.keys !== false;
  const nav = flat.map(([k, label, n]) => `<button data-a="playJump" data-g="${k}"><span>${label}</span><b>${n}</b></button>`).join("");
  return `<div class="pm ${keys ? "withkeys" : ""}">
    <div class="pm-cmd">
      <div class="r">${tracker}
        <label class="srch"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg><input id="pm-q" type="search" placeholder="Search" aria-label="Search abilities" value="${esc(app.playQ || "")}" autocomplete="off"><kbd>/</kbd></label></div>
      <div class="r"><span class="lab">Show</span>${SOURCES.map(([k, l]) => `<button class="src" data-a="playShow" data-k="${k}" role="checkbox" aria-checked="${show[k]}" aria-pressed="${show[k]}"><span class="bx">${CHECK}</span>${l} <b>${all.filter(e => (e.type === "std" ? "std" : e.type) === k).length}</b></button>`).join("")}
        <span class="sep"></span><span class="lab">Filter</span><div class="fchips" role="group" aria-label="Filter by action type">${FILTERS.map(([k, l]) => `<button class="fc" data-a="playFilter" data-k="${k}" aria-pressed="${filter === k}">${l} <b>${count(k)}</b></button>`).join("")}</div></div>
    </div>
    ${dying ? deathPanel(c) : ""}
    ${hotbar(app, c, d)}
    ${gwmRow(app, c)}
    <div class="pm-main">
      <aside class="pm-rail" aria-label="Sections"><section><h3>Sections</h3><nav class="nav">${nav}</nav></section>${slotsRail(c, d)}</aside>
      <div class="pm-list">
        <div class="pm-slots">${slotsRail(c, d)}</div>
        ${show.feature ? trackHtml(app, c) : ""}
        ${groups || `<p class="muted small" style="padding:18px 0">Nothing matches. <button class="linkbtn" data-a="playClear">Reset filters</button></p>`}
        <p class="sub2" style="margin:12px 0">Tap a name to read it. Dimmed buttons can't be used right now; tap one to see why. Action types are the app's reading of the rules text.</p>
      </div>
      ${sideHtml(app, c, d, selE)}
    </div>
    ${keys ? keysBar() : ""}
  </div>`;
}
