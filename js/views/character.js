// The Advanced sheet: Play Mode / Spells / Gear / Rolls / Features / Stats. (Classic is js/views/classic.js.)
import { esc, kRow, kGroup } from "../ui.js";
import { findByName, subclassesFor } from "../data.js";
import { CASTER_TYPE } from "../rules.js";
import { optionNames, optionGroup } from "../progression.js";
import { needsFirstChoices, spellsTab, loadoutGearTab } from "./sheet.js";
import { playTab, trackHtml } from "./play.js";
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
    c.level >= 11 && !(cls?.features || []).some(x => x.lv > 10) ? `<p class="sub2" style="padding:8px 0">Rules data ends at level 10.</p>` : ""
  ].join("");
  return `
    <div class="panel"><div class="panel-head"><h2>Level ${c.level} ${esc(c.class)}</h2>
      <button class="btn sm pri" data-a="openLevelMenu" ${c.level >= 20 ? "disabled" : ""}>Level up</button></div>
      ${warn ? `<div class="panel-body flush">${warn}</div>` : ""}</div>
    <div class="pm prog-wrap"><div class="prog-head">${kGroup("Progression", "level 1 to 20", { tone: "blue" })}</div>${trackHtml(app, c)}</div>
    ${kGroup("Class", classRows.length, { tone: "amber" })}<div class="k-list">${classRows.map(r => rowOf(r, "amber")).join("")}</div>
    ${kGroup("Species and background", 2, { tone: "green" })}<div class="k-list">
      ${rowOf({ name: `${c.species} traits`, sub: "Species", kind: "species", dn: c.species }, "green")}
      ${rowOf({ name: c.background, sub: "Background", kind: "background", dn: c.background }, "blue")}</div>
    ${kGroup("Feats", c.feats.length, { tone: "feat" })}<div class="k-list">
      ${c.feats.map((f, i) => rowOf({ name: f, sub: "Feat", kind: "feat", i }, "feat")).join("")}</div>
    <div class="btnrow" style="margin-top:10px"><button class="btn" data-a="openPicker" data-picker="feats">Add a feat</button></div>
    ${c.classFeatureNotes ? `<div class="panel" style="margin-top:14px"><div class="panel-head"><h2>Class notes</h2></div><div class="panel-body"><textarea class="f" data-field="classFeatureNotes" aria-label="Class notes">${esc(c.classFeatureNotes)}</textarea></div></div>` : ""}`;
}

export function findTile(app, c, d, id) {
  const all = playEntries(app, c, d).flatMap(e => [e, ...(e.kids || [])]);
  return all.find(x => x.id === id) || buildCombat(app, c, d).find(x => x.id === id) || null;
}

export function concBanner(app) {
  return app.concPrompt ? `<div class="concbanner" role="alert"><b>Concentration check</b><span>Constitution save, DC ${app.concPrompt.dc}${app.concPrompt.conc ? " to keep " + esc(app.concPrompt.conc) : ""}</span>
      <span class="btnrow"><button class="btn sm pri" data-a="concKeep">Kept it</button><button class="btn sm danger" data-a="concLose">Lost it</button></span></div>` : "";
}
