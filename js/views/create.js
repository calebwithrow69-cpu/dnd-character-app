// Character creation, codex style: Class, Species and Background are the same sortable
// portrait list; then ability scores (with the background bonus), skills and gear, and a
// final page for the name and roleplay details. "View progress" opens a sheet of every chapter.
// All data and validation live in ../creation.js. ASCII only in this file.
import { esc, topbar, formatText, searchBox, infoRow } from "../ui.js";
import { enabledClasses, enabledSpecies, enabledBackgrounds, findByName, subclassesFor } from "../data.js";
import { ABILITIES, ABILITY_LABEL, SKILLS, parseList, abilityMod, fmtMod, speciesSpeed, speciesSize } from "../rules.js";
import { draftChoices, optionsFor, backgroundToolChoice, backgroundFeatNames, bgSkillIds, bgAbilityIds } from "../choices.js";
import { fmtPrice } from "../equipment.js";
import { parseSpecies, classifyText } from "../species.js";
import { renderCodexList, renderControls } from "./codex.js";
import { levelBody, levelWhy } from "./levelup.js";
import { stepValidFor } from "../progression.js";
import {
  CHAPTERS, ALIGNMENTS, validateChapter, validateAll, unresolvedDecisions, choicePlan, bgAbilities, takenSkills, classSkillOptions,
  finalAbilities, suggestedArray, equipOptions, gearChoices
} from "../creation.js";

const firstLineOf = t => { const s = String(t || "").split("\n")[0]; return s.length > 90 ? s.slice(0, 88) + "\u2026" : s; };
const LIST_KINDS = ["class", "species", "background"];
export const chapterId = d => CHAPTERS[d.chapter] ? CHAPTERS[d.chapter].id : CHAPTERS[0].id;
const NOTE = "A Trait is always on. An Ability takes an action or has limited uses. Those two tags and the usage line are this app's reading of the text; the words inside each one are the book's, unchanged.";


// ---- one choice (skill, feat, lineage, spell\u2026)
function choiceDetail(app, o) {
  if (o.detail) return formatText(o.detail);
  if (!o.term) return "";
  const [kind, name] = [o.term.slice(0, o.term.indexOf(":")), o.term.slice(o.term.indexOf(":") + 1)];
  const L = app.library, C = app.campaign;
  if (kind === "feat") { const f = [...L.feats, ...(C.homebrew?.feats || [])].find(x => x.name === name); return f ? `<p class="sub2">${esc(f.type || "")}</p>` + formatText(f.text) : ""; }
  if (kind === "spell") { const s = [...L.spells, ...(C.homebrew?.spells || [])].find(x => x.name === name); return s ? `<p class="sub2">${esc([s.time, s.range, s.dur].filter(Boolean).join(" \u00b7 "))}</p>` + formatText(s.text) : ""; }
  return "";
}

export function renderChoice(app, d, def) {
  const opts = optionsFor(def, app, d);
  const cur = [].concat(d.picks[def.id] || []);
  const full = cur.length >= def.n;
  const head = `<div class="choice-head"><h3>${esc(def.label)}</h3>
      <span class="sub2">${esc(def.trait && def.trait !== def.label ? def.trait + " \u00b7 " : "")}${esc(def.from)}${def.n > 1 ? ` \u00b7 pick ${def.n} (${cur.length}/${def.n})` : ""}</span></div>
      ${def.hint ? `<p class="small muted">${esc(def.hint)}</p>` : ""}`;
  if (def.kind === "text") {
    return `<div class="choice">${head}<input class="f" data-pick-text="${esc(def.id)}" value="${esc(d.picks[def.id] || "")}" placeholder="${esc(def.placeholder || "Your choice")}" autocomplete="off">
      <p class="sub2" style="margin-top:4px">Optional \u2014 you can fill this in later on your sheet.</p></div>`;
  }
  if (!opts.length) return `<div class="choice">${head}<p class="small muted">${def.kind === "spell" ? "Choose the spell list above first." : "No options available."}</p></div>`;
  const rich = opts.some(o => o.detail || o.term);
  if (!rich) {
    return `<div class="choice">${head}<div class="chips">${opts.map(o => {
      const on = cur.includes(o.v);
      return `<button class="chipbtn" data-a="pick" data-id="${esc(def.id)}" data-v="${esc(o.v)}" aria-pressed="${on}" ${!on && full && def.n > 1 ? "disabled" : ""}>${esc(o.label || o.v)}${o.sub ? `<span>${esc(o.sub)}</span>` : ""}</button>`;
    }).join("")}</div></div>`;
  }
  return `<div class="choice">${head}<div class="optlist">${opts.map(o => {
    const on = cur.includes(o.v), key = `choice:${def.id}:${o.v}`, open = app.info.has(key);
    return infoRow({ key, action: "pick", data: { id: def.id, v: o.v }, title: o.label || o.v, sub: esc(o.sub || ""),
      pressed: on, disabled: !on && full && def.n > 1, open, detail: open ? choiceDetail(app, o) : "", badge: on ? `<span class="tag amber">Chosen</span>` : "" });
  }).join("")}</div></div>`;
}
const firstLine = firstLineOf;

// Choices as tiles (used by the species picker): name, one line of what it does,
// and the full rules text for whatever is picked, shown right under the tiles.
export function renderTileChoice(app, d, def) {
  const opts = optionsFor(def, app, d);
  const cur = [].concat(d.picks[def.id] || []);
  const full = cur.length >= def.n;
  const head = `<div class="choice-head"><h3>${esc(def.label)}</h3>
      <span class="sub2">${esc(def.trait && def.trait !== def.label ? def.trait + " \u00b7 " : "")}${def.n > 1 ? `pick ${def.n} (${cur.length}/${def.n})` : "pick one"}</span></div>
      ${def.hint && def.kind !== "text" ? `<p class="small muted">${esc(def.hint)}</p>` : ""}`;
  if (def.kind === "text") return renderChoice(app, d, def);
  if (!opts.length) return renderChoice(app, d, def);
  const picked = opts.filter(o => cur.includes(o.v));
  return `<div class="choice tiles">${head}<div class="tilegrid">${opts.map(o => {
    const on = cur.includes(o.v), sub = o.sub || "";
    return `<button class="tile" data-a="pick" data-id="${esc(def.id)}" data-v="${esc(o.v)}" aria-pressed="${on}" ${!on && full && def.n > 1 ? "disabled" : ""}>
      <span class="grow"><b>${esc(o.label || o.v)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${on ? `<span class="tick" aria-hidden="true">&#10003;</span>` : ""}</button>`;
  }).join("")}</div>
    ${picked.map(o => { const det = choiceDetail(app, o); return det ? `<div class="about tile-about"><p class="sub2"><b>${esc(o.label || o.v)}</b></p>${det}</div>` : ""; }).join("")}</div>`;
}


function renderBonus(app, d) {
  const opts = bgAbilities(app, d);
  if (!opts.length) return "";
  const cls = findByName(app.library.classes, d.class);
  const optSel = (key, exclude) => `<select class="f" data-draft="${key}">
      <option value="">Choose\u2026</option>
      ${opts.filter(a => a !== exclude).map(a => `<option value="${a}" ${d[key] === a ? "selected" : ""}>${ABILITY_LABEL[a]}</option>`).join("")}
    </select>`;
  return `<div class="choice"><div class="choice-head"><h3>Ability score increases</h3><span class="sub2">${esc(d.background)}</span></div>
    <p class="small">Raise ${opts.map(a => ABILITY_LABEL[a]).join(", ")}.${cls ? ` ${esc(cls.name)}s rely most on <b>${esc(cls.primary)}</b>.` : ""}</p>
    <div class="seg" role="group" aria-label="Bonus type" style="margin-top:8px">
      <button data-a="bonusMode" data-mode="21" aria-pressed="${d.bonusMode === "21"}">+2 and +1</button>
      <button data-a="bonusMode" data-mode="111" aria-pressed="${d.bonusMode === "111"}">+1 to all three</button>
    </div>
    ${d.bonusMode === "21" ? `<div class="grid2" style="margin-top:8px">
      <div class="field"><label>+2 to</label>${optSel("plus2", null)}</div>
      <div class="field"><label>+1 to</label>${optSel("plus1", d.plus2)}</div></div>` : ""}</div>`;
}


function renderEquipGroup(app, d, which) {
  const opts = equipOptions(app, which, d);
  const key = which === "class" ? "equipClass" : "equipBg";
  const name = which === "class" ? d.class : d.background;
  if (!opts.length) return "";
  return `<div class="choice"><div class="choice-head"><h3>From your ${which === "class" ? "class" : "background"}</h3><span class="sub2">${esc(name)}</span></div>
    <div class="optlist">${opts.map(o => {
      const on = d[key] === o.key;
      const gc = on ? gearChoices(app, d).filter(g => g.which === which) : [];
      const list = o.items.map((i, k) => { const g = gc.find(x => x.index === k); const nm = g ? (g.fixed || d.picks[g.id] || i.name) : i.name; return `${i.qty > 1 ? i.qty + " \u00d7 " : ""}${nm}`; }).join(", ");
      return `<button class="optcard" data-a="pickEquip" data-which="${key}" data-k="${o.key}" aria-pressed="${on}">
        <span class="grow"><b>${o.items.length ? `Option ${o.key}: gear + ${fmtPrice(o.gp)}` : `Option ${o.key}: ${fmtPrice(o.gp)} to spend`}</b>
        <span>${esc(list || "Buy your own gear in the shop after you finish.")}</span></span>${on ? `<span class="tag amber">Chosen</span>` : ""}</button>
        ${on ? gearChoices(app, d).filter(g => g.which === which && !g.fixed).map(g => `<div class="field gearpick"><label>Choose: ${esc(g.label)}</label>
          <select class="f" data-gear-pick="${esc(g.id)}"><option value="">Choose\u2026</option>
          ${g.options.map(o => `<option value="${esc(o)}" ${d.picks[g.id] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`).join("") : ""}`;
    }).join("")}</div></div>`;
}



// ---- the three codex lists
function cfgFor(app, d, kind) {
  const { library: L, campaign: C } = app;
  const base = { kind, query: d.query || "", traitsTitle: "Features", note: () => NOTE, intro: () => "", lore: () => "" };
  const srcOf = items => [...new Set(items.map(o => o.source || "No source"))].sort();
  if (kind === "species") {
    const items = enabledSpecies(L, C), srcs = srcOf(items);
    return {
      ...base, items, selected: d.species, noun: "species", sources: true, filterLabel: "Source", filterOptions: ["All", ...srcs],
      test: (o, f) => (o.source || "No source") === f,
      sub: s => [speciesSize(s.traits), `speed ${speciesSpeed(s.traits)} ft`, s.source].filter(Boolean).join(" \u00b7 "),
      facts: s => parseSpecies(s).facts.map(f => [f.k, f.v]),
      intro: s => parseSpecies(s).intro.join("\n\n"), lore: s => s.desc || "",
      traits: s => parseSpecies(s).traits.map(t => ({ name: t.name, kind: t.kind, usage: t.usage, level: t.level, body: t.body })),
      traitsTitle: "Traits and abilities",
      chosen: () => draftChoices(app, d, "species").map(def => renderTileChoice(app, d, def)).join("")
    };
  }
  if (kind === "class") {
    const items = enabledClasses(L, C);
    const caster = c => (c.features || []).some(f => /^(Spellcasting|Pact Magic)$/i.test(f.name));
    return {
      ...base, items, selected: d.class, noun: "classes", sources: new Set(items.map(c => c.source)).size > 1, filterLabel: "Type",
      filterOptions: ["All", "Spellcasters", "Martial"], test: (c, f) => f === "Spellcasters" ? caster(c) : !caster(c),
      sub: c => `d${c.hd} hit die \u00b7 ${c.primary || ""}${caster(c) ? " \u00b7 Spellcaster" : ""}`,
      facts: c => [["Hit die", "d" + c.hd], ["Primary ability", c.primary], ["Saving throws", parseList(c.saves).join(", ")],
        ["Armor training", c.armorProf || "None"], ["Weapon training", c.weaponProf], c.toolProf ? ["Tool training", c.toolProf] : null,
        ["Skills", `Choose ${c.skillN}: ${parseList(c.skillFrom).join(", ")}`]].filter(Boolean).filter(f => f[1]),
      lore: c => c.desc || "", laterCollapsed: true,
      traits: c => (c.features || []).filter(f => f.lv <= 10).map(f => ({ name: f.name, level: f.lv, body: f.text, ...classifyText(f.text) }))
    };
  }
  const items = enabledBackgrounds(L, C);
  const featBase = n => n.replace(/\s*\(.*$/, "");
  const feats = [...new Set(items.flatMap(b => backgroundFeatNames(b).map(featBase)))].sort();
  return {
    ...base, items, selected: d.background, noun: "backgrounds", sources: false, filterLabel: "Feat", filterOptions: ["All", ...feats],
    test: (b, f) => backgroundFeatNames(b).some(n => featBase(n) === f),
    sub: b => [bgAbilityIds(b).map(a => ABILITY_LABEL[a].slice(0, 3)).join("/"), parseList(b.skills).join(", "), backgroundFeatNames(b).join(" or ")].filter(Boolean).join(" \u00b7 "),
    facts: b => {
      const tool = backgroundToolChoice(b), eq = (/Equipment:\s*([^\n]+)/.exec(b.effect || "") || [])[1];
      return [["Ability scores", bgAbilityIds(b).map(a => ABILITY_LABEL[a]).join(", ")], ["Skills", parseList(b.skills).join(", ")], ["Tool", tool ? (tool.fixed || "Your choice of one") : ""],
        ["Feat", backgroundFeatNames(b).join(" or ")], ["Equipment", eq || ""]].filter(f => f[1]);
    },
    lore: b => b.desc || "",
    traits: b => backgroundFeatNames(b).map(n => {
      const f = [...L.feats, ...(C.homebrew?.feats || [])].find(x => x.name === featBase(n));
      return { name: "Feat: " + n, kind: "passive", usage: "Granted at level 1", level: 1, body: f ? f.text : "Tap the feat name on your sheet to read it." };
    }),
    traitsTitle: "What you get",
    note: () => "Raise two or three of these ability scores (+2/+1, or +1 each) on the Ability scores step.",
    chosen: () => draftChoices(app, d, "bg").map(def => renderTileChoice(app, d, def)).join("")
  };
}
export function listItems(app, d, kind) { return cfgFor(app, d, kind).items; }

export function renderWizardResults(app) {
  const d = app.createDraft, id = chapterId(d);
  return LIST_KINDS.includes(id) ? renderCodexList(app, cfgFor(app, d, id)) : "";
}

// ---- progress sheet
function chapterValue(app, d, id) {
  if (id === "class") return d.class;
  if (id === "species") return d.species;
  if (id === "background") return d.background;
  if (id === "abilities") { if (!d.background) return ""; const f = finalAbilities(app, d); return ABILITIES.map(a => `${a.toUpperCase()} ${f[a]}`).join(" \u00b7 "); }
  if (id === "classOpts") return d.class ? `${d.classSkills.length} class skills \u00b7 gear options ${d.equipClass} and ${d.equipBg}` : "";
  if (id === "classChoices") {
    const cp = choicePlan(d, app); if (!cp) return "";
    const l = cp.lvl, n = [l.subclass, l.style, ...l.expertise, ...l.mastery, ...l.options, ...l.cantrips, ...l.spells].filter(Boolean).length;
    return cp.steps.length ? `${n} choice${n === 1 ? "" : "s"} made` : "Nothing to choose";
  }
  return d.name.trim();
}
export function reachIndex(app, d) {
  for (let i = 0; i < CHAPTERS.length; i++) if (!validateChapter(CHAPTERS[i].id, d, app).valid) return i;
  return CHAPTERS.length - 1;
}
function progressSheet(app, d) {
  const reach = reachIndex(app, d);
  const rows = CHAPTERS.map((c, i) => {
    const v = validateChapter(c.id, d, app), val = chapterValue(app, d, c.id);
    const ok = v.valid && (c.id !== "abilities" || !!d.background) && (i < d.chapter || i !== d.chapter || c.id !== "finish");
    const done = v.valid && c.id !== "finish" || (c.id === "finish" && v.valid);
    const line = done ? (val || "Done") : (v.reasons[0] || "Still to do");
    return `<button class="prow ${done ? "done" : ""}" data-a="gotoChapter" data-i="${i}" ${i > reach ? "disabled" : ""}>
      <span class="n">${done ? "\u2713" : i + 1}</span>
      <span class="grow"><b>${esc(c.title)}</b><small class="${done ? "" : "miss"}">${esc(line)}</small></span>
      <span class="sub2">${i === d.chapter ? "You are here" : i > reach ? "Locked" : "Edit"}</span></button>`;
  }).join("");
  const complete = CHAPTERS.filter(c => validateChapter(c.id, d, app).valid).length;
  return `<div class="modal-back" data-a="closeProgressBackdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Progress so far">
    <div class="modal-head"><h2>Progress so far</h2><button class="iconbtn" data-a="closeProgress" aria-label="Close">&times;</button></div>
    <div class="modal-body">${rows}<p class="sub2" style="margin-top:12px">${complete} of ${CHAPTERS.length} chapters complete. Later chapters unlock as you finish the ones before them.</p></div></div></div>`;
}

// ---- chapter bodies
function abilitiesBody(app, d) {
  const fin = finalAbilities(app, d), cls = findByName(app.library.classes, d.class);
  const sug = suggestedArray(app, d.class);
  return `<p class="small muted">${cls ? `${esc(cls.name)}s rely most on <b>${esc(cls.primary)}</b>. ` : ""}Set your base scores first, then apply your background's bonus below.</p>
    <div class="btnrow" style="margin-top:10px">
      ${sug ? `<button class="btn sm pri" data-a="suggestedArray">Suggested for ${esc(d.class)}</button>` : ""}
      <button class="btn sm" data-a="standardArray">Standard array</button>
      <button class="btn sm" data-a="rollStats">Roll 4d6 for each</button>
    </div>
    ${d.rolls ? `<p class="sub2" style="margin-top:6px">Your roll is saved: ${ABILITIES.map(a => d.rolls[a]).join(", ")}. Reloading will not roll again.</p>` : ""}
    <div class="grid3" style="margin-top:12px">
      ${ABILITIES.map(a => `<label class="abil"><span class="an">${ABILITY_LABEL[a]}</span>
        <input type="number" inputmode="numeric" min="3" max="20" data-draft-ability="${a}" value="${d.base[a]}" aria-label="${ABILITY_LABEL[a]} base score">
        <span class="as" data-final="${a}">${fin[a] !== d.base[a] ? "\u2192 " + fin[a] + " " : ""}(${fmtMod(abilityMod(fin[a]))})</span></label>`).join("")}
    </div>
    <p class="sub2" style="margin-top:8px">Under each score: the final score after your background bonus, and its modifier.</p>
    ${renderBonus(app, d) || `<p class="muted small" style="margin-top:12px">Choose a background first to see its bonus.</p>`}`;
}

function skillsGearBody(app, d) {
  const taken = takenSkills(app, d), { from, n } = classSkillOptions(app, d);
  const choices = from.filter(id => !taken.includes(id)), need = Math.min(n, choices.length);
  const toolDefs = draftChoices(app, d, "class");
  const subs = subclassesFor(app.library, d.class), lvl = app.campaign.startingLevel || 1;
  return `<div class="stack">
    ${toolDefs.map(def => renderChoice(app, d, def)).join("")}
    <div class="choice"><div class="choice-head"><h3>Class skills</h3><span class="sub2">Pick ${need} \u00b7 ${d.classSkills.length}/${need} chosen</span></div>
      <div class="optlist">
        ${taken.map(id => `<div class="optcard locked" aria-pressed="true"><input type="checkbox" checked disabled><span class="grow"><b>${esc(SKILLS.find(s => s.id === id).label)}</b><span>Already yours</span></span></div>`).join("")}
        ${choices.map(id => { const on = d.classSkills.includes(id), s = SKILLS.find(x => x.id === id);
          return `<label class="optcard" aria-pressed="${on}"><input type="checkbox" data-a="toggleSkill" data-id="${id}" ${on ? "checked" : ""} ${!on && d.classSkills.length >= need ? "disabled" : ""}><span class="grow"><b>${esc(s.label)}</b><span>${ABILITY_LABEL[s.ability]}</span></span></label>`; }).join("")}
      </div></div>
    ${renderEquipGroup(app, d, "class")}${renderEquipGroup(app, d, "bg")}
    <p class="sub2">Gear goes straight into your inventory, and armor, shield and weapons are put on for you. Gold can be spent in the shop on your Gear tab.</p></div>`;
}

function choiceLines(app, d) {
  const cp = choicePlan(d, app); if (!cp) return [];
  const l = cp.lvl, out = [];
  const grp = cp.steps.find(x => x.id === "options");
  if (l.subclass) out.push(["Subclass", l.subclass]);
  if (l.style) out.push(["Fighting style", l.style]);
  if (l.expertise.length) out.push(["Expertise", l.expertise.map(id => SKILLS.find(x => x.id === id)?.label).filter(Boolean).join(", ")]);
  if (l.mastery.length) out.push(["Weapon mastery", l.mastery.join(", ")]);
  if (l.options.length) out.push([grp ? grp.label : "Choices", l.options.join(", ")]);
  if (l.cantrips.length) out.push(["Cantrips", l.cantrips.join(", ")]);
  if (l.spells.length) out.push(["Spells", l.spells.join(", ")]);
  return out;
}

// The old "Level 1 choices" screen, now a creation chapter: subclass, spells, invocations and so on.
function classChoicesBody(app, d) {
  const cp = choicePlan(d, app);
  if (!cp) return `<p class="muted">Choose a class, species and background first.</p>`;
  if (!cp.steps.length) return `<p>${esc(d.class)} has nothing to choose at level ${cp.tmp.level}. Continue to the last step.</p>`;
  const { body, step } = levelBody(app);
  const l = cp.lvl;
  const pills = cp.steps.map((st, i) => {
    const before = cp.steps.slice(0, i).every(x => stepValidFor(cp.tmp, l, x));
    return `<li><button data-a="lvlGoto" data-i="${i}" class="${i === l.step ? "now" : stepValidFor(cp.tmp, l, st) && i < l.step ? "done" : ""}" ${before ? "" : "disabled"}><span>${i + 1}</span>${esc(st.label)}</button></li>`;
  }).join("");
  return `<ol class="lvl-steps" aria-label="Class choices">${pills}</ol>
    <div class="choice"><div class="choice-head"><h3>${esc(step.label)}</h3><span class="sub2">${l.step + 1} of ${cp.steps.length}</span></div>${body}</div>`;
}

// What the bottom button needs: inside Class Choices it follows the current sub-step
function canContinue(app, d, id) {
  if (id !== "classChoices") return validateChapter(id, d, app);
  const cp = choicePlan(d, app);
  if (!cp || !cp.steps.length) return validateChapter(id, d, app);
  const st = cp.steps[cp.lvl.step], last = cp.lvl.step === cp.steps.length - 1;
  if (last) return validateChapter(id, d, app).valid ? { valid: true, reasons: [] } : { valid: false, reasons: [levelWhy(st.id) || "Make each class choice to continue."] };
  return stepValidFor(cp.tmp, cp.lvl, st) ? { valid: true, reasons: [] } : { valid: false, reasons: [levelWhy(st.id)] };
}

// Called before each render: the level-up pickers read app.char / app.lvl, so point them at the draft.
export function prepareChoiceContext(app) {
  const d = app.createDraft;
  if (d && chapterId(d) === "classChoices") {
    const cp = choicePlan(d, app);
    app.char = cp ? cp.tmp : null; app.lvl = cp ? cp.lvl : null;
  } else { app.char = null; app.lvl = null; }
}

function finishBody(app, d) {
  const fin = finalAbilities(app, d), lvl = app.campaign.startingLevel || 1;
  const skills = [...takenSkills(app, d), ...d.classSkills].map(id => SKILLS.find(s => s.id === id)?.label).filter(Boolean);
  const open = unresolvedDecisions(d, app).filter(x => x.chapter !== "finish");
  const picks = choiceLines(app, d);
  return `<div class="field"><label for="f-name">Character name</label>
      <input class="f" id="f-name" value="${esc(d.name)}" placeholder="e.g. Gandork the Green" autocomplete="off" enterkeyhint="next"></div>
    <div class="btnrow" style="margin-top:8px"><button class="btn sm" data-a="randomName">Random name</button></div>
    <div class="grid2" style="margin-top:12px">
      <div class="field"><label for="f-align">Alignment</label><select class="f" id="f-align" data-draft="alignment"><option value="">Choose...</option>${ALIGNMENTS.map(a => `<option ${d.alignment === a ? "selected" : ""}>${a}</option>`).join("")}</select></div>
      <div class="field"><label>Languages</label><input class="f" value="${esc(["Common", ...[].concat(d.picks["bg:lang"] || [])].join(", "))}" disabled aria-label="Languages from your background"></div>
    </div>
    <div class="field" style="margin-top:12px"><label for="f-look">Appearance</label><textarea class="f" id="f-look" rows="3" data-draft-text="appearance" placeholder="Height, build, hair, scars, clothing">${esc(d.appearance || "")}</textarea></div>
    <div class="field" style="margin-top:12px"><label for="f-story">Backstory and personality</label><textarea class="f" id="f-story" rows="5" data-draft-text="backstory" placeholder="Where you come from, what you want, how you act">${esc(d.backstory || "")}</textarea></div>
    <div class="choice"><div class="choice-head"><h3>Summary</h3></div><dl class="kv">
      <dt>Class</dt><dd>${esc(d.class)}, level ${lvl}</dd><dt>Species</dt><dd>${esc(d.species)}</dd><dt>Background</dt><dd>${esc(d.background)}</dd>
      <dt>Abilities</dt><dd class="num">${ABILITIES.map(a => `${a.toUpperCase()} ${fin[a]}`).join(" \u00b7 ")}</dd>
      <dt>Skills</dt><dd>${esc(skills.join(", "))}</dd>${picks.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
    ${open.length ? `<div class="choice"><div class="choice-head"><h3>Still to do</h3></div>${open.map(x => `<button class="optcard" data-a="gotoChapter" data-id="${x.chapter}" style="margin-bottom:6px"><span class="grow"><b>${esc(x.label)}</b><span>${esc(x.reason)}</span></span><span class="sub2">Go</span></button>`).join("")}</div>` : ""}`;
}

export function renderCreate(app) {
  const d = app.createDraft, id = chapterId(d), ch = CHAPTERS[d.chapter] || CHAPTERS[0];
  const v = canContinue(app, d, id);
  let tools = "", content = "";
  if (LIST_KINDS.includes(id)) {
    const cfg = cfgFor(app, d, id);
    tools = `<button class="btn sm" data-a="randomPick">Surprise me</button>`;
    if (id !== "class" && d[id] && draftChoices(app, d, id === "species" ? "species" : "bg").length) tools += ` <button class="btn sm" data-a="randomChoices">Pick my choices</button>`;
    if (id === "class") tools += ` <button class="btn sm" data-a="randomAll">Make everything random</button>`;
    if (id === "background") tools += ` <button class="btn sm" data-a="openCustomBg">Custom background</button>`;
    content = `${renderControls(app, cfg)}${searchBox("wizard", d.query, `Search ${cfg.items.length} ${cfg.noun}`)}
      <div class="sp-list" id="wizard-results">${renderWizardResults(app)}</div>`;
  } else if (id === "abilities") content = abilitiesBody(app, d);
  else if (id === "classOpts") {
    tools = `<button class="btn sm" data-a="randomSkills">Pick skills for me</button>` + (gearChoices(app, d).some(g => !g.fixed) ? ` <button class="btn sm" data-a="randomGear">Pick gear for me</button>` : "");
    content = skillsGearBody(app, d);
  } else if (id === "classChoices") content = classChoicesBody(app, d);
  else content = finishBody(app, d);
  const last = d.chapter === CHAPTERS.length - 1;
  return `
    ${topbar(ch.title, `Step ${d.chapter + 1} of ${CHAPTERS.length}`, { back: d.chapter === 0 ? "cancelCreate" : "prevStep" })}
    <main class="wrap page has-stickybar">
      <div class="steprow" aria-hidden="true">${CHAPTERS.map((_, i) => `<div class="step ${i <= d.chapter ? "done" : ""}"></div>`).join("")}</div>
      ${tools ? `<div class="wiztools">${tools}</div>` : ""}
      <div class="panel"><div class="panel-body">${content}</div></div>
    </main>
    <div class="stickybar"><div class="wrap">
      <p class="why" id="wizard-why">${v.valid ? "" : esc(v.reasons.join(" "))}</p>
      <div class="btnrow">
        <button class="btn" data-a="openProgress">View progress</button>
        <button class="btn pri" data-a="${last ? "finishCreate" : "nextStep"}" ${v.valid ? "" : "disabled"}>${last ? "Create character" : "Continue"}</button>
      </div>
    </div></div>
    ${app.progressOpen ? progressSheet(app, d) : ""}`;
}
