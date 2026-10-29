// The classic character sheet: one page laid out like the printed 2024 sheet
// (header, vitals, six ability blocks with their saves and skills, weapons,
// class features, species traits, feats, training). Everything is tappable.
import { esc, ICONS, searchBox } from "../ui.js";
import { ABILITIES, ABILITY_LABEL, fmtMod, deriveCharacter, PROF_GROUPS } from "../rules.js";
import { findByName } from "../data.js";
import { optionNames, optionGroup } from "../progression.js";
import { attacksPanel, needsFirstChoices, spellsTab, gearTab } from "./sheet.js";
import { subclassesFor } from "../data.js";
import { weaponsOf } from "../gear.js";

const row = (name, sub, kind, extra = "") => `<button class="rowline rollable" data-a="showDetail" data-kind="${kind}" ${extra}><span class="nm">${esc(name)}</span><span class="sub2">${esc(sub)}</span></button>`;

function abilityBlock(c, d, a) {
  const skills = d.skills.filter(s => s.ability === a);
  return `<section class="abblk" aria-label="${ABILITY_LABEL[a]}">
    <h3>${ABILITY_LABEL[a]}</h3>
    <button class="abmod" data-a="rollAbility" data-ab="${a}" aria-label="${ABILITY_LABEL[a]} check ${fmtMod(d.mods[a])}. Tap to roll."><b>${fmtMod(d.mods[a])}</b><span>${c.abilities[a]}</span></button>
    <button class="abrow save" data-a="rollSave" data-ab="${a}"><span class="dot ${c.saveProf.includes(a) ? "on" : ""}"></span><span class="nm">Save</span><b>${fmtMod(d.saves[a])}</b></button>
    ${skills.map(s => `<div class="abrow"><button class="pip" data-a="cycleSkill" data-id="${s.id}" aria-label="${s.label} proficiency: ${s.expert ? "expertise" : s.proficient ? "proficient" : "none"}"><span class="dot ${s.expert ? "exp" : s.proficient ? "on" : ""}"></span></button>
      <button class="nm linkbtn" data-a="rollSkill" data-id="${s.id}">${s.label}</button><button class="v" data-a="rollSkill" data-id="${s.id}">${fmtMod(s.bonus)}</button></div>`).join("")}
  </section>`;
}


// Armor and weapon training as check boxes.
export function profsChecks(c) {
  const p = c.profs || { armor: [], weapons: [] };
  return PROF_GROUPS.map(([g, label, opts]) => `<div class="profgrp"><span class="lab">${label}</span><div class="profopts">${opts.map(([k, l]) =>
    `<label class="profchk"><input type="checkbox" data-a="toggleProf" data-g="${g}" data-k="${k}" ${(p[g] || []).includes(k) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>`).join("");
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

  const subs = [["sheet", "Sheet"], ["features", "Features"], si ? ["spells", "Spells"] : null, ["gear", "Equipment"], ["notes", "Notes"]].filter(Boolean);
  const sub = subs.some(x => x[0] === app.classicSub) ? app.classicSub : "sheet";
  const profsBox = `<div class="panel"><div class="panel-head"><h2>Equipment training and proficiencies</h2></div><div class="panel-body stack">
      ${profsChecks(c)}
      <div class="field"><label>Tools and other training</label><textarea class="f" data-field="profsText" style="min-height:60px">${esc(c.profsText)}</textarea></div>
      <div class="field"><label>Languages</label><input class="f" data-field="languages" value="${esc(c.languages)}"></div>
    </div></div>`;
  const pages = {
    sheet: `    <div class="cl-top">
    <div class="panel"><div class="panel-head"><h2>Character</h2></div><div class="panel-body">
      <div class="idgrid"><div><span>Class</span><b>${esc(c.class)}</b></div><div><span>Subclass</span><b>${esc(c.subclass || "None yet")}</b></div>
        <div><span>Species</span><b>${esc(c.species)}</b></div><div><span>Background</span><b>${esc(c.background)}</b></div></div></div></div>
    <div class="panel"><div class="panel-head"><h2>Hit dice and death saves</h2></div><div class="panel-body stack">
      <div class="rowline" style="border:0"><span class="nm">Hit dice <span class="sub2">d${hd.die}</span></span><b>${hd.total - hd.spent} / ${hd.total}</b></div>
      <div class="btnrow"><button class="btn" data-a="openShortRest">Short rest</button><button class="btn" data-a="openLongRest">Long rest</button></div>
      <div class="rowline"><span class="nm">Death save successes</span><span class="pips">${pips(c.deathSaves.success, "success", "ok")}</span></div>
      <div class="rowline"><span class="nm">Death save failures</span><span class="pips">${pips(c.deathSaves.fail, "fail", "fail")}</span></div>
      ${c.hp.cur <= 0 ? `<button class="btn pri block" data-a="rollDeathSave" ${c.deathSaves.fail >= 3 || c.deathSaves.success >= 3 ? "disabled" : ""}>Roll death save</button>` : ""}
    </div></div>
    </div>

    <div class="cvals">
      ${val("Heroic Inspiration: " + (c.inspiration ? "have it" : "none"), c.inspiration ? "✓" : "–", `data-a="toggleInsp" aria-pressed="${!!c.inspiration}"`)}
      ${val("Size", esc(c.size || "Medium"))}
    </div>

    <div class="cl-cols">
      <div class="cl-ab">
    <div class="abgrid">${ABILITIES.map(a => abilityBlock(c, d, a)).join("")}</div>
      </div>
      <div class="cl-side">
    ${attacksPanel(app, c, d, { head: "Weapons and damage" })}
    ${si ? `<div class="panel"><div class="panel-head"><h2>Spellcasting</h2></div><div class="panel-body">
      <div class="cvals three">${val("Ability", ABILITY_LABEL[si.ability])}${val("Modifier", fmtMod(si.mod))}${val("Spell save DC", si.dc)}${val("Spell attack", fmtMod(si.attackBonus))}</div></div></div>` : ""}
      </div>
    </div>`,
    features: `<div class="cl-cols3 cl-two"><div>
    <div class="panel"><div class="panel-head"><h2>Class features</h2>
      <button class="btn sm pri" data-a="openLevelMenu" ${c.level >= 20 ? "disabled" : ""}>Level up</button></div><div class="panel-body flush">
      ${(c.masteries || []).length ? `<div class="rowline"><span class="nm">Weapon mastery</span><span class="sub2" style="text-align:right">${esc(c.masteries.join(", "))}</span></div>` : ""}
      ${classRows.map(r => row(r.name, r.sub, r.kind, `data-name="${esc(r.name)}" data-from="${esc(r.from)}"`)).join("")}
      ${c.level >= 11 && !(cls?.features || []).some(x => x.lv > 10) ? `<p class="sub2" style="padding:8px 0">Your rules data stops at level 10, so level ${c.level} features aren't listed.</p>` : ""}
    </div></div>
    </div><div>
    <div class="panel"><div class="panel-head"><h2>Species traits</h2></div><div class="panel-body flush">
      ${row(`${c.species} traits`, "Species", "species", `data-name="${esc(c.species)}"`)}
      ${row(c.background, "Background", "background", `data-name="${esc(c.background)}"`)}
    </div></div>
    <div class="panel"><div class="panel-head"><h2>Feats</h2><button class="btn sm" data-a="openPicker" data-picker="feats">Add</button></div><div class="panel-body flush">
      ${c.feats.length ? c.feats.map((f, i) => row(f, "Feat", "feat", `data-name="${esc(f)}" data-i="${i}"`)).join("") : `<p class="muted small" style="padding:12px 0">No feats yet.</p>`}
    </div></div>
    </div></div>`,
    spells: () => (si ? spellsTab(app, c, d) : ""),
    gear: () => gearTab(app, c, d, { attacks: false }),
    notes: `<div class="cl-cols3 cl-two"><div>${profsBox}</div><div>
    <div class="panel"><div class="panel-body"><div class="btnrow">
      <button class="btn" data-a="downloadPdf">Download character sheet (PDF)</button></div>
      <label class="field" style="margin-top:12px"><span class="lab">Notes</span><textarea class="f" data-field="notes" aria-label="Notes" style="min-height:120px">${esc(c.notes)}</textarea></label></div></div>
      </div>
    </div></div>`
  };

  return `<div class="classic">
    <div class="subtabs seg" role="group" aria-label="Sheet sections" style="--n:${subs.length}">
      ${subs.map(([id, label]) => `<button data-a="classicSub" data-sub="${id}" aria-pressed="${sub === id}">${label}</button>`).join("")}</div>
    ${searchBox("sheet", app.sheetQuery, "Search your sheet: skills, features, spells, items...")}
    <div id="results-sheet">${renderSheetSearch(app)}</div>
    ${!c.subclass && c.level >= 3 && subclassesFor(app.library, c.class).length ? `<div class="panel"><div class="panel-body"><div class="rowline" style="border:0"><span class="nm" style="color:var(--amber)">No subclass chosen yet</span><button class="btn sm" data-a="openEdit">Choose</button></div></div></div>` : ""}
    ${needsFirstChoices(app, c) ? `<div class="panel"><div class="panel-body"><div class="rowline" style="border:0"><span class="nm" style="color:var(--amber)">Level 1 choices not made yet</span><button class="btn sm pri" data-a="startFirstChoices">Choose</button></div></div></div>` : ""}
    ${typeof pages[sub] === "function" ? pages[sub]() : pages[sub]}
  </div>`;
}
