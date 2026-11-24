// DM mode screens: Party (snapshots from players), Combat (initiative and HP), Prep (creature book, encounter budget). ASCII only.
import { esc, topbar, modalShell, ICONS } from "../ui.js";
import * as dm from "../dmmode.js";

export const dmUiDefault = () => ({ tab: "party", msg: "", confirm: "", open: "" });
const AB_LABEL = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
const sgn = n => (n >= 0 ? "+" : "-") + Math.abs(n);

function ago(ts, now = Date.now()) {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 2) return "Just now";
  if (m < 90) return m + " min ago";
  const h = Math.round(m / 60); if (h < 36) return h + " h ago";
  return Math.round(h / 24) + " days ago";
}
const stale = ts => Date.now() - ts > 7 * 864e5;

export function renderDmMode(app) {
  const s = app.dmm, ui = s.ui, tabs = [["party", "Party"], ["combat", "Combat"], ["prep", "Prep"]];
  const body = ui.tab === "combat" ? combatTab(s) : ui.tab === "prep" ? prepTab(s) : partyTab(s);
  return `${topbar("DM", app.campaign && app.campaign.name || "This device", { back: "goHome" })}
    <main class="wrap page wide dmmode">
      <div class="seg dmtabs" role="group" aria-label="DM mode">${tabs.map(([k, l]) => `<button data-a="dmTab" data-v="${k}" aria-pressed="${ui.tab === k}">${l}${k === "combat" && s.d.combat ? `<em class="dot" aria-hidden="true"></em>` : ""}</button>`).join("")}</div>
      ${ui.msg ? `<p class="small dmmsg" role="status">${esc(ui.msg)}</p>` : ""}
      ${body}
    </main>`;
}

// ------------------------------------------------------------------ party
function partyTab(s) {
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
      <div class="btnrow"><button class="btn sm danger" data-a="dmCardRemove" data-id="${esc(c.id)}">${app_confirm(c.id)}</button></div>
    </div></article>`;
}
let _confirm = "";
export const setConfirm = v => { _confirm = v || ""; };
const app_confirm = id => (_confirm === "card:" + id ? "Tap again to remove" : "Remove");

// ------------------------------------------------------------------ combat
function combatTab(s) {
  const cb = s.d.combat;
  if (!cb) return `<div class="empty"><h3>No fight running</h3><p>Start empty or with the party.</p></div>
    <div class="btnrow"><button class="btn pri" data-a="dmNewCombat">New combat</button>${Object.keys(s.d.party).length ? `<button class="btn" data-a="dmPartyToCombat">With party</button>` : ""}</div>`;
  const cur = cb.rows[cb.turn];
  return `<div class="dmbar-top"><div><b>Round ${cb.round}</b><span class="sub2">${cb.started && cur ? esc(cur.name) + "'s turn" : cb.rows.length ? "Not started" : "No creatures"}</span></div>
      <div class="btnrow"><button class="btn" data-a="dmRollInit">Roll initiative</button><button class="btn pri" data-a="dmNext">${cb.started ? "Next turn" : "Start"}</button></div></div>
    <div class="dmrows">${cb.rows.length ? cb.rows.map((r, i) => rowHtml(r, cb.started && i === cb.turn)).join("") : ""}</div>
    ${addForm(s)}
    <div class="btnrow" style="margin-top:12px"><button class="btn danger" data-a="dmEndCombat">${_confirm === "end" ? "Tap again to end" : "End combat"}</button></div>`;
}
function rowHtml(r, turn) {
  const pct = Math.round(100 * r.cur / r.hp);
  return `<div class="dmrow${turn ? " on" : ""}${r.out ? " out" : ""}${r.kind === "pc" ? " pc" : ""}"${turn ? ` aria-current="true"` : ""}>
    <input class="f num dminit" type="number" inputmode="numeric" data-dmf="init" data-id="${esc(r.id)}" value="${r.init == null ? "" : r.init}" placeholder="--" aria-label="Initiative, ${esc(r.name)}">
    <button class="dmmain" data-a="dmRowOpen" data-id="${esc(r.id)}">
      <span class="dmname">${esc(r.name)}${r.conc ? `<i class="tag">Conc</i>` : ""}${r.out ? `<i class="tag">${r.kind === "pc" ? "Down" : "Out"}</i>` : r.cur === 0 ? `<i class="tag">Down</i>` : ""}</span>
      <span class="dmsub">AC ${r.ac}${r.conds.map(c => ` · ${esc(c.n)}${c.r != null ? " " + c.r : ""}`).join("")}${r.note ? " · " + esc(r.note) : ""}</span>
      <span class="dmbar" role="img" aria-label="Hit points ${r.cur} of ${r.hp}"><i class="${pct > 50 ? "ok" : pct > 25 ? "mid" : "low"}" style="width:${pct}%"></i></span>
    </button>
    <span class="dmhp"><b>${r.cur}</b><span>/${r.hp}${r.temp ? ` +${r.temp}` : ""}</span></span></div>`;
}
function addForm(s) {
  const book = s.d.creatures;
  return `<div class="panel"><div class="panel-head"><h2>Add creatures</h2></div><div class="panel-body stack">
      ${book.length ? `<div class="grid3"><label class="field"><span class="lab">From book</span><select class="f" id="dm-bk">${book.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label>
        <label class="field"><span class="lab">Count</span><input class="f num" id="dm-bkn" type="number" inputmode="numeric" value="1" min="1" max="20"></label>
        <button class="btn" data-a="dmAddBook" style="align-self:end">Add</button></div>` : ""}
      <div class="grid3"><label class="field"><span class="lab">Name</span><input class="f" id="dm-qn" maxlength="60" autocomplete="off"></label>
        <label class="field"><span class="lab">HP</span><input class="f num" id="dm-qh" type="number" inputmode="numeric" min="1"></label>
        <label class="field"><span class="lab">AC</span><input class="f num" id="dm-qa" type="number" inputmode="numeric" min="0"></label></div>
      <div class="grid3"><label class="field"><span class="lab">Init bonus</span><input class="f num" id="dm-qi" type="number" inputmode="numeric" value="0"></label>
        <label class="field"><span class="lab">Count</span><input class="f num" id="dm-qc" type="number" inputmode="numeric" value="1" min="1" max="20"></label>
        <button class="btn" data-a="dmAddQuick" style="align-self:end">Add</button></div>
      ${Object.values(s.d.party).some(c => !s.d.combat.rows.some(r => r.card === c.id)) ? `<button class="btn" data-a="dmAddParty">Add party</button>` : ""}
    </div></div>`;
}

// ------------------------------------------------------------------ prep
function prepTab(s) {
  const d = s.d, e = d.enc, levels = dm.encounterLevels(d), xp = dm.encounterXp(d), r = dm.rate(levels, xp);
  const bud = dm.DIFFS.map(([k, l]) => [k, l, dm.partyBudget(levels, k)]);
  const top = bud[2][2] || 1;
  const party = Object.values(d.party).sort((a, b) => a.name.localeCompare(b.name));
  const picks = e.picks.map(p => ({ p, c: d.creatures.find(x => x.id === p.cid) })).filter(x => x.c);
  return `<div class="panel"><div class="panel-head"><h2>Encounter budget</h2><span class="chip dmrate ${r.tier}">${xp ? esc(r.label) : "Empty"}</span></div><div class="panel-body stack">
      ${party.length ? `<div class="dmchips">${party.map(c => `<button class="chip chipbtn" data-a="dmEncSkip" data-id="${esc(c.id)}" aria-pressed="${!e.skip.includes(c.id)}">${esc(c.name)} ${c.level}</button>`).join("")}</div>`
        : `<div class="grid2"><label class="field"><span class="lab">Characters</span><input class="f num" type="number" inputmode="numeric" min="1" max="12" data-dmf="encn" value="${e.n}"></label>
        <label class="field"><span class="lab">Level</span><input class="f num" type="number" inputmode="numeric" min="1" max="20" data-dmf="enclv" value="${e.lv}"></label></div>`}
      <div class="seg" role="group" aria-label="Difficulty">${dm.DIFFS.map(([k, l]) => `<button data-a="dmEncDiff" data-v="${k}" aria-pressed="${e.diff === k}">${l}</button>`).join("")}</div>
      <div class="dmbudget" role="img" aria-label="${xp} XP of ${bud[2][2]} high budget"><i class="fill ${r.tier}" style="width:${Math.min(100, Math.round(100 * xp / top))}%"></i>${bud.slice(0, 2).map(b => `<u style="left:${Math.round(100 * b[2] / top)}%"></u>`).join("")}</div>
      <div class="dmbtable">${bud.map(([k, l, v]) => `<div class="${e.diff === k ? "on" : ""}"><span>${l}</span><b>${v.toLocaleString("en-US")}</b></div>`).join("")}<div><span>Spent</span><b>${xp.toLocaleString("en-US")}</b></div></div>
      ${picks.length ? `<div class="dmpicks">${picks.map(({ p, c }) => `<div class="rowline"><span class="nm">${esc(c.name)}<span class="sub2">${c.xp.toLocaleString("en-US")} XP each</span></span>
        <button class="iconbtn" data-a="dmPickQty" data-id="${esc(c.id)}" data-v="-1" aria-label="Fewer ${esc(c.name)}">-</button><b class="dmqty">${p.qty}</b><button class="iconbtn" data-a="dmPickQty" data-id="${esc(c.id)}" data-v="1" aria-label="More ${esc(c.name)}">+</button></div>`).join("")}</div>
        <div class="btnrow"><button class="btn pri" data-a="dmEncToCombat">Add to combat</button><button class="btn ghost" data-a="dmEncClear">Clear</button></div>` : ""}
    </div></div>
    <div class="panel"><div class="panel-head"><h2>Creature book</h2><button class="btn sm" data-a="dmCreatureNew">New</button></div><div class="panel-body flush">
      ${d.creatures.length ? d.creatures.map(c => `<div class="rowline"><button class="nm dmcname" data-a="dmCreatureEdit" data-id="${esc(c.id)}"><span>${esc(c.name)}</span><span class="sub2">${c.cr ? "CR " + esc(c.cr) + " · " : ""}${c.xp.toLocaleString("en-US")} XP · HP ${c.hp} · AC ${c.ac}</span></button>
        <button class="btn sm" data-a="dmPickAdd" data-id="${esc(c.id)}">Add</button></div>`).join("") : `<p class="sub2" style="padding:12px 16px">No creatures yet.</p>`}
    </div></div>
    <div class="btnrow" style="margin-top:12px"><button class="btn ghost" data-a="dmOpen">Homebrew editor</button></div>`;
}

// ------------------------------------------------------------------ modals
export function renderDmModal(app) {
  const m = app.modal, s = app.dmm;
  if (m.type === "dmSend") return sendModal(m);
  if (!s) return "";
  if (m.type === "dmRow") return rowModal(s, m);
  if (m.type === "dmCreature") return creatureModal(s, m);
  return "";
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
      <div class="btnrow"><button class="btn${r.conc ? " pri" : ""}" data-a="dmConc" aria-pressed="${r.conc}">Concentrating</button><button class="btn${r.out ? " pri" : ""}" data-a="dmOut" aria-pressed="${r.out}">${r.kind === "pc" ? "Out of fight" : "Defeated"}</button></div>
      <p class="lab" style="margin-top:6px">Details</p>
      <div class="grid3"><label class="field"><span class="lab">Name</span><input class="f" id="dm-rn" maxlength="60" value="${esc(r.name)}"></label>
        <label class="field"><span class="lab">AC</span><input class="f num" id="dm-ra" type="number" inputmode="numeric" value="${r.ac}"></label>
        <label class="field"><span class="lab">Max HP</span><input class="f num" id="dm-rh" type="number" inputmode="numeric" value="${r.hp}"></label></div>
      <label class="field"><span class="lab">Note</span><input class="f" id="dm-rt" maxlength="200" value="${esc(r.note)}"></label>
    </div>`, `<button class="btn danger" data-a="dmRowRemove">${_confirm === "row" ? "Tap again" : "Remove"}</button><button class="btn" data-a="dmRowSave">Save details</button><button class="btn pri" data-a="closeModal">Done</button>`);
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
    </div>`, `${c ? `<button class="btn danger" data-a="dmCreatureDelete" data-id="${esc(c.id)}">${_confirm === "cr:" + c.id ? "Tap again" : "Delete"}</button>` : ""}<button class="btn pri" data-a="dmCreatureSave" data-id="${c ? esc(c.id) : ""}">Save</button>`);
}
