import { esc, topbar, formatText, searchBox, infoRow } from "../ui.js";
import { enabledClasses, enabledSpecies, enabledBackgrounds, findByName, subclassesFor, allWeapons, allItems } from "../data.js";
import {
  ABILITIES, ABILITY_LABEL, SKILLS, parseList, skillIdByLabel, abilityMod, fmtMod,
  primaryAbility, speciesSpeed, speciesSize, hpAverageGain, SUGGESTED_ARRAYS
} from "../rules.js";
import { newId } from "../store.js";
import {
  draftChoices, optionsFor, isAnswered, applyChoices, backgroundToolChoice, backgroundFeatNames,
  bgSkillIds, bgAbilityIds, speciesBaseText, grantedSpells
} from "../choices.js";
import { parseEquipment, resolveItem, fmtPrice } from "../equipment.js";
import { makeItem, fitsOk, wearKind } from "../gear.js";

const STEP_TITLE = {
  name: "Name your character", species: "Choose a species", speciesOpts: "Species choices", class: "Choose a class",
  background: "Choose a background", bgOpts: "Background choices", abilities: "Set ability scores",
  skills: "Choose skills", equipment: "Starting gear", review: "Review"
};

export function newDraft() {
  return {
    step: 0, name: "", species: "", class: "", background: "", subclass: "",
    base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    bonusMode: "21", plus2: "", plus1: "",
    classSkills: [], query: "", picks: {}, equipClass: "A", equipBg: "A"
  };
}

// Steps depend on the picks: "Species choices" only shows when the species asks for any.
export function stepsFor(app, d) {
  return ["name", "species", draftChoices(app, d, "species").length ? "speciesOpts" : null,
    "class", "background", "bgOpts", "abilities", "skills", "equipment", "review"].filter(Boolean);
}
export const stepName = (app, d) => stepsFor(app, d)[d.step] || "review";

// ---- derived draft values (shared by the view and the final build)
export function bgAbilities(app, d) { return bgAbilityIds(findByName(app.library.backgrounds, d.background)); }
export function bgSkills(app, d) { return bgSkillIds(findByName(app.library.backgrounds, d.background)); }

// Every skill already granted before the class step (background, species, feats, replacements).
export function takenSkills(app, d) {
  const picked = [...draftChoices(app, d, "species"), ...draftChoices(app, d, "bg")]
    .filter(x => x.kind === "skill" || x.kind === "skilltool")
    .flatMap(x => [].concat(d.picks[x.id] || []));
  return [...new Set([...bgSkills(app, d), ...picked])].filter(id => SKILLS.some(s => s.id === id));
}

export function classSkillOptions(app, d) {
  const cls = findByName(app.library.classes, d.class);
  if (!cls) return { from: [], n: 0 };
  const mapped = parseList(cls.skillFrom).map(skillIdByLabel).filter(Boolean);
  const from = mapped.length ? mapped : SKILLS.map(s => s.id); // "any skill" classes
  return { from, n: Number(cls.skillN) || 0 };
}
export function finalAbilities(app, d) {
  const out = { ...d.base };
  const opts = bgAbilities(app, d);
  if (!opts.length) return out;
  if (d.bonusMode === "111") opts.forEach(a => { out[a] += 1; });
  else {
    if (d.plus2) out[d.plus2] += 2;
    if (d.plus1 && d.plus1 !== d.plus2) out[d.plus1] += 1;
  }
  return out;
}
export function suggestedArray(app, className) {
  return app.campaign?.suggestedArrays?.[className] || SUGGESTED_ARRAYS[className] || null;
}

const choicesDone = (app, d, scope) => draftChoices(app, d, scope).every(def => def.kind === "text" || isAnswered(def, d.picks));

export function validateStep(step, d, app) {
  if (step === "name") return d.name.trim().length > 0;
  if (step === "species") return !!d.species;
  if (step === "speciesOpts") return choicesDone(app, d, "species");
  if (step === "class") return !!d.class;
  if (step === "background") return !!d.background;
  if (step === "bgOpts") {
    const bonusOk = !bgAbilities(app, d).length || d.bonusMode === "111" || (!!d.plus2 && !!d.plus1 && d.plus1 !== d.plus2);
    return bonusOk && choicesDone(app, d, "bg");
  }
  if (step === "skills") {
    const { from, n } = classSkillOptions(app, d);
    const avail = from.filter(id => !takenSkills(app, d).includes(id)).length;
    return d.classSkills.length === Math.min(n, avail);
  }
  if (step === "equipment") return !!d.equipClass && !!d.equipBg;
  return true;
}
export const WHY = {
  name: "Type a name to continue.", species: "Tap a species to continue.", speciesOpts: "Make each choice to continue.",
  class: "Tap a class to continue.", background: "Tap a background to continue.",
  bgOpts: "Choose your ability bonuses and each option to continue.", skills: "Pick your class skills to continue.",
  equipment: "Choose your starting gear."
};

// ---- option lists (the wizard re-renders only this part while searching)
function listFor(app, d, step) {
  const { library: L, campaign: C } = app;
  if (step === "species") return {
    items: enabledSpecies(L, C), selected: d.species, action: "pickSpecies",
    sub: s => [speciesSize(s.traits), `speed ${speciesSpeed(s.traits)} ft`, s.source].filter(Boolean).join(" · "),
    about: s => formatText(s.desc ? s.desc + "\n\n" + s.traits : s.traits)
  };
  if (step === "class") return {
    items: enabledClasses(L, C), selected: d.class, action: "pickClass",
    sub: c => `d${c.hd} hit die · ${c.primary || ""}`,
    about: c => formatText((c.desc || "") + "\n\n" + (c.core || ""))
  };
  return {
    items: enabledBackgrounds(L, C), selected: d.background, action: "pickBackground",
    sub: b => [parseList(b.skills).join(", "), backgroundFeatNames(b).join(" or ")].filter(Boolean).join(" · "),
    about: b => backgroundSummary(b) + formatText(b.desc || "")
  };
}
export function listItems(app, d, step) { return listFor(app, d, step).items; }

// Background at a glance: what you actually get, with the feat readable in place.
export function backgroundSummary(b) {
  const abil = bgAbilityIds(b).map(a => ABILITY_LABEL[a]), skills = bgSkillIds(b).map(id => SKILLS.find(s => s.id === id).label);
  const tool = backgroundToolChoice(b);
  const feats = backgroundFeatNames(b);
  return `<dl class="summary">
      ${abil.length ? `<dt>Ability scores</dt><dd>${esc(abil.join(", "))} <span class="sub2">(+2/+1 or +1 each — you choose next)</span></dd>` : ""}
      ${skills.length ? `<dt>Skills</dt><dd>${esc(skills.join(", "))}</dd>` : ""}
      ${tool ? `<dt>Tool</dt><dd>${esc(tool.fixed || "You choose one")}</dd>` : ""}
      ${feats.length ? `<dt>Feat</dt><dd>${feats.map(f => `<button class="term" data-term="feat:${esc(f.replace(/\s*\(.*$/, ""))}">${esc(f)}</button>`).join(" or ")} <span class="sub2">tap to read</span></dd>` : ""}
    </dl>`;
}

export function renderWizardResults(app) {
  const d = app.createDraft;
  const step = stepName(app, d);
  const cfg = listFor(app, d, step);
  const q = (d.query || "").trim().toLowerCase();
  const items = cfg.items.filter(x => !q || x.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  if (!items.length) return `<p class="muted small" style="padding:12px 0">Nothing matches “${esc(d.query)}”.</p>`;
  return items.map(it => {
    const on = it.name === cfg.selected, key = step + ":" + it.name, open = on || app.info.has(key);
    return infoRow({ key, action: cfg.action, data: { name: it.name }, title: it.name, sub: esc(cfg.sub(it)), pressed: on, open,
      detail: open ? cfg.about(it) : "", badge: on ? `<span class="tag amber">Chosen</span>` : "" });
  }).join("");
}

// ---- one choice (skill, feat, lineage, spell…)
function choiceDetail(app, o) {
  if (o.detail) return formatText(o.detail);
  if (!o.term) return "";
  const [kind, name] = [o.term.slice(0, o.term.indexOf(":")), o.term.slice(o.term.indexOf(":") + 1)];
  const L = app.library, C = app.campaign;
  if (kind === "feat") { const f = [...L.feats, ...(C.homebrew?.feats || [])].find(x => x.name === name); return f ? `<p class="sub2">${esc(f.type || "")}</p>` + formatText(f.text) : ""; }
  if (kind === "spell") { const s = [...L.spells, ...(C.homebrew?.spells || [])].find(x => x.name === name); return s ? `<p class="sub2">${esc([s.time, s.range, s.dur].filter(Boolean).join(" · "))}</p>` + formatText(s.text) : ""; }
  return "";
}

export function renderChoice(app, d, def) {
  const opts = optionsFor(def, app, d);
  const cur = [].concat(d.picks[def.id] || []);
  const full = cur.length >= def.n;
  const head = `<div class="choice-head"><h3>${esc(def.label)}</h3>
      <span class="sub2">${esc(def.trait && def.trait !== def.label ? def.trait + " · " : "")}${esc(def.from)}${def.n > 1 ? ` · pick ${def.n} (${cur.length}/${def.n})` : ""}</span></div>
      ${def.hint ? `<p class="small muted">${esc(def.hint)}</p>` : ""}`;
  if (def.kind === "text") {
    return `<div class="choice">${head}<input class="f" data-pick-text="${esc(def.id)}" value="${esc(d.picks[def.id] || "")}" placeholder="${esc(def.placeholder || "Your choice")}" autocomplete="off">
      <p class="sub2" style="margin-top:4px">Optional — you can fill this in later on your sheet.</p></div>`;
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
    return infoRow({ key, action: "pick", data: { id: def.id, v: o.v }, title: o.label || o.v, sub: esc(o.sub || firstLine(o.detail)),
      pressed: on, disabled: !on && full && def.n > 1, open, detail: open ? choiceDetail(app, o) : "", badge: on ? `<span class="tag amber">Chosen</span>` : "" });
  }).join("")}</div></div>`;
}
const firstLine = t => { const s = String(t || "").split("\n")[0]; return s.length > 90 ? s.slice(0, 88) + "…" : s; };

function renderBonus(app, d) {
  const opts = bgAbilities(app, d);
  if (!opts.length) return "";
  const cls = findByName(app.library.classes, d.class);
  const optSel = (key, exclude) => `<select class="f" data-draft="${key}">
      <option value="">Choose…</option>
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

function equipOptions(app, which, d) {
  const L = app.library;
  const src = which === "class" ? findByName(L.classes, d.class) : findByName(L.backgrounds, d.background);
  const text = which === "class" ? src?.equipment : (/Equipment:\s*([^\n]+)/.exec(src?.effect || "") || [])[1];
  return parseEquipment(text || "");
}

function renderEquipGroup(app, d, which) {
  const opts = equipOptions(app, which, d);
  const key = which === "class" ? "equipClass" : "equipBg";
  const name = which === "class" ? d.class : d.background;
  if (!opts.length) return "";
  return `<div class="choice"><div class="choice-head"><h3>From your ${which === "class" ? "class" : "background"}</h3><span class="sub2">${esc(name)}</span></div>
    <div class="optlist">${opts.map(o => {
      const on = d[key] === o.key;
      const list = o.items.map(i => `${i.qty > 1 ? i.qty + " × " : ""}${i.name}`).join(", ");
      return `<button class="optcard" data-a="pickEquip" data-which="${key}" data-k="${o.key}" aria-pressed="${on}">
        <span class="grow"><b>${o.items.length ? `Option ${o.key}: gear + ${fmtPrice(o.gp)}` : `Option ${o.key}: ${fmtPrice(o.gp)} to spend`}</b>
        <span>${esc(list || "Buy your own gear in the shop after you finish.")}</span></span>${on ? `<span class="tag amber">Chosen</span>` : ""}</button>`;
    }).join("")}</div></div>`;
}

export function renderCreate(app) {
  const d = app.createDraft;
  const steps = stepsFor(app, d);
  const step = steps[d.step] || "review";
  let content = "", tools = "";

  if (step === "name") {
    content = `<div class="field"><label for="f-name">Character name</label>
      <input class="f" id="f-name" value="${esc(d.name)}" placeholder="e.g. Gandork the Green" autocomplete="off" enterkeyhint="next"></div>
      <div class="btnrow" style="margin-top:12px">
        <button class="btn sm" data-a="randomName">Random name</button>
        <button class="btn sm" data-a="randomAll">Make everything random</button>
      </div>
      <p class="sub2" style="margin-top:8px">“Make everything random” fills in every step and takes you to the review, where you can go back and change anything.</p>`;
  } else if (step === "species" || step === "class" || step === "background") {
    const count = listFor(app, d, step).items.length;
    tools = `<button class="btn sm" data-a="randomPick">Surprise me</button>`;
    content = `${count > 8 ? searchBox("wizard", d.query, `Search ${count} options`) : ""}
      <div class="optlist" id="wizard-results">${renderWizardResults(app)}</div>`;
  } else if (step === "speciesOpts" || step === "bgOpts") {
    const scope = step === "speciesOpts" ? "species" : "bg";
    const defs = draftChoices(app, d, scope);
    tools = `<button class="btn sm" data-a="randomChoices">Pick for me</button>`;
    content = `<div class="stack">
      ${scope === "bg" ? renderBonus(app, d) : ""}
      ${scope === "bg" ? (() => { const t = backgroundToolChoice(findByName(app.library.backgrounds, d.background)); return t?.fixed ? `<p class="small">Tool proficiency: <b>${esc(t.fixed)}</b></p>` : ""; })() : ""}
      ${scope === "bg" ? backgroundFeatNames(findByName(app.library.backgrounds, d.background)).length === 1
        ? `<p class="small">Feat: <button class="term" data-term="feat:${esc(backgroundFeatNames(findByName(app.library.backgrounds, d.background))[0].replace(/\s*\(.*$/, ""))}">${esc(backgroundFeatNames(findByName(app.library.backgrounds, d.background))[0])}</button> <span class="sub2">tap to read</span></p>` : "" : ""}
      ${defs.map(def => renderChoice(app, d, def)).join("") || (scope === "bg" ? "" : `<p class="muted">Nothing to choose.</p>`)}
    </div>`;
  } else if (step === "abilities") {
    const fin = finalAbilities(app, d);
    const cls = findByName(app.library.classes, d.class);
    const sug = suggestedArray(app, d.class);
    content = `
      <p class="small muted">${cls ? `${esc(cls.name)}s rely most on <b>${esc(cls.primary)}</b>. ` : ""}Type your scores, or use a shortcut:</p>
      <div class="btnrow" style="margin-top:10px">
        ${sug ? `<button class="btn sm pri" data-a="suggestedArray">Suggested for ${esc(d.class)}</button>` : ""}
        <button class="btn sm" data-a="standardArray">Standard array</button>
        <button class="btn sm" data-a="rollStats">Roll 4d6 for each</button>
      </div>
      <div class="grid3" style="margin-top:12px">
        ${ABILITIES.map(a => `<label class="abil">
            <span class="an">${ABILITY_LABEL[a]}</span>
            <input type="number" inputmode="numeric" min="3" max="20" data-draft-ability="${a}" value="${d.base[a]}" aria-label="${ABILITY_LABEL[a]} score">
            <span class="as" data-final="${a}">${fin[a] !== d.base[a] ? `→ ${fin[a]} ` : ""}(${fmtMod(abilityMod(fin[a]))})</span>
          </label>`).join("")}
      </div>
      ${bgAbilities(app, d).length ? `<p class="sub2" style="margin-top:10px">Includes your background bonus (${d.bonusMode === "111" ? "+1 each" : "+2/+1"}). Change it on the background choices step.</p>` : ""}`;
  } else if (step === "skills") {
    const taken = takenSkills(app, d);
    const { from, n } = classSkillOptions(app, d);
    const choices = from.filter(id => !taken.includes(id));
    const need = Math.min(n, choices.length);
    tools = `<button class="btn sm" data-a="randomSkills">Pick for me</button>`;
    content = `<p class="small muted">Pick <b>${need}</b> from your class. ${d.classSkills.length}/${need} chosen.</p>
      <div class="optlist">
        ${taken.map(id => `<div class="optcard locked" aria-pressed="true"><input type="checkbox" checked disabled>
          <span class="grow"><b>${esc(SKILLS.find(s => s.id === id).label)}</b><span>Already yours</span></span></div>`).join("")}
        ${choices.map(id => {
          const on = d.classSkills.includes(id);
          const s = SKILLS.find(x => x.id === id);
          return `<label class="optcard" aria-pressed="${on}"><input type="checkbox" data-a="toggleSkill" data-id="${id}" ${on ? "checked" : ""} ${!on && d.classSkills.length >= need ? "disabled" : ""}>
            <span class="grow"><b>${esc(s.label)}</b><span>${ABILITY_LABEL[s.ability]}</span></span></label>`;
        }).join("")}
      </div>`;
  } else if (step === "equipment") {
    content = `<div class="stack">${renderEquipGroup(app, d, "class")}${renderEquipGroup(app, d, "bg")}
      <p class="sub2">Gear goes straight into your inventory, and armor, shield and weapons are put on for you. Gold can be spent in the shop on your Gear tab.</p></div>`;
  } else if (step === "review") {
    const fin = finalAbilities(app, d);
    const lvl = app.campaign.startingLevel || 1;
    const subs = subclassesFor(app.library, d.class);
    const skills = [...takenSkills(app, d), ...d.classSkills].map(id => SKILLS.find(s => s.id === id)?.label);
    const picks = [...draftChoices(app, d, "species"), ...draftChoices(app, d, "bg")].filter(def => d.picks[def.id] && def.kind !== "skill")
      .map(def => `${def.label}: ${[].concat(d.picks[def.id]).map(v => def.kind === "ability" ? ABILITY_LABEL[v] : (optionsFor(def, app, d).find(o => o.v === v)?.label || v)).join(", ")}`);
    content = `<dl class="kv">
        <dt>Name</dt><dd>${esc(d.name)}</dd>
        <dt>Species</dt><dd>${esc(d.species)}</dd>
        <dt>Class</dt><dd>${esc(d.class)}, level ${lvl}</dd>
        <dt>Background</dt><dd>${esc(d.background)}</dd>
        <dt>Abilities</dt><dd class="num">${ABILITIES.map(a => `${a.toUpperCase()} ${fin[a]}`).join(" · ")}</dd>
        <dt>Skills</dt><dd>${esc(skills.join(", "))}</dd>
        ${picks.length ? `<dt>Choices</dt><dd>${picks.map(esc).join("<br>")}</dd>` : ""}
        <dt>Gear</dt><dd>Class option ${esc(d.equipClass)}, background option ${esc(d.equipBg)}</dd>
      </dl>
      ${lvl >= 3 && subs.length ? `<div class="field"><label>Subclass</label><select class="f" data-draft="subclass">
        <option value="">Choose later</option>${subs.map(s => `<option ${d.subclass === s.name ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>` : ""}`;
  }

  const canNext = validateStep(step, d, app);
  const why = canNext ? "" : WHY[step] || "";
  return `
    ${topbar(STEP_TITLE[step], `Step ${d.step + 1} of ${steps.length}`, { back: d.step === 0 ? "cancelCreate" : "prevStep" })}
    <main class="wrap page has-stickybar">
      <div class="steprow" aria-hidden="true">${steps.map((_, i) => `<div class="step ${i <= d.step ? "done" : ""}"></div>`).join("")}</div>
      ${tools ? `<div class="wiztools">${tools}</div>` : ""}
      <div class="panel"><div class="panel-body">${content}</div></div>
    </main>
    <div class="stickybar"><div class="wrap">
      <p class="why" id="wizard-why">${why}</p>
      <button class="btn pri block" data-a="${step === "review" ? "finishCreate" : "nextStep"}" ${canNext ? "" : "disabled"}>
        ${step === "review" ? "Create character" : "Continue"}</button>
    </div></div>`;
}

// Put on what the starting gear allows: armor, shield, then weapons.
export function autoEquip(char) {
  const eq = char.equipment = char.equipment || {};
  const inv = char.inventory || [];
  const free = slot => !eq[slot];
  const put = (slot, it) => { if (free(slot) && fitsOk(it, slot, char)) { eq[slot] = it.id; return true; } return false; };
  inv.filter(i => wearKind(i) === "armor" && i.armor).slice(0, 1).forEach(i => put("armor", i));
  const avg = i => { const m = /(\d+)d(\d+)/.exec(i.weapon.dice || ""); return m ? +m[1] * (+m[2] + 1) / 2 : 0; };
  const melee = inv.filter(i => i.weapon && i.weapon.kind !== "Ranged").sort((a, b) => avg(b) - avg(a));
  const ranged = inv.filter(i => i.weapon && i.weapon.kind === "Ranged");
  const shield = inv.find(i => wearKind(i) === "shield");
  // with a shield, prefer a one-handed main weapon
  const main = (shield ? melee.find(i => !/two-handed/i.test(i.weapon.props || "")) : null) || melee[0];
  if (main) put("main", main);
  if (shield) put("off", shield);
  if (ranged[0]) put("ranged", ranged[0]);
  return char;
}

export function buildCharacterFromDraft(d, app) {
  const { library: L, campaign: C } = app;
  const cls = findByName(L.classes, d.class);
  const sp = findByName(L.species, d.species);
  const level = Math.min(20, Math.max(1, Number(C.startingLevel) || 1));
  const abilities = finalAbilities(app, d);
  const conMod = abilityMod(abilities.con);
  const hd = cls ? cls.hd : 8;
  const maxHp = Math.max(1, hd + conMod) + (level - 1) * hpAverageGain(hd, conMod);
  const saves = cls ? parseList(cls.saves).map(l => ({ Strength: "str", Dexterity: "dex", Constitution: "con", Intelligence: "int", Wisdom: "wis", Charisma: "cha" }[l])).filter(Boolean) : [];
  const bg = findByName(L.backgrounds, d.background);
  const tool = backgroundToolChoice(bg);
  const feats = backgroundFeatNames(bg);
  const bgFeat = feats.length > 1 ? d.picks["bg:feat"] : feats[0];

  const char = {
    schema: 2, id: newId(), name: d.name.trim(), species: d.species, class: d.class,
    subclass: d.subclass || "", level, background: d.background,
    abilities, saveProf: saves,
    skillProf: [...new Set([...bgSkills(app, d), ...d.classSkills])], skillExpertise: [],
    profsText: cls ? [cls.armorProf, cls.weaponProf, cls.toolProf, tool?.fixed].filter(Boolean).join(". ") : "",
    languages: "Common", feats: bgFeat ? [bgFeat] : [],
    hp: { max: maxHp, cur: maxHp, temp: 0 },
    ac: { base: 10, bonus: 0, shield: false, dexCap: null, armorName: "", override: null },
    speed: sp ? speciesSpeed(sp.traits) : 30, initBonus: 0, size: sp ? speciesSize(sp.traits) : "",
    hitDice: { total: level, spent: 0, die: hd },
    deathSaves: { success: 0, fail: 0 }, conditions: [], exhaustion: 0, concentration: null,
    spellcasting: { slotsUsed: Array(10).fill(0), spells: [] },
    resources: [], weapons: [], inventory: [], equipment: {},
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    classFeatureNotes: "", notes: ""
  };
  if (tool?.options && d.picks["bg:tool"]) char.profsText = [char.profsText, d.picks["bg:tool"]].filter(Boolean).join(". ");

  // Species/background/feat choices, plus spells the species and feats simply give you
  const defs = [...draftChoices(app, d, "species"), ...draftChoices(app, d, "bg")].filter(x => x.id !== "bg:tool");
  const featTexts = [...char.feats, ...defs.filter(x => x.kind === "feat").flatMap(x => [].concat(d.picks[x.id] || []))]
    .map(f => [L.feats.find(x => x.name === f.replace(/\s*\(.*$/, ""))?.text || "", f]);
  applyChoices(char, defs, d.picks, L, [[speciesBaseText(sp, L, C), d.species], ...featTexts]);

  // Starting gear
  const W = allWeapons(L, C), I = allItems(L, C);
  for (const [which, key] of [["class", d.equipClass], ["bg", d.equipBg]]) {
    const opt = equipOptions(app, which, d).find(o => o.key === key);
    if (!opt) continue;
    for (const line of opt.items) {
      const r = resolveItem(line, W, I);
      const it = makeItem(r.name, { weapons: W, items: I }, newId);
      it.qty = r.qty; if (r.note) it.notes = r.note;
      const same = char.inventory.find(x => x.name === it.name && !x.weapon === !it.weapon && !it.notes);
      if (same) same.qty += it.qty; else char.inventory.push(it);
    }
    char.coins.gp += Math.floor(opt.gp);
    char.coins.sp += Math.round((opt.gp % 1) * 10);
  }
  autoEquip(char);
  if (char.inventory.some(i => i.armor && char.equipment.armor === i.id)) char.ac.armorName = char.inventory.find(i => i.id === char.equipment.armor).name;
  return char;
}

export { primaryAbility, grantedSpells };
