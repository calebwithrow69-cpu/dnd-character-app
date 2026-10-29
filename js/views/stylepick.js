// First-run choice, shown full screen: Classic (the printed 2024 sheet) or Advanced (play-at-the-table tools).
// Appears until a style is picked. Changing it later is in Edit character (and Settings) and asks "Are you sure?".
import { topbar, ICONS } from "../ui.js";

const ROWS = [
  ["Layout", "One page like the printed 2024 sheet, with sub-tabs to jump around", "Tabs: Play, Spells, Gear, Rolls, Features, More"],
  ["Rolling", "Tap any modifier, save or skill to roll it", "Same, plus every action as a one-tap tile"],
  ["Reading abilities", "Tap a feature to read what it does", "Play Mode lists actions, bonus actions and reactions with their costs"],
  ["Health and armor class", "yes", "yes"],
  ["Search", "Search your whole sheet", "Search inside Play Mode and the rules"],
  ["Spells", "Slots, prepared spells, Cast button", "Same, plus concentration prompts"],
  ["Turn tracker", "no", "Action, Bonus Action and Reaction, with a new-turn button"],
  ["Gear", "Equipment slots, bag and coins", "Saved loadouts with a preview before you swap, weight and attunement"],
  ["Hotbar and shortcuts", "no", "Pin favorites; keyboard shortcuts on a laptop"],
  ["Best for", "New players, or anyone used to paper sheets", "Players who want the app to run their turn"]
];
const cell = v => v === "yes" ? `<span class="yes" aria-label="Yes">✓</span>` : v === "no" ? `<span class="no" aria-label="Not included">—</span>` : v;

export function stylePicker(app) {
  return `<div class="sheetview stylefull">
    ${topbar("Choose your sheet", app.char ? app.char.name : "", { back: "backToRoster" })}
    <main class="wrap page">
      <p class="sub2" style="margin:6px 0 14px">Both hold your whole character. Spells, gear and notes are all on the Character screen either way. You can switch later from Edit character, and nothing you entered is lost.</p>
      <div class="sp-cards">
        <button class="sp-card rec" data-a="setPrefV" data-k="sheetStyle" data-v="classic">
          <span class="sp-badge">Recommended if paper sheets feel familiar</span>
          <span class="sp-ic">${ICONS.book}</span><b>Classic sheet</b>
          <span class="sp-d">A virtual version of the printed 2024 character sheet.</span>
          <span class="sp-go">Use the classic sheet</span>
        </button>
        <button class="sp-card" data-a="setPrefV" data-k="sheetStyle" data-v="advanced">
          <span class="sp-badge alt">More tools</span>
          <span class="sp-ic">${ICONS.bolt}</span><b>Advanced sheet</b>
          <span class="sp-d">Built for playing at the table, split into tabs.</span>
          <span class="sp-go">Use the advanced sheet</span>
        </button>
      </div>
      <h2 class="sp-cmp-h">What is different</h2>
      <div class="sp-cmp" role="table" aria-label="Classic compared with Advanced">
        <div class="r head" role="row"><span role="columnheader"></span><span role="columnheader">Classic</span><span role="columnheader">Advanced</span></div>
        ${ROWS.map(([k, a, b]) => `<div class="r" role="row"><span class="k" role="rowheader">${k}</span><span role="cell">${cell(a)}</span><span role="cell">${cell(b)}</span></div>`).join("")}
      </div>
    </main></div>`;
}
