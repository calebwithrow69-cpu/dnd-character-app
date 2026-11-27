// The classic character sheet: one page laid out like the printed 2024 sheet
// (header, vitals, six ability blocks with their saves and skills, weapons,
// class features, species traits, feats, training). Everything is tappable.
import { featuresView } from "./features.js";
import { layoutOf, PRESETS, blockOf } from "../sheetlayout.js";
import { toolGrid } from "./tools.js";
import { esc, ICONS, searchBox } from "../ui.js";
import { ABILITIES, ABILITY_LABEL, fmtMod, deriveCharacter, PROF_GROUPS } from "../rules.js";
import { findByName, enabledSpells } from "../data.js";
import { grantsOf } from "../effects.js";
import { optionNames, optionGroup } from "../progression.js";
import { attacksPanel, needsFirstChoices, spellsTab, coinsPanel, weightBar } from "./sheet.js";
import { statCard, skillsMain } from "./stats.js";
import { SLOTS, itemById, attunedCount, weaponsOf } from "../gear.js";
import { classicGear } from "./classicgear.js";
import { subclassesFor } from "../data.js";
import { trackersPanel } from "./trackers.js";
import { playTab, trackHtml } from "./play.js";

const row = (name, sub, kind, extra = "") => `<button class="rowline rollable" data-a="showDetail" data-kind="${kind}" ${extra}><span class="nm">${esc(name)}</span><span class="sub2">${esc(sub)}</span></button>`;

function abilityBlock(c, d, a) {
  const skills = d.skills.filter(s => s.ability === a);
  return `<section class="abblk" aria-label="${ABILITY_LABEL[a]}">
    <h3>${ABILITY_LABEL[a]}</h3>
    <button class="abmod" data-a="rollAbility" data-ab="${a}" aria-label="${ABILITY_LABEL[a]} check ${fmtMod(d.mods[a])}"><b>${fmtMod(d.mods[a])}</b><span>${c.abilities[a]}</span></button>
    <button class="abrow save" data-a="rollSave" data-ab="${a}"><span class="dot ${c.saveProf.includes(a) ? "on" : ""}"></span><span class="nm">Save</span><b>${fmtMod(d.saves[a])}</b></button>
    ${skills.map(s => `<div class="abrow"><button class="pip" data-a="cycleSkill" data-id="${s.id}" aria-label="${s.label} proficiency: ${s.expert ? "expertise" : s.proficient ? "proficient" : "none"}"><span class="dot ${s.expert ? "exp" : s.proficient ? "on" : ""}"></span></button>
      <button class="nm linkbtn" data-a="rollSkill" data-id="${s.id}">${s.label}</button><button class="v" data-a="rollSkill" data-id="${s.id}">${fmtMod(s.bonus)}</button></div>`).join("")}
  </section>`;
}


// Armor and weapon training as check boxes. Read-only: training comes from your class and does not change by tapping.
export function profsChecks(c) {
  const p = c.profs || { armor: [], weapons: [] };
  return PROF_GROUPS.map(([g, label, opts]) => `<div class="profgrp"><span class="lab">${label}</span><div class="profopts">${opts.map(([k, l]) =>
    `<label class="profchk ${(p[g] || []).includes(k) ? "on" : ""}"><input type="checkbox" disabled ${(p[g] || []).includes(k) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>`).join("");
}

// Cantrips sit in the weapons list like the printed sheet: name, casting time and range, a Cast button.
function cantripRows(app, c) {
  const L = app.library;
  const rows = (c.spellcasting.spells || []).map(s => ({ s, r: findByName(enabledSpells(L, app.campaign), s.name) || findByName(L.spells, s.name) })).filter(x => x.r && x.r.level === 0);
  return rows.map(({ s, r }) => `<div class="rowline"><button class="nm linkbtn" data-a="showDetail" data-kind="spell" data-name="${esc(s.name)}">${esc(s.name)}</button><span class="sub2">${esc([r.time, r.range].filter(Boolean).join(" \u00b7 "))}</span><button class="btn sm" data-a="castCantrip" data-name="${esc(s.name)}">Cast</button></div>`).join("");
}

// Passive scores, senses and damage defenses: the boxes the printed sheet keeps beside the skills.
function sensesPanel(c, d) {
  const sk = id => (d.skills.find(x => x.id === id) || { bonus: 0 }).bonus;
  const list = k => grantsOf(c, k).map(g => `<span class="chip"><span class="chip-main" title="${esc(g.src || "")}">${esc(g.name)}${g.v != null ? " " + esc(g.v) + " ft" : ""}</span></span>`).join("");
  const none = `<span class="sub2">None</span>`;
  const senses = list("sense"), res = list("resist"), imm = list("immune");
  return `<div class="panel"><div class="panel-head"><h2>Senses and defenses</h2></div><div class="panel-body stack">
    <div class="cvals three"><button class="cval" data-term="Passive Perception"><b>${d.passivePerception}</b><span>Passive Perception</span></button><div class="cval"><b>${10 + sk("investigation")}</b><span>Passive Investigation</span></div><div class="cval"><b>${10 + sk("insight")}</b><span>Passive Insight</span></div></div>
    <div><div class="defrow"><span>Senses</span><span class="chips">${senses || none}</span></div>
    <div class="defrow"><span>Resistances</span><span class="chips">${res || none}</span></div>
    <div class="defrow"><span>Immunities</span><span class="chips">${imm || none}</span></div></div>
  </div></div>`;
}

function slotPips(si, c) {
  if (!si || !si.slots.length) return "";
  const lab = l => (l === 0 ? "Cantrip" : "Level " + l);
  return `<div class="slotbox">${si.slots.map(r => {
    const used = c.spellcasting.slotsUsed[r.level - 1] || 0;
    return `<div class="sp2-slot"><span class="lv">${r.pact ? "Pact " + r.level : lab(r.level)}</span><span class="gems">${Array.from({ length: r.max }, (_, i) => `<button class="pip ${i < r.max - used ? "" : "used"}" data-a="toggleSlot" data-lvl="${r.level}" data-i="${i}" data-max="${r.max}" aria-label="${lab(r.level)} slot ${i + 1}, ${i < r.max - used ? "available" : "used"}"></button>`).join("")}</span></div>`;
  }).join("")}</div>`;
}

function detailsPanel(c) {
  return `<div class="panel"><div class="panel-head"><h2>Character details</h2></div><div class="panel-body stack">
    <div class="field"><label>Alignment</label><input class="f" data-field="alignment" value="${esc(c.alignment)}"></div>
    <div class="field"><label>Appearance</label><textarea class="f" data-field="appearance" style="min-height:70px">${esc(c.appearance)}</textarea></div>
    <div class="field"><label>Backstory and personality</label><textarea class="f" data-field="backstory" style="min-height:110px">${esc(c.backstory)}</textarea></div>
  </div></div>`;
}

function featureRows(app, c) {
  const cls = findByName(app.library.classes, c.class);
  const sub = c.subclass ? findByName(app.library.subclasses, c.subclass) : null;
  const hide = optionNames(cls), group = optionGroup(cls);
  const chosen = group ? (c.choices[group.key] || []) : [];
  return [
    ...((cls?.features) || []).filter(f => f.lv <= c.level && !hide.has(f.name)).map(f => ({ name: f.name, sub: `Lv ${f.lv}`, lv: f.lv, kind: "classFeature", from: c.class })),
    ...((sub?.features) || []).filter(f => f.lv <= c.level && !f.intro).map(f => ({ name: f.name, sub: `${c.subclass} \u00b7 Lv ${f.lv}`, lv: f.lv, kind: "subclassFeature", from: c.subclass })),
    ...chosen.map(n => ({ name: n, sub: group.label, lv: 99, kind: "classFeature", from: c.class }))
  ].sort((a, b) => a.lv - b.lv || a.name.localeCompare(b.name));
}

// Search the sheet: skills, abilities, features, feats, spells and bag items. Tapping a result rolls it or reads it.
export function renderSheetSearch(app) {
  const c = app.char, d = deriveCharacter(c), q = (app.sheetQuery || "").trim().toLowerCase();
  if (!q) return "";
  const has = t => String(t || "").toLowerCase().includes(q);
  const hits = [];
  ABILITIES.forEach(a => { if (has(ABILITY_LABEL[a])) hits.push(["Roll", `${ABILITY_LABEL[a]} check`, fmtMod(d.mods[a]), `data-a="rollAbility" data-ab="${a}"`]); });
  d.skills.forEach(s => { if (has(s.label)) hits.push(["Roll", s.label, fmtMod(s.bonus), `data-a="rollSkill" data-id="${s.id}"`]); });
  featureRows(app, c).forEach(r => { if (has(r.name)) hits.push(["Feature", r.name, r.sub, `data-a="showDetail" data-kind="${r.kind}" data-name="${esc(r.name)}" data-from="${esc(r.from)}"`]); });
  c.feats.forEach((f, i) => { if (has(f)) hits.push(["Feat", f, "", `data-a="showDetail" data-kind="feat" data-name="${esc(f)}" data-i="${i}"`]); });
  (c.spellcasting.spells || []).forEach(s => { if (has(s.name)) hits.push(["Spell", s.name, "", `data-a="showDetail" data-kind="spell" data-name="${esc(s.name)}"`]); });
  (c.inventory || []).forEach(it => { if (has(it.name)) hits.push(["Item", it.name, it.qty > 1 ? "x" + it.qty : "", `data-a="showDetail" data-kind="item" data-name="${esc(it.name)}"`]); });
  [[c.species, "species"], [c.background, "background"]].forEach(([n, k]) => { if (has(n)) hits.push([k === "species" ? "Species" : "Background", n, "", `data-a="showDetail" data-kind="${k}" data-name="${esc(n)}"`]); });
  return `<div class="panel"><div class="panel-body flush">
    ${hits.slice(0, 14).map(([g, n, v, at]) => `<button class="rowline rollable" ${at}><span class="nm">${esc(n)}</span><span class="sub2">${esc(g)}${v ? " \u00b7 " + esc(v) : ""}</span></button>`).join("")}
    ${hits.length ? "" : `<p class="muted small" style="padding:12px 0">Nothing on your sheet matches.</p>`}
    <button class="rowline rollable" data-a="searchRules"><span class="nm">Search all rules for \u201c${esc(app.sheetQuery.trim())}\u201d</span><span class="sub2">Glossary</span></button>
  </div></div>`;
}

export function classicBody(app, c, d) {
  const cls = findByName(app.library.classes, c.class);
  const classRows = featureRows(app, c);
  const hd = c.hitDice, si = d.spellInfo;
  const pips = (n, kind, cls2) => Array.from({ length: 3 }, (_, i) => `<button class="pip ${cls2} ${i < n ? "" : "used"}" data-a="deathSave" data-kind="${kind}" data-i="${i}" aria-label="${kind} ${i + 1}"><i></i></button>`).join("");
  const val = (label, v, attrs = "") => `<${attrs ? "button" : "div"} class="cval" ${attrs}><b>${v}</b><span>${label}</span></${attrs ? "button" : "div"}>`;

  const subs = [["play", "Play"], ["sheet", "Sheet"], ["features", "Features"], si ? ["spells", "Spells"] : null, ["gear", "Gear"]].filter(Boolean);
  const sub = subs.some(x => x[0] === app.classicSub) ? app.classicSub : "sheet";
  const profsBox = `<div class="panel"><div class="panel-head"><h2>Equipment training and proficiencies</h2></div><div class="panel-body stack">
      ${profsChecks(c)}
      <div class="field"><label>Tools and other training</label><textarea class="f" data-field="profsText" style="min-height:60px">${esc(c.profsText)}</textarea></div>
      <div class="field"><label>Languages</label><input class="f" data-field="languages" value="${esc(c.languages)}"></div>
    </div></div>`;
  const blk = {
    identity: () => `<div class="panel paperid"><div class="panel-body">
      <div class="idgrid wide4"><div><span>Class</span><b>${esc(c.class)}</b></div><div><span>Subclass</span><b>${esc(c.subclass || "None yet")}</b></div>
        <div><span>Species</span><b>${esc(c.species)}</b></div><div><span>Background</span><b>${esc(c.background)}</b></div></div></div></div>`,
    status: () => `<div class="paperrow">
      <button class="pbox" data-a="toggleInsp" aria-pressed="${!!c.inspiration}"><b>${c.inspiration ? "\u2713" : "\u2013"}</b><span>Heroic Inspiration</span></button>
      <div class="pbox"><b>${esc(c.size || "Medium")}</b><span>Size</span></div>
      <div class="pbox hd"><b>${hd.total - hd.spent}<i> / ${hd.total}</i></b><span>Hit dice d${hd.die}</span>
        <div class="btnrow"><button class="btn sm" data-a="openShortRest">Short rest</button><button class="btn sm" data-a="openLongRest">Long rest</button></div></div>
      <div class="pbox ds"><span class="dsr"><em>Successes</em><span class="pips">${pips(c.deathSaves.success, "success", "ok")}</span></span>
        <span class="dsr"><em>Failures</em><span class="pips">${pips(c.deathSaves.fail, "fail", "fail")}</span></span>
        ${c.hp.cur <= 0 ? `<button class="btn sm pri" data-a="rollDeathSave" ${c.deathSaves.fail >= 3 || c.deathSaves.success >= 3 ? "disabled" : ""}>Roll death save</button>` : ""}<span>Death saves</span></div>
    </div>`,
    abilities: () => `<div class="abgrid">${ABILITIES.map(a => abilityBlock(c, d, a)).join("")}</div>`,
    weapons: () => attacksPanel(app, c, d, { head: "Weapons and damage", extra: cantripRows(app, c) }),
    spellcasting: () => si ? `<div class="panel"><div class="panel-head"><h2>Spellcasting</h2></div><div class="panel-body">
      <div class="cvals three">${val("Ability", ABILITY_LABEL[si.ability])}${val("Modifier", fmtMod(si.mod))}${val("Spell save DC", si.dc)}${val("Spell attack", fmtMod(si.attackBonus))}</div>${slotPips(si, c)}</div></div>` : "",
    senses: () => sensesPanel(c, d),
    trackers: () => trackersPanel(c),
    statweb: () => statCard(app, c, d),
    skills: () => skillsMain(app, c, d),
    equipped: () => { const eq = SLOTS.map(sl => [sl.label, itemById(c, c.equipment && c.equipment[sl.key])]).filter(x => x[1]);
      return `<div class="panel"><div class="panel-head"><h2>Equipped</h2></div><div class="panel-body stack"><div class="cg-stats"><div><span>Armor class</span><b>${d.ac}</b></div><div><span>Attuned</span><b>${attunedCount(c)}/3</b></div><div><span>Items</span><b>${c.inventory.length}</b></div></div>${weightBar(c)}
        ${eq.length ? eq.map(([l, it]) => `<div class="rowline"><span class="nm">${esc(it.name)}</span><span class="sub2">${esc(l)}</span></div>`).join("") : `<p class="muted small" style="margin:0">Nothing equipped.</p>`}</div></div>`; },
    coins: () => `<div class="panel"><div class="panel-head"><h2>Coins</h2></div><div class="panel-body">${coinsPanel(c)}</div></div>`,
    feats: () => `<div class="panel"><div class="panel-head"><h2>Feats</h2></div><div class="panel-body flush">${c.feats.length
      ? c.feats.map((f, i) => `<button class="rowline rollable" data-a="showDetail" data-kind="feat" data-name="${esc(f)}" data-i="${i}"><span class="nm">${esc(f)}</span><span class="sub2">Feat</span></button>`).join("")
      : `<p class="muted small" style="padding:12px 0">No feats yet.</p>`}</div></div>`,
    profs: () => profsBox,
    details: () => detailsPanel(c)
  };
  const lay = layoutOf(app.prefs), shown = id => lay.blocks.some(x => x.id === id && x.on);
  const sheetPage = () => `<div class="sl-bar"><span class="sub2">${esc(lay.custom ? "Custom layout" : (PRESETS.find(x => x.id === lay.preset) || {}).label)}</span><button class="btn sm" data-a="slOpen">Edit layout</button></div>
    <div class="cl-flow">${lay.blocks.filter(x => x.on).map(x => { const h = blk[x.id](); return h ? `<div class="slb ${(blockOf(x.id) || {}).wide ? "wide" : ""}" data-block="${x.id}">${h}</div>` : ""; }).join("")}</div>`;
  const pages = {
    sheet: sheetPage,
    features: `${featuresView(app, c)}<div class="cl-cols3 cl-two"><div>
    ${shown("details") ? "" : detailsPanel(c)}</div><div>
    ${shown("profs") ? "" : profsBox}
    </div></div>`,
    spells: () => (si ? spellsTab(app, c, d) : ""),
    gear: () => classicGear(app, c, d),
    tools: () => toolGrid(app, c),
    play: () => playTab(app, c, d)
  };

  return `<div class="classic">
    <div class="subtabs seg" role="group" aria-label="Sheet sections" style="--n:${subs.length}">
      ${subs.map(([id, label]) => `<button data-a="classicSub" data-sub="${id}" aria-pressed="${sub === id}">${label}</button>`).join("")}</div>
    ${sub === "tools" || sub === "play" ? "" : `${searchBox("sheet", app.sheetQuery, "Search sheet")}
    <div id="results-sheet">${renderSheetSearch(app)}</div>`}
    ${!c.subclass && c.level >= 3 && subclassesFor(app.library, c.class).length ? `<div class="panel"><div class="panel-body"><div class="rowline" style="border:0"><span class="nm" style="color:var(--amber)">No subclass chosen yet</span><button class="btn sm" data-a="openEdit">Choose</button></div></div></div>` : ""}
    ${needsFirstChoices(app, c) ? `<div class="panel"><div class="panel-body"><div class="rowline" style="border:0"><span class="nm" style="color:var(--amber)">Level 1 choices not made yet</span><button class="btn sm pri" data-a="startFirstChoices">Choose</button></div></div></div>` : ""}
    ${typeof pages[sub] === "function" ? pages[sub]() : pages[sub]}
  </div>`;
}
