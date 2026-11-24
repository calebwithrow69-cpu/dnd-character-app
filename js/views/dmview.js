// DM mode table screen: for a TV, a second window or a phone. Friendly side on the left, enemies on the right, initiative
// order in the middle; what shows is set on the Table tab (state `d.table`). Wide screens show columns, narrow ones stack. ASCII only.
import { esc } from "../ui.js";
import { portraitFor } from "../portraits.js";
import * as dm from "../dmmode.js";

// A steady colour for a creature with no portrait, from its name.
function hue(name) { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
const base = name => String(name).replace(/\s+\d+$/, "");
// The name the table sees: the alias when the DM set one.
export const shownName = r => r.alias || r.name;

function portrait(r, party, friend) {
  const card = r.card && party[r.card], img = card && !r.alias ? portraitFor(card.species) : "";
  if (img) return `<img src="${esc(img)}" alt="">`;
  const nm = shownName(r), h = friend ? 150 + hue(nm) % 90 : 340 + hue(base(nm)) % 40;
  return `<span class="vmono" style="--h:${h % 360}" aria-hidden="true">${esc(Array.from(base(nm))[0] || "?").toUpperCase()}</span>`;
}

function card(r, st, party, friend, T) {
  const state = dm.hpState(r), pct = Math.max(0, Math.min(100, Math.round(100 * r.cur / r.hp)));
  const tone = pct > 50 ? "ok" : pct > 25 ? "mid" : "low", mode = friend ? T.partyHp : T.foeHp, nums = mode === "numbers";
  const bar = mode !== "none", words = !friend && mode === "bloodied";
  const conds = T.conds ? r.conds.map(c => `<span class="vc">${esc(c.n)}${T.condRounds && c.r != null ? " " + c.r : ""}</span>`).join("") + (T.conc && r.conc ? `<span class="vc">Concentrating</span>` : "") : "";
  const showAc = T.ac === "all" || (T.ac === "party" && friend);
  const label = `${shownName(r)}, ${nums ? `hit points ${r.cur} of ${r.hp}` : state === "bloodied" ? "bloodied" : state === "down" ? "down" : "in the fight"}`;
  const hp = nums ? `<b>${r.cur}</b>/${r.hp}${r.temp ? ` <em>+${r.temp}</em>` : ""}` : words && state === "bloodied" ? "Bloodied" : state === "down" ? "Down" : "&nbsp;";
  return `<article class="vcard ${friend ? "friend" : "foe"} s-${state}${r.id === st.turnId ? " turn" : ""}" aria-label="${esc(label)}">
    <div class="vpic">${portrait(r, party, friend)}${state === "down" ? `<b class="vtag">Down</b>` : state === "out" ? `<b class="vtag">${friend ? "Out" : "Defeated"}</b>` : ""}</div>
    <div class="vname">${esc(shownName(r))}${showAc ? `<span class="vac">AC ${r.ac}</span>` : ""}</div>
    ${bar ? `<div class="vbar ${tone}" role="img" aria-label="${esc(label)}"><i style="width:${pct}%"></i>${r.temp && nums ? `<u style="width:${Math.min(100, Math.round(100 * r.temp / r.hp))}%"></u>` : ""}</div>` : ""}
    ${bar || state === "down" ? `<div class="vhp">${hp}</div>` : ""}
    ${conds ? `<div class="vconds">${conds}</div>` : ""}</article>`;
}

// One to three creatures sit side by side, bigger groups wrap into rows.
const cols = n => (n <= 1 ? 1 : n <= 3 ? n : n === 4 ? 2 : n <= 9 ? 3 : 4);
const rowsOf = n => Math.max(1, Math.ceil(n / cols(n)));

// opts.preview: a small copy for the Table tab (no controls, not fixed to the screen).
export function renderDmView(app, opts = {}) {
  const s = app.dmm, ui = s.ui, T = s.d.table, party = s.d.party, win = !!app._dmViewWindow, prev = !!opts.preview;
  const raw = dm.stageOf(s.d.combat), st = raw && { ...raw, friends: T.defeated === "hide" ? raw.friends.filter(r => !r.out) : raw.friends, foes: T.defeated === "hide" ? raw.foes.filter(r => !r.out) : raw.foes };
  const attrs = `data-theme="${T.theme}" data-accent="${T.accent}" data-size="${T.size}" data-text="${T.text}"`;
  const cls = "vstage" + (prev ? " prev" : "") + (st ? "" : " empty");
  const bar = prev ? "" : `<div class="vctl" ${ui.vctl === false ? "hidden" : ""}>
      ${st ? `<button class="btn sm pri" data-a="dmNext">${st.started ? "Next turn" : "Start"}</button>` : ""}
      <button class="btn sm" data-a="dmTblCycle" data-k="foeHp">Enemy HP</button>
      <button class="btn sm" data-a="dmTblTog" data-k="blank" aria-pressed="${T.blank}">Blank</button>
      ${T.msg.on ? `<button class="btn sm" data-a="dmMsgClear">Clear message</button>` : ""}
      <button class="btn sm" data-a="dmViewFull">Full screen</button>
      ${win ? "" : `<button class="btn sm" data-a="dmViewWindow">New window</button>`}
      <button class="btn sm ghost" data-a="${win ? "dmViewClose" : "dmViewBack"}">${win ? "Close" : "Exit"}</button></div>`;
  const msg = T.msg.on && (T.msg.title || T.msg.text) ? `<div class="vmsg" role="status"><div>${T.msg.title ? `<h2>${esc(T.msg.title)}</h2>` : ""}${T.msg.text ? `<p>${esc(T.msg.text).replace(/\n/g, "<br>")}</p>` : ""}</div></div>` : "";
  const root = inner => `<div class="${cls}" ${attrs}${prev ? "" : ' data-a="dmViewCtl"'}>${inner}${msg}${bar}</div>`;
  if (T.blank) return root(`<div class="vwait"></div>`);
  if (!st) return root(`<div class="vwait"><h1>No fight running</h1></div>`);

  const turnRow = s.d.combat.rows[s.d.combat.turn], hereNow = st.started && turnRow && !turnRow.hid ? turnRow : null;
  const idx = st.order.findIndex(r => r.id === st.turnId), next = st.started && st.order.length > 1 ? st.order[(idx < 0 ? 0 : idx + 1) % st.order.length] : null;
  const rowsHtml = st.order.length ? st.order.map(r => `<li class="vo ${dm.isFriend(r) ? "friend" : "foe"}${r.id === st.turnId ? " now" : ""}">${T.initNums ? `<span class="vi">${r.init == null ? "--" : r.init}</span>` : ""}<span class="vn">${esc(shownName(r))}</span></li>`).join("")
    : `<li class="vo"><span class="vn">Nobody left</span></li>`;
  const side = (list, friend, title) => `<section class="vside ${friend ? "friend" : "foe"}" style="--cols:${cols(list.length)};--rows:${rowsOf(list.length)}" aria-label="${title}"><h2>${title}<span>${list.length}</span></h2>
      <div class="vgrid">${list.map(r => card(r, st, party, friend, T)).join("") || `<p class="vnone">None</p>`}</div></section>`;
  const parts = [T.show.party && "1fr", T.show.order && "minmax(14em,22%)", T.show.foes && "1fr"].filter(Boolean);
  const mid = T.show.order ? `<section class="vmid" aria-label="Initiative order"><h2>Initiative</h2><ol>${rowsHtml}</ol>${T.show.next && next ? `<div class="vnext">Next <b>${esc(shownName(next))}</b></div>` : ""}</section>` : "";
  return root(`<header class="vtop"><div class="vround">${T.show.round ? `Round <b>${st.round}</b>` : ""}</div><div class="vnow">${T.show.now ? (hereNow ? esc(shownName(hereNow)) : st.started ? "" : "Not started") : ""}</div></header>
    <div class="vboard" style="--tc:${parts.join(" ") || "1fr"}">
      ${T.show.party ? side(st.friends, true, "Party") : ""}${mid}${T.show.foes ? side(st.foes, false, "Enemies") : ""}
    </div>`);
}
