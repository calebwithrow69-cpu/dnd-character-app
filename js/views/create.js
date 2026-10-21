import { esc, topbar, formatText, searchBox, infoRow } from "../ui.js";
import { enabledClasses, enabledSpecies, enabledBackgrounds, findByName, subclassesFor } from "../data.js";
import {
  ABILITIES, ABILITY_LABEL, ABILITY_BY_LABEL, SKILLS, parseList, skillIdByLabel, abilityMod, fmtMod,
  primaryAbility, speciesSpeed, speciesSize, hpAverageGain
} from "../rules.js";
import { newId } from "../store.js";

export const STEPS = ["name", "species", "class", "background", "abilities", "skills", "review"];
const STEP_TITLE = {
  name: "Name your character", species: "Choose a species", class: "Choose a class",
  background: "Choose a background", abilities: "Set ability scores", skills: "Choose skills", review: "Review"
};

export function newDraft() {
  return {
    step: 0, name: "", species: "", class: "", background: "", subclass: "",
    base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    bonusMode: "21", plus2: "", plus1: "",
    classSkills: [], query: ""
  };
}

// ---- derived draft values (shared by the view and the final build)
export function bgAbilities(app, d) {
  const bg = findByName(app.library.backgrounds, d.background);
  return bg ? parseList(bg.abilities).map(l => ABILITY_BY_LABEL[l]).filter(Boolean) : [];
}
export function bgSkills(app, d) {
  const bg = findByName(app.library.backgrounds, d.background);
  return bg ? parseList(bg.skills).map(skillIdByLabel).filter(Boolean) : [];
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

export function validateStep(stepName, d, app) {
  if (stepName === "name") return d.name.trim().length > 0;
  if (stepName === "species") return !!d.species;
  if (stepName === "class") return !!d.class;
  if (stepName === "background") return !!d.background;
  if (stepName === "abilities") {
    if (!bgAbilities(app, d).length || d.bonusMode === "111") return true;
    return !!d.plus2 && !!d.plus1 && d.plus1 !== d.plus2;
  }
  if (stepName === "skills") {
    const { from, n } = classSkillOptions(app, d);
    const avail = from.filter(id => !bgSkills(app, d).includes(id)).length;
    return d.classSkills.length === Math.min(n, avail);
  }
  return true;
}

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
    sub: b => [parseList(b.skills).join(", "), b.feat].filter(Boolean).join(" · "),
    about: b => backgroundSummary(b) + formatText(b.desc || "")
  };
}

// Background at a glance: what you actually get, with the feat readable in place.
export function backgroundSummary(b) {
  const abil = parseList(b.abilities), skills = parseList(b.skills);
  return `<dl class="summary">
      ${abil.length ? `<dt>Ability scores</dt><dd>${esc(abil.join(", "))} <span class="sub2">(+2/+1 or +1 each — you pick on the scores step)</span></dd>` : ""}
      ${skills.length ? `<dt>Skills</dt><dd>${esc(skills.join(", "))}</dd>` : ""}
      ${b.tool ? `<dt>Tool</dt><dd>${esc(b.tool)}</dd>` : ""}
      ${b.feat ? `<dt>Feat</dt><dd><button class="term" data-term="feat:${esc(b.feat.replace(/\s*\(.*$/, ""))}">${esc(b.feat)}</button> <span class="sub2">tap to read</span></dd>` : ""}
    </dl>`;
}

export function renderWizardResults(app) {
  const d = app.createDraft;
  const step = STEPS[d.step];
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

export function renderCreate(app) {
  const d = app.createDraft;
  const step = STEPS[d.step];
  let content = "";

  if (step === "name") {
    content = `<div class="field"><label for="f-name">Character name</label>
      <input class="f" id="f-name" value="${esc(d.name)}" placeholder="e.g. Gandork the Green" autocomplete="off" enterkeyhint="next"></div>`;
  } else if (step === "species" || step === "class" || step === "background") {
    const count = listFor(app, d, step).items.length;
    content = `${count > 8 ? searchBox("wizard", d.query, `Search ${count} options`) : ""}
      <div class="optlist" id="wizard-results">${renderWizardResults(app)}</div>`;
  } else if (step === "abilities") {
    const opts = bgAbilities(app, d);
    const fin = finalAbilities(app, d);
    const cls = findByName(app.library.classes, d.class);
    const optSel = (key, exclude) => `<select class="f" data-draft="${key}">
        <option value="">Choose…</option>
        ${opts.filter(a => a !== exclude).map(a => `<option value="${a}" ${d[key] === a ? "selected" : ""}>${ABILITY_LABEL[a]}</option>`).join("")}
      </select>`;
    content = `
      <p class="small muted">${cls ? `${esc(cls.name)}s rely most on <b>${esc(cls.primary)}</b>. ` : ""}Type your scores, or use a shortcut:</p>
      <div class="btnrow" style="margin-top:10px">
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
      ${opts.length ? `<div class="panel" style="margin-top:14px"><div class="panel-body stack">
        <p class="small">Your ${esc(d.background)} background raises ${opts.map(a => ABILITY_LABEL[a]).join(", ")}.</p>
        <div class="seg" role="group" aria-label="Bonus type">
          <button data-a="bonusMode" data-mode="21" aria-pressed="${d.bonusMode === "21"}">+2 and +1</button>
          <button data-a="bonusMode" data-mode="111" aria-pressed="${d.bonusMode === "111"}">+1 to all three</button>
        </div>
        ${d.bonusMode === "21" ? `<div class="grid2">
          <div class="field"><label>+2 to</label>${optSel("plus2", null)}</div>
          <div class="field"><label>+1 to</label>${optSel("plus1", d.plus2)}</div></div>` : ""}
      </div></div>` : ""}`;
  } else if (step === "skills") {
    const fromBg = bgSkills(app, d);
    const { from, n } = classSkillOptions(app, d);
    const choices = from.filter(id => !fromBg.includes(id));
    const need = Math.min(n, choices.length);
    content = `<p class="small muted">Pick <b>${need}</b> from your class. ${d.classSkills.length}/${need} chosen.</p>
      <div class="optlist">
        ${fromBg.map(id => `<div class="optcard locked" aria-pressed="true"><input type="checkbox" checked disabled>
          <span class="grow"><b>${esc(SKILLS.find(s => s.id === id).label)}</b><span>From your background</span></span></div>`).join("")}
        ${choices.map(id => {
          const on = d.classSkills.includes(id);
          const s = SKILLS.find(x => x.id === id);
          return `<label class="optcard" aria-pressed="${on}"><input type="checkbox" data-a="toggleSkill" data-id="${id}" ${on ? "checked" : ""} ${!on && d.classSkills.length >= need ? "disabled" : ""}>
            <span class="grow"><b>${esc(s.label)}</b><span>${ABILITY_LABEL[s.ability]}</span></span></label>`;
        }).join("")}
      </div>`;
  } else if (step === "review") {
    const fin = finalAbilities(app, d);
    const lvl = app.campaign.startingLevel || 1;
    const subs = subclassesFor(app.library, d.class);
    const skills = [...bgSkills(app, d), ...d.classSkills].map(id => SKILLS.find(s => s.id === id)?.label);
    const bg = findByName(app.library.backgrounds, d.background);
    content = `<dl class="kv">
        <dt>Name</dt><dd>${esc(d.name)}</dd>
        <dt>Species</dt><dd>${esc(d.species)}</dd>
        <dt>Class</dt><dd>${esc(d.class)}, level ${lvl}</dd>
        <dt>Background</dt><dd>${esc(d.background)}${bg?.feat ? ` (feat: ${esc(bg.feat)})` : ""}</dd>
        <dt>Abilities</dt><dd class="num">${ABILITIES.map(a => `${a.toUpperCase()} ${fin[a]}`).join(" · ")}</dd>
        <dt>Skills</dt><dd>${esc(skills.join(", "))}</dd>
      </dl>
      ${lvl >= 3 && subs.length ? `<div class="field"><label>Subclass</label><select class="f" data-draft="subclass">
        <option value="">Choose later</option>${subs.map(s => `<option ${d.subclass === s.name ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>` : ""}
      <p class="small muted">Weapons, gear and spells are added on the character sheet.</p>`;
  }

  const canNext = validateStep(step, d, app);
  const why = canNext ? "" : {
    name: "Type a name to continue.", species: "Tap a species to continue.", class: "Tap a class to continue.",
    background: "Tap a background to continue.", abilities: "Choose where your +2 and +1 go.",
    skills: "Pick your class skills to continue."
  }[step] || "";
  return `
    ${topbar(STEP_TITLE[step], `Step ${d.step + 1} of ${STEPS.length}`, { back: d.step === 0 ? "cancelCreate" : "prevStep" })}
    <main class="wrap page has-stickybar">
      <div class="steprow" aria-hidden="true">${STEPS.map((_, i) => `<div class="step ${i <= d.step ? "done" : ""}"></div>`).join("")}</div>
      <div class="panel"><div class="panel-body">${content}</div></div>
    </main>
    <div class="stickybar"><div class="wrap">
      <p class="why" id="wizard-why">${why}</p>
      <button class="btn pri block" data-a="${step === "review" ? "finishCreate" : "nextStep"}" ${canNext ? "" : "disabled"}>
        ${step === "review" ? "Create character" : "Continue"}</button>
    </div></div>`;
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
  const saves = cls ? parseList(cls.saves).map(l => ABILITY_BY_LABEL[l]).filter(Boolean) : [];
  const bg = findByName(L.backgrounds, d.background);

  return {
    schema: 2, id: newId(), name: d.name.trim(), species: d.species, class: d.class,
    subclass: d.subclass || "", level, background: d.background,
    abilities, saveProf: saves,
    skillProf: [...new Set([...bgSkills(app, d), ...d.classSkills])], skillExpertise: [],
    profsText: cls ? [cls.armorProf, cls.weaponProf, cls.toolProf, bg?.tool].filter(Boolean).join(". ") : "",
    languages: "Common", feats: bg?.feat ? [bg.feat] : [],
    hp: { max: maxHp, cur: maxHp, temp: 0 },
    ac: { base: 10, bonus: 0, shield: false, dexCap: null, armorName: "", override: null },
    speed: sp ? speciesSpeed(sp.traits) : 30, initBonus: 0,
    hitDice: { total: level, spent: 0, die: hd },
    deathSaves: { success: 0, fail: 0 }, conditions: [], exhaustion: 0, concentration: null,
    spellcasting: { slotsUsed: Array(10).fill(0), spells: [] },
    resources: [], weapons: [], inventory: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    classFeatureNotes: "",
    notes: cls?.equipment ? `Starting equipment (${cls.name}): ${cls.equipment}` : ""
  };
}

export { primaryAbility };
