// The Character tab: Combat / Rolls / Features / Tools / Notes.
import { esc, ICONS, conditionIcon, formatText, activeChips, turnBar } from "../ui.js";
import { ABILITIES, ABILITY_LABEL, ABILITY_SHORT, fmtMod } from "../rules.js";
import { findByName, subclassesFor } from "../data.js";
import { optionNames, optionGroup } from "../progression.js";
import { buildCombat, sortCombat, COSTS, COST_LABEL } from "../combat.js";
import { hotbar, diceTab, needsFirstChoices } from "./sheet.js";
import { playTab } from "./play.js";
import { playEntries } from "../play.js";

export const SUBTABS = [["play", "Play Mode"], ["combat", "Combat"], ["rolls", "Rolls"], ["features", "Features"], ["tools", "Tools"], ["notes", "Notes"]];

export function characterBody(app, c, d) {
  const sub = SUBTABS.some(s => s[0] === app.charSub) ? app.charSub : "play";
  const body = sub === "play" ? playTab(app, c, d) : sub === "combat" ? combatTab(app, c, d) : sub === "rolls" ? rollsTab(app, c, d)
    : sub === "features" ? featuresTab(app, c, d) : sub === "tools" ? toolsTab(app, c, d) : notesTab(app, c, d);
  return `<div class="viewswap"><span class="sub2">Advanced sheet</span><button class="linkbtn" data-a="setPrefV" data-k="sheetStyle" data-v="classic">Switch to the classic sheet</button></div><div class="subtabs seg" role="group" aria-label="Character sections">
      ${SUBTABS.map(([id, label]) => `<button data-a="charSub" data-sub="${id}" aria-pressed="${sub === id}">${label}</button>`).join("")}
    </div>${body}`;
}

const switchRow = (k, label, hint, on) => `<div class="setrow"><div class="setinfo"><div class="setlabel">${label}</div><div class="sethint">${hint}</div></div>
  <button class="switch" role="switch" aria-checked="${on ? "true" : "false"}" aria-label="${esc(label)}" data-a="togglePref" data-k="${k}"><i></i></button></div>`;

function tileIcon(e) {
  return e.spell ? ICONS.bolt : e.src === "Attack" ? ICONS.sword : e.kind === "Trait" ? ICONS.shield : ICONS.spell;
}

// ---------------- Combat ----------------
export function combatEntries(app, c, d) {
  return buildCombat(app, c, d);
}

function combatTab(app, c, d) {
  const dying = c.hp.cur <= 0;
  const pips = (n, kind, cls) => Array.from({ length: 3 }, (_, i) =>
    `<button class="pip ${cls} ${i < n ? "" : "used"}" data-a="deathSave" data-kind="${kind}" data-i="${i}" aria-label="${kind} ${i + 1}"><i></i></button>`).join("");
  const all = combatEntries(app, c, d);
  const f = app.combatFilter || "All";
  const shown = sortCombat(all.filter(e => f === "All" || e.cost === f || (f === "Passive" && e.cost === "Passive")), app.combatSort);
  const count = k => all.filter(e => k === "All" || e.cost === k).length;
  const gwm = c.feats.includes("Great Weapon Master");
  const heavy = all.some(e => e.weaponId && /heavy/i.test((c.inventory.find(i => i.id === e.weaponId)?.weapon?.props) || ""));

  const onIds = new Set((c.active || []).map(a => a.id));
  const tile = e => `<button class="ctile ${e.block ? "off" : ""} ${onIds.has(e.id) ? "fxon" : ""} ${e.cost.toLowerCase()}" data-a="openTile" data-id="${esc(e.id)}" aria-label="${esc(e.name)}, ${COST_LABEL[e.cost]}${e.block ? ", unavailable: " + esc(e.block) : ""}">
      <span class="ct-ic">${tileIcon(e)}</span>
      <span class="ct-nm">${esc(e.name)}</span>
      <span class="ct-sub">${e.res ? (e.res.max != null ? `${e.res.cur}/${e.res.max} left` : `${e.res.cur} ${esc(e.res.label)}`) : esc(e.src)}${e.note ? ` · ${e.note}` : ""}</span>
      <span class="ct-cost">${onIds.has(e.id) ? "Active" : e.block ? "Unavailable" : COST_LABEL[e.cost]}</span>
    </button>`;

  return `
    ${app.prefs.turns ? turnBar(app) : ""}
    ${dying ? `<div class="panel"><div class="panel-head"><h2>Death saves</h2></div><div class="panel-body">
        <div class="rowline"><span class="nm">Successes</span><span class="pips">${pips(c.deathSaves.success, "success", "ok")}</span></div>
        <div class="rowline"><span class="nm">Failures</span><span class="pips">${pips(c.deathSaves.fail, "fail", "fail")}</span></div>
        <button class="btn pri block" data-a="rollDeathSave" ${c.deathSaves.fail >= 3 || c.deathSaves.success >= 3 ? "disabled" : ""}>Roll death save</button>
        <p class="small muted" style="margin-top:8px">Damage at 0 HP adds a failure automatically. Healing brings you back.</p></div></div>` : ""}
    ${hotbar(app, c, d)}
    ${gwm && heavy ? `<div class="panel"><div class="panel-body" style="padding:0 14px">${switchRow("gwm", "Great Weapon Master", "On: Heavy weapon attacks add your Proficiency Bonus to damage (once per turn, on a hit during the Attack action).", !!app.gwm)}</div></div>` : ""}
    <div class="combathead"><h2>What can I do?</h2>
      <label class="sortsel"><span class="sub2">Sort</span><select class="f" data-a="combatSort" aria-label="Sort abilities">
        ${[["avail", "Available first"], ["name", "A to Z"], ["source", "Source"]].map(([v, l]) => `<option value="${v}" ${(app.combatSort || "avail") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    ${shown.length ? `<div class="ctiles">${shown.map(tile).join("")}</div>` : `<p class="muted small" style="padding:14px 0">Nothing here for ${f === "All" ? "this character" : COST_LABEL[f].toLowerCase()} yet.</p>`}
    <p class="sub2" style="margin-top:12px">Greyed tiles can't be used right now; tap one to see why and read it. Action types are the app's reading of the rules text.</p>
    <div class="filterstrip" role="group" aria-label="Filter by action type">
      ${["All", ...COSTS].map(k => `<button data-a="combatFilter" data-k="${k}" aria-pressed="${f === k}">${k === "Bonus" ? "Bonus" : k === "Passive" ? "Passive" : k}<span>${count(k)}</span></button>`).join("")}
    </div>`;
}

// ---------------- Rolls ----------------
function rollsTab(app, c, d) {
  return `
    <div class="panel"><div class="panel-head"><h2>Abilities</h2><span class="sub2">Tap to roll</span></div><div class="panel-body">
      <div class="grid3 grid6">
        ${ABILITIES.map(a => `<button class="abil" data-a="rollAbility" data-ab="${a}">
          <span class="an">${ABILITY_SHORT[a]}</span><span class="am" style="display:block">${c.abilities[a]}</span><span class="as">${fmtMod(d.mods[a])}</span></button>`).join("")}
      </div></div></div>
    <div class="panel"><div class="panel-head"><h2>Saving throws</h2><span class="sub2">Tap to roll</span></div><div class="panel-body flush">
      ${ABILITIES.map(a => `<button class="rowline rollable" data-a="rollSave" data-ab="${a}">
        <span class="nm"><span class="dot ${c.saveProf.includes(a) ? "on" : ""}"></span>${ABILITY_LABEL[a]}</span><span class="val">${fmtMod(d.saves[a])}</span></button>`).join("")}
    </div></div>
    <div class="panel"><div class="panel-head"><h2>Skills</h2><span class="sub2">Dot: proficiency · name: roll</span></div><div class="panel-body flush">
      ${d.skills.map(s => `<div class="rowline"><span class="nm">
          <button class="pip" data-a="cycleSkill" data-id="${s.id}" aria-label="${s.label} proficiency: ${s.expert ? "expertise" : s.proficient ? "proficient" : "none"}" style="width:36px;margin-left:-8px">
            <i style="width:14px;height:14px;${s.expert ? "box-shadow:0 0 0 3px var(--amber-dim),0 0 0 5px var(--amber);" : ""}${s.proficient || s.expert ? "" : "background:transparent;border-color:var(--faint)"}"></i></button>
          <button class="linkbtn" style="text-decoration:none" data-a="rollSkill" data-id="${s.id}">${s.label} <span class="sub2">${ABILITY_SHORT[s.ability]}</span></button></span>
        <button class="val" style="color:var(--amber);min-height:36px" data-a="rollSkill" data-id="${s.id}">${fmtMod(s.bonus)}</button></div>`).join("")}
    </div></div>`;
}

// ---------------- Features ----------------
function featuresTab(app, c, d) {
  const cls = findByName(app.library.classes, c.class);
  const sub = c.subclass ? findByName(app.library.subclasses, c.subclass) : null;
  const hide = optionNames(cls), group = optionGroup(cls);
  const chosen = group ? (c.choices[group.key] || []) : [];
  const rows = [
    ...((cls?.features) || []).filter(f => f.lv <= c.level && !hide.has(f.name)).map(f => ({ g: "Class", name: f.name, sub: `Lv ${f.lv}`, lv: f.lv, kind: "classFeature", from: c.class })),
    ...((sub?.features) || []).filter(f => f.lv <= c.level && !f.intro).map(f => ({ g: "Class", name: f.name, sub: `${c.subclass} · Lv ${f.lv}`, lv: f.lv, kind: "subclassFeature", from: c.subclass })),
    ...chosen.map(n => ({ g: "Class", name: n, sub: group.label, lv: 99, kind: "classFeature", from: c.class })),
    { g: "Species", name: `${c.species} traits`, sub: "Species", lv: 0, kind: "species", dn: c.species },
    { g: "Background", name: c.background, sub: "Background", lv: 0, kind: "background", dn: c.background },
    ...c.feats.map((f, i) => ({ g: "Feats", name: f, sub: "Feat", lv: 50, kind: "feat", i }))
  ];
  const f = app.featFilter || "All", how = app.featSort || "level";
  const list = rows.filter(r => f === "All" || r.g === f).sort(how === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.lv - b.lv || a.name.localeCompare(b.name));
  return `
    <div class="panel"><div class="panel-head"><h2>Level ${c.level} ${esc(c.class)}</h2>
      <button class="btn sm pri" data-a="openLevelMenu" ${c.level >= 20 ? "disabled" : ""}>Level up</button></div>
      <div class="panel-body flush">
        ${!c.subclass && c.level >= 3 && subclassesFor(app.library, c.class).length ? `<div class="rowline"><span class="nm" style="color:var(--amber)">No subclass chosen yet</span><button class="btn sm" data-a="openEdit">Choose</button></div>` : ""}
        ${needsFirstChoices(app, c) ? `<div class="rowline"><span class="nm" style="color:var(--amber)">Level 1 choices not made yet</span><button class="btn sm pri" data-a="startFirstChoices">Choose</button></div>` : ""}
        ${(c.masteries || []).length ? `<div class="rowline"><span class="nm">Weapon mastery</span><span class="sub2" style="text-align:right">${esc(c.masteries.join(", "))}</span></div>` : ""}
        ${c.level >= 11 && !(cls?.features || []).some(x => x.lv > 10) ? `<p class="sub2" style="padding:8px 0">Your rules data stops at level 10, so level ${c.level} features aren't listed.</p>` : ""}
      </div></div>
    <div class="combathead"><div class="seg" role="group" aria-label="Filter features" style="flex:1">
      ${["All", "Class", "Species", "Feats"].map(k => `<button data-a="featFilter" data-k="${k}" aria-pressed="${f === k}">${k}</button>`).join("")}</div>
      <label class="sortsel"><span class="sub2">Sort</span><select class="f" data-a="featSort" aria-label="Sort features">
        ${[["level", "By level"], ["name", "A to Z"]].map(([v, l]) => `<option value="${v}" ${how === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <div class="panel"><div class="panel-body flush">
      ${list.map(r => `<button class="rowline rollable" data-a="showDetail" data-kind="${r.kind}" data-name="${esc(r.dn || r.name)}" ${r.from ? `data-from="${esc(r.from)}"` : ""} ${r.i != null ? `data-i="${r.i}"` : ""}>
        <span class="nm">${esc(r.name)}</span><span class="sub2">${esc(r.sub)}</span></button>`).join("")}
    </div></div>
    ${f === "Feats" ? `<div class="panel"><div class="panel-head"><h2>Add a feat</h2><button class="btn sm" data-a="openPicker" data-picker="feats">Add</button></div></div>` : ""}`;
}

// ---------------- Tools ----------------
function toolsTab(app, c, d) {
  const hd = c.hitDice;
  return `
    <div class="panel"><div class="panel-head"><h2>Turn helpers</h2><span class="sub2">Off unless you want them</span></div><div class="panel-body" style="padding:0 14px">
      ${switchRow("turns", "Turn tracker", "Shows Action, Bonus Action and Reaction on the Combat tab, and greys out what you've already used.", !!app.prefs.turns)}
      ${switchRow("concprompt", "Concentration prompts", "When you're hit while concentrating, asks you to make the Constitution save instead of just a note.", !!app.prefs.concprompt)}
    </div></div>
    <div class="panel"><div class="panel-head"><h2>Initiative and inspiration</h2></div><div class="panel-body stack">
      <div class="btnrow"><button class="btn pri" data-a="rollInit">Roll initiative ${fmtMod(d.initiative)}</button>
        <button class="btn ${c.inspiration ? "pri" : ""}" data-a="toggleInsp" aria-pressed="${!!c.inspiration}">Heroic Inspiration: ${c.inspiration ? "have it" : "none"}</button></div>
      <p class="sub2">Heroic Inspiration: reroll any die and keep the new roll. You can only hold one.</p>
    </div></div>
    <div class="panel"><div class="panel-head"><h2>Rests and hit dice</h2></div><div class="panel-body stack">
      <div class="rowline" style="border:0"><span class="nm">Hit dice left</span><b>${hd.total - hd.spent} / ${hd.total} <span class="sub2">d${hd.die}</span></b></div>
      <div class="btnrow"><button class="btn" data-a="openShortRest">Short rest</button><button class="btn" data-a="openLongRest">Long rest</button></div>
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
        </div>`).join("") : `<p class="muted small" style="padding:12px 0">Track things like Wild Shape, Rage or Channel Divinity uses. A tracker named like a feature links to it on the Combat tab.</p>`}
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
      <div class="field"><label>Armor, weapons, tools</label><textarea class="f" data-field="profsText" style="min-height:70px">${esc(c.profsText)}</textarea></div>
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
