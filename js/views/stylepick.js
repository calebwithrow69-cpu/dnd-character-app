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
  classic: { name: "Classic", short: "Classic", mock: MOCK_CLASSIC, icon: "book",
    gets: ["One page", "Tap to roll", "Paper layout"] },
  advanced: { name: "Advanced", short: "Advanced", mock: MOCK_ADV, icon: "bolt",
    gets: ["Tabs", "Action tiles, turn tracker", "Loadouts, hotbar, shortcuts"] }
};

export function stylePicker(app) {
  const pend = app.stylePending, p = pend && SHEETS[pend];
  const card = k => {
    const s = SHEETS[k], on = pend === k;
    return `<button class="sp-card ${k}${on ? " sel" : ""}" data-a="stylePick" data-v="${k}" aria-pressed="${on}">
      <span class="sp-check" aria-hidden="true">${on ? "✓" : ""}</span>
      ${s.mock}
      <b>${s.name}</b>
      <ul class="sp-gets">${s.gets.map(g => `<li>${g}</li>`).join("")}</ul>
    </button>`;
  };
  return `<div class="sheetview stylefull">
    ${topbar("Sheet", app.char ? app.char.name : "", { back: "backToRoster" })}
    <main class="wrap page">
      <div class="sp-cards">${card("classic")}${card("advanced")}</div>
    </main>
    <div class="sp-confirm"><div class="wrap">
      <button class="btn pri block" data-a="styleConfirm" ${p ? "" : "disabled"}>${p ? `Use ${p.short}` : "Select a sheet"}</button>
    </div></div></div>`;
}
