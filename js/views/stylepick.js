// Which sheet to use: Classic (the printed 2024 sheet) or Advanced (tools for playing at the table).
// Shown after a character is made, until a style is chosen. Tap a sheet to look at it, then confirm.
// Changing it later is in Edit character (and Settings) and asks first.
import { topbar, ICONS } from "../ui.js";

// Small drawings of the two layouts, so they look different at a glance
const MOCK_CLASSIC = `<svg class="sp-mock" viewBox="0 0 120 150" aria-hidden="true" focusable="false">
  <rect x="4" y="4" width="112" height="142" rx="4" class="paper"/>
  <rect x="12" y="12" width="96" height="14" rx="2" class="bar"/>
  <g class="box">${[0, 1, 2].map(i => `<rect x="${12 + i * 33}" y="34" width="30" height="22" rx="2"/>`).join("")}${[0, 1, 2].map(i => `<rect x="${12 + i * 33}" y="60" width="30" height="22" rx="2"/>`).join("")}</g>
  <g class="line">${[92, 102, 112, 122, 132].map(y => `<rect x="12" y="${y}" width="${y % 20 ? 96 : 70}" height="4" rx="2"/>`).join("")}</g></svg>`;
const MOCK_ADV = `<svg class="sp-mock" viewBox="0 0 120 150" aria-hidden="true" focusable="false">
  <rect x="22" y="2" width="76" height="146" rx="9" class="phone"/>
  <rect x="28" y="10" width="64" height="12" rx="3" class="bar"/>
  <g class="tab">${[0, 1, 2, 3].map(i => `<rect x="${28 + i * 16.5}" y="26" width="14" height="6" rx="3" class="${i === 0 ? "on" : ""}"/>`).join("")}</g>
  <g class="box">${[0, 1].map(r => [0, 1].map(c => `<rect x="${28 + c * 33}" y="${38 + r * 30}" width="31" height="27" rx="3"/>`).join("")).join("")}</g>
  <g class="line">${[102, 112, 122].map(y => `<rect x="28" y="${y}" width="64" height="5" rx="2.5"/>`).join("")}</g>
  <rect x="28" y="132" width="64" height="10" rx="5" class="bar"/></svg>`;

const SHEETS = {
  classic: { name: "Classic sheet", what: "One page, like the printed 2024 sheet.", mock: MOCK_CLASSIC, icon: "book",
    gets: ["Everything on one page, with tabs for Features, Spells, Equipment and Notes", "Tap any score, save or skill to roll it", "Best if you are used to paper sheets"] },
  advanced: { name: "Advanced sheet", what: "Tabs and tiles for playing at the table.", mock: MOCK_ADV, icon: "bolt",
    gets: ["Tabs for Play, Spells, Gear, Rolls, Features and More", "Every action is a tile with its cost, plus a turn tracker", "Saved gear loadouts, a hotbar and keyboard shortcuts"] }
};

const ROWS = [
  ["Layout", "One page with sub-tabs", "Separate tabs"],
  ["Actions", "Read a feature, then roll", "One-tap tiles with their costs"],
  ["Turn tracker", "no", "yes"],
  ["Gear", "Slots, bag and coins", "Plus saved loadouts and a preview before you swap"],
  ["Hotbar and shortcuts", "no", "yes"]
];
const cell = v => v === "yes" ? `<span class="yes" aria-label="Yes">✓</span>` : v === "no" ? `<span class="no" aria-label="Not included">—</span>` : v;

export function stylePicker(app) {
  const pend = app.stylePending, p = pend && SHEETS[pend];
  const card = k => {
    const s = SHEETS[k], on = pend === k;
    return `<button class="sp-card ${k}${on ? " sel" : ""}" data-a="stylePick" data-v="${k}" aria-pressed="${on}">
      <span class="sp-check" aria-hidden="true">${on ? "✓" : ""}</span>
      ${s.mock}
      <b>${s.name}</b>
      <span class="sp-d">${s.what}</span>
      <ul class="sp-gets">${s.gets.map(g => `<li>${g}</li>`).join("")}</ul>
    </button>`;
  };
  return `<div class="sheetview stylefull">
    ${topbar("Choose your sheet", app.char ? app.char.name : "", { back: "backToRoster" })}
    <main class="wrap page">
      <p class="sub2" style="margin:6px 0 14px">Both show the same character. Tap one to choose it, then confirm. You can switch later in Edit character.</p>
      <div class="sp-cards">${card("classic")}${card("advanced")}</div>
      <h2 class="sp-cmp-h">Side by side</h2>
      <div class="sp-cmp" role="table" aria-label="Classic compared with Advanced">
        <div class="r head" role="row"><span role="columnheader"></span><span role="columnheader" class="c-classic">Classic</span><span role="columnheader" class="c-advanced">Advanced</span></div>
        ${ROWS.map(([k, a, b]) => `<div class="r" role="row"><span class="k" role="rowheader">${k}</span><span role="cell">${cell(a)}</span><span role="cell">${cell(b)}</span></div>`).join("")}
      </div>
    </main>
    <div class="sp-confirm"><div class="wrap">
      <button class="btn pri block" data-a="styleConfirm" ${p ? "" : "disabled"}>${p ? `Use the ${p.name}` : "Tap a sheet above to choose it"}</button>
    </div></div></div>`;
}
