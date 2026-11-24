// DM mode player view: the table screen for a TV or a second window. Friendly side on the left, enemies on the right,
// initiative order in the middle. Wide screens show three columns; narrow ones stack and the order becomes a strip. ASCII only.
import { esc, ICONS } from "../ui.js";
import { portraitFor } from "../portraits.js";
import * as dm from "../dmmode.js";

// A steady colour for a creature with no portrait, from its name.
function hue(name) { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
const base = name => String(name).replace(/\s+\d+$/, "");

function portrait(r, party, friend) {
  const card = r.card && party[r.card], img = card ? portraitFor(card.species) : "";
  if (img) return `<img src="${esc(img)}" alt="">`;
  const h = friend ? 150 + hue(r.name) % 90 : 340 + hue(base(r.name)) % 40;
  return `<span class="vmono" style="--h:${h % 360}" aria-hidden="true">${esc(Array.from(base(r.name))[0] || "?").toUpperCase()}</span>`;
}

function card(r, st, party, friend, nums) {
  const state = dm.hpState(r), pct = Math.max(0, Math.min(100, Math.round(100 * r.cur / r.hp)));
  const tone = pct > 50 ? "ok" : pct > 25 ? "mid" : "low", show = friend || nums;
  const conds = r.conds.map(c => `<span class="vc">${esc(c.n)}${c.r != null ? " " + c.r : ""}</span>`).join("") + (r.conc ? `<span class="vc">Concentrating</span>` : "");
  const label = `${r.name}, ${friend ? `hit points ${r.cur} of ${r.hp}` : state === "bloodied" ? "bloodied" : state === "down" ? "down" : "hit points"}`;
  return `<article class="vcard ${friend ? "friend" : "foe"} s-${state}${r.id === st.turnId ? " turn" : ""}" aria-label="${esc(label)}">
    <div class="vpic">${portrait(r, party, friend)}${state === "down" ? `<b class="vtag">Down</b>` : state === "out" ? `<b class="vtag">${friend ? "Out" : "Defeated"}</b>` : ""}</div>
    <div class="vname">${esc(r.name)}</div>
    <div class="vbar ${tone}" role="img" aria-label="${esc(label)}"><i style="width:${pct}%"></i>${r.temp && show ? `<u style="width:${Math.min(100, Math.round(100 * r.temp / r.hp))}%"></u>` : ""}</div>
    <div class="vhp">${show ? `<b>${r.cur}</b>/${r.hp}${r.temp ? ` <em>+${r.temp}</em>` : ""}` : state === "bloodied" ? "Bloodied" : state === "down" ? "Down" : "&nbsp;"}</div>
    ${conds ? `<div class="vconds">${conds}</div>` : ""}</article>`;
}

// Columns for a side: one to three creatures sit side by side, bigger groups wrap into rows.
const cols = n => (n <= 1 ? 1 : n <= 3 ? n : n === 4 ? 2 : n <= 9 ? 3 : 4);
const rows = n => Math.max(1, Math.ceil(n / cols(n)));

export function renderDmView(app) {
  const s = app.dmm, st = dm.stageOf(s.d.combat), ui = s.ui, party = s.d.party, win = !!app._dmViewWindow;
  const bar = `<div class="vctl" ${ui.vctl === false ? "hidden" : ""}>
      ${st ? `<button class="btn sm pri" data-a="dmNext">${st.started ? "Next turn" : "Start"}</button>` : ""}
      <button class="btn sm" data-a="dmViewNums" aria-pressed="${!!ui.vnums}">Enemy HP</button>
      <button class="btn sm" data-a="dmViewFull">Full screen</button>
      ${win ? "" : `<button class="btn sm" data-a="dmViewWindow">New window</button>`}
      <button class="btn sm ghost" data-a="${win ? "dmViewClose" : "dmViewBack"}">${win ? "Close" : "Exit"}</button></div>`;
  if (!st) return `<div class="vstage empty" data-a="dmViewCtl"><div class="vwait"><h1>No fight running</h1></div>${bar}</div>`;
  const cur = st.order[0] && st.started ? st.order[0] : null;
  const rowsHtml = st.order.length ? st.order.map((r, i) => `<li class="vo ${dm.isFriend(r) ? "friend" : "foe"}${st.started && i === 0 ? " now" : ""}"><span class="vi">${r.init == null ? "--" : r.init}</span><span class="vn">${esc(r.name)}</span></li>`).join("")
    : `<li class="vo"><span class="vn">Nobody left</span></li>`;
  const side = (list, friend, title) => `<section class="vside ${friend ? "friend" : "foe"}" style="--cols:${cols(list.length)};--rows:${rows(list.length)}" aria-label="${title}"><h2>${title}<span>${list.length}</span></h2>
      <div class="vgrid">${list.map(r => card(r, st, party, friend, !!ui.vnums)).join("") || `<p class="vnone">None</p>`}</div></section>`;
  return `<div class="vstage" data-a="dmViewCtl">
    <header class="vtop"><div class="vround">Round <b>${st.round}</b></div><div class="vnow">${cur ? esc(cur.name) : st.started ? "" : "Not started"}</div></header>
    <div class="vboard">
      ${side(st.friends, true, "Party")}
      <section class="vmid" aria-label="Initiative order"><h2>Initiative</h2><ol>${rowsHtml}</ol></section>
      ${side(st.foes, false, "Enemies")}
    </div>${bar}</div>`;
}
