import { readinessStrip, loadoutCards, wornRows } from "./loadout.js";
import { esc, topbar, ICONS, searchBox, formatText, conditionIcon, infoRow, activeChips, hotbarToggle, kRow, kGroup } from "../ui.js";
import {
  ABILITIES, ABILITY_LABEL, ABILITY_SHORT, deriveCharacter, fmtMod, weaponNumbers, CASTER_TYPE, parseList
} from "../rules.js";
import { findFeat, enabledSpells, allWeapons, allItems, enabledFeats, findByName, subclassesFor } from "../data.js";
import { SLOTS, itemById, fitsOk, slotOf, slotsOf, wearKind, weaponsOf, attacksOf, attunedCount, itemCategory, categoryRank, speciesLook } from "../gear.js";
import { optionGroup, optionNames, levelUpPlan } from "../progression.js";
import { characterBody, concBanner } from "./character.js";
import { classicBody } from "./classic.js";
import { stylePicker } from "./stylepick.js";
import { xpForLevel } from "../rules.js";
import { shieldSvg, armorTier } from "../shield.js";
import { unitWeight, carried, fmtLb } from "../weights.js";

const levelLabel = l => (Number(l) === 0 ? "Cantrip" : `Level ${l}`);

export function sheetTabs(app) {
  return [
    ["stats", "Character", ICONS.stats],
    ["rules", "Rules", ICONS.book]
  ];
}

// Sheet header. Phone: one slim row (name + level line). Laptop: a banner with the name, the full
// class line, a live read-out of the numbers you check most, and labelled buttons.
function sheetBar(c, d, meta) {
  const sub = [c.species, c.class + (c.subclass ? " (" + c.subclass + ")" : "")].filter(Boolean).join(" \u00b7 ");
  const pill = (v, l) => `<span class="sb-pill"><b>${v}</b><i>${l}</i></span>`;
  return `<header class="topbar sheetbar"><div class="wrap row sb-phone">
      <button class="iconbtn" data-a="backToRoster" aria-label="Back">${ICONS.back}</button>
      <div class="grow"><h1>${esc(c.name)}</h1><div class="sub">${esc(meta)}</div></div>
      <button class="iconbtn" data-a="openEdit" aria-label="Edit character">${ICONS.edit}</button>
      <button class="iconbtn" data-a="openSettings" aria-label="Settings">${ICONS.settings}</button></div>
    <div class="wrap row sb-wide">
      <button class="btn sm" data-a="backToRoster">${ICONS.back}<span>Characters</span></button>
      <div class="grow"><h1>${esc(c.name)}</h1><div class="sub">Level ${c.level} \u00b7 ${esc(sub)}</div></div>
      <div class="sb-pills">${pill(c.hp.cur + "/" + c.hp.max, "HP")}${pill(d.ac, "AC")}${pill(d.speed, "Speed")}${pill(fmtMod(d.initiative), "Init")}${pill(fmtMod(d.prof), "Prof")}</div>
      <button class="btn sm" data-a="openEdit">${ICONS.edit}<span>Edit</span></button>
      <button class="btn sm" data-a="openSettings">${ICONS.settings}<span>Settings</span></button></div></header>`;
}

export function renderSheet(app) {
  const c = app.char;
  const d = deriveCharacter(c);
  const tabs = sheetTabs(app);
  if (!tabs.some(t => t[0] === app.sheetTab)) app.sheetTab = "stats";
  const tab = app.sheetTab;
  if (tab === "stats" && (app.styleAsk === c.id || (app.prefs.sheetStyle !== "classic" && app.prefs.sheetStyle !== "advanced"))) return stylePicker(app);

  const pct = Math.max(0, Math.min(100, (c.hp.cur / Math.max(1, c.hp.max)) * 100));
  const hpState = c.hp.cur <= c.hp.max * 0.25 ? "low" : c.hp.cur <= c.hp.max * 0.6 ? "mid" : "";
  const hpLook = c.hp.cur <= 0 ? "down" : c.hp.cur <= c.hp.max * 0.1 ? "crit" : c.hp.cur <= c.hp.max * 0.25 ? "low" : c.hp.cur <= c.hp.max * 0.6 ? "mid" : "ok";
  const tempPct = c.hp.temp ? Math.min(100 - pct, (c.hp.temp / Math.max(1, c.hp.max)) * 100) : 0;
  const dying = c.hp.cur <= 0;

  const chips = [
    activeChips(c, true),
    c.concentration ? `<span class="chip conc"><button class="chip-main" data-term="spell:${esc(c.concentration)}"><span class="sub2" style="color:inherit">Concentrating</span> ${esc(c.concentration)}</button><button class="chip-x" data-a="endConc" aria-label="End concentration">${ICONS.close}</button></span>` : "",
    ...c.conditions.map(x => `<span class="chip cond"><button class="chip-main" data-term="condition:${esc(x)}">${conditionIcon(x)}${esc(x)}</button><button class="chip-x" data-a="removeCondition" data-name="${esc(x)}" aria-label="Remove ${esc(x)}">${ICONS.close}</button></span>`),
    c.exhaustion > 0 ? `<span class="chip cond"><button class="chip-main" data-term="condition:Exhaustion">${conditionIcon("Exhaustion")}Exhaustion ${c.exhaustion} <span class="sub2" style="color:inherit">−${c.exhaustion * 2} to d20s</span></button></span>` : "",
    dying ? `<span class="chip cond"><button class="chip-main" data-term="Death Saving Throw">${conditionIcon("Unconscious")}${c.deathSaves.fail >= 3 ? "Dead" : c.deathSaves.success >= 3 ? "Stable at 0 HP" : "Dying"}</button></span>` : ""
  ].join("");

  const xpPct = c.level >= 20 ? 100 : Math.max(0, Math.min(100, Math.round(((c.xp || 0) - xpForLevel(c.level)) / Math.max(1, xpForLevel(c.level + 1) - xpForLevel(c.level)) * 100)));
  const xpReady = c.level < 20 && (c.xp || 0) >= xpForLevel(c.level + 1);
  const meta = `Level ${c.level} ${c.species} ${c.class}${c.subclass ? " · " + c.subclass : ""}`;

  let body;
  const styled = app.prefs.sheetStyle === "advanced" || app.prefs.sheetStyle === "classic";
  if (tab === "stats") body = app.prefs.sheetStyle === "advanced" ? characterBody(app, c, d) : classicBody(app, c, d);
  else body = rulesTab(app);
  const wide = tab === "stats" && app.prefs.sheetStyle === "advanced" && app.charSub === "gear";

  return `<div class="sheetview">
    ${sheetBar(c, d, meta)}
    <main class="wrap page ${wide ? "wide" : ""}">
      ${c.dead ? `<div class="deadbar" role="status"><span><b>${esc(c.name)} has died.</b> ${c.dead.cause ? esc(c.dead.cause) : "Cause unknown."} <button class="linkbtn" data-a="editCause">${c.dead.cause ? "Edit" : "Add cause"}</button></span><button class="btn sm" data-a="reviveAsk" data-id="${esc(c.id)}" data-name="${esc(c.name)}">Revive</button></div>` : ""}
      <section class="status" aria-label="Status">
        <div class="vitals">
          <button class="seal" data-a="openLevelMenu" aria-label="Level ${c.level}, ${(c.xp || 0).toLocaleString()} experience points. Tap to add XP or level up.">
            <svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" class="ring-bg"/><circle cx="50" cy="50" r="45" class="ring-fg" pathLength="100" stroke-dasharray="${xpPct} 100"/></svg>
            <span class="wax"><b>${c.level}</b></span><span class="sealcap">Level</span>
            ${xpReady ? `<span class="canlevel">Level up</span>` : ""}
          </button>
          <button class="hpwrap hpbtn" data-a="openHp" aria-label="Hit points ${c.hp.cur} of ${c.hp.max}${c.hp.temp ? ", " + c.hp.temp + " temporary" : ""}. Tap to change.">
            <span class="hpstage"><canvas id="hpc" aria-hidden="true"></canvas></span>
            <span class="hptext"><b class="hpnum">${c.hp.cur}</b><span class="muted">/ ${c.hp.max} HP${c.hp.temp ? ` · +${c.hp.temp} temp` : ""}</span><span class="hpedit">${ICONS.edit}Change</span></span>
          </button>
          <button class="shieldbtn tier-${armorTier(d.ac).key}" data-a="openAc" aria-label="Armor class ${d.ac}, ${armorTier(d.ac).name}. Tap to see and change the bonuses.">${shieldSvg(d.ac)}<b>${d.ac}</b><span>AC</span></button>
        </div>
        <p class="xpline">${c.level >= 20 ? "Max level" : `${(c.xp || 0).toLocaleString()} XP \u00b7 ${xpReady ? "ready for level " + (c.level + 1) : (xpForLevel(c.level + 1) - (c.xp || 0)).toLocaleString() + " to level " + (c.level + 1)}`}</p>
        <div class="quick">
          <button data-a="rollInit"><b>${fmtMod(d.initiative)}</b><span>Initiative · roll</span></button>
          <button data-a="openBreakdown" aria-label="Speed ${d.speed} feet. Tap to see how it is worked out."><b>${d.speed}</b><span>Speed ft</span></button>
          <div><b>${fmtMod(d.prof)}</b><span>Proficiency</span></div>
          <button data-term="Passive Perception"><b>${d.passivePerception}</b><span>Passive Perception</span></button>
        </div>
        ${chips ? `<div class="chips">${chips}</div>` : ""}
        ${concBanner(app)}
      </section>
      ${body}
    </main>
    <nav class="tabs" aria-label="Sheet sections"><div class="in" style="grid-template-columns:repeat(${tabs.length},1fr)">
      ${tabs.map(([id, label, icon]) => `<button data-a="sheetTab" data-tab="${id}" ${tab === id ? 'aria-current="page"' : ""}>${icon}<span>${label}</span></button>`).join("")}
    </div></nav></div>`;
}

// ---- Attacks (shared by the Stats and Gear tabs) ----
export function attacksPanel(app, c, d, { head = "Attacks" } = {}) {
  const weapons = attacksOf(c);
  const where = id => slotsOf(c, id).map(k => SLOTS.find(s => s.key === k).label).join(" + ");
  const mastered = it => (c.masteries || []).some(m => m === it.name || m === it.weapon?.base);
  return `<div class="panel"><div class="panel-head"><h2>${head}</h2></div>
      <div class="panel-body flush">
      ${weapons.length ? weapons.map(it => {
    const n = weaponNumbers(it.weapon, c);
    const w = it.weapon, k = slotOf(c, it.id);
    return kRow({
      icon: ICONS.sword, tone: "amber", titleHtml: it.virtual ? esc(it.name) : `<span data-a="openItem" data-id="${it.id}" role="button" tabindex="0" style="cursor:pointer">${esc(it.name)}</span>`,
      capHtml: it.virtual ? "Natural" : k ? esc(where(it.id)) : "In bag",
      subHtml: `${fmtMod(n.toHit)} to hit \u00b7 ${esc(n.dice)}${n.dmgMod ? (n.dmgMod > 0 ? "+" : "") + n.dmgMod : ""} ${esc(w.dtype || "")}${w.mastery && mastered(it) ? ` \u00b7 <button class="tag term" style="text-decoration:none" data-term="${esc(w.mastery)}">${esc(w.mastery)}</button>` : ""}`,
      actions: `${hotbarToggle(c, "attack", it.id, it.name, false)}<button class="btn pri sm" data-a="attackRoll" data-id="${it.id}">Attack</button>`,
      extra: w.ammo ? `${esc(w.ammo.name)}: <span class="stepper"><button data-a="ammoStep" data-id="${it.id}" data-n="-1" aria-label="Spend ammo">\u2212</button><b>${w.ammo.cur}</b><button data-a="ammoStep" data-id="${it.id}" data-n="1" aria-label="Add ammo">+</button></span>` : ""
    });
  }).join("") : `<p class="muted small" style="padding:12px 0">No weapons in your bag yet.</p>`}
      </div></div>`;
}

// ---- Hotbar: a customizable action bar (attacks, spells, items, abilities) ----
const HOTBAR_MAX = 12;
export function hotbarGlyph(app, c, h) {
  if (h.kind === "attack" || (h.kind === "item" && itemById(c, h.id)?.weapon)) return ICONS.sword;
  if (h.kind === "spell") return ICONS.bolt;
  if (h.kind === "ability") return ICONS.spell;
  const it = itemById(c, h.id);
  return it ? itemGlyphIcon(it) : ICONS.flask;
}
function itemGlyphIcon(it) {
  const cat = itemCategory(it);
  return cat === "weapon" ? ICONS.sword : cat === "armor" ? ICONS.shield : cat === "shield" ? ICONS.shield
    : cat === "potion" ? ICONS.flask : cat === "scroll" ? ICONS.scroll : cat === "ring" ? ICONS.ring
    : cat === "focus" ? ICONS.bolt : ICONS.flask;
}
export function hotbarLabel(app, c, h) {
  if (h.kind === "spell" || h.kind === "ability") return h.name;
  const it = itemById(c, h.id);
  return it ? it.name : "—";
}
export function hotbar(app, c, d) {
  const edit = app.hotbarEdit;
  const slots = (c.hotbar || []).map((h, i) => {
    const label = hotbarLabel(app, c, h);
    const sub = h.kind === "attack" ? "Attack" : h.kind === "spell" ? "Cast" : h.kind === "ability" ? "Ability" : "Use";
    return `<div class="hb-slot" data-pop="hb:${esc(h.kind + ":" + (h.id || h.name))}">
      <button class="hb-btn" data-a="${edit ? "noop" : "hotbarUse"}" data-i="${i}" ${edit ? "disabled" : ""} aria-label="${esc(sub)} ${esc(label)}">
        <span class="hb-ic">${hotbarGlyph(app, c, h)}</span><span class="hb-lbl">${esc(label)}</span><span class="hb-sub">${sub}</span>
      </button>
      ${edit ? `<button class="hb-x" data-a="removeHotbar" data-i="${i}" aria-label="Remove ${esc(label)} from hotbar">${ICONS.close}</button>` : ""}
    </div>`;
  }).join("");
  return `<div class="panel hotbar-panel"><div class="panel-head"><h2>Hotbar</h2>
      <span class="btnrow">
        <button class="btn sm" data-a="openHotbarAdd">Add</button>
        <button class="btn sm ${edit ? "pri" : ""}" data-a="toggleHotbarEdit" ${(c.hotbar || []).length ? "" : "disabled"}>${edit ? "Done" : "Edit"}</button>
      </span></div>
    <div class="panel-body">
      ${(c.hotbar || []).length ? `<div class="hotbar">${slots}</div>` : `<p class="muted small" style="padding:0">Hotbar empty.</p>`}
    </div></div>`;
}

export function needsFirstChoices(app, c) {
  if (c.level !== 1 || (c.levelLog || []).some(e => e.level === 1)) return false;
  return levelUpPlan(app.library, c, 1, {}, { fromCreation: true }).steps.length > 1;
}

// ---------------- Spells ----------------
export function spellsTab(app, c, d) {
  const info = d.spellInfo;
  const L = app.library;
  const known = c.spellcasting.spells.map(s => ({ ...s, ref: findByName(enabledSpells(L, app.campaign), s.name) || findByName(L.spells, s.name) }));
  const prepared = known.filter(s => s.ref && s.ref.level > 0 && (s.prepared || s.always)).length;

  const byLevel = {};
  known.forEach(s => { const lv = s.ref ? s.ref.level : 1; (byLevel[lv] = byLevel[lv] || []).push(s); });
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

  return `
    ${info ? `<div class="panel"><div class="panel-body">
      <div class="quick" style="margin-top:0;grid-template-columns:repeat(3,1fr)">
        <div><b>${info.dc}</b><span>Save DC</span></div>
        <button data-a="rollSpellAttack"><b>${fmtMod(info.attackBonus)}</b><span>Spell attack</span></button>
        <div><b>${prepared}</b><span>Prepared</span></div>
      </div></div></div>` : ""}

    <div class="sp2">
    <div class="sp2-side"><h2 class="sec2">Spell slots <small>tap a gem to mark it used</small></h2>
      ${info.slots.length ? info.slots.map(r => {
        const used = c.spellcasting.slotsUsed[r.level - 1] || 0;
        return `<div class="sp2-slot"><span class="lv">${r.pact ? `Pact · level ${r.level}` : levelLabel(r.level)}</span>
          <span class="gems">${Array.from({ length: r.max }, (_, i) => `<button class="pip ${i < r.max - used ? "" : "used"}" data-a="toggleSlot" data-lvl="${r.level}" data-i="${i}" data-max="${r.max}" aria-label="${levelLabel(r.level)} slot ${i + 1}, ${i < r.max - used ? "available" : "used"}"></button>`).join("")}</span></div>`;
      }).join("") + (info.slots.some(r => r.pact) ? `<p class="sub2">Pact slots come back on a short rest.</p>` : "") : `<p class="muted small">No spell slots at this level.</p>`}
      <p class="sub2 sp2-key">✦ always prepared · tap a spell to read it</p></div>
    <div class="sp2-main"><div class="sp2-head"><h2 class="sec2">Your spells</h2><button class="btn sm pri" data-a="openPicker" data-picker="spells">Add spells</button></div>
      ${known.length ? levels.map(lv => kGroup(levelLabel(lv), byLevel[lv].length, { tone: lv === 0 ? "faint" : "amber" }) + `<div class="k-list">` + byLevel[lv].map(s => {
        const r = s.ref;
        const sub = r ? [r.time, r.range].filter(Boolean).join(" \u00b7 ") : "";
        const tag = r?.conc ? "Concentration" : r?.ritual ? "Ritual" : s.always ? "Always prepared" : "";
        const unprep = lv > 0 && !s.always && !s.prepared;
        return kRow({
          glyph: (r?.school || s.name)[0], tone: lv === 0 ? "blue" : "amber", off: unprep,
          title: s.name + (s.always ? " \u2726" : ""), cap: [r?.school, tag].filter(Boolean).join(" \u00b7 "), sub,
          mainAttrs: `data-a="showDetail" data-kind="spell" data-name="${esc(s.name)}"`,
          actions: `${lv > 0 && !s.always ? `<label class="prep" data-pop="prep:${esc(s.name)}" title="Prepared"><input type="checkbox" data-a="togglePrepared" data-name="${esc(s.name)}" ${s.prepared ? "checked" : ""} aria-label="Prepared: ${esc(s.name)}"><span>Prep</span></label>` : ""}
            ${info && (lv === 0 || s.prepared || s.always) ? `<button class="btn sm ${lv === 0 ? "" : "pri"}" data-a="${lv === 0 ? "castCantrip" : "openCast"}" data-name="${esc(s.name)}">Cast</button>` : ""}
            ${!s.always ? `<button class="iconbtn sp2-x" data-a="askRemove" data-do="removeSpell" data-what="spell" data-name="${esc(s.name)}" aria-label="Remove ${esc(s.name)}">${ICONS.close}</button>` : ""}`
        });
      }).join("") + "</div>").join("") : `<p class="muted small" style="padding:12px 0">No spells.</p>`}
    </div></div>`;
}

export function renderSpellResults(app) {
  const c = app.char, L = app.library;
  const q = (app.pickerQuery || "").trim().toLowerCase();
  const all = enabledSpells(L, app.campaign);
  const mine = c.spellcasting.spells.map(s => s.name);
  const list = all.filter(s => (app.pickerAllClasses || !s.classes || !parseClasses(s).length || parseClasses(s).includes(c.class))
    && (!q || s.name.toLowerCase().includes(q))
    && (app.pickerLevel == null || s.level === app.pickerLevel))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  if (!list.length) return `<p class="muted small" style="padding:12px 0">No spells match.</p>`;
  return `<div class="optlist" style="margin-top:4px">` + list.slice(0, 80).map(s => {
    const has = mine.includes(s.name), key = "spell:" + s.name;
    return infoRow({ key, action: has ? "askRemove" : "addSpell", data: has ? { name: s.name, do: "removeSpell", what: "spell" } : { name: s.name }, title: s.name,
      sub: esc(spellSub(s)), pressed: has, open: app.info.has(key),
      detail: app.info.has(key) ? detailFor(app, "spell", s.name).body : "",
      badge: `<span class="tag ${has ? "amber" : ""}">${has ? "Added ✓" : "+ Add"}</span>` });
  }).join("") + `</div>` + (list.length > 80 ? `<p class="muted small" style="padding:10px 0">Showing 80 of ${list.length}. Search to narrow it down.</p>` : "");
}
function parseClasses(s) { return parseList(s.classes); }
export function spellSub(s) {
  return [s.level ? "Level " + s.level : "Cantrip", s.school, s.time, s.conc ? "Concentration" : "", s.ritual ? "Ritual" : ""].filter(Boolean).join(" · ");
}

// ---------------- Gear ----------------
const FIGURE = `<svg class="figure" viewBox="0 0 120 220" aria-hidden="true">
  <circle cx="60" cy="26" r="17"/>
  <path d="M38 52h44l10 62-11 3-7-40v66l8 66H68l-8-58-8 58H38l8-66V77l-7 40-11-3z"/>
</svg>`;

function slotTile(app, c, s) {
  const it = itemById(c, c.equipment[s.key]);
  const sel = app.selItem ? itemById(c, app.selItem) : null;
  const can = sel && fitsOk(sel, s.key, c);
  const main = itemById(c, c.equipment.main);
  const blocked = s.key === "off" && !it && main && /two-handed/i.test(main.weapon?.props || "");
  const attWarn = it && it.attune && !it.attuned;
  return `<button class="slot ${it ? "filled" : ""} ${can ? "can-drop" : ""} ${blocked ? "blocked" : ""}" style="grid-area:${s.key}"
      data-a="slotTap" data-slot="${s.key}" data-drop-slot="${s.key}" ${it ? `draggable="true" data-drag-item="${it.id}"` : ""}
      aria-label="${s.label}: ${it ? esc(it.name) : "empty"}">
    <span class="slot-lbl">${s.label}</span>
    <span class="slot-item">${it ? esc(it.name) : blocked ? "Both hands used" : "Empty"}</span>
    ${attWarn ? `<span class="slot-warn">Not attuned</span>` : ""}
  </button>`;
}

// One simple marker per equipment slot, drawn on the figure when the slot is filled.
// Later each can become real art per item (studded leather, plate, ...).
const WORN = {
  head: '<path class="worn" d="M43 26a17 17 0 0134 0z"/><path class="worn line" d="M41 27h38"/>',
  neck: '<path class="worn line" d="M51 52q9 13 18 0"/><circle class="worn" cx="60" cy="63" r="3.4"/>',
  armor: '<path class="worn" d="M46 53h28v58H46z"/><path class="worn line" d="M60 55v54"/>',
  gloves: '<circle class="worn" cx="31" cy="117" r="6"/><circle class="worn" cx="89" cy="117" r="6"/>',
  ring1: '<circle class="worn line" cx="29" cy="127" r="3.2"/>',
  ring2: '<circle class="worn line" cx="91" cy="127" r="3.2"/>',
  belt: '<path class="worn" d="M46 100h28v7H46z"/><rect class="worn" x="57" y="99" width="6" height="9"/>',
  boots: '<path class="worn" d="M34 201h19v10H32z"/><path class="worn" d="M67 201h19l2 10H67z"/>',
  main: '<path class="worn line" d="M98 70v44M92 114h12M98 114v9"/>',
  ranged: '<path class="worn line" d="M108 72q14 38 0 76M108 72v76"/>'
};
function wornMarks(c) {
  const eq = c.equipment || {};
  const has = k => !!itemById(c, eq[k]);
  let behind = "", front = "";
  if (has("cloak")) behind += '<g data-worn="cloak"><path class="worn soft" d="M36 52h48l14 98H22z"/></g>';
  Object.keys(WORN).forEach(k => { if (has(k)) front += `<g data-worn="${k}">${WORN[k]}</g>`; });
  if (has("off")) {
    const shield = wearKind(itemById(c, eq.off)) === "shield";
    front += `<g data-worn="off">${shield ? '<path class="worn" d="M6 98h22v19c0 8-6 13-11 16-5-3-11-8-11-16z"/>' : '<path class="worn line" d="M17 86v36M12 118h10"/>'}</g>`;
  }
  return { behind, front };
}

function figureFor(c) {
  const look = speciesLook(c.species, c.size);
  const tf = `translate(60,118) scale(${(look.width * look.scale).toFixed(3)},${look.scale.toFixed(3)}) translate(-60,-118)`;
  const w = wornMarks(c);
  return `<svg class="figure" viewBox="0 0 120 220" aria-hidden="true" style="grid-area:fig;--fig-tint:hsl(${look.hue} ${look.sat}% 55%)">
    <g transform="${tf}">
      ${w.behind}
      <circle cx="60" cy="26" r="${(17 * look.head).toFixed(1)}"/>
      <path d="M38 52h44l10 62-11 3-7-40v66l8 66H68l-8-58-8 58H38l8-66V77l-7 40-11-3z"/>
      ${w.front}
    </g></svg>`;
}

export function coinsPanel(c) {
  return `<div class="panel"><div class="panel-head"><h2>Coins</h2><button class="btn sm" data-a="openShop">Shop</button></div><div class="panel-body">
      <div class="coinrow">
        ${[["pp", "#D9D6E2", "Platinum"], ["gp", "#E3BF5C", "Gold"], ["ep", "#CFC49A", "Electrum"], ["sp", "#C9CCD1", "Silver"], ["cp", "#C98B5B", "Copper"]].map(([k, col, nm]) => `<label class="coinc"><i style="background:radial-gradient(circle at 35% 30%,#fff9,${col} 55%,${col})" aria-hidden="true">${k.toUpperCase()}</i><input class="f num" type="number" inputmode="numeric" min="0" data-coin="${k}" value="${c.coins[k] || 0}" aria-label="${nm} pieces"></label>`).join("")}
      </div></div></div>`;
}

// Advanced sheet gear: status strip, loadouts, worn gear as rows, then the bag and coins.
export function loadoutGearTab(app, c, d) {
  const sel = app.selItem ? itemById(c, app.selItem) : null;
  return `<div class="ld-page">${readinessStrip(app, c, d)}${loadoutCards(app, c)}
    ${sel ? `<div class="selbar"><span>Tap a slot to equip <b>${esc(sel.name)}</b></span><button class="btn sm" data-a="clearSel">Cancel</button></div>` : ""}
    <div class="ld-cols"><div>${wornRows(app, c)}</div><div>${bagGrid(app, c)}${coinsPanel(c)}</div></div></div>`;
}

export function gearTab(app, c, d, { attacks = true } = {}) {
  const sel = app.selItem ? itemById(c, app.selItem) : null;
  const ac = d.acInfo;
  return `<div class="gear-grid"><div class="doll-col">
    <div class="panel"><div class="panel-head"><h2>Equipment</h2>
      <span class="sub2">${attunedCount(c)}/3 attuned</span></div>
      ${sel ? `<div class="selbar"><span>Tap a glowing slot to equip <b>${esc(sel.name)}</b></span><button class="btn sm" data-a="clearSel">Cancel</button></div>` : ""}
      <div class="panel-body">
        <div class="doll">${figureFor(c)}${SLOTS.map(s => slotTile(app, c, s)).join("")}</div>
        <p class="sub2" style="margin-top:10px">${matchMedia("(pointer:fine)").matches ? "Drag items between your bag and the slots, or click an item then a slot." : "Tap an item in your bag, then tap a glowing slot. Tap a slot to change it."}</p>
      </div></div></div><div class="gear-side">

    ${attacks ? attacksPanel(app, c, d) : ""}

    <div class="panel"><div class="panel-head"><h2>Armor class ${d.ac}</h2>${ac.stealthDis ? `<span class="tag">Stealth disadvantage</span>` : ""}</div>
      <div class="panel-body stack">${acBody(c, d)}
      </div></div>

    ${bagGrid(app, c)}

    ${coinsPanel(c)}
    </div></div>`;
}


export function acBody(c, d) {
  const ac = d.acInfo;
  return `
        <div class="small">${ac.parts.map(([k, v]) => `<div class="rowline" style="min-height:34px;padding:4px 0"><span class="nm">${esc(k)}</span><span class="val">${k === ac.parts[0][0] ? v : fmtMod(v)}</span></div>`).join("")}</div>
        ${ac.warn ? `<p class="small" style="color:var(--red)">${esc(ac.warn)}</p>` : ""}
        ${ac.mode === "manual" ? `<p class="sub2">Nothing worn. AC from the values below.</p>
          <div class="grid3">
            <div class="field"><label>Base AC</label><input class="f num" type="number" inputmode="numeric" data-ac="base" value="${c.ac.base ?? 10}"></div>
            <div class="field"><label>Max Dex</label><input class="f num" type="number" inputmode="numeric" data-ac="dexCap" value="${c.ac.dexCap ?? ""}" placeholder="none"></div>
            <label class="field"><span class="lab">Shield</span><span class="row" style="min-height:44px"><input type="checkbox" data-a="toggleShield" ${c.ac.shield ? "checked" : ""}> +2</span></label>
          </div>` : ""}
        <div class="grid2">
          <div class="field"><label>Other AC bonus</label><input class="f num" type="number" inputmode="numeric" data-ac="bonus" value="${c.ac.bonus ?? 0}"></div>
          <div class="field"><label>Override AC</label><input class="f num" type="number" inputmode="numeric" data-ac="override" value="${c.ac.override ?? ""}" placeholder="auto"></div>
        </div>`;
}

// ---- the bag: a BG3-style icon grid, sortable, with right-click / long-press menus ----
export const CAT_GLYPH = { weapon: "sword", armor: "shield", shield: "shield", potion: "flask", scroll: "scroll", ring: "ring", wondrous: "spell", ammo: "bolt", focus: "bolt", tool: "gear", gear: "flask" };
export const SORTS = [["type", "Type"], ["name", "Name"], ["weight", "Weight"], ["recent", "Recent"]];
export function sortedInventory(app, c) {
  const inv = c.inventory.map((it, i) => ({ it, i }));
  const mode = app.bagSort || "type";
  if (mode === "name") inv.sort((a, b) => a.it.name.localeCompare(b.it.name));
  else if (mode === "weight") inv.sort((a, b) => ((unitWeight(b.it) ?? -1) * (b.it.qty ?? 1)) - ((unitWeight(a.it) ?? -1) * (a.it.qty ?? 1)) || a.it.name.localeCompare(b.it.name));
  else if (mode === "type") inv.sort((a, b) => categoryRank(itemCategory(a.it)) - categoryRank(itemCategory(b.it)) || a.it.name.localeCompare(b.it.name));
  // "recent" keeps insertion order
  return inv.map(x => x.it);
}
export function weightBar(c) {
  const w = carried(c), pct = Math.min(100, Math.round(w.total / w.capacity * 100));
  return `<div class="wbar ${w.total > w.capacity ? "over" : ""}"><div class="wl"><span>Carrying <b>${fmtLb(w.total)}</b> of ${w.capacity} lb</span>${w.coins ? `<span class="sub2">coins ${fmtLb(w.coins)}</span>` : ""}</div><div class="track" aria-hidden="true"><i style="width:${pct}%"></i></div>${w.unknown ? `<p class="sub2">${w.unknown} item${w.unknown === 1 ? "" : "s"} with no listed weight are not counted.</p>` : ""}</div>`;
}
function bagGrid(app, c) {
  const items = sortedInventory(app, c);
  const where = id => slotsOf(c, id).map(k => SLOTS.find(s => s.key === k).label).join(" + ");
  return `<div class="panel" data-drop-bag="1"><div class="panel-head"><h2>Bag <span class="sub2">${c.inventory.length}</span></h2>
      <span class="btnrow">
        <select class="f sortsel" data-a="bagSort" aria-label="Sort bag">${SORTS.map(([v, l]) => `<option value="${v}" ${(app.bagSort || "type") === v ? "selected" : ""}>Sort: ${l}</option>`).join("")}</select>
        <button class="btn sm" data-a="openShop">Shop</button><button class="btn sm" data-a="openPicker" data-picker="items">Add</button>
      </span></div>
    <div class="panel-body">
      ${items.length ? `<div class="bag-list" role="list"><div class="bl-head" aria-hidden="true"><span></span><span>Item</span><span class="q">Qty</span><span class="w">Weight</span><span></span></div>${items.map(it => {
    const k = slotOf(c, it.id), cat = itemCategory(it), u = unitWeight(it), q = it.qty == null ? 1 : it.qty;
    return `<div class="bl-row ${k ? "equipped" : ""} ${app.selItem === it.id ? "selected" : ""} ${it.qty ? "" : "empty"} cat-${cat}" role="listitem"
        draggable="true" data-drag-item="${it.id}" data-a="itemCell" data-id="${it.id}"
        data-ctx-item="${it.id}" tabindex="0" aria-label="${esc(it.name)}${k ? ", " + esc(where(it.id)) : ""}${it.attuned ? ", attuned" : ""}">
        <span class="bag-ic">${ICONS[CAT_GLYPH[cat] || "flask"]}</span>
        <span class="bl-nm"><b>${esc(it.name)}</b>${k ? `<span class="tag amber">${esc(where(it.id))}</span>` : ""}${it.attuned ? `<span class="tag blue">Attuned</span>` : ""}</span>
        <span class="q">${q !== 1 ? "×" + q : ""}</span>
        <span class="w">${u == null ? "–" : fmtLb(u * q)}${u != null && q !== 1 ? `<small>${fmtLb(u)} each</small>` : ""}</span>
        <button class="bag-menu" data-a="itemMenu" data-id="${it.id}" aria-label="${esc(it.name)} actions">${ICONS.grip}</button>
      </div>`;
  }).join("")}</div>
      ${weightBar(c)}
      <p class="sub2" style="margin-top:8px">Tap an item for actions, or tap the ⋮ button. ${matchMedia("(pointer:fine)").matches ? "Right-click or drag onto a slot." : "Press and hold for the menu."}</p>`
      : `<p class="muted small" style="padding:12px 0">Your bag is empty.</p>`}
    </div></div>`;
}

export function renderGearResults(app, kind) {
  const q = (app.pickerQuery || "").trim().toLowerCase();
  const L = app.library, C = app.campaign;
  let source;
  if (kind === "feats") source = enabledFeats(L, C).map(x => ({ x, sub: (x.type || "").replace(/\s*\(.*$/, ""), detail: "feat" }));
  else {
    const seen = new Set();
    source = [...allWeapons(L, C).map(x => ({ x, sub: `Weapon · ${x.dice} ${x.dtype || ""}`, detail: "libWeapon" })),
              ...allItems(L, C).map(x => ({ x, sub: x.type || "", detail: "libItem" }))]
      .filter(r => (seen.has(r.x.name) ? false : seen.add(r.x.name)))
      .sort((a, b) => a.x.name.localeCompare(b.x.name));
  }
  const owned = kind === "feats" ? app.char.feats : [];
  const list = source.filter(r => !q || r.x.name.toLowerCase().includes(q)).slice(0, 80);
  const custom = q && !source.some(r => r.x.name.toLowerCase() === q)
    ? `<div class="rowline"><span class="nm">Add "${esc(app.pickerQuery.trim())}" as your own</span><button class="btn sm pri" data-a="pickCustom" data-picker="${kind}">Add</button></div>` : "";
  return custom + (list.length ? `<div class="optlist" style="margin-top:4px">` + list.map(({ x, sub, detail }) => {
    const has = owned.includes(x.name), key = detail + ":" + x.name;
    return infoRow({ key, action: "pickFrom", data: { picker: kind, name: x.name }, title: x.name, sub: esc(sub),
      pressed: has, disabled: has, open: app.info.has(key),
      detail: app.info.has(key) ? detailFor(app, detail, x.name).body : "",
      badge: `<span class="tag ${has ? "amber" : ""}">${has ? "Added ✓" : "+ Add"}</span>` });
  }).join("") + `</div>` : (custom ? "" : `<p class="muted small" style="padding:12px 0">Nothing matches.</p>`));
}

// ---------------- Dice ----------------
export function diceTab(app) {
  return `
    <div class="panel"><div class="panel-head"><h2>Roll dice</h2></div><div class="panel-body">
      <div class="diegrid">
        ${[4, 6, 8, 10, 12, 20, 100].map(n => `<button class="diebtn" data-a="quickRoll" data-sides="${n}" data-hold="egg"><b>d${n}</b></button>`).join("")}
        <button class="diebtn" data-a="quickRoll" data-sides="20" data-count="2"><b>2d20</b></button>
      </div>
      <form data-form="customRoll" class="field" style="margin-top:14px">
        <label for="f-formula">Any roll, like 2d6+3 or 1d8+1d6+2</label>
        <div class="row"><input class="f grow" id="f-formula" value="${esc(app.diceFormula || "")}" placeholder="1d20+5" autocomplete="off" enterkeyhint="go">
          <button class="btn pri" type="submit">Roll</button></div>
      </form>
    </div></div>
    <div class="panel history"><div class="panel-head"><h2>Recent rolls</h2>${app.history.length ? `<button class="btn sm ghost" data-a="clearHistory">Clear</button>` : ""}</div>
      <div class="panel-body flush">
      ${app.history.length ? app.history.map(h => `<div class="rowline"><span class="nm">${esc(h.title)}</span><span class="val">${esc(h.summary)}</span></div>`).join("")
        : `<p class="muted small" style="padding:12px 0">Rolls from anywhere on the sheet show up here.</p>`}
      </div></div>`;
}

// ---------------- Glossary / Rules browser ----------------
const GLOSS_CATS = [
  { id: "class", label: "Classes", icon: "⚔" },
  { id: "species", label: "Species", icon: "☺" },
  { id: "background", label: "Backgrounds", icon: "✎" },
  { id: "feat", label: "Feats", icon: "★" },
  { id: "spell", label: "Spells", icon: "✨" },
  { id: "condition", label: "Conditions", icon: "☠" },
  { id: "libItem", label: "Items", icon: "⌂" },
  { id: "libWeapon", label: "Weapons", icon: "†" },
  { id: "rule", label: "Rules", icon: "≡" }
];

const CONDITIONS = new Set(["Blinded","Charmed","Deafened","Exhaustion","Frightened","Grappled","Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone","Restrained","Stunned","Unconscious"]);

export function rulesTab(app) {
  const q = (app.rulesQuery || "").trim();
  const viewing = app.glossaryClass;
  return `<div class="panel"><div class="panel-body">
      ${searchBox("rules", app.rulesQuery, "Search rules, spells, items, feats...")}
      ${q ? "" : glossaryChips(app)}
      <div class="results" id="results-rules" style="max-height:none">${renderRulesResults(app)}</div>
    </div></div>`;
}

function glossaryChips(app) {
  const cat = app.glossaryCat || "";
  // If viewing a class/subclass detail, show a back button instead of chips
  if (app.glossaryClass) return "";
  return `<div class="gloss-chips">${GLOSS_CATS.map(c =>
    `<button class="gloss-chip${cat === c.id ? " active" : ""}" data-a="glossaryCat" data-cat="${c.id}"><span class="gloss-icon">${c.icon}</span>${c.label}</button>`
  ).join("")}</div>`;
}

function glossaryCatList(app) {
  const L = app.library, C = app.campaign, cat = app.glossaryCat;
  if (!cat) return "";
  const row = (kind, name, sub, extra) =>
    `<button class="rowline rollable" data-a="${extra || "showDetail"}" data-kind="${kind}" data-name="${esc(name)}"${extra ? ` data-class="${esc(name)}"` : ""}><span class="nm">${esc(name)}</span>${sub ? `<span class="sub2">${esc(sub)}</span>` : ""}</button>`;

  if (cat === "class") return L.classes.map(c => {
    const subs = subclassesFor(L, c.name);
    return row("class", c.name, `${subs.length} subclass${subs.length !== 1 ? "es" : ""}`, "glossaryClassView");
  }).join("");
  if (cat === "species") return L.species.slice().sort((a, b) => a.name.localeCompare(b.name)).map(s => row("species", s.name)).join("");
  if (cat === "background") return L.backgrounds.slice().sort((a, b) => a.name.localeCompare(b.name)).map(b => row("background", b.name)).join("");
  if (cat === "feat") return enabledFeats(L, C).slice().sort((a, b) => a.name.localeCompare(b.name)).map(f => row("feat", f.name, f.type || "")).join("");
  if (cat === "spell") return spellsByLevel(L, C);
  if (cat === "condition") return L.rules.filter(r => CONDITIONS.has(r.name)).sort((a, b) => a.name.localeCompare(b.name)).map(r => row("condition", r.name)).join("");
  if (cat === "libItem") return allItems(L, C).slice().sort((a, b) => a.name.localeCompare(b.name)).map(i => row("libItem", i.name, i.type || "")).join("");
  if (cat === "libWeapon") return allWeapons(L, C).slice().sort((a, b) => a.name.localeCompare(b.name)).map(w => row("libWeapon", w.name, [w.cat, w.kind].filter(Boolean).join(" "))).join("");
  if (cat === "rule") return L.rules.filter(r => !CONDITIONS.has(r.name)).sort((a, b) => a.name.localeCompare(b.name)).map(r => row("rule", r.name)).join("");
  return "";
}

function spellsByLevel(L, C) {
  const spells = enabledSpells(L, C).slice().sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name));
  let html = "", lastLv = -1;
  for (const s of spells) {
    const lv = s.level || 0;
    if (lv !== lastLv) { html += `<div class="grouph">${lv === 0 ? "Cantrips" : `Level ${lv}`}</div>`; lastLv = lv; }
    html += `<button class="rowline rollable" data-a="showDetail" data-kind="spell" data-name="${esc(s.name)}"><span class="nm">${esc(s.name)}</span><span class="sub2">${esc(s.school || "")}</span></button>`;
  }
  return html;
}

function classDetailView(app) {
  const L = app.library, name = app.glossaryClass;
  const cls = findByName(L.classes, name);
  if (!cls) return `<p class="muted">Class not found.</p>`;
  const subs = subclassesFor(L, name);

  // Parse the plaintext table into rows
  const tableHtml = renderClassTable(cls.table);

  // Group features by level
  const byLv = {};
  for (const f of cls.features) { (byLv[f.lv] || (byLv[f.lv] = [])).push(f); }
  const levels = Object.keys(byLv).map(Number).sort((a, b) => a - b);

  let html = `<button class="gloss-back" data-a="glossaryBack">← Classes</button>`;
  html += `<h2 class="gloss-title">${esc(name)}</h2>`;
  if (cls.desc) html += `<div class="gloss-desc">${formatText(cls.desc)}</div>`;

  // Quick stats
  html += `<dl class="kv">`;
  if (cls.hd) html += `<dt>Hit Die</dt><dd>${esc(cls.hd)}</dd>`;
  if (cls.primary) html += `<dt>Primary Ability</dt><dd>${esc(cls.primary)}</dd>`;
  if (cls.saves) html += `<dt>Saving Throws</dt><dd>${esc(cls.saves)}</dd>`;
  if (cls.armorProf) html += `<dt>Armor</dt><dd>${esc(cls.armorProf)}</dd>`;
  if (cls.weaponProf) html += `<dt>Weapons</dt><dd>${esc(cls.weaponProf)}</dd>`;
  html += `</dl>`;

  // Progression table
  html += `<div class="grouph">Progression</div>`;
  html += `<div class="gloss-table-wrap">${tableHtml}</div>`;

  // Features by level
  html += `<div class="grouph">Features</div>`;
  for (const lv of levels) {
    html += `<div class="gloss-lv-header">Level ${lv}</div>`;
    for (const f of byLv[lv]) {
      html += `<button class="rowline rollable" data-a="showDetail" data-kind="classFeature" data-name="${esc(f.name)}" data-from="${esc(name)}"><span class="nm">${esc(f.name)}</span></button>`;
    }
  }

  // Subclasses
  if (subs.length) {
    html += `<div class="grouph">Subclasses (${subs.length})</div>`;
    for (const sc of subs.sort((a, b) => a.name.localeCompare(b.name))) {
      html += `<button class="rowline rollable" data-a="glossarySubclass" data-name="${esc(sc.name)}" data-class="${esc(name)}"><span class="nm">${esc(sc.name)}</span><span class="sub2">${sc.features.length} feature${sc.features.length !== 1 ? "s" : ""}</span></button>`;
    }
  }

  return html;
}

function subclassDetailView(app) {
  const L = app.library, name = app.glossarySubclass, parentName = app.glossaryClass;
  const sc = findByName(L.subclasses, name);
  if (!sc) return `<p class="muted">Subclass not found.</p>`;

  const byLv = {};
  for (const f of sc.features) { (byLv[f.lv] || (byLv[f.lv] = [])).push(f); }
  const levels = Object.keys(byLv).map(Number).sort((a, b) => a - b);

  let html = `<button class="gloss-back" data-a="glossaryBackToClass" data-class="${esc(parentName)}">← ${esc(parentName)}</button>`;
  html += `<h2 class="gloss-title">${esc(name)}</h2>`;
  html += `<p class="sub2" style="margin-bottom:12px">${esc(parentName)} subclass</p>`;

  for (const lv of levels) {
    html += `<div class="gloss-lv-header">Level ${lv}</div>`;
    for (const f of byLv[lv]) {
      html += `<button class="rowline rollable" data-a="showDetail" data-kind="subclassFeature" data-name="${esc(f.name)}" data-from="${esc(name)}"><span class="nm">${esc(f.name)}</span></button>`;
    }
  }

  return html;
}

function renderClassTable(tableStr) {
  if (!tableStr) return "";
  const lines = tableStr.split("\n").filter(l => l.trim());
  if (!lines.length) return "";
  // Parse whitespace-delimited columns by header positions
  const header = lines[0];
  // Find column boundaries from the header
  const cols = [];
  const re = /\S+(\s+\S+)*/g;
  let m;
  // Simple approach: split by 2+ spaces
  const headerParts = header.split(/\s{2,}/);
  let pos = 0;
  const starts = [];
  for (const part of headerParts) {
    const idx = header.indexOf(part, pos);
    starts.push(idx);
    pos = idx + part.length;
  }
  let html = `<table class="gloss-table"><thead><tr>`;
  for (const h of headerParts) html += `<th>${esc(h.trim())}</th>`;
  html += `</tr></thead><tbody>`;
  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    html += `<tr>`;
    for (let c = 0; c < starts.length; c++) {
      const s = starts[c];
      const e = c + 1 < starts.length ? starts[c + 1] : line.length;
      const cell = (line.substring(s, e) || "").trim();
      html += `<td>${esc(cell)}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

export function rulesIndex(app) {
  if (app._rulesIndex) return app._rulesIndex;
  const L = app.library, C = app.campaign;
  const idx = [];
  L.rules.forEach(r => idx.push({ kind: CONDITIONS.has(r.name) ? "condition" : "rule", label: CONDITIONS.has(r.name) ? "Condition" : "Rule", name: r.name }));
  enabledSpells(L, C).forEach(s => idx.push({ kind: "spell", label: s.level ? `Spell · Lv ${s.level}` : "Cantrip", name: s.name }));
  enabledFeats(L, C).forEach(f => idx.push({ kind: "feat", label: "Feat", name: f.name }));
  allItems(L, C).forEach(i => idx.push({ kind: "libItem", label: "Item", name: i.name }));
  allWeapons(L, C).forEach(w => idx.push({ kind: "libWeapon", label: "Weapon", name: w.name }));
  L.species.forEach(s => idx.push({ kind: "species", label: "Species", name: s.name }));
  L.classes.forEach(c => {
    idx.push({ kind: "class", label: "Class", name: c.name });
    c.features.forEach(f => idx.push({ kind: "classFeature", label: `${c.name} · Lv ${f.lv}`, name: f.name, from: c.name }));
  });
  L.subclasses.forEach(sc => {
    idx.push({ kind: "subclass", label: `${sc.cls} subclass`, name: sc.name, from: sc.cls });
    sc.features.forEach(f => idx.push({ kind: "subclassFeature", label: `${sc.name} · Lv ${f.lv}`, name: f.name, from: sc.name }));
  });
  L.backgrounds.forEach(s => idx.push({ kind: "background", label: "Background", name: s.name }));
  app._rulesIndex = idx;
  return idx;
}

export function renderRulesResults(app) {
  const q = (app.rulesQuery || "").trim().toLowerCase();
  // If searching, show search results across everything
  if (q) {
    const idx = rulesIndex(app);
    const list = idx.filter(x => x.name.toLowerCase().includes(q))
      .sort((a, b) => (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1) || a.name.localeCompare(b.name));
    if (!list.length) return `<p class="muted small" style="padding:12px 0">Nothing matches "${esc(app.rulesQuery)}".</p>`;
    return list.slice(0, 100).map(x =>
      `<button class="rowline rollable" data-a="showDetail" data-kind="${x.kind}" data-name="${esc(x.name)}"${x.from ? ` data-from="${esc(x.from)}"` : ""}><span class="nm">${esc(x.name)}</span><span class="sub2">${esc(x.label)}</span></button>`).join("");
  }
  // Subclass detail view
  if (app.glossarySubclass) return subclassDetailView(app);
  // Class detail view
  if (app.glossaryClass) return classDetailView(app);
  // Category listing
  if (app.glossaryCat) return glossaryCatList(app);
  // Default: show the category chips only (no list until a chip is tapped)
  return `<p class="muted small" style="padding:12px 0">Tap a category above or search to browse the rules.</p>`;
}

// ---------------- Detail lookup (shared by every "tap to read") ----------------
export function detailFor(app, kind, name, i, from) {
  const L = app.library, C = app.campaign, c = app.char;
  const kv = rows => `<dl class="kv">${rows.filter(r => r[1] !== undefined && r[1] !== "" && r[1] !== null).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  if (kind === "spell") {
    const s = findByName(enabledSpells(L, C), name) || findByName(L.spells, name);
    if (!s) return { title: name, body: formatText("") };
    return { title: s.name, body: `<p class="sub2" style="margin-bottom:10px">${s.level ? "Level " + s.level : "Cantrip"} ${esc(s.school || "")}${s.ritual ? " · ritual" : ""}</p>` +
      kv([["Casting time", s.time], ["Range", s.range], ["Components", s.comp], ["Duration", (s.conc ? "Concentration, " : "") + (s.dur || "")], ["Classes", parseList(s.classes).join(", ")]]) + formatText(s.text) };
  }
  if (kind === "feat") {
    const f = findFeat(enabledFeats(L, C), name) || findFeat(L.feats, name);
    return { title: name, body: (f?.type ? `<p class="sub2" style="margin-bottom:10px">${esc(f.type)}</p>` : "") + formatText(f?.text), removeFeat: c && c.feats.includes(name) ? c.feats.indexOf(name) : null };
  }
  if (kind === "weapon" || kind === "libWeapon") {
    const w = findByName(allWeapons(L, C), name);
    if (!w) return { title: name, body: formatText("") };
    const n = c ? weaponNumbers(w, c) : null;
    const mastery = w.mastery ? findByName(L.rules, w.mastery) : null;
    return { title: w.name, body: kv([
      ["Damage", `${w.dice}${n && n.dmgMod ? (n.dmgMod > 0 ? "+" : "") + n.dmgMod : ""} ${w.dtype || ""}`], ["To hit", n ? fmtMod(n.toHit) : ""],
      ["Type", [w.cat, w.kind].filter(Boolean).join(" ")], ["Properties", w.props], ["Mastery", w.mastery], ["Range", w.range],
      ["Magic bonus", w.magic ? fmtMod(w.magic) : ""]]) + (w.text ? formatText(w.text) : "") + (mastery ? `<h3 style="margin:12px 0 4px;font-size:.95rem">${esc(mastery.name)}</h3>${formatText(mastery.text)}` : "") };
  }
  if (kind === "item" || kind === "libItem") {
    const it = null;
    const ref = findByName(allItems(L, C), it ? it.name : name);
    return { title: it ? it.name : name, removeItem: it ? i : null, itemIndex: it ? i : null,
      body: (ref ? kv([["Type", ref.type], ["Price", ref.priceTxt ? ref.priceTxt + " gp" : ""]]) + formatText(ref.text) : `<p class="muted">Not in the rules data — it's your own item.</p>`)
        + (it ? `<div class="field" style="margin-top:12px"><label>Your notes</label><textarea class="f" data-item-notes="${i}" style="min-height:70px">${esc(it.notes || "")}</textarea></div>` : "") };
  }
  if (kind === "species") { const s = findByName(L.species, name); return { title: name, body: formatText(s ? (s.desc ? s.desc + "\n\n" : "") + s.traits : "") }; }
  if (kind === "class") { const s = findByName(L.classes, name); return { title: name, body: formatText(s ? (s.desc || "") + "\n\n" + (s.core || "") : "") }; }
  if (kind === "background") { const s = findByName(L.backgrounds, name); return { title: name, body: formatText(s ? (s.desc || "") + "\n\n" + (s.effect || "") : "") }; }
  if (kind === "rule" || kind === "condition") { const r = findByName(L.rules, name); return { title: name, body: formatText(r?.text || (kind === "condition" ? "This condition isn't in the rules glossary yet." : "")) }; }
  if (kind === "classFeature" || kind === "subclassFeature") {
    const src = kind === "classFeature" ? findByName(L.classes, from) : findByName(L.subclasses, from);
    const f = (src?.features || []).find(x => x.name === name);
    return { title: name, body: `<p class="sub2" style="margin-bottom:10px">${esc(from)}${f ? " · level " + f.lv : ""}</p>` + formatText(f?.text) };
  }
  return { title: name, body: formatText("") };
}
