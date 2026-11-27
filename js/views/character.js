// The Advanced sheet: Play Mode / Spells / Gear / Rolls / Features / Stats. (Classic is js/views/classic.js.)
import { esc, kRow, kGroup } from "../ui.js";
import { findByName, subclassesFor } from "../data.js";
import { CASTER_TYPE } from "../rules.js";
import { optionNames, optionGroup } from "../progression.js";
import { needsFirstChoices, spellsTab, loadoutGearTab } from "./sheet.js";
import { playTab } from "./play.js";
import { featuresView } from "./features.js";
import { statsTab, rollsTab } from "./stats.js";
import { buildCombat } from "../combat.js";
import { playEntries } from "../play.js";

export function subtabsFor(c) {
  const caster = !!CASTER_TYPE[c.class] || (c.spellcasting.spells || []).length > 0;
  return [["play", "Play"], caster ? ["spells", "Spells"] : null, ["gear", "Gear"], ["rolls", "Rolls"], ["features", "Features"], ["stats", "Stats"]].filter(Boolean);
}

export function characterBody(app, c, d) {
  const tabs = subtabsFor(c);
  const sub = tabs.some(s => s[0] === app.charSub) ? app.charSub : app.charSub === "more" ? "stats" : "play";
  const body = sub === "play" ? playTab(app, c, d) : sub === "spells" ? spellsTab(app, c, d) : sub === "gear" ? loadoutGearTab(app, c, d)
    : sub === "rolls" ? rollsTab(app, c, d) : sub === "features" ? featuresTab(app, c, d) : statsTab(app, c, d);
  return `<div class="subtabs seg" role="group" aria-label="Character sections" style="--n:${tabs.length}">
      ${tabs.map(([id, label]) => `<button data-a="charSub" data-sub="${id}" aria-pressed="${sub === id}">${label}</button>`).join("")}
    </div>${body}`;
}

function featuresTab(app, c) { return featuresView(app, c); }

export function findTile(app, c, d, id) {
  const all = playEntries(app, c, d).flatMap(e => [e, ...(e.kids || [])]);
  return all.find(x => x.id === id) || buildCombat(app, c, d).find(x => x.id === id) || null;
}

export function concBanner(app) {
  return app.concPrompt ? `<div class="concbanner" role="alert"><b>Concentration check</b><span>Constitution save, DC ${app.concPrompt.dc}${app.concPrompt.conc ? " to keep " + esc(app.concPrompt.conc) : ""}</span>
      <span class="btnrow"><button class="btn sm pri" data-a="concKeep">Kept it</button><button class="btn sm danger" data-a="concLose">Lost it</button></span></div>` : "";
}
