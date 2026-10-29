// Shared character-creation model.
// All three modes (manual, generate, template) build on this:
//   a CreationState that tracks every decision, validates,
//   persists to sessionStorage, and reports what's unresolved.

import { ABILITIES, ABILITY_LABEL, SKILLS, parseList, skillIdByLabel, abilityMod, fmtMod,
  primaryAbility, speciesSpeed, speciesSize, hpAverageGain, standardArray,
  roll4d6DropLowest, SUGGESTED_ARRAYS } from "./rules.js";
import { newId, normalize } from "./store.js";
import { levelUpPlan, stepValidFor, optionPrereq, spellsFor, expertiseOptions } from "./progression.js";
import {
  draftChoices, optionsFor, isAnswered, applyChoices, backgroundToolChoice,
  backgroundFeatNames, bgSkillIds, bgAbilityIds, speciesBaseText, grantedSpells,
  syncLineageSpells, randomize, TOOLS
} from "./choices.js";
import { enabledClasses, enabledSpecies, enabledBackgrounds, enabledFeats, findByName, subclassesFor,
  allWeapons, allItems } from "./data.js";
import { parseEquipment, resolveItem } from "./equipment.js";
import { makeItem, fitsOk, wearKind } from "./gear.js";

// \u2500\u2500\u2500 Chapter definitions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// The manual builder walks these in order. Each chapter groups
// related decisions and knows how to validate itself.
export const CHAPTERS = [
  { id: "class",      title: "Class",           short: "Class" },
  { id: "species",    title: "Species",         short: "Species" },
  { id: "background", title: "Background",      short: "Background" },
  { id: "abilities",  title: "Ability Scores",  short: "Abilities" },
  { id: "classOpts",  title: "Skills and Gear", short: "Skills & gear" },
  { id: "classChoices", title: "Class Choices", short: "Class choices" },
  { id: "finish",     title: "Name and Finish", short: "Finish" },
];
export const ALIGNMENTS = ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil", "Unaligned"];

// \u2500\u2500\u2500 Blank draft \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
export function blankDraft() {
  return {
    chapter: 0,
    name: "",
    alignment: "",
    appearance: "",
    backstory: "",
    species: "",
    class: "",
    background: "",
    subclass: "",
    base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    bonusMode: "21",       // "21" = +2/+1, "111" = +1 each
    plus2: "",
    plus1: "",
    classSkills: [],
    picks: {},             // choice answers keyed by choice id
    equipClass: "A",
    equipBg: "A",
    rolls: null,           // { str, dex, ... } locked dice results, null = not rolled
    pointBuy: false,       // true while the scores are being set with the 27-point budget
    mode: "manual",        // "manual" | "generate" | "template"
    templateId: null,
    lvl: null,             // level-1 class choices (subclass, spells, invocations...), same shape as the level-up draft
    ts: Date.now(),        // creation timestamp (for persistence key)
  };
}

// \u2500\u2500\u2500 Persistence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const STORAGE_KEY = "dnd-creation-draft-v1";

export function saveDraft(draft) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch (e) { /* quota */ }
}
export function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function clearDraft() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ok */ }
}

// \u2500\u2500\u2500 Derived values (shared by every mode and the final build) \u2500
export function bgAbilities(app, d) { return bgAbilityIds(findByName(app.library.backgrounds, d.background)); }
export function bgSkills(app, d) { return bgSkillIds(findByName(app.library.backgrounds, d.background)); }

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

// Every skill already granted before the class-skill step.
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
  const from = mapped.length ? mapped : SKILLS.map(s => s.id);
  return { from, n: Number(cls.skillN) || 0 };
}

export function suggestedArray(app, className) {
  return app.campaign?.suggestedArrays?.[className] || SUGGESTED_ARRAYS[className] || null;
}

// \u2500\u2500\u2500 Equipment helpers (reused from create.js, now shared) \u2500\u2500\u2500\u2500
export function equipOptions(app, which, d) {
  const L = app.library;
  const src = which === "class" ? findByName(L.classes, d.class) : findByName(L.backgrounds, d.background);
  const text = which === "class" ? src?.equipment : (/Equipment:\s*([^\n]+)/.exec(src?.effect || "") || [])[1];
  return parseEquipment(text || "");
}

const CATEGORY = [[/musical instrument/i, TOOLS.instrument], [/artisan'?s tools/i, TOOLS.artisan], [/gaming set/i, TOOLS.gaming]];
const expand = part => { for (const [re, list] of CATEGORY) if (re.test(part)) return list; return [part.trim()]; };

export function gearChoice(line, sameAs) {
  const n = String(line.name).replace(/['\u2019]/g, "'").trim();
  const same = /\(same as above\)|chosen for the tool proficiency above/i.test(n);
  const base = n.replace(/\s*\((?:same as above|any)\)/i, "").replace(/\s+(?:of your choice|chosen for the tool proficiency above)$/i, "").trim();
  if (same && sameAs) return { fixed: [].concat(sameAs)[0] };
  if (/^holy symbol$/i.test(base)) return { label: "Holy Symbol", options: ["Amulet", "Emblem", "Reliquary"].map(t => `Holy Symbol (${t})`) };
  const paren = /^(.+?)\s*\(([^)]+ or [^)]+)\)$/i.exec(base);
  if (paren) return { label: paren[1], options: paren[2].split(/\s+or\s+/i).map(x => `${paren[1]} (${x.trim()[0].toUpperCase() + x.trim().slice(1)})`) };
  const parts = base.split(/\s+or\s+/i);
  const isCat = parts.some(p => CATEGORY.some(([re]) => re.test(p)));
  if (parts.length > 1 || isCat) {
    const options = [...new Set(parts.flatMap(expand))];
    if (options.length > 1) return { label: base, options };
  }
  return null;
}

export function gearChoices(app, d) {
  const out = [];
  for (const [which, key, sameAs] of [
    ["class", d.equipClass, d.picks["cls:tool"]],
    ["bg", d.equipBg, d.picks["bg:tool"] || backgroundToolChoice(findByName(app.library.backgrounds, d.background))?.fixed]
  ]) {
    const opt = equipOptions(app, which, d).find(o => o.key === key);
    if (!opt) continue;
    opt.items.forEach((line, i) => {
      const g = gearChoice(line, sameAs);
      if (g) out.push({ id: `gear:${which}:${key}:${i}`, which, index: i, ...g });
    });
  }
  return out;
}

// \u2500\u2500\u2500 Class choices made at creation (the old "Level 1 choices" screen) \u2500\u2500\u2500
export const blankLevelDraft = level => ({
  next: level, fromCreation: true, step: 0, hpMode: "avg", rolled: null, subclass: "",
  asiMode: "asi", asiSplit: "2", a2: "", a1a: "", a1b: "", feat: "",
  style: "", expertise: [], mastery: [], options: [], cantrips: [], spells: [],
  query: "", showAll: false, open: null
});
// The character as it stands so far, plus what the class still asks you to choose.
// Returns null until class, species and background are picked.
export function choicePlan(d, app) {
  if (!d.class || !d.species || !d.background) return null;
  const tmp = normalize(buildCharacter(d, app), app.library);
  if (!d.lvl || d.lvl.forKey !== d.class + "|" + d.species + "|" + d.background + "|" + d.classSkills.join(",")) {
    const keep = d.lvl && d.lvl.forClass === d.class ? d.lvl : null;
    d.lvl = blankLevelDraft(tmp.level);
    if (keep) { d.lvl.subclass = keep.subclass; d.lvl.style = keep.style; d.lvl.options = keep.options; d.lvl.cantrips = keep.cantrips; d.lvl.spells = keep.spells; d.lvl.mastery = keep.mastery; }
    d.lvl.forClass = d.class;
    d.lvl.forKey = d.class + "|" + d.species + "|" + d.background + "|" + d.classSkills.join(",");
  }
  const lvl = d.lvl;
  // drop stale expertise picks (the skills they depend on may have changed)
  lvl.expertise = lvl.expertise.filter(id => (tmp.skillProf || []).includes(id));
  const plan = levelUpPlan(app.library, tmp, tmp.level, lvl, { fromCreation: true });
  const steps = plan.steps.filter(x => x.id !== "review");
  lvl.step = Math.max(0, Math.min(lvl.step || 0, Math.max(0, steps.length - 1)));
  return { tmp, lvl, plan, steps, ok: steps.every(st => stepValidFor(tmp, lvl, st)) };
}

// Fill ONE class-choice step at random (the Randomize button on each step). Keeps picks already made for spell lists.
export function randomizeStep(app, tmp, lvl, st) {
  const L = app.library, C = app.campaign;
  const any = l => l[Math.floor(Math.random() * l.length)];
  const some = (l, n) => [...l].sort(() => Math.random() - 0.5).slice(0, n);
  if (st.id === "subclass") { const s = subclassesFor(L, tmp.class); if (s.length) lvl.subclass = any(s).name; }
  else if (st.id === "style") { const f = enabledFeats(L, C).filter(f => /^Fighting Style Feat/i.test(f.type || "") && !tmp.feats.includes(f.name)); if (f.length) lvl.style = any(f).name; }
  else if (st.id === "expertise") lvl.expertise = some(expertiseOptions(tmp), st.n).map(x => x.id);
  else if (st.id === "mastery") lvl.mastery = some(allWeapons(L, C).filter(w => w.mastery && !(tmp.masteries || []).includes(w.name)), st.n).map(w => w.name);
  else if (st.id === "options") {
    const ok = st.group.options.filter(o => { const p = optionPrereq(o); return p.level <= lvl.next && !p.needs.length; });
    lvl.options = some(ok, st.n).map(o => o.name);
  } else if (st.id === "cantrips" || st.id === "spells") {
    const key = st.id === "cantrips" ? "cantrips" : "spells", other = st.id === "cantrips" ? lvl.spells : lvl.cantrips;
    const n = st.n == null ? 2 : st.n, have = lvl[key].slice(0, n);
    const list = spellsFor(L, C, tmp, { cantrips: st.id === "cantrips", maxLevel: st.maxLevel || 0, all: false }).filter(s => !have.includes(s.name) && !other.includes(s.name));
    lvl[key] = have.concat(some(list, n - have.length).map(s => s.name));
  }
}
// Fill every class choice at random (used by "make everything random").
export function randomClassChoices(d, app) {
  const cp = choicePlan(d, app); if (!cp) return;
  for (const st of cp.steps) { if (st.id === "cantrips" || st.id === "spells") cp.lvl[st.id] = []; randomizeStep(app, cp.tmp, cp.lvl, st); }
}

// \u2500\u2500\u2500 Validation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Returns { valid: bool, reasons: string[] } for a single chapter.
// Reasons are user-facing short sentences.

const choicesDone = (app, d, scope) =>
  draftChoices(app, d, scope).every(def => def.kind === "text" || isAnswered(def, d.picks));

export function validateChapter(chapterId, d, app) {
  const reasons = [];

  if (chapterId === "abilities") {
    const vals = Object.values(d.base);
    if (vals.some(v => v < 3 || v > 20)) reasons.push("Each ability score must be 3\u201320.");
    if (d.pointBuy && pbSpent(d) > PB_BUDGET) reasons.push(`Point buy allows ${PB_BUDGET} points; you have spent ${pbSpent(d)}.`);
    if (!d.background) reasons.push("Choose a background first.");
    else {
      const bonusOk = !bgAbilities(app, d).length || d.bonusMode === "111" ||
        (!!d.plus2 && !!d.plus1 && d.plus1 !== d.plus2);
      if (!bonusOk) reasons.push("Choose your background ability bonuses.");
    }
  }

  if (chapterId === "class") {
    if (!d.class) reasons.push("Choose a class.");
  }

  if (chapterId === "classOpts") {
    if (!choicesDone(app, d, "class")) reasons.push("Finish your class tool choices.");
    const { from, n } = classSkillOptions(app, d);
    const avail = from.filter(id => !takenSkills(app, d).includes(id)).length;
    if (d.classSkills.length !== Math.min(n, avail)) reasons.push(`Pick ${Math.min(n, avail)} class skill${n > 1 ? "s" : ""}.`);
    // equipment
    if (!d.equipClass) reasons.push("Choose your class starting gear.");
    if (!d.equipBg) reasons.push("Choose your background starting gear.");
    const gc = gearChoices(app, d);
    if (gc.some(g => !g.fixed && !d.picks[g.id])) reasons.push("Pick each item marked \u201cchoose\u201d in your gear.");
  }

  if (chapterId === "species") {
    if (!d.species) reasons.push("Choose a species.");
    if (d.species && !choicesDone(app, d, "species")) reasons.push("Finish your species choices.");
  }

  if (chapterId === "background") {
    if (!d.background) reasons.push("Choose a background.");
    if (d.background) {
      if (!choicesDone(app, d, "bg")) reasons.push("Finish your background choices.");
    }
  }

  if (chapterId === "classChoices") {
    const cp = choicePlan(d, app);
    if (!cp) reasons.push("Choose a class, species and background first.");
    else if (!cp.ok) reasons.push("Make each class choice to continue.");
  }

  if (chapterId === "finish") {
    for (const ch of CHAPTERS) {
      if (ch.id === "finish") break;
      if (!validateChapter(ch.id, d, app).valid) reasons.push(`${ch.short}: still incomplete.`);
    }
    if (!d.name.trim()) reasons.push("Give your character a name.");
    if (!d.alignment) reasons.push("Choose an alignment.");
    if (!(d.appearance || "").trim()) reasons.push("Describe your character's appearance.");
    if (!(d.backstory || "").trim()) reasons.push("Write a short backstory and personality.");
  }

  return { valid: reasons.length === 0, reasons };
}

// Validate the entire draft across all chapters.
export function validateAll(d, app) {
  const results = {};
  let allValid = true;
  for (const ch of CHAPTERS) {
    results[ch.id] = validateChapter(ch.id, d, app);
    if (!results[ch.id].valid) allValid = false;
  }
  return { valid: allValid, chapters: results };
}

// \u2500\u2500\u2500 Unresolved decisions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Returns a flat list of { chapter, label, reason } for anything
// that's missing across the whole draft. UI shows this as a checklist.
export function unresolvedDecisions(d, app) {
  const out = [];
  const push = (chapter, label, reason) => out.push({ chapter, label, reason });

  // Abilities: always "resolved" if in range
  // Class
  if (!d.class) push("class", "Class", "No class chosen");
  // Class options
  if (d.class) {
    const defs = draftChoices(app, d, "class");
    for (const def of defs) {
      if (def.kind !== "text" && !isAnswered(def, d.picks))
        push("classOpts", def.label, `Choose ${def.label}`);
    }
    const { from, n } = classSkillOptions(app, d);
    const avail = from.filter(id => !takenSkills(app, d).includes(id)).length;
    const need = Math.min(n, avail);
    if (d.classSkills.length < need)
      push("classOpts", "Class skills", `Pick ${need - d.classSkills.length} more skill${need - d.classSkills.length > 1 ? "s" : ""}`);
    if (!d.equipClass) push("classOpts", "Class gear", "Choose starting gear option");
    if (!d.equipBg) push("classOpts", "Background gear", "Choose starting gear option");
    gearChoices(app, d).forEach(g => {
      if (!g.fixed && !d.picks[g.id]) push("classOpts", g.label, "Choose this item");
    });
  }
  // Species
  if (!d.species) push("species", "Species", "No species chosen");
  else {
    for (const def of draftChoices(app, d, "species")) {
      if (def.kind !== "text" && !isAnswered(def, d.picks))
        push("species", def.label, `Choose ${def.label}`);
    }
  }
  // Background
  if (!d.background) push("background", "Background", "No background chosen");
  else {
    const bonusOk = !bgAbilities(app, d).length || d.bonusMode === "111" ||
      (!!d.plus2 && !!d.plus1 && d.plus1 !== d.plus2);
    if (!bonusOk) push("abilities", "Ability bonuses", "Assign your +2 and +1");
    for (const def of draftChoices(app, d, "bg")) {
      if (def.kind !== "text" && !isAnswered(def, d.picks))
        push("background", def.label, `Choose ${def.label}`);
    }
  }
  // Name
  if (d.class && d.species && d.background) {
    const cp = choicePlan(d, app);
    if (cp && !cp.ok) push("classChoices", "Class choices", "Make each class choice");
  }
  if (!d.name.trim()) push("finish", "Name", "Give your character a name");
  if (!d.alignment) push("finish", "Alignment", "Choose an alignment");
  if (!(d.appearance || "").trim()) push("finish", "Appearance", "Describe your character");
  if (!(d.backstory || "").trim()) push("finish", "Backstory", "Write a short backstory");

  return out;
}

// \u2500\u2500\u2500 Dependency invalidation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// When a major choice changes, downstream picks that are no longer
// valid must be pruned. This function mutates the draft and returns
// a list of { id, label, oldValue } for what was removed, so the
// UI can show "X was removed because Y changed".

export function applyPick(d, app, pickId, value) {
  const removed = [];

  // Set the new value
  const oldVal = d.picks[pickId];
  if (value == null || (Array.isArray(value) && !value.length)) {
    delete d.picks[pickId];
  } else {
    d.picks[pickId] = value;
  }

  // Clear child picks (e.g. a feat's sub-choices when the feat changes)
  const prefix = pickId + ">";
  for (const k of Object.keys(d.picks)) {
    if (k.startsWith(prefix)) {
      removed.push({ id: k, label: k, oldValue: d.picks[k] });
      delete d.picks[k];
    }
  }

  // Re-check all remaining picks: if an option set has changed, prune
  // picks whose values are no longer in the options.
  const allDefs = [
    ...draftChoices(app, d, "species"),
    ...draftChoices(app, d, "bg"),
    ...draftChoices(app, d, "class"),
  ];
  for (const k of Object.keys(d.picks)) {
    const def = allDefs.find(x => x.id === k);
    if (!def) {
      // Orphan pick from a scope that no longer applies
      if (/^(sp|bg):/.test(k)) {
        removed.push({ id: k, label: k, oldValue: d.picks[k] });
        delete d.picks[k];
      }
      continue;
    }
    if (def.kind === "text") continue;
    const validSet = new Set(optionsFor(def, app, d).map(o => o.v));
    const cur = [].concat(d.picks[k]);
    const kept = cur.filter(v => validSet.has(v));
    if (kept.length < cur.length) {
      const dropped = cur.filter(v => !validSet.has(v));
      removed.push({ id: k, label: def.label, oldValue: dropped });
    }
    if (!kept.length) delete d.picks[k];
    else d.picks[k] = def.n > 1 ? kept : kept[0];
  }

  // Class skills may reference skills now taken by species/bg
  const taken = takenSkills(app, d);
  const prunedSkills = d.classSkills.filter(sk => taken.includes(sk));
  if (prunedSkills.length) {
    removed.push({ id: "classSkills", label: "Class skills", oldValue: prunedSkills });
    d.classSkills = d.classSkills.filter(sk => !taken.includes(sk));
  }

  return removed;
}

// High-level mutators for major picks. Each clears the right scope
// and returns the invalidation list.
export function pickSpecies(d, app, name) {
  const old = d.species;
  if (old === name) return [];
  d.species = name;
  // clear species-scope picks
  for (const k of Object.keys(d.picks)) {
    if (k.startsWith("sp:")) delete d.picks[k];
  }
  // re-validate bg picks (duplicate-skill replacements may change)
  return applyPick(d, app, "_species_change", null);
}

export function pickClass(d, app, name) {
  if (d.class === name) return [];
  d.class = name;
  d.classSkills = [];
  d.subclass = "";
  d.equipClass = "A";
  for (const k of Object.keys(d.picks)) {
    if (k.startsWith("cls:") || k.startsWith("gear:class")) delete d.picks[k];
  }
  return [];
}

export function pickBackground(d, app, name) {
  if (d.background === name) return [];
  d.background = name;
  d.plus2 = "";
  d.plus1 = "";
  d.equipBg = "A";
  for (const k of Object.keys(d.picks)) {
    if (k.startsWith("bg:") || k.startsWith("gear:bg")) delete d.picks[k];
  }
  // class skills may be affected by new bg skills
  d.classSkills = d.classSkills.filter(sk => !takenSkills(app, d).includes(sk));
  return [];
}

// \u2500\u2500\u2500 Locked dice rolls \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Roll once, store the result. The draft keeps this so a refresh
// doesn't silently reroll.
export const PB_BUDGET = 27;
export const PB_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const pbSpent = d => ABILITIES.reduce((n, a) => n + (PB_COST[d.base[a]] ?? 0), 0);
export function startPointBuy(d) { d.base = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }; d.rolls = null; d.pointBuy = true; }
export function pointBuyStep(d, a, dir) {
  const v = d.base[a], n = v + dir;
  if (!(n in PB_COST) || !d.pointBuy) return false;
  if (dir > 0 && pbSpent(d) - PB_COST[v] + PB_COST[n] > PB_BUDGET) return false;
  d.base[a] = n; return true;
}
export function rollAndLock(d) {
  const rolls = {};
  for (const a of ABILITIES) rolls[a] = roll4d6DropLowest();
  d.rolls = rolls;
  d.pointBuy = false;
  d.base = { ...rolls };
  return rolls;
}

export function applySuggestedArray(d, app) {
  const sug = suggestedArray(app, d.class);
  if (sug) {
    d.base = { ...sug };
    d.rolls = null; // suggested array replaces any roll
    d.pointBuy = false;
  }
  return sug;
}

export function applyStandardArray(d, app) {
  const cls = findByName(app.library.classes, d.class);
  d.base = standardArray(primaryAbility(cls?.primary));
  d.rolls = null; d.pointBuy = false;
}

// \u2500\u2500\u2500 Auto-equip (from create.js, now shared) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
export function autoEquip(char) {
  const eq = char.equipment = char.equipment || {};
  const inv = char.inventory || [];
  const free = slot => !eq[slot];
  const put = (slot, it) => { if (free(slot) && fitsOk(it, slot, char)) { eq[slot] = it.id; return true; } return false; };
  inv.filter(i => wearKind(i) === "armor" && i.armor).slice(0, 1).forEach(i => put("armor", i));
  const avg = i => { const m = /(\d+)d(\d+)/.exec(i.weapon?.dice || ""); return m ? +m[1] * (+m[2] + 1) / 2 : 0; };
  const melee = inv.filter(i => i.weapon && i.weapon.kind !== "Ranged").sort((a, b) => avg(b) - avg(a));
  const ranged = inv.filter(i => i.weapon && i.weapon.kind === "Ranged");
  const shield = inv.find(i => wearKind(i) === "shield");
  const main = (shield ? melee.find(i => !/two-handed/i.test(i.weapon.props || "")) : null) || melee[0];
  if (main) put("main", main);
  if (shield) put("off", shield);
  if (ranged[0]) put("ranged", ranged[0]);
  return char;
}

// \u2500\u2500\u2500 Build final character from draft \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// This is the same logic as buildCharacterFromDraft in create.js,
// extracted so all modes share one build path.
export function buildCharacter(d, app) {
  const { library: L, campaign: C } = app;
  const cls = findByName(L.classes, d.class);
  const sp = findByName(L.species, d.species);
  const level = Math.min(20, Math.max(1, Number(C.startingLevel) || 1));
  const abilities = finalAbilities(app, d);
  const conMod = abilityMod(abilities.con);
  const hd = cls ? cls.hd : 8;
  const maxHp = Math.max(1, hd + conMod) + (level - 1) * hpAverageGain(hd, conMod);
  const saves = cls ? parseList(cls.saves).map(l =>
    ({ Strength: "str", Dexterity: "dex", Constitution: "con", Intelligence: "int", Wisdom: "wis", Charisma: "cha" }[l])
  ).filter(Boolean) : [];
  const bg = findByName(L.backgrounds, d.background);
  const tool = backgroundToolChoice(bg);
  const feats = backgroundFeatNames(bg);
  const bgFeat = feats.length > 1 ? d.picks["bg:feat"] : feats[0];

  const char = {
    schema: 2, id: newId(), name: d.name.trim(), species: d.species, class: d.class,
    subclass: d.subclass || "", level, background: d.background,
    abilities, saveProf: saves,
    skillProf: [...new Set([...bgSkills(app, d), ...d.classSkills])], skillExpertise: [],
    profsText: cls ? [cls.armorProf, cls.weaponProf,
      /^choose/i.test(cls.toolProf || "") ? "" : cls.toolProf, tool?.fixed].filter(Boolean).join(". ") : "",
    languages: "Common", feats: bgFeat ? [bgFeat] : [],
    hp: { max: maxHp, cur: maxHp, temp: 0, base: hd + (level - 1) * hpAverageGain(hd, 0), adjust: 0 },
    ac: { base: 10, bonus: 0, shield: false, dexCap: null, armorName: "", override: null },
    speed: sp ? speciesSpeed(sp.traits) : 30, initBonus: 0, size: sp ? speciesSize(sp.traits) : "",
    hitDice: { total: level, spent: 0, die: hd },
    deathSaves: { success: 0, fail: 0 }, conditions: [], exhaustion: 0, concentration: null,
    spellcasting: { slotsUsed: Array(10).fill(0), spells: [] },
    resources: [], weapons: [], inventory: [], equipment: {},
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    classFeatureNotes: "", notes: "",
    alignment: d.alignment || "", appearance: (d.appearance || "").trim(), backstory: (d.backstory || "").trim(),
  };
  if (tool?.options && d.picks["bg:tool"]) char.profsText = [char.profsText, d.picks["bg:tool"]].filter(Boolean).join(". ");

  // Species/background/feat choices + granted spells
  const defs = [...draftChoices(app, d, "species"), ...draftChoices(app, d, "bg"), ...draftChoices(app, d, "class")]
    .filter(x => x.id !== "bg:tool");
  const featTexts = [...char.feats, ...defs.filter(x => x.kind === "feat").flatMap(x => [].concat(d.picks[x.id] || []))]
    .map(f => [L.feats.find(x => x.name === f.replace(/\s*\(.*$/, ""))?.text || "", f]);
  applyChoices(char, defs, d.picks, L, [[speciesBaseText(sp, L, C), d.species], ...featTexts]);
  // Starting gear
  const W = allWeapons(L, C), I = allItems(L, C);
  for (const [which, key] of [["class", d.equipClass], ["bg", d.equipBg]]) {
    const opt = equipOptions(app, which, d).find(o => o.key === key);
    if (!opt) continue;
    const picks = gearChoices(app, d).filter(g => g.which === which);
    opt.items.forEach((line0, i) => {
      const g = picks.find(x => x.index === i);
      const line = g ? { ...line0, name: g.fixed || d.picks[g.id] || line0.name } : line0;
      const r = resolveItem(line, W, I);
      const it = makeItem(r.name, { weapons: W, items: I }, newId);
      it.qty = r.qty; if (r.note) it.notes = r.note;
      const same = char.inventory.find(x => x.name === it.name && !x.weapon === !it.weapon && !it.notes);
      if (same) same.qty += it.qty; else char.inventory.push(it);
    });
    char.coins.gp += Math.floor(opt.gp);
    char.coins.sp += Math.round((opt.gp % 1) * 10);
  }
  syncLineageSpells(char, L, C);
  autoEquip(char);
  if (char.inventory.some(i => i.armor && char.equipment.armor === i.id))
    char.ac.armorName = char.inventory.find(i => i.id === char.equipment.armor).name;
  return char;
}

// \u2500\u2500\u2500 Random generation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Fills the entire draft randomly with optional constraints.
// constraints: { class?, species?, background? } \u2014 pin any of these.
export function generateRandom(d, app, constraints = {}) {
  const L = app.library, C = app.campaign;
  const any = list => list[Math.floor(Math.random() * list.length)];

  // Pin or pick
  d.species = constraints.species || any(enabledSpecies(L, C)).name;
  for (const k of Object.keys(d.picks)) { if (k.startsWith("sp:")) delete d.picks[k]; }

  d.class = constraints.class || any(enabledClasses(L, C)).name;
  d.classSkills = [];
  d.subclass = "";
  d.equipClass = "A";
  for (const k of Object.keys(d.picks)) { if (k.startsWith("cls:") || k.startsWith("gear:class")) delete d.picks[k]; }

  d.background = constraints.background || any(enabledBackgrounds(L, C)).name;
  d.plus2 = ""; d.plus1 = ""; d.equipBg = "A";
  for (const k of Object.keys(d.picks)) { if (k.startsWith("bg:") || k.startsWith("gear:bg")) delete d.picks[k]; }

  // Ability scores: use suggested array if available, else standard
  const sug = suggestedArray(app, d.class);
  if (sug) d.base = { ...sug };
  else {
    const cls = findByName(L.classes, d.class);
    d.base = standardArray(primaryAbility(cls?.primary));
  }
  d.rolls = null;

  // Background bonuses
  const bgAb = bgAbilities(app, d);
  if (bgAb.length) {
    d.bonusMode = "21";
    const cls = findByName(L.classes, d.class);
    const pri = primaryAbility(cls?.primary);
    if (bgAb.includes(pri)) { d.plus2 = pri; d.plus1 = bgAb.find(a => a !== pri) || ""; }
    else { d.plus2 = bgAb[0]; d.plus1 = bgAb[1] || ""; }
  }

  // Species/bg/class choices (repeat for dependent choices)
  for (let i = 0; i < 4; i++) {
    randomize(draftChoices(app, d, "species"), app, d);
    randomize(draftChoices(app, d, "bg"), app, d);
    randomize(draftChoices(app, d, "class"), app, d);
  }

  // Class skills
  const taken = takenSkills(app, d);
  const { from, n } = classSkillOptions(app, d);
  const pool = from.filter(id => !taken.includes(id)).sort(() => Math.random() - 0.5);
  d.classSkills = pool.slice(0, n);

  // Equipment: random gear picks
  for (const g of gearChoices(app, d)) {
    if (!g.fixed && g.options?.length && !d.picks[g.id]) {
      d.picks[g.id] = g.options[Math.floor(Math.random() * g.options.length)];
    }
  }

  d.lvl = null;
  randomClassChoices(d, app);
  d.mode = "generate";
  return d;
}
