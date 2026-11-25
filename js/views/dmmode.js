// DM mode. Same shell as the character sheet (tab rail on a laptop, bottom bar on a phone, a status strip under the header).
// Five tabs: Party, Combat (board, list, screen), Bestiary, Encounters, Rewards. ASCII only.
import { esc, topbar, modalShell, ICONS } from "../ui.js";
import { tourCard } from "../tour.js";
import { XP_TABLE } from "../rules.js";
import * as dm from "../dmmode.js";
import { renderDmView, renderDmBoard } from "./dmview.js";

export const dmUiDefault = () => ({ tab: "party", msg: "", confirm: "", q: "", mcr: "all", mtype: "", src: "all", limit: 40, cview: "board", add: false });
const PEOPLE = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 5a3.5 3.5 0 010 6.5M18 14c2 .6 3.3 2.4 3.6 6"/></svg>`;
export const DM_TABS = [["party", "Party", PEOPLE], ["combat", "Combat", ICONS.sword], ["bestiary", "Bestiary", ICONS.book], ["encounters", "Encounters", ICONS.flag], ["rewards", "Rewards", ICONS.coin]];
const AB_LABEL = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
const sgn = n => (n >= 0 ? "+" : "-") + Math.abs(n);
const fmt = n => Number(n).toLocaleString("en-US");

function ago(ts, now = Date.now()) {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 2) return "Just now";
  if (m < 90) return m + " min ago";
  const h = Math.round(m / 60); if (h < 36) return h + " h ago";
  return Math.round(h / 24) + " days ago";
}
const stale = ts => Date.now() - ts > 7 * 864e5;

let _confirm = "";
export const setConfirm = v => { _confirm = v || ""; };
const sure = (key, label, again = "Tap again") => (_confirm === key ? again : label);

// ------------------------------------------------------------------ the library's bestiary
const monCache = { src: null, byId: null };
export function monsterIndex(app) {
  const list = (app.library && app.library.monsters) || [];
  if (monCache.src !== list) { monCache.src = list; monCache.byId = new Map(list.map(m => [m.id, m])); }
  return monCache.byId;
}
// A monster or a creature-book entry, in one shape for the list.
function bestiary(app) {
  const s = app.dmm, out = [];
  if (s.ui.src !== "srd") s.d.creatures.forEach(c => out.push({ id: c.id, name: c.name, type: "", cr: c.cr, xp: c.xp, hp: c.hp, ac: c.ac, mine: true }));
  if (s.ui.src !== "mine") ((app.library && app.library.monsters) || []).forEach(m => out.push({ id: "m:" + m.id, name: m.name, type: m.type, size: m.size, cr: m.cr, xp: m.xp, hp: m.hp, ac: m.ac, mine: false }));
  return out;
}

// ------------------------------------------------------------------ shell
export function renderDmMode(app) {
  const s = app.dmm, ui = s.ui, d = s.d;
  if (ui.tab === "table") { ui.tab = "combat"; ui.cview = "screen"; }
  if (!DM_TABS.some(t => t[0] === ui.tab)) ui.tab = "party";
  const body = { party: partyTab, combat: combatTab, bestiary: bestiaryTab, encounters: encountersTab, rewards: rewardsTab }[ui.tab](app, s);
  const cards = Object.values(d.party), avg = cards.length ? Math.round(cards.reduce((a, c) => a + c.level, 0) / cards.length * 10) / 10 : null;
  const xp = dm.encounterXp(d);
  return `<div class="sheetview dmview">
    ${topbar(dm.readIndex().list.find(x => x.id === dm.activeId()).name, "Dungeon Master", { back: "goHome", backLabel: "Main menu", actions: [{ a: "dmCampOpen", label: "Campaigns", icon: "book" }] })}
    <main class="wrap page wide dmmode">
      <section class="status" aria-label="Table"><div class="quick">
        <div><b>${cards.length || "--"}</b><span>Characters</span></div>
        <div><b>${avg == null ? "--" : avg}</b><span>Average level</span></div>
        <div><b>${d.combat ? d.combat.round : "--"}</b><span>Round</span></div>
        <div><b>${xp ? fmt(xp) : "--"}</b><span>Encounter XP</span></div>
      </div></section>
      ${tourCard("dm")}
      ${ui.msg ? `<p class="small dmmsg" role="status">${esc(ui.msg)}</p>` : ""}
      ${body}
    </main>
    <nav class="tabs" aria-label="DM sections"><div class="in" style="grid-template-columns:repeat(${DM_TABS.length},1fr)">
      ${DM_TABS.map(([id, label, icon]) => `<button data-a="dmTab" data-v="${id}" ${ui.tab === id ? 'aria-current="page"' : ""}>${icon}<span>${label}</span>${id === "combat" && d.combat ? `<i class="newdot" aria-hidden="true"></i>` : ""}</button>`).join("")}
    </div></nav></div>`;
}

// ------------------------------------------------------------------ 1. party
function partyTab(app, s) {
  const cards = Object.values(s.d.party).sort((a, b) => a.name.localeCompare(b.name));
  const imp = `<div class="panel"><div class="panel-head"><h2>Import</h2></div><div class="panel-body stack">
      <label class="field"><span class="lab">Player codes, one per line</span><textarea class="f mono" id="dm-code" rows="3" placeholder="CRP1...." spellcheck="false"></textarea></label>
      <div class="btnrow"><button class="btn pri" data-a="dmImport">Import</button>
        <button class="btn" data-a="dmPickFile">Open file</button><input type="file" id="dm-file" accept=".json,application/json,text/plain" data-dmc-file hidden></div>
    </div></div>`;
  if (!cards.length) return `<div class="empty"><h3>No party yet</h3><p>Players send a code from Edit character.</p></div>${imp}`;
  const lv = cards.map(c => c.level);
  return `<div class="dmsum"><span><b>${cards.length}</b> ${cards.length === 1 ? "character" : "characters"}</span><span>Level <b>${Math.min(...lv)}${Math.max(...lv) !== Math.min(...lv) ? "-" + Math.max(...lv) : ""}</b></span>
      <span>Best passive Perception <b>${Math.max(...cards.map(c => c.pp))}</b></span><span>Lowest AC <b>${Math.min(...cards.map(c => c.ac))}</b></span></div>
    <div class="dmcards">${cards.map(card).join("")}</div>
    <div class="btnrow" style="margin-top:12px"><button class="btn pri" data-a="dmPartyToCombat">Start combat with party</button></div>
    ${imp}`;
}
function card(c) {
  const pct = Math.round(100 * c.cur / c.hp);
  return `<article class="panel dmcard${c.dead ? " dead" : ""}" aria-label="${esc(c.name)}">
    <div class="panel-head"><div><h2>${esc(c.name)}</h2><div class="sub2">Level ${c.level} ${esc(c.cls)}${c.sub ? ", " + esc(c.sub) : ""}${c.species ? " · " + esc(c.species) : ""}</div></div>
      <span class="sub2${stale(c.at) ? " stale" : ""}">${c.dead ? "Dead · " : ""}${ago(c.at)}</span></div>
    <div class="panel-body">
      <div class="dmstats"><div><span>AC</span><b>${c.ac}</b></div><div><span>HP</span><b>${c.cur}/${c.hp}${c.temp ? `<i>+${c.temp}</i>` : ""}</b></div>
        <div><span>Speed</span><b>${c.speed}</b></div><div><span>Init</span><b>${sgn(c.init)}</b></div>
        <div><span>Perception</span><b>${c.pp}</b></div><div><span>Insight</span><b>${c.pi}</b></div><div><span>Invest.</span><b>${c.pinv}</b></div>${c.dc != null ? `<div><span>Spell DC</span><b>${c.dc}</b></div>` : ""}</div>
      <div class="dmbar" role="img" aria-label="Hit points ${c.cur} of ${c.hp}"><i class="${pct > 50 ? "ok" : pct > 25 ? "mid" : "low"}" style="width:${pct}%"></i></div>
      <div class="dmsaves">${Object.keys(AB_LABEL).map(a => `<span><em>${AB_LABEL[a]}</em> ${sgn(c.saves[a])}</span>`).join("")}</div>
      ${c.conds.length || c.exh || c.conc ? `<div class="dmchips">${c.conds.map(x => `<span class="chip dmchip">${esc(x)}</span>`).join("")}${c.exh ? `<span class="chip dmchip">Exhaustion ${c.exh}</span>` : ""}${c.conc ? `<span class="chip dmchip">Concentrating: ${esc(c.conc)}</span>` : ""}</div>` : ""}
      ${c.langs ? `<p class="sub2">Languages: ${esc(c.langs)}</p>` : ""}
      ${c.xp ? `<p class="sub2">${fmt(c.xp)} XP</p>` : ""}
      <div class="btnrow"><button class="btn sm danger" data-a="dmCardRemove" data-id="${esc(c.id)}">${sure("card:" + c.id, "Remove", "Tap again to remove")}</button></div>
    </div></article>`;
}

// ------------------------------------------------------------------ 2. combat
function combatTab(app, s) {
  const cb = s.d.combat, ui = s.ui, view = ui.cview === "list" || ui.cview === "screen" ? ui.cview : "board";
  const sw = `<div class="seg dmvsw" role="group" aria-label="Combat view">${[["board", "Board"], ["list", "List"], ["screen", "Screen"]].map(([v, l]) => `<button data-a="dmCview" data-v="${v}" aria-pressed="${view === v}">${l}</button>`).join("")}</div>`;
  const cur = cb && cb.rows[cb.turn];
  const wide = view === "list" ? "" : " wide", head = cb ? `<div class="dmbar-top${wide}"><div><b>Round ${cb.round}</b><span class="sub2">${cb.started && cur ? esc(cur.name) + "'s turn" : cb.rows.length ? "Not started" : "No creatures"}</span></div>
      <div class="btnrow"><button class="btn" data-a="dmRollInit">Roll initiative</button><button class="btn pri" data-a="dmNext">${cb.started ? "Next turn" : "Start"}</button></div></div>` : "";
  const tools = `<div class="dmtools${wide}">${sw}${cb && view !== "screen" ? `<button class="btn sm" data-a="dmAddToggle" aria-pressed="${!!ui.add}">${ui.add ? "Close" : "Add creatures"}</button>` : ""}</div>`;
  if (view === "screen") return `${head}${tools}${screenView(app, s)}`;
  if (!cb) return `${tools}<div class="empty"><h3>No fight running</h3><p>Start empty or with the party.</p></div>
    <div class="btnrow"><button class="btn pri" data-a="dmNewCombat">New combat</button>${Object.keys(s.d.party).length ? `<button class="btn" data-a="dmPartyToCombat">With party</button>` : ""}</div>`;
  return `${head}${tools}
    ${ui.add ? addForm(s) : ""}
    ${view === "list" ? `<div class="dmrows">${cb.rows.map((r, i) => rowHtml(r, cb.started && i === cb.turn)).join("")}</div>` : renderDmBoard(app)}
    <div class="btnrow" style="margin-top:12px"><button class="btn danger" data-a="dmEndCombat">${sure("end", "End combat", "Tap again to end")}</button></div>`;
}
function rowHtml(r, turn) {
  const pct = Math.round(100 * r.cur / r.hp);
  return `<div class="dmrow${turn ? " on" : ""}${r.out ? " out" : ""}${r.kind === "pc" ? " pc" : ""}"${turn ? ` aria-current="true"` : ""}>
    <input class="f num dminit" type="number" inputmode="numeric" data-dmf="init" data-id="${esc(r.id)}" value="${r.init == null ? "" : r.init}" placeholder="--" aria-label="Initiative, ${esc(r.name)}">
    <button class="dmmain" data-a="dmRowOpen" data-id="${esc(r.id)}">
      <span class="dmname">${esc(r.name)}${r.hid ? `<i class="tag">Hidden</i>` : ""}${r.conc ? `<i class="tag">Conc</i>` : ""}${r.out ? `<i class="tag">${r.kind === "pc" ? "Down" : "Out"}</i>` : r.cur === 0 ? `<i class="tag">Down</i>` : ""}</span>
      <span class="dmsub">AC ${r.ac}${r.conds.map(c => ` · ${esc(c.n)}${c.r != null ? " " + c.r : ""}`).join("")}${r.note ? " · " + esc(r.note) : ""}</span>
      <span class="dmbar" role="img" aria-label="Hit points ${r.cur} of ${r.hp}"><i class="${pct > 50 ? "ok" : pct > 25 ? "mid" : "low"}" style="width:${pct}%"></i></span>
    </button>
    <span class="dmhp"><b>${r.cur}</b><span>/${r.hp}${r.temp ? ` +${r.temp}` : ""}</span></span></div>`;
}
function addForm(s) {
  const book = s.d.creatures;
  return `<div class="panel"><div class="panel-head"><h2>Add creatures</h2><button class="btn sm" data-a="dmTab" data-v="bestiary">Bestiary</button></div><div class="panel-body stack">
      ${book.length ? `<div class="grid3"><label class="field"><span class="lab">From book</span><select class="f" id="dm-bk">${book.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label>
        <label class="field"><span class="lab">Count</span><input class="f num" id="dm-bkn" type="number" inputmode="numeric" value="1" min="1" max="20"></label>
        <button class="btn" data-a="dmAddBook" style="align-self:end">Add</button></div>` : ""}
      <div class="grid3"><label class="field"><span class="lab">Name</span><input class="f" id="dm-qn" maxlength="60" autocomplete="off"></label>
        <label class="field"><span class="lab">HP</span><input class="f num" id="dm-qh" type="number" inputmode="numeric" min="1"></label>
        <label class="field"><span class="lab">AC</span><input class="f num" id="dm-qa" type="number" inputmode="numeric" min="0"></label></div>
      <div class="grid3"><label class="field"><span class="lab">Init bonus</span><input class="f num" id="dm-qi" type="number" inputmode="numeric" value="0"></label>
        <label class="field"><span class="lab">XP</span><input class="f num" id="dm-qx" type="number" inputmode="numeric" min="0" value="0"></label>
        <label class="field"><span class="lab">Count</span><input class="f num" id="dm-qc" type="number" inputmode="numeric" value="1" min="1" max="20"></label></div>
      <button class="btn" data-a="dmAddQuick">Add creature</button>
      ${Object.values(s.d.party).some(c => !s.d.combat.rows.some(r => r.card === c.id)) ? `<button class="btn" data-a="dmAddParty">Add party</button>` : ""}
    </div></div>`;
}

// ------------------------------------------------------------------ 3. bestiary
function bestiaryTab(app, s) {
  const ui = s.ui, all = bestiary(app), types = dm.monsterTypes(all);
  const found = dm.searchMonsters(all, { q: ui.q, cr: ui.mcr, type: ui.mtype }), shown = found.slice(0, ui.limit);
  const lib = ((app.library && app.library.monsters) || []).length;
  return `<div class="panel"><div class="panel-body stack">
      <div class="search">${ICONS.search}<input class="f" type="search" id="dm-q" value="${esc(ui.q)}" placeholder="Search creatures" autocomplete="off"></div>
      <div class="grid2"><label class="field"><span class="lab">Challenge</span><select class="f" data-dmf="mcr">${dm.CR_BANDS.map(b => `<option value="${b[0]}"${ui.mcr === b[0] ? " selected" : ""}>${b[1]}</option>`).join("")}</select></label>
        <label class="field"><span class="lab">Type</span><select class="f" data-dmf="mtype"><option value="">Any type</option>${types.map(t => `<option value="${esc(t)}"${ui.mtype === t ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label></div>
      <div class="seg" role="group" aria-label="Source">${[["all", "All"], ["srd", "SRD"], ["mine", "Mine"]].map(([k, l]) => `<button data-a="dmSrc" data-v="${k}" aria-pressed="${ui.src === k}">${l}</button>`).join("")}</div>
    </div></div>
    <div class="panel"><div class="panel-head"><h2>${found.length} ${found.length === 1 ? "creature" : "creatures"}</h2><button class="btn sm" data-a="dmCreatureNew">New</button></div><div class="panel-body flush">
      ${shown.length ? shown.map(m => `<div class="rowline dmmrow"><button class="nm dmcname" data-a="dmMonOpen" data-id="${esc(m.id)}"><span>${esc(m.name)}${m.mine ? `<i class="tag">Mine</i>` : ""}</span>
          <span class="sub2">CR ${esc(m.cr || "?")}${m.type ? " · " + esc(m.type) : ""} · ${fmt(m.xp)} XP · AC ${m.ac} · HP ${m.hp}</span></button>
        <button class="btn sm" data-a="dmPickAddId" data-id="${esc(m.id)}" aria-label="Add ${esc(m.name)} to encounter">Add</button></div>`).join("")
      : `<p class="sub2" style="padding:12px 16px">${!lib && ui.src !== "mine" ? "The bestiary comes with the rules." : "No matches."}</p>`}
    </div></div>
    ${found.length > shown.length ? `<button class="btn block" data-a="dmMore">Show more (${found.length - shown.length})</button>` : ""}`;
}

// ------------------------------------------------------------------ 4. encounters
function encountersTab(app, s) {
  const d = s.d, e = d.enc, levels = dm.encounterLevels(d), xp = dm.encounterXp(d), r = dm.rate(levels, xp);
  const bud = dm.DIFFS.map(([k, l]) => [k, l, dm.partyBudget(levels, k)]);
  const top = bud[2][2] || 1;
  const party = Object.values(d.party).sort((a, b) => a.name.localeCompare(b.name));
  const picks = e.picks.map(p => ({ p, c: dm.pickCreature(d, p) })).filter(x => x.c);
  return `<div class="panel"><div class="panel-head"><h2>Encounter budget</h2><span class="chip dmrate ${r.tier}">${xp ? esc(r.label) : "Empty"}</span></div><div class="panel-body stack">
      ${party.length ? `<div class="dmchips">${party.map(c => `<button class="chip chipbtn" data-a="dmEncSkip" data-id="${esc(c.id)}" aria-pressed="${!e.skip.includes(c.id)}">${esc(c.name)} ${c.level}</button>`).join("")}</div>`
        : `<div class="grid2"><label class="field"><span class="lab">Characters</span><input class="f num" type="number" inputmode="numeric" min="1" max="12" data-dmf="encn" value="${e.n}"></label>
        <label class="field"><span class="lab">Level</span><input class="f num" type="number" inputmode="numeric" min="1" max="20" data-dmf="enclv" value="${e.lv}"></label></div>`}
      <div class="seg" role="group" aria-label="Difficulty">${dm.DIFFS.map(([k, l]) => `<button data-a="dmEncDiff" data-v="${k}" aria-pressed="${e.diff === k}">${l}</button>`).join("")}</div>
      <div class="dmbudget" role="img" aria-label="${xp} XP of ${bud[2][2]} high budget"><i class="fill ${r.tier}" style="width:${Math.min(100, Math.round(100 * xp / top))}%"></i>${bud.slice(0, 2).map(b => `<u style="left:${Math.round(100 * b[2] / top)}%"></u>`).join("")}</div>
      <div class="dmbtable">${bud.map(([k, l, v]) => `<div class="${e.diff === k ? "on" : ""}"><span>${l}</span><b>${fmt(v)}</b></div>`).join("")}<div><span>Spent</span><b>${fmt(xp)}</b></div></div>
    </div></div>
    <div class="panel"><div class="panel-head"><h2>Creatures</h2><div class="btnrow" style="flex:0 0 auto"><button class="btn sm" data-a="dmTab" data-v="bestiary">Bestiary</button><button class="btn sm" data-a="dmCreatureNew">New</button></div></div><div class="panel-body flush">
      ${picks.length ? picks.map(({ p, c }) => `<div class="rowline"><button class="nm dmcname" data-a="dmMonOpen" data-id="${esc(p.cid)}"><span>${esc(c.name)}</span><span class="sub2">${c.cr ? "CR " + esc(c.cr) + " · " : ""}${fmt(c.xp)} XP each</span></button>
        <button class="iconbtn" data-a="dmPickQty" data-id="${esc(p.cid)}" data-v="-1" aria-label="Fewer ${esc(c.name)}">${ICONS.minus}</button><b class="dmqty">${p.qty}</b><button class="iconbtn" data-a="dmPickQty" data-id="${esc(p.cid)}" data-v="1" aria-label="More ${esc(c.name)}">${ICONS.plus}</button></div>`).join("")
      : `<p class="sub2" style="padding:12px 16px">None picked.</p>`}
    </div></div>
    ${picks.length ? `<div class="btnrow" style="margin-top:12px"><button class="btn pri" data-a="dmEncToCombat">Add to combat</button><button class="btn ghost" data-a="dmEncClear">Clear</button></div>` : ""}
    <div class="btnrow" style="margin-top:12px"><button class="btn ghost" data-a="dmOpen">Homebrew editor</button></div>`;
}

// ------------------------------------------------------------------ 5. rewards
export function rewardPlan(d) {
  const cb = d.combat, fromFight = dm.defeatedXp(cb), total = fromFight + d.rw.xp, rec = dm.recipients(d);
  const xp = dm.splitEven(total, rec.n), gp = dm.splitEven(d.rw.gp, rec.n);
  const people = rec.cards.map(c => {
    const known = c.xp > 0 || c.level === 1, after = c.xp + xp.each;
    return { c, known, up: known ? dm.levelFor(after, XP_TABLE) : c.level, after };
  });
  return { fromFight, count: dm.defeatedCount(cb), total, xp, gp, n: rec.n, people };
}
function rewardsTab(app, s) {
  const d = s.d, p = rewardPlan(d), party = Object.values(d.party).sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="panel"><div class="panel-head"><h2>Reward</h2></div><div class="panel-body stack">
      <div class="dmbtable"><div><span>Defeated</span><b>${p.count}</b></div><div><span>Combat XP</span><b>${fmt(p.fromFight)}</b></div><div><span>Total XP</span><b>${fmt(p.total)}</b></div><div><span>Gold</span><b>${fmt(d.rw.gp)}</b></div></div>
      <div class="grid2"><label class="field"><span class="lab">Bonus XP</span><input class="f num" type="number" inputmode="numeric" min="0" data-dmf="rwxp" value="${d.rw.xp || ""}" placeholder="0"></label>
        <label class="field"><span class="lab">Gold</span><input class="f num" type="number" inputmode="numeric" min="0" data-dmf="rwgp" value="${d.rw.gp || ""}" placeholder="0"></label></div>
      ${party.length ? `<p class="lab" style="margin-top:4px">Shared by</p><div class="dmchips">${party.map(c => `<button class="chip chipbtn" data-a="dmRwSkip" data-id="${esc(c.id)}" aria-pressed="${!d.rw.skip.includes(c.id) && !c.dead}" ${c.dead ? "disabled" : ""}>${esc(c.name)}</button>`).join("")}</div>`
        : `<div class="grid2"><label class="field"><span class="lab">Characters</span><input class="f num" type="number" inputmode="numeric" min="1" max="12" data-dmf="encn" value="${d.enc.n}"></label></div>`}
    </div></div>
    <div class="panel"><div class="panel-head"><h2>Each character</h2><button class="btn sm" data-a="dmRwCopy">Copy summary</button></div><div class="panel-body flush">
      <div class="rowline"><span class="nm">Per character<span class="sub2">${p.xp.left || p.gp.left ? `Left over: ${fmt(p.xp.left)} XP, ${fmt(p.gp.left)} gp` : "Nothing left over"}</span></span><b>${fmt(p.xp.each)} XP · ${fmt(p.gp.each)} gp</b></div>
      ${p.people.map(({ c, known, up }) => `<div class="rowline"><span class="nm">${esc(c.name)}<span class="sub2">Level ${c.level}${known ? "" : " · XP not sent"}</span></span>${up > c.level ? `<span class="chip dmchip dmup">Level ${up}</span>` : `<span class="sub2">${known ? fmt(c.xp + p.xp.each) + " XP" : ""}</span>`}</div>`).join("")}
    </div></div>`;
}

// ------------------------------------------------------------------ combat > screen (what the table screen shows)
const seg = (k, v, opts) => `<div class="seg" role="group" aria-label="${k}">${opts.map(([val, l]) => `<button data-a="dmTblSet" data-k="${k}" data-v="${val}" aria-pressed="${v === val}">${l}</button>`).join("")}</div>`;
const tog = (k, on, label) => `<div class="tbrow"><span>${label}</span><button class="chip chipbtn" data-a="dmTblTog" data-k="${k}" aria-pressed="${on}">${on ? "On" : "Off"}</button></div>`;
const choice = (label, control) => `<div class="tbrow"><span>${label}</span>${control}</div>`;
function screenView(app, s) {
  const T = s.d.table, cb = s.d.combat;
  const rows = cb ? cb.rows : [];
  const swatch = [["gold", "#e8b84f"], ["teal", "#4fc3b0"], ["crimson", "#d8493f"], ["violet", "#a58be8"]];
  return `<div class="tblgrid"><div class="stack">
      <div class="btnrow"><button class="btn pri" data-a="dmViewOpen">Open here</button><button class="btn" data-a="dmViewWindow">New window</button>
        <button class="btn${T.blank ? " pri" : ""}" data-a="dmTblTog" data-k="blank" aria-pressed="${T.blank}">Blank</button></div>
      <div class="vprevbox" aria-label="Preview">${renderDmView(app, { preview: true })}</div>
      <div class="panel"><div class="panel-head"><h2>Push message</h2>${T.msg.on ? `<span class="chip dmchip">Showing</span>` : ""}</div><div class="panel-body stack">
        <label class="field"><span class="lab">Title</span><input class="f" id="tb-mt" maxlength="80" value="${esc(T.msg.title)}" autocomplete="off"></label>
        <label class="field"><span class="lab">Text</span><textarea class="f" id="tb-mx" rows="3" maxlength="600">${esc(T.msg.text)}</textarea></label>
        <div class="btnrow"><button class="btn pri" data-a="dmMsgPush">Push to screen</button><button class="btn" data-a="dmMsgClear" ${T.msg.on ? "" : "disabled"}>Clear</button></div>
      </div></div></div>
    <div class="stack">
      <div class="panel"><div class="panel-head"><h2>Show</h2></div><div class="panel-body">
        ${tog("show.party", T.show.party, "Party")}${tog("show.foes", T.show.foes, "Enemies")}${tog("show.order", T.show.order, "Initiative")}${tog("initNums", T.initNums, "Initiative numbers")}
        ${tog("show.round", T.show.round, "Round")}${tog("show.now", T.show.now, "Current creature")}${tog("show.next", T.show.next, "Next up")}
        ${tog("conds", T.conds, "Conditions")}${tog("condRounds", T.condRounds, "Rounds left")}${tog("conc", T.conc, "Concentration")}</div></div>
      <div class="panel"><div class="panel-head"><h2>Health</h2></div><div class="panel-body">
        ${choice("Party", seg("partyHp", T.partyHp, [["numbers", "Numbers"], ["bar", "Bar"], ["none", "None"]]))}
        ${choice("Enemies", seg("foeHp", T.foeHp, [["bloodied", "Bloodied"], ["bar", "Bar"], ["numbers", "Numbers"], ["none", "None"]]))}
        ${choice("Armor class", seg("ac", T.ac, [["off", "Off"], ["party", "Party"], ["all", "All"]]))}
        ${choice("Defeated", seg("defeated", T.defeated, [["dim", "Dim"], ["hide", "Hide"]]))}</div></div>
      <div class="panel"><div class="panel-head"><h2>Look</h2></div><div class="panel-body">
        ${choice("Theme", seg("theme", T.theme, [["dark", "Dark"], ["parchment", "Parchment"]]))}
        ${choice("Accent", `<div class="tbsw" role="group" aria-label="Accent">${swatch.map(([k, c]) => `<button data-a="dmTblSet" data-k="accent" data-v="${k}" style="background:${c}" aria-label="${k}" aria-pressed="${T.accent === k}"></button>`).join("")}</div>`)}
        ${choice("Text", seg("text", T.text, [["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]]))}
        ${choice("Portraits", seg("size", T.size, [["s", "S"], ["m", "M"], ["l", "L"]]))}</div></div>
      <div class="panel"><div class="panel-head"><h2>Creatures</h2></div><div class="panel-body">
        ${rows.length ? rows.map(r => `<div class="tbrow"><span>${esc(r.name)}${r.alias ? ` <em class="sub2">as ${esc(r.alias)}</em>` : ""}</span><button class="chip chipbtn" data-a="dmRowHideId" data-id="${esc(r.id)}" aria-pressed="${!r.hid}" aria-label="${esc(r.name)} on table">${r.hid ? "Hidden" : "Shown"}</button></div>`).join("") : `<p class="sub2">No fight running.</p>`}</div></div>
    </div></div>`;
}

// ------------------------------------------------------------------ modals
export function renderDmModal(app) {
  const m = app.modal, s = app.dmm;
  if (m.type === "dmSend") return sendModal(m);
  if (m.type === "dmCamps") return campsModal(m);
  if (m.type === "dmCampName") return campNameModal(m);
  if (!s) return "";
  if (m.type === "dmRow") return rowModal(s, m);
  if (m.type === "dmCreature") return creatureModal(s, m);
  if (m.type === "dmMon") return monModal(app, s, m);
  return "";
}
function campsModal(m) {
  const ix = dm.readIndex(), rows = ix.list.slice().sort((a, b) => b.at - a.at).map(c => { const g = dm.campaignGlance(c);
    return `<div class="dmcamp${c.id === ix.active ? " on" : ""}"><button class="dmcamp-main press" data-a="dmCampPick" data-id="${esc(c.id)}"><b>${esc(c.name)}</b><span>${g.n} ${g.n === 1 ? "character" : "characters"}${c.id === ix.active ? " \u00b7 Open" : ""}</span></button>
      <button class="iconbtn" data-a="dmCampRename" data-id="${esc(c.id)}" aria-label="Rename ${esc(c.name)}">${ICONS.edit}</button>
      <button class="${_confirm === "camp" + c.id ? "btn sm danger" : "iconbtn"}" data-a="dmCampDelete" data-id="${esc(c.id)}" aria-label="Delete ${esc(c.name)}">${_confirm === "camp" + c.id ? "Delete?" : ICONS.trash}</button></div>`; }).join("");
  return modalShell("Campaigns", `<div class="stack dmcamps">${rows}</div>`, `<button class="btn pri" data-a="dmCampNew">New campaign</button>`);
}
function campNameModal(m) {
  return modalShell(m.id ? "Rename campaign" : "New campaign", `<label class="field"><span class="lab">Name</span><input class="f" id="dm-cname" maxlength="40" value="${esc(m.name || "")}" autocomplete="off"></label>`,
    `<button class="btn" data-a="${m.home ? "closeModal" : "dmCampOpen"}">Cancel</button><button class="btn pri" data-a="dmCampSave">Save</button>`);
}
function sendModal(m) {
  return modalShell("Send to DM", `<label class="field"><span class="lab">${esc(m.name)}, current stats</span><textarea class="f mono" id="dm-send" rows="5" readonly spellcheck="false" onfocus="this.select()">${esc(m.code)}</textarea></label>`,
    `<button class="btn" data-a="dmSendSave">Save file</button><button class="btn pri" data-a="dmSendCopy">Copy code</button>`);
}
function rowModal(s, m) {
  const cb = s.d.combat, r = cb && cb.rows.find(x => x.id === m.id); if (!r) return "";
  const has = n => r.conds.find(c => c.n === n);
  return modalShell(r.name, `<div class="stack">
      <div class="dmhpbig"><b>${r.cur}</b><span>/${r.hp}${r.temp ? ` +${r.temp} temp` : ""}</span></div>
      <label class="field"><span class="lab">Amount</span><input class="f num" id="dm-amt" type="number" inputmode="numeric" min="0" placeholder="0"></label>
      <div class="btnrow"><button class="btn danger" data-a="dmDamage">Damage</button><button class="btn" data-a="dmHeal">Heal</button><button class="btn" data-a="dmTemp">Temp HP</button></div>
      <p class="lab" style="margin-top:6px">Conditions</p>
      <label class="field"><span class="lab">Rounds (blank until removed)</span><input class="f num" id="dm-rounds" type="number" inputmode="numeric" min="1" max="99"></label>
      <div class="dmchips">${dm.CONDITIONS.map(n => { const c = has(n); return `<button class="chip chipbtn" data-a="dmCond" data-n="${n}" aria-pressed="${!!c}">${n}${c && c.r != null ? " " + c.r : ""}</button>`; }).join("")}</div>
      <div class="btnrow"><button class="btn${r.conc ? " pri" : ""}" data-a="dmConc" aria-pressed="${r.conc}">Concentrating</button><button class="btn${r.out ? " pri" : ""}" data-a="dmOut" aria-pressed="${r.out}">${r.kind === "pc" ? "Out of fight" : "Defeated"}</button>${r.kind === "pc" ? "" : `<button class="btn${r.ally ? " pri" : ""}" data-a="dmAlly" aria-pressed="${!!r.ally}">Ally</button>`}<button class="btn${r.hid ? " pri" : ""}" data-a="dmRowHide" aria-pressed="${!!r.hid}">Hide from table</button></div>
      ${r.mid ? `<button class="btn" data-a="dmMonOpen" data-id="m:${esc(r.mid)}">Stat block</button>` : ""}
      <p class="lab" style="margin-top:6px">Details</p>
      <div class="grid3"><label class="field"><span class="lab">Name</span><input class="f" id="dm-rn" maxlength="60" value="${esc(r.name)}"></label>
        <label class="field"><span class="lab">AC</span><input class="f num" id="dm-ra" type="number" inputmode="numeric" value="${r.ac}"></label>
        <label class="field"><span class="lab">Max HP</span><input class="f num" id="dm-rh" type="number" inputmode="numeric" value="${r.hp}"></label></div>
      <label class="field"><span class="lab">Initiative</span><input class="f num" id="dm-ri" type="number" inputmode="numeric" value="${r.init == null ? "" : r.init}" placeholder="--"></label>
      <label class="field"><span class="lab">Table name</span><input class="f" id="dm-ral" maxlength="40" value="${esc(r.alias)}" placeholder="${esc(r.name)}" autocomplete="off"></label>
      <label class="field"><span class="lab">Note</span><input class="f" id="dm-rt" maxlength="200" value="${esc(r.note)}"></label>
    </div>`, `<button class="btn danger" data-a="dmRowRemove">${sure("row", "Remove")}</button><button class="btn" data-a="dmRowSave">Save details</button><button class="btn pri" data-a="closeModal">Done</button>`);
}
function creatureModal(s, m) {
  const c = m.id ? s.d.creatures.find(x => x.id === m.id) : null, v = c || { name: "", cr: "", xp: "", hp: "", ac: "", init: 0, note: "" };
  return modalShell(c ? "Edit creature" : "New creature", `<div class="stack">
      <label class="field"><span class="lab">Name</span><input class="f" id="dc-n" maxlength="60" value="${esc(v.name)}" autocomplete="off"></label>
      <div class="grid2"><label class="field"><span class="lab">CR</span><select class="f" id="dc-cr" data-dmf="cr"><option value="">None</option>${dm.CRS.map(x => `<option value="${x}"${v.cr === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>
        <label class="field"><span class="lab">XP</span><input class="f num" id="dc-xp" type="number" inputmode="numeric" min="0" value="${v.xp}"></label></div>
      <div class="grid3"><label class="field"><span class="lab">HP</span><input class="f num" id="dc-hp" type="number" inputmode="numeric" min="1" value="${v.hp}"></label>
        <label class="field"><span class="lab">AC</span><input class="f num" id="dc-ac" type="number" inputmode="numeric" min="0" value="${v.ac}"></label>
        <label class="field"><span class="lab">Init bonus</span><input class="f num" id="dc-in" type="number" inputmode="numeric" value="${v.init}"></label></div>
      <label class="field"><span class="lab">Note</span><input class="f" id="dc-nt" maxlength="300" value="${esc(v.note)}"></label>
      ${c && c.mid ? `<button class="btn" data-a="dmMonOpen" data-id="m:${esc(c.mid)}">Stat block</button>` : ""}
    </div>`, `${c ? `<button class="btn danger" data-a="dmCreatureDelete" data-id="${esc(c.id)}">${sure("cr:" + c.id, "Delete")}</button>` : ""}<button class="btn pri" data-a="dmCreatureSave" data-id="${c ? esc(c.id) : ""}">Save</button>`);
}

// A stat block as the rules print it: header, numbers, then traits, actions, reactions, legendary actions.
function monModal(app, s, m) {
  const id = String(m.id || ""), book = id.startsWith("m:") ? null : s.d.creatures.find(x => x.id === id);
  const mon = monsterIndex(app).get(id.startsWith("m:") ? id.slice(2) : book && book.mid);
  const name = mon ? mon.name : book ? book.name : "Creature";
  const foot = `<button class="btn" data-a="dmMonEnc">To encounter</button><button class="btn" data-a="dmMonCombat">To combat</button>${book ? "" : `<button class="btn pri" data-a="dmMonCopy">Copy to book</button>`}`;
  if (!mon) return modalShell(name, book ? `<p class="sub2">CR ${esc(book.cr || "?")} · ${fmt(book.xp)} XP · AC ${book.ac} · HP ${book.hp}</p>${book.note ? `<p>${esc(book.note)}</p>` : ""}` : `<p class="sub2">Not in the bestiary.</p>`, foot);
  const list = (label, a) => (a && a.length ? `<p class="sbl"><b>${label}</b> ${a.map(esc).join(", ")}</p>` : "");
  const sect = (title, a) => (a && a.length ? `<h3 class="sbh">${title}</h3>${a.map(e => `<p class="sbe"><b>${esc(e.n)}${e.u ? ` (${esc(e.u)})` : ""}.</b> ${esc(e.d)}</p>`).join("")}` : "");
  const saves = Object.entries(mon.saves || {}).map(([k, v]) => `${AB_LABEL[k] || k} ${sgn(v)}`), skills = Object.entries(mon.skills || {}).map(([k, v]) => `${k} ${sgn(v)}`);
  const abil = ["str", "dex", "con", "int", "wis", "cha"].map((a, i) => `<div><span>${AB_LABEL[a]}</span><b>${mon.abil[i]}</b><i>${sgn(dm.abilMod(mon.abil[i]))}</i></div>`).join("");
  return modalShell(name, `<div class="sbk">
      <p class="sub2">${esc(mon.size)} ${esc(mon.type)}${mon.align ? ", " + esc(mon.align) : ""}</p>
      <div class="sbtop"><div><span>AC</span><b>${mon.ac}</b>${mon.acNote ? `<i>${esc(mon.acNote)}</i>` : ""}</div><div><span>HP</span><b>${mon.hp}</b>${mon.hpRoll ? `<i>${esc(mon.hpRoll)}</i>` : ""}</div><div class="wide"><span>Speed</span><b>${esc(mon.speed)}</b></div></div>
      <div class="sbabil">${abil}</div>
      ${list("Saves", saves)}${list("Skills", skills)}${list("Resistances", mon.dr)}${list("Vulnerabilities", mon.dv)}${list("Immunities", mon.di)}${list("Condition immunities", mon.ci)}
      <p class="sbl"><b>Senses</b> ${esc(mon.senses || "None")}</p>${mon.langs ? `<p class="sbl"><b>Languages</b> ${esc(mon.langs)}</p>` : ""}
      <p class="sbl"><b>CR</b> ${esc(mon.cr)} (${fmt(mon.xp)} XP${mon.xpLair ? `, ${fmt(mon.xpLair)} in lair` : ""}) <b>PB</b> ${sgn(mon.pb)}</p>
      ${mon.gear ? `<p class="sbl"><b>Gear</b> ${esc(mon.gear)}</p>` : ""}
      ${sect("Traits", mon.traits)}${sect("Actions", mon.actions)}${sect("Bonus actions", mon.bonus)}${sect("Reactions", mon.reactions)}${sect("Legendary actions", mon.legendary)}
    </div>`, foot, "monmodal");
}
