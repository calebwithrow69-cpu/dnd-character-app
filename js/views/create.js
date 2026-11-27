// Character creation, codex style: Class, Species and Background are the same sortable
// portrait list; then ability scores (with the background bonus), skills and gear, and a
// final page for the name and roleplay details. "View progress" opens a sheet of every chapter.
// All data and validation live in ../creation.js. ASCII only in this file.
import { PHYS } from "../phys.js";
import { esc, topbar, formatText, searchBox, infoRow, snipOf, kRow, ICONS } from "../ui.js";
import { enabledClasses, enabledSpecies, enabledBackgrounds, findByName, subclassesFor } from "../data.js";
import { ABILITIES, ABILITY_LABEL, ABILITY_BY_LABEL, SKILLS, parseList, abilityMod, fmtMod, speciesSpeed, speciesSize, primaryAbilities } from "../rules.js";
import { speciesFit } from "../speciesfit.js";
import { variantDef, stripVariantText, draftChoices, optionsFor, isAnswered, backgroundToolChoice, backgroundFeatNames, bgSkillIds, bgAbilityIds } from "../choices.js";
import { fmtPrice } from "../equipment.js";
import { purseCard, shopDecorator } from "./shopkit.js";
import { parseSpecies, classifyText } from "../species.js";
import { renderCodexList, renderControls, matchChoices } from "./codex.js";
import { levelBody, levelWhy } from "./levelup.js";
import { stepValidFor, expertiseOptions } from "../progression.js";
import { normalize } from "../store.js";
import { computeAC } from "../gear.js";
import { emblem, emblemFor, emblemIcon } from "../emblems.js";
import { cxSync } from "../cxfx.js";
import {
  CHAPTERS, ALIGNMENTS, validateChapter, validateAll, unresolvedDecisions, choicePlan, bgAbilities, takenSkills, classSkillOptions,
  finalAbilities, equipOptions, gearChoices, buildCharacter, PB_BUDGET, pbSpent, rolledCount,
  startCp, walletLeftCp, cartRows, priceCp
} from "../creation.js";

const firstLineOf = t => { const s = String(t || "").split("\n")[0]; return s.length > 90 ? s.slice(0, 88) + "\u2026" : s; };
const LIST_KINDS = ["class", "species", "background"];
export const chapterId = d => CHAPTERS[d.chapter] ? CHAPTERS[d.chapter].id : CHAPTERS[0].id;
const NOTE = "Trait: always on. Ability: you use it. Tags are this app's reading; the text is the book's.";


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
  const full = cur.length >= def.n, need = def.kind !== "text" && !full ? " need" : "";
  const head = `<div class="choice-head"><h3>${esc(def.label)}</h3>
      <span class="sub2">${esc(def.trait && def.trait !== def.label ? def.trait + " \u00b7 " : "")}${esc(def.from)}${def.n > 1 ? ` \u00b7 choose ${def.n} (${cur.length}/${def.n})` : ""}</span></div>
      ${def.hint ? `<p class="small muted">${esc(def.hint)}</p>` : ""}`;
  if (def.kind === "text") {
    return `<div class="choice">${head}<input class="f" data-pick-text="${esc(def.id)}" value="${esc(d.picks[def.id] || "")}" placeholder="${esc(def.placeholder || "Type here")}" autocomplete="off">
      <p class="sub2" style="margin-top:4px">Optional.</p></div>`;
  }
  if (!opts.length) return `<div class="choice">${head}<p class="small muted">${def.kind === "spell" ? "Choose the spell list first." : "No options available."}</p></div>`;
  const rich = opts.some(o => o.detail || o.term);
  if (!rich) {
    return `<div class="choice${need}">${head}<div class="chips">${opts.map(o => {
      const on = cur.includes(o.v);
      return `<button class="chipbtn" data-a="pick" data-id="${esc(def.id)}" data-v="${esc(o.v)}" aria-pressed="${on}" ${!on && full && def.n > 1 ? "disabled" : ""}>${esc(o.label || o.v)}${o.sub ? `<span>${esc(o.sub)}</span>` : ""}</button>`;
    }).join("")}</div></div>`;
  }
  return `<div class="choice${need}">${head}<div class="optlist">${opts.map(o => {
    const on = cur.includes(o.v), key = `choice:${def.id}:${o.v}`, open = app.info.has(key);
    return infoRow({ key, action: "pick", data: { id: def.id, v: o.v }, title: o.label || o.v, sub: esc(o.sub || ""), snip: o.detail ? snipOf(o.detail) : "",
      pressed: on, disabled: !on && full && def.n > 1, open, detail: open ? choiceDetail(app, o) : "", badge: on ? `<span class="tag amber">Chosen</span>` : "" });
  }).join("")}</div></div>`;
}
const firstLine = firstLineOf;

// Choices as tiles (used by the species picker): name, one line of what it does,
// and the full rules text for whatever is picked, shown right under the tiles.
export function renderTileChoice(app, d, def) {
  const opts = optionsFor(def, app, d);
  const cur = [].concat(d.picks[def.id] || []);
  const full = cur.length >= def.n, need = def.kind !== "text" && !full ? " need" : "";
  const head = `<div class="choice-head"><h3>${esc(def.label)}</h3>
      <span class="sub2">${esc(def.trait && def.trait !== def.label ? def.trait + " \u00b7 " : "")}${def.n > 1 ? `choose ${def.n} (${cur.length}/${def.n})` : "choose one"}</span></div>
      ${def.hint && def.kind !== "text" ? `<p class="small muted">${esc(def.hint)}</p>` : ""}`;
  if (def.kind === "text") return renderChoice(app, d, def);
  if (!opts.length) return renderChoice(app, d, def);
  const picked = opts.filter(o => cur.includes(o.v));
  return `<div class="choice tiles${need}">${head}<div class="tilegrid">${opts.map(o => {
    const on = cur.includes(o.v), sub = o.sub || "";
    return `<button class="tile" data-a="pick" data-id="${esc(def.id)}" data-v="${esc(o.v)}" aria-pressed="${on}" ${!on && full && def.n > 1 ? "disabled" : ""}>
      <span class="grow"><b>${esc(o.label || o.v)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${on ? `<span class="tick" aria-hidden="true">&#10003;</span>` : ""}</button>`;
  }).join("")}</div>
    ${picked.map(o => { const det = choiceDetail(app, o); return det ? `<div class="about tile-about"><p class="sub2"><b>${esc(o.label || o.v)}</b></p>${det}</div>` : ""; }).join("")}</div>`;
}



// A hit die drawn as its own shape with the number inside (d6 square, d8 diamond, d10 kite, d12 pentagon).
const DIE_SHAPE = {
  6: '<rect x="3" y="3" width="18" height="18" rx="3.5"/>',
  8: '<path d="M12 1.6 22.4 12 12 22.4 1.6 12z"/><path class="f" d="M1.6 12h20.8M12 1.6v20.8"/>',
  10: '<path d="M12 1.5l9.6 7.6L12 22.5 2.4 9.1z"/><path class="f" d="M2.4 9.1h19.2"/>',
  12: '<path d="M12 1.6l10 7.4-3.8 12H5.8L2 9z"/><path class="f" d="M12 1.6v5.2M2 9l5.6 1.8M22 9l-5.6 1.8M5.8 21l3.6-6.6M18.2 21l-3.6-6.6"/>'
};
export function dieIcon(n) {
  const num = String(n), sh = DIE_SHAPE[n] || DIE_SHAPE[6];
  return `<svg class="die" viewBox="0 0 24 24" aria-hidden="true">${sh}<text x="12" y="${n === 10 ? 14.6 : 15.2}" text-anchor="middle">${num}</text></svg>`;
}
const AB_SHORT = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
export const abChip = k => `<i class="ab ab-${k}" aria-label="${esc(ABILITY_LABEL[k])}">${AB_SHORT[k]}</i>`;
const classBadges = c => {
  const keys = primaryAbilities(c.primary), caster = (c.features || []).some(f => /^(Spellcasting|Pact Magic)$/i.test(f.name));
  return `<span class="cx-badges"><span class="cx-brow"><span class="cx-bl">Hit die:</span><span class="cx-die" aria-label="d${c.hd} hit die">${dieIcon(c.hd)}d${c.hd}</span></span>`
    + `<span class="cx-brow"><span class="cx-bl">Primary stat${keys.length > 1 ? "s" : ""}:</span>${keys.map(abChip).join("")}${caster ? `<span class="cx-tagc">Caster</span>` : ""}</span></span>`;
};

// How well one ability score suits a class: green (primary), yellow (conditional), red (little use).
// Conditional = hit points (Con), AC and initiative (Dex, unless heavy armor), or a subclass that adds spellcasting.
const FIT_WORD = { good: "Primary", ok: "Useful", bad: "Low value" };
const FIT_MARK = { good: "\u2713", ok: "~", bad: "\u00d7" };
export function abilFit(L, cls, key) {
  if (!cls) return null;
  if (primaryAbilities(cls.primary).includes(key)) return { tone: "good", why: "Primary ability" };
  const sub = (L.subclasses || []).find(s => s.cls === cls.name && (s.features || []).some(f => {
    if (!/spellcasting|pact magic/i.test(f.name)) return false;
    const m = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/.exec(f.text || ""); return m && ABILITY_BY_LABEL[m[1]] === key;
  }));
  if (sub) return { tone: "ok", why: sub.name + " spellcasting" };
  if (key === "con") return { tone: "ok", why: "Hit points and saves" };
  if (key === "dex" && !/heavy/i.test(cls.armorProf || "")) return { tone: "ok", why: "AC and initiative" };
  return { tone: "bad", why: "No class use" };
}
const abilColor = (L, cls, key) => { const f = abilFit(L, cls, key); return f ? "cx-bg-" + f.tone : ""; };

function renderBonus(app, d) {
  const opts = bgAbilities(app, d);
  if (!opts.length) return "";
  const cls = findByName(app.library.classes, d.class);
  const optSel = (key, exclude, label) => `<select class="f" data-draft="${key}" aria-label="${label}">
      <option value="">Choose\u2026</option>
      ${opts.filter(a => a !== exclude).map(a => { const f = abilFit(app.library, cls, a); return `<option value="${a}" ${d[key] === a ? "selected" : ""} class="${f ? "cx-bg-" + f.tone : ""}">${ABILITY_LABEL[a]}${f ? " \u00b7 " + FIT_WORD[f.tone] : ""}</option>`; }).join("")}
    </select>`;
  const bonusDone = d.bonusMode === "111" || (!!d.plus2 && !!d.plus1 && d.plus1 !== d.plus2);
  return `<div class="choice${bonusDone ? "" : " need"}"><div class="choice-head"><h3>Ability score increases</h3><span class="sub2">${esc(d.background)}</span></div>
    <p class="small">Raise ${opts.map(a => `<span class="cx-ab ${cls ? abilColor(app.library, cls, a) : ""}">${ABILITY_LABEL[a]}</span>`).join(", ")}.</p>
    <div class="seg" role="group" aria-label="Bonus type" style="margin-top:8px">
      <button data-a="bonusMode" data-mode="21" aria-pressed="${d.bonusMode === "21"}">+2 and +1</button>
      <button data-a="bonusMode" data-mode="111" aria-pressed="${d.bonusMode === "111"}">+1 to all three</button>
    </div>
    ${d.bonusMode === "21" ? `<div style="margin-top:8px;display:grid;gap:8px">
      <div class="field"><label>+2 to</label>${optSel("plus2", null, "Plus 2 to")}</div>
      <div class="field"><label>+1 to</label>${optSel("plus1", d.plus2, "Plus 1 to")}</div></div>` : ""}</div>`;
}


function renderEquipGroup(app, d, which) {
  const opts = equipOptions(app, which, d);
  const key = which === "class" ? "equipClass" : "equipBg";
  const name = which === "class" ? d.class : d.background;
  if (!opts.length) return "";
  return `<div class="choice"><div class="choice-head"><h3>From your ${which === "class" ? "class" : "background"}</h3><span class="sub2">${esc(name)}</span></div>
    <p class="small muted">${d[key] === "none" ? "None" : "Option " + esc(d[key])} selected</p>
    <div class="optlist">${opts.map(o => {
      const on = d[key] === o.key;
      const gc = on ? gearChoices(app, d).filter(g => g.which === which) : [];
      const list = o.items.map((i, k) => { const g = gc.find(x => x.index === k); const nm = g ? (g.fixed || d.picks[g.id] || i.name) : i.name; return `${i.qty > 1 ? i.qty + " \u00d7 " : ""}${nm}`; }).join(", ");
      return `<button class="optcard" data-a="pickEquip" data-which="${key}" data-k="${o.key}" aria-pressed="${on}">
        <span class="grow"><b>${o.items.length ? `Option ${o.key}: gear + ${fmtPrice(o.gp)}` : `Option ${o.key}: ${fmtPrice(o.gp)} to spend`}</b>
        <span>${esc(list || "No gear. Spend the gold in the shop below.")}</span></span>${on ? `<span class="tag amber">Chosen</span>` : ""}</button>
        ${on ? gearChoices(app, d).filter(g => g.which === which && !g.fixed).map(g => `<div class="field gearpick${d.picks[g.id] ? "" : " need"}"><label>Choose: ${esc(g.label)}</label>
          <select class="f" data-gear-pick="${esc(g.id)}"><option value="">Choose\u2026</option>
          ${g.options.map(o => `<option value="${esc(o)}" ${d.picks[g.id] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`).join("") : ""}`;
    }).join("")}
      <button class="optcard" data-a="pickEquip" data-which="${key}" data-k="none" aria-pressed="${d[key] === "none"}"><span class="grow"><b>None</b><span>No gear, no gold</span></span>${d[key] === "none" ? `<span class="tag amber">Chosen</span>` : ""}</button></div></div>`;
}

// The variant shown for a species: the pick when it is the chosen species, else what was last previewed.
export const sortedVariants = vd => [...vd.options].sort((a, b) => String(a.v).localeCompare(String(b.v)));
function selectedVariant(app, d, s, vd) {
  // No default: the player picks which one to read, and the rest stays hidden until then.
  const ok = v => v && vd.options.some(o => o.v === v) ? v : null;
  if (d.species === s.name) { const p = ok([].concat(d.picks[vd.id] || [])[0]); if (p) return p; }
  return ok(app.spUi.variant && app.spUi.variant[s.name]);
}
// What a choice screen needs for the item being read: its choices, and how to draw and check each one.
function choiceBundle(app, d, kind, o) {
  const field = kind, scope = kind === "background" ? "bg" : kind, on = d[field] === o.name;
  const dd = on ? d : { ...d, [field]: o.name };
  const vd = kind === "species" ? variantDef(o, app.library, app.campaign) : null;
  const defs = draftChoices(app, dd, scope).filter(def => !vd || def.id !== vd.id);
  return { on, defs, render: def => renderTileChoice(app, d, def), done: def => def.kind === "text" || isAnswered(def, d.picks) };
}
// After choosing an item, open the abilities that still need a choice so the choice is in view under the ability.
export function openChoiceTraits(app) {
  const d = app.createDraft, id = chapterId(d); if (!LIST_KINDS.includes(id) || !d[id]) return;
  const cfg = cfgFor(app, d, id), o = cfg.items.find(x => x.name === d[id]); if (!o) return;
  const b = cfg.choices(o), vd = cfg.variants ? cfg.variants(o) : null, mt = matchChoices(b.defs, cfg.traits(o), vd && vd.trait);
  for (const [name, defs] of mt.by) if (defs.some(x => !b.done(x))) app.spUi.traits.add(id + ":" + o.name + ":" + name);
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
      traits: s => {
        const vd = variantDef(s, L, C), sel = vd && selectedVariant(app, d, s, vd);
        const out = [];
        parseSpecies(s).traits.forEach(t => {
          if (vd && t.name === vd.trait) {
            out.push({ name: t.name, kind: t.kind === "active" && sel ? "passive" : t.kind, usage: sel ? "Choose one \u00b7 " + sel : t.usage, level: t.level, body: stripVariantText(t.body, vd) || t.body, variantTrait: true });
          } else out.push({ name: t.name, kind: t.kind, usage: t.usage, level: t.level, body: t.body });
        });
        return out;
      },
      variants: s => {
        const vd = variantDef(s, L, C); if (!vd) return null;
        return { label: vd.label, trait: vd.trait, cur: selectedVariant(app, d, s, vd), options: sortedVariants(vd).map(o => ({ v: o.v, label: o.v, detail: o.detail || "" })), on: d.species === s.name };
      },
      traitsTitle: "Traits and abilities",
      chips: o => d.class && speciesFit(d.class, o.name) ? [{ label: "Recommended", full: "Recommended for " + d.class, tone: "good" }] : [],
      fitWord: { good: "Suggested", ok: "", bad: "" }, noFitBlock: true,
      recLabel: d.class ? "Recommended for " + d.class : "Recommended",
      synergyScore: d.class ? o => (speciesFit(d.class, o.name) ? 1 : 0) : undefined,
      synergyGood: o => speciesFit(d.class, o.name),
      choices: o => choiceBundle(app, d, "species", o)
    };
  }
  if (kind === "class") {
    const items = enabledClasses(L, C);
    const caster = c => (c.features || []).some(f => /^(Spellcasting|Pact Magic)$/i.test(f.name));
    return {
      ...base, items, selected: d.class, noun: "classes", sources: new Set(items.map(c => c.source)).size > 1, filterLabel: "Show",
      filterOptions: ["All", "Spellcasters", "Non-spellcasters"], test: (c, f) => f === "Spellcasters" ? caster(c) : !caster(c),
      sub: () => "",
      badges: classBadges,
      facts: c => [["Hit Point Die", "d" + c.hd, `<span class="cx-die">${dieIcon(c.hd)}d${c.hd}</span>`], ["Primary ability", c.primary, primaryAbilities(c.primary).map(abChip).join(" ") + " " + esc(c.primary)], ["Saving throws", parseList(c.saves).join(", ")],
        ["Armor training", c.armorProf || "None"], ["Weapon training", c.weaponProf], c.toolProf ? ["Tool training", c.toolProf] : null,
        ["Skills", `Choose ${c.skillN}: ${parseList(c.skillFrom).join(", ")}`]].filter(Boolean).filter(f => f[1]),
      lore: c => c.desc || "", laterCollapsed: true, choices: o => choiceBundle(app, d, "class", o),
      traits: c => (c.features || []).filter(f => f.lv <= 10 && !f.opt).map(f => ({ name: f.name, level: f.lv, body: f.text, ...classifyText(f.text) }))
    };
  }
  const items = enabledBackgrounds(L, C);
  const featBase = n => n.replace(/\s*\(.*$/, "");
  const feats = [...new Set(items.flatMap(b => backgroundFeatNames(b).map(featBase)))].sort();
  return {
    ...base, items, selected: d.background, noun: "backgrounds", sources: false, filterLabel: "Feat", filterOptions: ["All", ...feats],
    test: (b, f) => backgroundFeatNames(b).some(n => featBase(n) === f),
    sub: b => [d.class ? "" : bgAbilityIds(b).map(a => ABILITY_LABEL[a].slice(0, 3)).join("/"), parseList(b.skills).join(", "), backgroundFeatNames(b).join(" or ")].filter(Boolean).join(" \u00b7 "),
    chips: b => { const cls = findByName(L.classes, d.class); return cls ? bgAbilityIds(b).map(a => ({ label: ABILITY_LABEL[a].slice(0, 3), full: ABILITY_LABEL[a], ...abilFit(L, cls, a) })) : []; },
    fitWord: FIT_WORD,
    facts: b => {
      const tool = backgroundToolChoice(b), eq = (/Equipment:\s*([^\n]+)/.exec(b.effect || "") || [])[1];
      return [["Ability scores", bgAbilityIds(b).map(a => ABILITY_LABEL[a]).join(", ")], ["Skills", parseList(b.skills).join(", ")], ["Tool", tool ? (tool.fixed || "Your choice of one") : ""],
        ["Feat", backgroundFeatNames(b).join(" or ")], ["Equipment", eq || ""]].filter(f => f[1]);
    },
    fitFor: d.class || "",
    recLabel: d.class ? "Recommended for " + d.class : "Recommended",
    synergyScore: b => {
      const cls = findByName(L.classes, d.class); if (!cls) return 0;
      return bgAbilityIds(b).reduce((n, a) => { const f = abilFit(L, cls, a); return n + (f.tone === "good" ? 10 : f.tone === "ok" ? 1 : 0); }, 0);
    },
    synergyGood: b => { const cls = findByName(L.classes, d.class); return !!cls && bgAbilityIds(b).some(a => abilFit(L, cls, a).tone === "good"); },
    lore: b => b.desc || "",
    traits: b => backgroundFeatNames(b).map(n => {
      const f = [...L.feats, ...(C.homebrew?.feats || [])].find(x => x.name === featBase(n));
      return { name: "Feat: " + n, kind: "passive", usage: "Granted at level 1", level: 1, body: f ? f.text : "Tap the feat name on your sheet to read it." };
    }),
    traitsTitle: "What you get",
    note: () => "Its bonus goes on your scores in the next step.",
    choices: o => choiceBundle(app, d, "background", o)
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
    <div class="modal-body">${rows}<p class="sub2" style="margin-top:12px">${complete} of ${CHAPTERS.length} steps done. Finish a step to unlock the next.</p></div></div></div>`;
}

// ---- chapter bodies
function abilitiesBody(app, d) {
  const fin = finalAbilities(app, d), cls = findByName(app.library.classes, d.class);
  const rolling = d.rolls && !d.pointBuy && !d.scoresSet;
  const rc = rolledCount(d);
  return `<p class="small muted">${cls ? `${esc(cls.name)} primary ability: <b>${esc(cls.primary)}</b>.` : ""}</p>
    <div class="btnrow cx-methods${d.scoresSet ? "" : " need"}" style="margin-top:10px">
      <button class="btn sm" data-a="standardArray">Standard array</button>
      <button class="btn sm${d.pointBuy ? " pri" : ""}" data-a="cxPointBuy">Point buy</button>
      <button class="btn sm${rolling ? " pri" : ""}" data-a="rollStats">Roll 4d6</button>
    </div>
    ${d.pointBuy ? `<p class="cx-budget"><b class="num" id="cx-pbleft">${PB_BUDGET - pbSpent(d)}</b> of ${PB_BUDGET} points left</p>` : ""}
    ${rolling ? `<p class="sub2" style="margin-top:6px">${rc}/6 rolled. Tap a score to roll it. Swap any two after.</p>` : ""}
    ${d.scoresSet && d.rolls ? `<p class="sub2" style="margin-top:6px">All rolled. Swap any two scores to rearrange.</p>` : ""}
    <div class="grid3 ${app._cxPop ? "cx-pop" : ""}" style="margin-top:12px">
      ${ABILITIES.map((a, i) => {
        const isPrime = cls && String(cls.primary || "").includes(ABILITY_LABEL[a]);
        const unrolled = rolling && (!d.rolls || d.rolls[a] == null);
        const swapping = app._cxSwap;
        const swapSel = swapping === a;
        return `<div class="abil ${isPrime ? "cx-prime" : ""} ${swapSel ? "picked" : ""} ${unrolled ? "cx-unrolled" : ""}" style="--i:${i}">
        ${unrolled ? `<button class="abil-roll" data-a="rollOne" data-ab="${a}" aria-label="Roll ${ABILITY_LABEL[a]}"><span class="an">${ABILITY_LABEL[a]}</span><span class="roll-cue">\ud83c\udfb2</span><span class="as">—</span></button>`
        : `<label><span class="an">${ABILITY_LABEL[a]}${isPrime ? ' <i title="Primary ability for ' + esc(cls.name) + '">&#9733;</i>' : ""}</span>
        ${d.rolls && d.rolls[a] != null ? `<span class="am">${d.base[a]}</span>` : `<input type="number" inputmode="numeric" min="3" max="20" data-draft-ability="${a}" value="${d.base[a]}" aria-label="${ABILITY_LABEL[a]} base score">`}
        <span class="as" data-final="${a}">${fin[a] !== d.base[a] ? "\u2192 " + fin[a] + " " : ""}(${fmtMod(abilityMod(fin[a]))})</span></label>
        ${(d.rolls ? d.rolls[a] != null : d.scoresSet && !d.pointBuy) ? `<button class="btn sm cx-swap" data-a="cxSwapSel" data-ab="${a}" aria-pressed="${swapSel}">Swap</button>` : ""}`}
        ${d.pointBuy ? `<div class="cx-pb"><button class="btn sm" data-a="cxPb" data-ab="${a}" data-dir="-1" aria-label="Lower ${ABILITY_LABEL[a]}" ${d.base[a] <= 8 ? "disabled" : ""}>-</button><button class="btn sm" data-a="cxPb" data-ab="${a}" data-dir="1" aria-label="Raise ${ABILITY_LABEL[a]}" ${d.base[a] >= 15 ? "disabled" : ""}>+</button></div>` : ""}</div>`; }).join("")}
    </div>
    ${renderBonus(app, d) || `<p class="muted small" style="margin-top:12px">Choose a background to see its increases.</p>`}`;
}

// Expertise (Rogue) is chosen from the skills you have, so it is asked here once the class skills are picked.
function expertisePanel(app, d) {
  const cp = choicePlan(d, app); if (!cp || !cp.expertise) return "";
  const st = cp.expertise, opts = expertiseOptions(cp.tmp), have = cp.lvl.expertise, full = have.length >= Math.min(st.n, opts.length);
  const { n } = classSkillOptions(app, d);
  return `<div class="choice${have.length < Math.min(st.n, opts.length) ? " need" : ""}"><div class="choice-head"><h3>Expertise</h3><span class="sub2">Choose ${st.n} \u00b7 ${have.length}/${Math.min(st.n, opts.length) || st.n}</span></div>
    ${d.classSkills.length < Math.min(n, classSkillOptions(app, d).from.length) ? `<p class="small muted">Choose your class skills first. Expertise doubles your proficiency bonus for skills you are proficient in.</p>` : `<p class="small muted">Your proficiency bonus is doubled for ${st.n} skills you are proficient in.</p>`}
    <div class="chips">${opts.map(o => `<button class="chipbtn" data-a="lvlExpertise" data-id="${o.id}" aria-pressed="${have.includes(o.id)}" ${full && !have.includes(o.id) ? "disabled" : ""}>${esc(o.label)}</button>`).join("")}</div></div>`;
}

function shopPanel(app, d) {
  const start = startCp(app, d), left = walletLeftCp(app, d), rows = cartRows(app, d), dec = shopDecorator(app.library, app.campaign);
  const g = cp => (cp > 0 ? fmtPrice(cp / 100) : "0 gp");
  return `<div class="choice"><div class="choice-head"><h3>Shop</h3></div>
    ${purseCard({ label: "Gold left", big: g(left), cells: [{ k: "Start", v: g(start) }, { k: "Items", v: rows.reduce((n, x) => n + x.qty, 0) }], bar: start ? (start - left) / start * 100 : 0 })}
    ${rows.length ? `<div class="k-list shoplist">${rows.map(x => { const r = dec(x.row); return kRow({ icon: ICONS[r.icon] || "", tone: r.tone, title: x.name, cap: r.aisle, sub: r.sub, status: x.qty > 1 ? "\u00d7" + x.qty : "", cls: "shopitem on",
      actions: `<span class="num shop-sum">${esc(g(priceCp(app, d, x.row) * x.qty))}</span><button class="btn sm shop-minus" data-a="cxUnbuy" data-name="${esc(x.name)}" aria-label="Remove one ${esc(x.name)}">${ICONS.minus}</button>` }); }).join("")}</div>` : ""}
    <button class="btn pri block" data-a="cxOpenShop" style="margin-top:10px">Open shop</button></div>`;
}

function skillsGearBody(app, d) {
  const taken = takenSkills(app, d), { from, n } = classSkillOptions(app, d);
  const choices = from.filter(id => !taken.includes(id)), need = Math.min(n, choices.length);
  const toolDefs = draftChoices(app, d, "class");
  const subs = subclassesFor(app.library, d.class), lvl = app.campaign.startingLevel || 1;
  return `<div class="stack">
    ${toolDefs.map(def => renderChoice(app, d, def)).join("")}
    <div class="choice${d.classSkills.length < need ? " need" : ""}"><div class="choice-head"><h3>Class skills</h3><span class="sub2">Choose ${need} \u00b7 ${d.classSkills.length}/${need}</span></div>
      <div class="optlist">
        ${choices.map(id => { const on = d.classSkills.includes(id), s = SKILLS.find(x => x.id === id);
          return `<label class="optcard" aria-pressed="${on}"><input type="checkbox" data-a="toggleSkill" data-id="${id}" ${on ? "checked" : ""} ${!on && d.classSkills.length >= need ? "disabled" : ""}><span class="grow"><b>${esc(s.label)}</b><span>${ABILITY_LABEL[s.ability]}</span></span></label>`; }).join("")}
        ${taken.map(id => `<div class="optcard locked" aria-pressed="true"><input type="checkbox" checked disabled><span class="grow"><b>${esc(SKILLS.find(s => s.id === id).label)}</b><span>You have this</span></span></div>`).join("")}
      </div></div>
    ${expertisePanel(app, d)}
    ${renderEquipGroup(app, d, "class")}${renderEquipGroup(app, d, "bg")}
    ${shopPanel(app, d)}
    </div>`;
}

function choiceLines(app, d) {
  const cp = choicePlan(d, app); if (!cp) return [];
  const l = cp.lvl, out = [];
  const grp = cp.steps.find(x => x.id === "options");
  if (l.subclass) out.push(["Subclass", l.subclass]);
  if (l.style) out.push(["Fighting style", l.style]);
  const ord = cp.steps.find(x => x.id === "order"); if (ord && l.order) out.push([ord.label, l.order]);
  if (l.language) out.push(["Language", l.language]);
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
  if (!cp) return `<p class="muted">Choose a class first.</p>`;
  if (!cp.steps.length) return `<p>${esc(d.class)} has no level ${cp.tmp.level} picks. Tap Continue.</p>`;
  const { body, step } = levelBody(app);
  const l = cp.lvl;
  const pills = cp.steps.map((st, i) => {
    const before = cp.steps.slice(0, i).every(x => stepValidFor(cp.tmp, l, x));
    return `<li><button data-a="lvlGoto" data-i="${i}" class="${i === l.step ? "now" : stepValidFor(cp.tmp, l, st) && i < l.step ? "done" : ""}" ${before ? "" : "disabled"}><span>${i + 1}</span>${esc(st.label)}</button></li>`;
  }).join("");
  return `${cp.steps.length > 1 ? `<ol class="lvl-steps" aria-label="Class choices">${pills}</ol>` : ""}
    <div class="choice"><div class="choice-head"><h3>${esc(step.label)}</h3></div>${body}</div>`;
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
  if (d && (chapterId(d) === "classChoices" || chapterId(d) === "classOpts")) {
    const cp = choicePlan(d, app);
    app.char = cp ? cp.tmp : null; app.lvl = cp ? cp.lvl : null;
  } else { app.char = null; app.lvl = null; }
}

function finishBody(app, d) {
  const fin = finalAbilities(app, d), lvl = app.campaign.startingLevel || 1;
  const skills = [...takenSkills(app, d), ...d.classSkills].map(id => SKILLS.find(s => s.id === id)?.label).filter(Boolean);
  const open = unresolvedDecisions(d, app).filter(x => x.chapter !== "finish");
  const picks = choiceLines(app, d);
  return `<div class="btnrow"><button class="btn" data-a="randomDetails">Randomize details</button></div>
    <div class="field" style="margin-top:12px"><div class="rlabel"><label for="f-name">Character name</label><button class="btn sm" data-a="randomName" aria-label="Random name">Random</button></div>
      <input class="f" id="f-name" value="${esc(d.name)}" placeholder="e.g. Gandork the Green" maxlength="60" autocomplete="off" enterkeyhint="next"></div>
    <div class="field" style="margin-top:12px"><div class="rlabel"><label for="f-align">Alignment (optional)</label><button class="btn sm" data-a="randomAlign" aria-label="Random alignment">Random</button></div><select class="f" id="f-align" data-draft="alignment"><option value="">Choose...</option>${ALIGNMENTS.map(a => `<option ${d.alignment === a ? "selected" : ""}>${a}</option>`).join("")}</select></div>
    <div class="field" style="margin-top:12px"><label>Languages</label><input class="f" value="${esc(["Common", ...[].concat(d.picks["bg:lang"] || [])].join(", "))}" disabled aria-label="Languages from your background"></div>
    <div class="field" style="margin-top:12px"><label>Physical traits (optional)</label><div class="phys-grid">${PHYS.map(([k, l, ph]) => `<label class="phys-f"><span>${l}</span><input class="f" data-draft-text="${k}" value="${esc(d[k] || "")}" placeholder="${esc(ph)}" maxlength="40" autocomplete="off"></label>`).join("")}</div></div>
    <div class="field" style="margin-top:12px"><div class="rlabel"><label for="f-look">Appearance (optional)</label><button class="btn sm" data-a="randomLook" aria-label="Random appearance">Random</button></div><textarea class="f" id="f-look" rows="3" data-draft-text="appearance" placeholder="Height, build, hair, scars, clothing">${esc(d.appearance || "")}</textarea></div>
    <div class="field" style="margin-top:12px"><div class="rlabel"><label for="f-story">Backstory and personality (optional)</label><button class="btn sm" data-a="randomStory" aria-label="Random backstory and personality">Random</button></div><textarea class="f" id="f-story" rows="5" data-draft-text="backstory" placeholder="Where from, what they want, how they act">${esc(d.backstory || "")}</textarea></div>
    <div class="choice"><div class="choice-head"><h3>Summary</h3></div><dl class="kv">
      <dt>Class</dt><dd>${esc(d.class)}, level ${lvl}</dd><dt>Species</dt><dd>${esc(d.species)}</dd><dt>Background</dt><dd>${esc(d.background)}</dd>
      <dt>Abilities</dt><dd class="num">${ABILITIES.map(a => `${a.toUpperCase()} ${fin[a]}`).join(" \u00b7 ")}</dd>
      <dt>Skills</dt><dd>${esc(skills.join(", "))}</dd>${picks.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
    <div class="choice"><div class="choice-head"><h3>Template</h3></div>
      <div class="btnrow"><button class="btn sm" data-a="tplSave">Save</button><button class="btn sm" data-a="tplCopy">Code</button></div></div>
    ${open.length ? `<div class="choice"><div class="choice-head"><h3>Still to do</h3></div>${open.map(x => `<button class="optcard" data-a="gotoChapter" data-id="${x.chapter}" style="margin-bottom:6px"><span class="grow"><b>${esc(x.label)}</b><span>${esc(x.reason)}</span></span><span class="sub2">Go</span></button>`).join("")}</div>` : ""}`;
}

// ---- the shell: chapter rail, live sheet, accent colour per choice
const AB_NAME = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const CXL = { hp: 0, ac: 10, rad: [0, 0, 0, 0, 0, 0] }; // what the sheet last showed, so numbers and the radar animate from there
let CX_HUE = 9;

function cxLook(app, d) {
  const id = chapterId(d);
  const pick = { class: d.class, species: d.species, background: d.background }[id];
  const kind = { class: "class", species: "species", background: "background" }[id];
  if (pick) { const e = emblemFor(kind, pick); return { hue: e.hue, amb: e.amb }; }
  if (id === "classChoices" || id === "classOpts" || id === "finish" || id === "abilities") {
    const e = id === "classChoices" && d.class ? emblemFor("class", d.class) : d.species ? emblemFor("species", d.species) : d.class ? emblemFor("class", d.class) : null;
    if (e) return { hue: e.hue, amb: e.amb };
  }
  return { hue: 9, amb: "embers" };
}

function previewChar(app, d) {
  if (!d.class) return null;
  try { return normalize(buildCharacter(d, app), app.library); } catch (e) { return null; }
}

function sheetInner(app, d, reach) {
  const cls = findByName(app.library.classes, d.class), sp = findByName(app.library.species, d.species), bg = findByName(app.library.backgrounds, d.background);
  const c = previewChar(app, d), fin = finalAbilities(app, d);
  const abIdx = CHAPTERS.findIndex(x => x.id === "abilities");
  const showAb = d.chapter >= abIdx || reach > abIdx;
  const hp = c ? c.hp.max : 0, ac = c ? computeAC(c).total : 10, speed = c ? c.speed : (sp ? speciesSpeed(sp.traits) : null);
  const hue = (d.species ? emblemFor("species", d.species) : d.class ? emblemFor("class", d.class) : { hue: 9 }).hue;
  const skills = c ? c.skillProf.map(id => (SKILLS.find(s => s.id === id) || {}).label).filter(Boolean) : [];
  const bgSk = new Set(bg ? parseList(bg.skills) : []);
  const saves = c ? c.saveProf.map(a => a.toUpperCase()) : [];
  const spells = d.lvl ? [...(d.lvl.cantrips || []), ...(d.lvl.spells || [])] : [];
  const feats = [...(c ? c.feats : []), ...(sp ? parseSpecies(sp).traits.filter(t => (t.level || 1) <= 1).slice(0, 4).map(t => t.name) : [])];
  const R = 88, cx = 110, cy = 104, pt = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ring = f => `<polygon points="${ABILITIES.map((_, i) => pt(i, R * f).map(v => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="var(--line)" stroke-width="1" opacity=".7"/>`;
  const dim = (on, h) => on ? h : h.replace('class="em', 'class="em empty');
  const trioHtml = [d.class ? emblem("class", d.class) : dim(false, emblemIcon("druid", 40)), d.species ? emblem("species", d.species) : dim(false, emblemIcon("human", 40)), d.background ? emblem("background", d.background) : dim(false, emblemIcon("sage", 40))].join("");
  CXL.next = { hp, ac, rad: ABILITIES.map(a => showAb ? Math.min(20, fin[a]) : 0) };
  const prim = a => cls && String(cls.primary || "").includes(ABILITY_LABEL[a]);
  return `<div class="cx-sh-head"><div class="cx-trio">${trioHtml}</div><div class="grow"><div class="cx-sh-name ${d.name.trim() ? "" : "empty"}" id="cx-name">${d.name.trim() ? esc(d.name.trim()) : "Unnamed adventurer"}</div>
      <div class="sub2">${esc(["Level " + (c ? c.level : 1) + (d.class ? " " + d.class : ""), d.species, d.background].filter(Boolean).join(" \u00b7 "))}</div></div></div>
    <div class="cx-vit"><div><div class="cx-vial" title="Hit points"><div class="cx-liq" id="cx-liq" style="height:${Math.min(100, CXL.hp / 20 * 100)}%"></div></div><b class="num" id="cx-hp">${CXL.hp}</b><small>Hit points</small></div>
      <div><div class="cx-shield"><svg viewBox="0 0 54 62" aria-hidden="true"><path d="M27 2 L50 10 V30 C50 44 40 54 27 60 C14 54 4 44 4 30 V10 Z" fill="var(--panel2)" stroke="var(--amber)" stroke-width="2.5"/></svg><b class="num" id="cx-ac">${CXL.ac}</b></div><small>Armor Class</small></div>
      <div><b class="num cx-spd">${speed == null ? "--" : speed}</b><small>Speed (ft)</small></div></div>
    <svg class="cx-radar" viewBox="0 -8 220 226" role="img" aria-label="Ability scores">${[0.25, 0.5, 0.75, 1].map(ring).join("")}${ABILITIES.map((_, i) => { const q = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="var(--line-soft)"/>`; }).join("")}<polygon id="cx-rpoly" points="" fill="var(--amber)" fill-opacity=".28" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round"/>${ABILITIES.map((a, i) => { const q = pt(i, R + 14); return `<text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" fill="var(--faint)" stroke="none">${AB_NAME[a]}</text>`; }).join("")}</svg>
    <div class="cx-six">${ABILITIES.map(a => `<div class="${prim(a) ? "p" : ""}"><span>${AB_NAME[a]}</span><b>${showAb ? fin[a] : "\u2013"}</b><i>${showAb ? fmtMod(abilityMod(fin[a])) : ""}</i></div>`).join("")}</div>
    ${(saves.length || skills.length) ? `<div><h4 class="cx-h">Proficiencies \u00b7 bonus +2</h4><div class="cx-pills">${saves.map(x => `<span class="cx-pill">Save ${x}</span>`).join("")}${skills.map(x => `<span class="cx-pill ${bgSk.has(x) ? "bg" : ""}">${esc(x)}</span>`).join("")}</div></div>` : ""}
    ${spells.length ? `<div><h4 class="cx-h">Spells</h4><div class="cx-pills">${spells.map(x => `<span class="cx-pill bg">${esc(x)}</span>`).join("")}</div></div>` : ""}
    ${feats.length ? `<div><h4 class="cx-h">Features</h4><div class="cx-pills">${feats.map(x => `<span class="cx-pill">${esc(x)}</span>`).join("")}</div></div>` : ""}`;
}

function railHtml(app, d, reach) {
  const done = CHAPTERS.map(c => validateChapter(c.id, d, app).valid && (c.id !== "abilities" || !!d.background));
  const n = CHAPTERS.length;
  return `<nav class="cx-rail" aria-label="Creation chapters"><div class="cx-line"><i style="height:calc(${Math.min(reach, n - 1)} / ${n - 1} * 100%)"></i></div>${CHAPTERS.map((c, i) => {
    const val = chapterValue(app, d, c.id), isOn = i === d.chapter, ok = done[i] && i <= reach;
    return `<button class="cx-chap ${isOn ? "on" : ""} ${ok ? "ok" : ""}" data-a="gotoChapter" data-i="${i}" ${i > reach ? "disabled" : ""} ${isOn ? 'aria-current="step"' : ""}>
      <span class="cx-no">${ok ? "\u2713" : i + 1}</span><span class="grow"><b>${esc(c.title)}</b><small>${esc(ok || isOn ? (val || "") : "")}</small></span></button>`;
  }).join("")}</nav>`;
}

// After every redraw: accent + particles for what is on screen, and animate the sheet numbers.
export function cxAfterRender(app) {
  const d = app.createDraft; if (!d) return;
  const look = cxLook(app, d);
  cxSync(look.amb, look.hue, app.prefs.cxfx !== false);
  cxAnimate();
}
function cxAnimate() {
  const n = CXL.next; if (!n) return;
  const poly = document.getElementById("cx-rpoly");
  if (poly) {
    const from = CXL.rad.slice(), R = 88, cx = 110, cy = 104, t0 = performance.now(), id = (CXL.tw = (CXL.tw || 0) + 1);
    const draw = arr => poly.setAttribute("points", arr.map((v, i) => { const a = -Math.PI / 2 + i * Math.PI / 3, r = R * Math.max(0, Math.min(20, v)) / 20; return (cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1); }).join(" "));
    (function f(now) { if (id !== CXL.tw) return; const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3); draw(n.rad.map((v, i) => from[i] + (v - from[i]) * e)); if (k < 1) requestAnimationFrame(f); })(t0);
  }
  const liq = document.getElementById("cx-liq"); if (liq) requestAnimationFrame(() => { liq.style.height = Math.min(100, n.hp / 20 * 100) + "%"; });
  const count = (el, a, b) => { if (!el || a === b) return; const t0 = performance.now(); (function f(now) { const k = Math.min(1, (now - t0) / 600); el.textContent = Math.round(a + (b - a) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0); };
  count(document.getElementById("cx-hp"), CXL.hp, n.hp); count(document.getElementById("cx-ac"), CXL.ac, n.ac);
  CXL.hp = n.hp; CXL.ac = n.ac; CXL.rad = n.rad.slice();
}
// Refresh only the sheet panel (used while typing a name or a score, when the page is not redrawn).
export function cxRefreshSheet(app) {
  const d = app.createDraft; if (!d) return;
  const el = document.querySelector(".cx-sheet");
  if (el) { el.innerHTML = sheetInner(app, d, reachIndex(app, d)); cxAnimate(); }
  const mb = document.querySelector(".cx-mbar-stats"); if (mb) mb.innerHTML = mbarStats(app, d);
  const ml = document.querySelector(".cx-mbar-label"); if (ml) ml.textContent = mbarLabel(d);
}

// HP and AC are real only once scores are set; speed once a species is chosen. Dashes until then.
function mbarStats(app, d) {
  const c = previewChar(app, d), abIdx = CHAPTERS.findIndex(x => x.id === "abilities");
  const scored = !!c && (d.chapter >= abIdx || reachIndex(app, d) > abIdx);
  const sp = findByName(app.library.species, d.species);
  const hp = scored ? c.hp.max : "--", ac = scored ? computeAC(c).total : "--", speed = c && sp ? c.speed : "--";
  return `<b>${hp}</b> HP <b>${ac}</b> AC <b>${speed}</b> ft`;
}
const mbarLabel = d => [d.class, d.species].filter(Boolean).join(" \u00b7 ") || "No class";
function mobileStatBar(app, d) {
  return `<div class="cx-mbar" data-a="toggleMobileSheet" role="button" aria-label="Character stats" aria-expanded="${!!app.mobileSheetOpen}">
    <span class="cx-mbar-label">${esc(mbarLabel(d))}</span>
    <span class="cx-mbar-stats">${mbarStats(app, d)}</span>
    <span class="cx-mbar-arrow">${app.mobileSheetOpen ? "\u25BC" : "\u25B2"}</span></div>
  ${app.mobileSheetOpen ? `<div class="cx-msheet-wrap"><div class="cx-msheet">${sheetInner(app, d, reachIndex(app, d))}</div></div>` : ""}`;
}

export function renderCreate(app) {
  const d = app.createDraft, id = chapterId(d), ch = CHAPTERS[d.chapter] || CHAPTERS[0];
  const v = canContinue(app, d, id), reach = reachIndex(app, d), look = cxLook(app, d);
  CX_HUE = look.hue;
  let tools = "", content = "";
  if (LIST_KINDS.includes(id)) {
    const cfg = cfgFor(app, d, id);
    cfg.randomBtn = `<button class="btn sm" data-a="randomPick">Random ${cfg.kind}</button>`;
    if (id === "class") tools = `<button class="btn sm" data-a="randomAll">Random character</button>`;
    if (id === "background") tools = `<button class="btn sm" data-a="openCustomBg">Custom background</button>`;
    content = `${renderControls(app, cfg)}${searchBox("wizard", d.query, `Search ${cfg.items.length} ${cfg.noun}`)}
      ${app.rndCard && app.rndCard.kind === id ? `<div class="rndres" id="rnd-card"><span class="lab">Random ${esc(cfg.kind)}</span><button class="rndname" data-a="rndView">${esc(app.rndCard.name)}</button><div class="btnrow"><button class="btn sm" data-a="showDetail" data-kind="${esc(id)}" data-name="${esc(app.rndCard.name)}">Read</button><button class="btn sm" data-a="rndUndo">Undo</button><button class="btn sm" data-a="randomPick">Reroll</button><button class="btn sm pri" data-a="rndKeep">Keep</button></div></div>` : ""}
      <div class="sp-list" id="wizard-results">${renderWizardResults(app)}</div>`;
  } else if (id === "abilities") content = abilitiesBody(app, d);
  else if (id === "classOpts") {
    tools = `<button class="btn sm" data-a="cxOpenShop">Shop \u00b7 ${esc(fmtPrice(walletLeftCp(app, d) / 100) || "0 gp")}</button> <button class="btn sm" data-a="randomSkills">Randomize skills</button>` + (gearChoices(app, d).some(g => !g.fixed) ? ` <button class="btn sm" data-a="randomGear">Randomize equipment</button>` : "");
    content = skillsGearBody(app, d);
  } else if (id === "classChoices") content = classChoicesBody(app, d);
  else content = finishBody(app, d);
  const last = d.chapter === CHAPTERS.length - 1;
  app._cxPop = false;
  return `<div class="cx-shell" style="--cx-h:${CX_HUE}">
    ${topbar(ch.title, `Step ${d.chapter + 1} of ${CHAPTERS.length}`, { back: d.chapter === 0 ? "cancelCreate" : "prevStep" })}
    <main class="wrap page has-stickybar cx-main">
      <div class="cx-grid">
        ${railHtml(app, d, reach)}
        <section class="cx-stage" aria-label="${esc(ch.title)}">
          <div class="steprow" aria-hidden="true">${CHAPTERS.map((_, i) => `<div class="step ${i <= d.chapter ? "done" : ""}"></div>`).join("")}</div>
          ${tools ? `<div class="wiztools">${tools}</div>` : ""}
          <div class="panel"><div class="panel-body">${content}</div></div>
        </section>
        <aside class="cx-sheet" aria-label="Your character so far">${sheetInner(app, d, reach)}</aside>
      </div>
    </main>
    <div class="stickybar">${mobileStatBar(app, d)}<div class="wrap">
      <p class="why" id="wizard-why">${v.valid ? "" : esc(v.reasons.join(" "))}</p>
      <div class="btnrow">
        <button class="btn" data-a="openProgress">View progress</button>
        <button class="btn pri${v.valid ? "" : " incomplete"}" data-a="${last ? "finishCreate" : "nextStep"}" ${v.valid ? "" : 'aria-disabled="true"'}>${last ? "Create character" : "Continue"}</button>
      </div>
    </div></div>
    ${app.progressOpen ? progressSheet(app, d) : ""}</div>`;
}

// Continue on an unfinished step: move to the first thing still missing and flag it.
export function flagEl(el) {
  el.scrollIntoView({ block: el.getBoundingClientRect().height > innerHeight * 0.6 ? "start" : "center", behavior: "smooth" });
  el.classList.remove("flag-need"); void el.offsetWidth; el.classList.add("flag-need");
  if (el.focus && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.focus({ preventScroll: true });
  setTimeout(() => el.classList.remove("flag-need"), 2600);
}
export function cxFlagNeed(app) {
  const d = app.createDraft, id = chapterId(d), stage = document.querySelector(".cx-stage"); if (!d || !stage) return false;
  let el = null;
  if (id === "finish") el = document.getElementById("f-name");
  else if (LIST_KINDS.includes(id) && !d[id]) el = stage.querySelector("#wizard-results");
  else el = stage.querySelector(".sp-row.open .choice.need, .sp-row.open .vpick.need, .sp-row.open .gearpick.need, .sp-row.open .field.need") || stage.querySelector(".choice.need, .vpick.need, .gearpick.need, .field.need, .cx-methods.need") || stage.querySelector(".sp-trait.pending, .need") || stage.querySelector(".optlist, .panel");
  if (!el) return false;
  flagEl(el);
  const why = document.getElementById("wizard-why"); if (why) { why.classList.remove("flag-why"); void why.offsetWidth; why.classList.add("flag-why"); }
  return true;
}
