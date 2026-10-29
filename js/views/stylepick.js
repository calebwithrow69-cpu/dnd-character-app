// First-run choice: Classic (the printed 2024 sheet) or Advanced (play-at-the-table tools).
// Shown on the Character screen until a style is picked; changing it later asks "Are you sure?".
import { ICONS } from "../ui.js";

export function stylePicker(app) {
  return `<section class="stylepick" aria-labelledby="sp-h">
    <h2 id="sp-h">How do you want your sheet?</h2>
    <p class="sub2">Both hold your whole character: abilities, spells, gear and notes all live on this screen. You can switch later in Settings, and nothing you entered is lost.</p>
    <div class="sp-cards">
      <button class="sp-card rec" data-a="setPrefV" data-k="sheetStyle" data-v="classic">
        <span class="sp-badge">Recommended if this is familiar</span>
        <span class="sp-ic">${ICONS.book}</span>
        <b>Classic sheet</b>
        <span class="sp-d">A virtual version of the printed 2024 character sheet, on one page.</span>
        <ul><li>Same layout as the paper sheet</li><li>Tap a number to roll it, tap a feature to read it</li><li>Track health and armor class</li><li>Search your sheet</li></ul>
        <span class="sp-go">Use the classic sheet</span>
      </button>
      <button class="sp-card" data-a="setPrefV" data-k="sheetStyle" data-v="advanced">
        <span class="sp-badge alt">More tools</span>
        <span class="sp-ic">${ICONS.bolt}</span>
        <b>Advanced sheet</b>
        <span class="sp-d">Built for playing at the table, split into tabs.</span>
        <ul><li>Play Mode: every action, spell and ability as one-tap tiles</li><li>Turn tracker, concentration prompts, spell slots</li><li>Gear loadouts you can save and preview</li><li>Hotbar, trackers, conditions, dice tray</li><li>Keyboard shortcuts on a laptop</li></ul>
        <span class="sp-go">Use the advanced sheet</span>
      </button>
    </div>
  </section>`;
}
