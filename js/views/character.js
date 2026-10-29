// The Advanced sheet: Play Mode / Spells / Gear / Rolls / Features / More. (Classic is js/views/classic.js.)
import { esc, ICONS, conditionIcon, formatText, activeChips, kRow, kGroup } from "../ui.js";
import { ABILITIES, ABILITY_LABEL, ABILITY_SHORT, fmtMod } from "../rules.js";
import { findByName, subclassesFor } from "../data.js";
import { CASTER_TYPE } from "../rules.js";
import { optionNames, optionGroup } from "../progression.js";
import { buildCombat } from "../combat.js";
import { diceTab, needsFirstChoices, spellsTab, loadoutGearTab } from "./sheet.js";
import { playTab } from "./play.js";
import { profsChecks } from "./classic.js";
import { playEntries } from "../play.js";

export function subtabsFor(c) {
  const caster = !!CASTER_TYPE[c.class] || (c.spellcasting.spells || []).length > 0;
  return [["play", "Play"], caster ? ["spells", "Spells"] : null, ["gear", "Gear"], ["rolls", "Rolls"], ["features", "Features"], ["more", "More"]].filter(Boolean);
}

export function characterBody(app, c, d) {
  const tabs = subtabsFor(c);
  const sub = tabs.some(s => s[0] === app.charSub) ? app.charSub : "play";
  const body = sub === "play" ? playTab(app, c, d) : sub === "spells" ? spellsTab(app, c, d) : sub === "gear" ? loadoutGearTab(app, c, d)
    : sub === "rolls" ? rollsTab(app, c, d) : sub === "features" ? featuresTab(app, c, d) : toolsTab(app, c, d) + notesTab(app, c, d);
  return `<div class="subtabs seg" role="group" aria-label="Character sections" style="--n:${tabs.length}">
      ${tabs.map(([id, label]) => `<button data-a="charSub" data-sub="${id}" aria-pressed="${sub === id}">${label}</button>`).join("")}
    </div>${body}`;
}

const switchRow = (k, label, hint, on) => `<div class="setrow"><div class="setinfo"><div class="setlabel">${label}</div><div class="sethint">${hint}</div></div>
  <button class="switch" role="switch" aria-checked="${on ? "true" : "false"}" aria-label="${esc(label)}" data-a="togglePref" data-k="${k}"><i></i></button></div>`;

// ---------------- Rolls ----------------
function rollsTab(app, c, d) {
  return `
    <div class="panel"><div class="panel-head"><h2>Abilities</h2><span class="sub2">Tap to roll a check</span></div><div class="panel-body">
      <div class="grid3 grid6">
        ${ABILITIES.map(a => `<button class="abil" data-a="rollAbility" data-ab="${a}">
          <span class="an">${ABILITY_SHORT[a]}</span><span class="am" style="display:block">${c.abilities[a]}</span><span class="as">${fmtMod(d.mods[a])}</span></button>`).join("")}
      </div></div></div>
    ${kGroup("Saving throws", c.saveProf.length + " proficient", { tone: "amber" })}<div class="k-list">
      ${ABILITIES.map(a => kRow({ glyph: ABILITY_SHORT[a], tone: c.saveProf.includes(a) ? "amber" : "faint", title: ABILITY_LABEL[a], cap: c.saveProf.includes(a) ? "Proficient" : "",
        status: fmtMod(d.saves[a]), mainAttrs: `data-a="rollSave" data-ab="${a}"` })).join("")}</div>
    ${kGroup("Skills", "dot = proficiency, row = roll", { tone: "blue" })}<div class="k-list">
      ${d.skills.map(s => kRow({ glyph: ABILITY_SHORT[s.ability], tone: s.expert ? "amber" : s.proficient ? "blue" : "faint", title: s.label,
        cap: s.expert ? "Expertise" : s.proficient ? "Proficient" : "", status: fmtMod(s.bonus), mainAttrs: `data-a="rollSkill" data-id="${s.id}"`,
        actions: `<button class="pip" data-a="cycleSkill" data-id="${s.id}" aria-label="${s.label} proficiency: ${s.expert ? "expertise" : s.proficient ? "proficient" : "none"}"><i style="width:14px;height:14px;${s.expert ? "box-shadow:0 0 0 3px var(--amber-dim),0 0 0 5px var(--amber);" : ""}${s.proficient || s.expert ? "" : "background:transparent;border-color:var(--faint)"}"></i></button>` })).join("")}</div>`;
}

// ---------------- Features ----------------
function featuresTab(app, c, d) {
  const cls = findByName(app.library.classes, c.class);
  const sub = c.subclass ? findByName(app.library.subclasses, c.subclass) : null;
  const hide = optionNames(cls), group = optionGroup(cls);
  const chosen = group ? (c.choices[group.key] || []) : [];
  const classRows = [
    ...((cls?.features) || []).filter(f => f.lv <= c.level && !hide.has(f.name)).map(f => ({ name: f.name, sub: `Level ${f.lv}`, lv: f.lv, kind: "classFeature", from: c.class })),
    ...((sub?.features) || []).filter(f => f.lv <= c.level && !f.intro).map(f => ({ name: f.name, sub: `${c.subclass} \u00b7 level ${f.lv}`, lv: f.lv, kind: "subclassFeature", from: c.subclass })),
    ...chosen.map(n => ({ name: n, sub: group.label, lv: 99, kind: "classFeature", from: c.class }))
  ].sort((a, b) => a.lv - b.lv || a.name.localeCompare(b.name));
  const rowOf = (r, tone, glyph) => kRow({ glyph: glyph || r.name[0], tone, title: r.name, cap: r.sub,
    mainAttrs: `data-a="showDetail" data-kind="${r.kind}" data-name="${esc(r.dn || r.name)}" ${r.from ? `data-from="${esc(r.from)}"` : ""} ${r.i != null ? `data-i="${r.i}"` : ""}` });
  const warn = [
    !c.subclass && c.level >= 3 && subclassesFor(app.library, c.class).length ? `<div class="rowline"><span class="nm" style="color:var(--amber)">No subclass chosen yet</span><button class="btn sm" data-a="openEdit">Choose</button></div>` : "",
    needsFirstChoices(app, c) ? `<div class="rowline"><span class="nm" style="color:var(--amber)">Level 1 choices not made yet</span><button class="btn sm pri" data-a="startFirstChoices">Choose</button></div>` : "",
    (c.masteries || []).length ? `<div class="rowline"><span class="nm">Weapon mastery</span><span class="sub2" style="text-align:right">${esc(c.masteries.join(", "))}</span></div>` : "",
    c.level >= 11 && !(cls?.features || []).some(x => x.lv > 10) ? `<p class="sub2" style="padding:8px 0">Your rules data stops at level 10, so level ${c.level} features aren't listed.</p>` : ""
  ].join("");
  return `
    <div class="panel"><div class="panel-head"><h2>Level ${c.level} ${esc(c.class)}</h2>
      <button class="btn sm pri" data-a="openLevelMenu" ${c.level >= 20 ? "disabled" : ""}>Level up</button></div>
      ${warn ? `<div class="panel-body flush">${warn}</div>` : ""}</div>
    ${kGroup("Class", classRows.length, { tone: "amber" })}<div class="k-list">${classRows.map(r => rowOf(r, "amber")).join("")}</div>
    ${kGroup("Species and background", 2, { tone: "green" })}<div class="k-list">
      ${rowOf({ name: `${c.species} traits`, sub: "Species", kind: "species", dn: c.species }, "green")}
      ${rowOf({ name: c.background, sub: "Background", kind: "background", dn: c.background }, "blue")}</div>
    ${kGroup("Feats", c.feats.length, { tone: "feat" })}<div class="k-list">
      ${c.feats.map((f, i) => rowOf({ name: f, sub: "Feat", kind: "feat", i }, "feat")).join("")}</div>
    <div class="btnrow" style="margin-top:10px"><button class="btn" data-a="openPicker" data-picker="feats">Add a feat</button></div>`;
}

// ---------------- Tools ----------------
function toolsTab(app, c, d) {
  const hd = c.hitDice;
  return `
    <div class="panel"><div class="panel-head"><h2>Turn helpers</h2><span class="sub2">Off unless you want them</span></div><div class="panel-body" style="padding:0 14px">
      ${switchRow("turns", "Turn tracker", "Shows Action, Bonus Action and Reaction on the Play tab, and greys out what you've already used.", !!app.prefs.turns)}
      ${switchRow("concprompt", "Concentration prompts", "When you're hit while concentrating, asks you to make the Constitution save instead of just a note.", !!app.prefs.concprompt)}
    </div></div>
    <div class="panel"><div class="panel-head"><h2>Rests and inspiration</h2></div><div class="panel-body stack">
      <div class="rowline" style="border:0"><span class="nm">Hit dice left</span><b>${hd.total - hd.spent} / ${hd.total} <span class="sub2">d${hd.die}</span></b></div>
      <div class="btnrow"><button class="btn" data-a="openShortRest">Short rest</button><button class="btn" data-a="openLongRest">Long rest</button></div>
      <button class="btn ${c.inspiration ? "pri" : ""}" data-a="toggleInsp" aria-pressed="${!!c.inspiration}">Heroic Inspiration: ${c.inspiration ? "have it" : "none"}</button>
      <p class="sub2">Heroic Inspiration: reroll any die and keep the new roll. You can only hold one. Initiative is the button in the header.</p>
    </div></div>
    ${trackersPanel(c)}
    <div class="panel"><div class="panel-head"><h2>Conditions</h2><button class="btn sm" data-a="openConditions">Change</button></div>
      <div class="panel-body">${c.conditions.length || c.exhaustion || (c.active || []).length ? `<div class="chips" style="margin:0">${activeChips(c, true)}${c.conditions.map(x => `<span class="chip cond"><button class="chip-main" data-term="condition:${esc(x)}">${conditionIcon(x)}${esc(x)}</button></span>`).join("")}${c.exhaustion ? `<span class="chip cond"><button class="chip-main" data-term="condition:Exhaustion">${conditionIcon("Exhaustion")}Exhaustion ${c.exhaustion}</button></span>` : ""}</div><p class="sub2" style="margin-top:8px">Tap a condition to see what it does.</p>` : `<span class="muted small">None</span>`}</div></div>
    <h2 class="toolh">Dice tray</h2>
    ${diceTab(app)}`;
}

function trackersPanel(c) {
  return `<div class="panel"><div class="panel-head"><h2>Trackers</h2><button class="btn sm" data-a="openResource">Add</button></div>
      <div class="panel-body flush">
        ${c.resources.length ? c.resources.map((r, i) => `<div class="rowline">
          <button class="nm linkbtn" style="text-decoration:none;flex-direction:column;align-items:flex-start;gap:0" data-a="openResource" data-i="${i}">
            <span>${esc(r.name)}</span><span class="sub2">Resets on ${r.reset === "short" ? "short or long" : "long"} rest${r.note ? " · " + esc(r.note) : ""}</span></button>
          ${r.max <= 8
            ? `<span class="pips">${Array.from({ length: r.max }, (_, k) => `<button class="pip ${k < r.max - r.used ? "" : "used"}" data-a="toggleResource" data-i="${i}" data-k="${k}" aria-label="${esc(r.name)} ${k + 1}"><i></i></button>`).join("")}</span>`
            : `<span class="stepper"><button data-a="resStep" data-i="${i}" data-n="1" aria-label="Use one">−</button><b>${r.max - r.used}</b><button data-a="resStep" data-i="${i}" data-n="-1" aria-label="Regain one">+</button></span>`}
        </div>`).join("") : `<p class="muted small" style="padding:12px 0">Track things like Wild Shape, Rage or Channel Divinity uses. A tracker named like a feature links to it on the Play tab.</p>`}
      </div></div>`;
}

// ---------------- Notes ----------------
function notesTab(app, c) {
  return `
    <div class="panel"><div class="panel-head"><h2>Notes</h2><span class="sub2">Saves as you type</span></div><div class="panel-body">
      <textarea class="f" data-field="notes" aria-label="Notes" style="min-height:170px">${esc(c.notes)}</textarea></div></div>
    ${c.classFeatureNotes ? `<div class="panel"><div class="panel-head"><h2>Class notes</h2></div><div class="panel-body">
      <textarea class="f" data-field="classFeatureNotes" aria-label="Class notes">${esc(c.classFeatureNotes)}</textarea></div></div>` : ""}
    <div class="panel"><div class="panel-head"><h2>Proficiencies &amp; languages</h2></div><div class="panel-body stack">
      ${profsChecks(c)}
      <div class="field"><label>Tools and other training</label><textarea class="f" data-field="profsText" style="min-height:60px">${esc(c.profsText)}</textarea></div>
      <div class="field"><label>Languages</label><input class="f" data-field="languages" value="${esc(c.languages)}"></div>
    </div></div>
    <button class="btn block pdfbtn" data-a="downloadPdf">Download character sheet (PDF)</button>`;
}

export function findTile(app, c, d, id) {
  const all = playEntries(app, c, d).flatMap(e => [e, ...(e.kids || [])]);
  return all.find(x => x.id === id) || buildCombat(app, c, d).find(x => x.id === id) || null;
}

export function concBanner(app) {
  return app.concPrompt ? `<div class="concbanner" role="alert"><b>Concentration check</b><span>Constitution save, DC ${app.concPrompt.dc}${app.concPrompt.conc ? " to keep " + esc(app.concPrompt.conc) : ""}</span>
      <span class="btnrow"><button class="btn sm pri" data-a="concKeep">Kept it</button><button class="btn sm danger" data-a="concLose">Lost it</button></span></div>` : "";
}
