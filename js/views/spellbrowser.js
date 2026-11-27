// Spell browser (Add spells), Wanted shelf, filter + sort menu, prepare menu and spell loadouts.
import { esc, ICONS, searchBox, modalShell, formatText } from "../ui.js";
import { enabledSpells, findByName } from "../data.js";
import { parseList } from "../rules.js";
import { tableCounts } from "../progression.js";
import { SCHOOLS, NUMERAL, ROLES, DAMAGE_TYPES, spellFacts, scaleRows, schoolKey } from "../spellinfo.js";
import { describeArea } from "../areagrid.js";
import { spellIcon } from "./spellicon.js";

const SHAPES = ["sphere", "cone", "line", "cube", "cylinder", "emanation"];
const SAVES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
const TIMES = ["Action", "Bonus", "Reaction", "Other"];
const SORTS = [["level", "Level"], ["name", "Name"], ["school", "School"], ["range", "Range"]];
const cap = s => s[0].toUpperCase() + s.slice(1);

export const sbState = app => app.sb || (app.sb = { tab: "browse", school: [], role: [], shape: [], dmg: [], save: [], time: [], conc: false, ritual: false, hideAdded: false, sort: "level" });
export const sbCount = s => ["school", "role", "shape", "dmg", "save", "time"].reduce((n, k) => n + s[k].length, 0) + (s.conc ? 1 : 0) + (s.ritual ? 1 : 0) + (s.hideAdded ? 1 : 0) + (s.sort !== "level" ? 1 : 0);

const classOf = s => parseList(s.classes);
function matches(sp, s) {
  const f = spellFacts(sp);
  return (!s.school.length || s.school.includes(f.school)) && (!s.role.length || f.roles.some(r => s.role.includes(r)))
    && (!s.shape.length || s.shape.includes(f.shape)) && (!s.dmg.length || f.dmg.some(t => s.dmg.includes(t)))
    && (!s.save.length || s.save.includes(f.save)) && (!s.time.length || s.time.includes(f.time))
    && (!s.conc || f.conc) && (!s.ritual || f.ritual);
}
export function browseList(app) {
  const c = app.char, s = sbState(app), q = (app.pickerQuery || "").trim().toLowerCase();
  const mine = new Set(c.spellcasting.spells.map(x => x.name));
  let list = enabledSpells(app.library, app.campaign);
  if (s.tab === "wanted") { const w = new Set(c.spellWish || []); list = list.filter(x => w.has(x.name)); }
  else list = list.filter(x => app.pickerAllClasses || !classOf(x).length || classOf(x).includes(c.class));
  list = list.filter(x => (!q || x.name.toLowerCase().includes(q)) && (app.pickerLevel == null || x.level === app.pickerLevel) && matches(x, s) && !(s.hideAdded && mine.has(x.name)));
  const by = { name: (a, b) => a.name.localeCompare(b.name), level: (a, b) => a.level - b.level || a.name.localeCompare(b.name),
    school: (a, b) => (a.school || "").localeCompare(b.school || "") || a.level - b.level || a.name.localeCompare(b.name),
    range: (a, b) => spellFacts(a).range - spellFacts(b).range || a.name.localeCompare(b.name) };
  return list.sort(by[s.sort] || by.level);
}

function chips(spf) {
  const out = [];
  if (spf.area) out.push(`<i class="spchip area">${esc(cap(spf.shape))} ${spf.area.r || spf.area.size || spf.area.len} ft</i>`);
  spf.roles.slice(0, 2).forEach(r => out.push(`<i class="spchip">${esc(r)}</i>`));
  if (spf.conc) out.push(`<i class="spchip">Conc.</i>`);
  return out.join("");
}
export const spellSubLine = s => [s.school, s.time, s.range].filter(Boolean).join(" · ");

function row(app, s, mine, wished, detailFor) {
  const key = "spell:" + s.name, open = app.info.has(key), f = spellFacts(s);
  const has = mine.has(s.name);
  return `<div class="inforow sprow ${open ? "open" : ""}">
    <div class="inforow-top">
      <button class="optcard" data-a="${has ? "noop" : "addSpell"}" data-name="${esc(s.name)}" ${has ? "disabled" : ""}>
        ${spellIcon(s)}<span class="grow"><b>${esc(s.name)}</b><span>${esc(spellSubLine(s))}</span><span class="spchips">${chips(f)}</span></span>
        <span class="tag ${has ? "amber" : ""}">${has ? "Added" : "Add"}</span></button>
      <button class="iconbtn heart ${wished ? "on" : ""}" data-a="spWish" data-name="${esc(s.name)}" aria-pressed="${wished}" aria-label="Wanted: ${esc(s.name)}">${ICONS.heart}</button>
      <button class="infobtn" data-a="toggleInfo" data-key="${esc(key)}" aria-expanded="${open}" aria-label="What ${esc(s.name)} does">${open ? ICONS.close : ICONS.info}</button>
    </div>
    ${open ? `<div class="about">${detailFor(app, "spell", s.name).body}${scaleBlock(s)}</div>` : ""}
  </div>`;
}

export function scaleBlock(s) {
  const rows = scaleRows(s);
  if (!rows.length) return "";
  return `<div class="spscale"><b>${s.level ? "By slot level" : "By character level"}</b><div>${rows.map(([k, v]) => `<span><em>${esc(k)}</em>${esc(v)}</span>`).join("")}</div></div>`;
}

export function renderBrowseResults(app, detailFor) {
  const c = app.char, list = browseList(app), mine = new Set(c.spellcasting.spells.map(x => x.name)), wish = new Set(c.spellWish || []);
  if (!list.length) return `<p class="muted small" style="padding:12px 0">${sbState(app).tab === "wanted" ? "No wanted spells" : "No spells match"}</p>`;
  return `<div class="optlist" style="margin-top:4px">${list.slice(0, 60).map(s => row(app, s, mine, wish.has(s.name), detailFor)).join("")}</div>`
    + (list.length > 60 ? `<p class="muted small" style="padding:10px 0">Showing 60 of ${list.length}</p>` : "");
}

export function renderBrowserBody(app, detailFor) {
  const c = app.char, s = sbState(app), n = sbCount(s), wn = (c.spellWish || []).length;
  return `<div class="seg sbtabs" role="group" aria-label="Shelf">
      <button data-a="spTab" data-tab="browse" aria-pressed="${s.tab === "browse"}">Browse</button>
      <button data-a="spTab" data-tab="wanted" aria-pressed="${s.tab === "wanted"}">Wanted <em>${wn}</em></button></div>
    <div class="sbfind">${searchBox("picker", app.pickerQuery, s.tab === "wanted" ? "Search wanted" : `Search ${esc(c.class)} spells`)}
      <button class="btn sm ${n ? "pri" : ""}" data-a="spFilterOpen" aria-label="Filter and sort">${ICONS.sort}<span>Filter</span>${n ? `<b class="sbbadge">${n}</b>` : ""}</button></div>
    <div class="seg sblv" role="group" aria-label="Spell level"><button data-a="pickerLevel" data-lv="" aria-pressed="${app.pickerLevel == null}">All</button>
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<button data-a="pickerLevel" data-lv="${l}" aria-pressed="${app.pickerLevel === l}" aria-label="${l ? "Level " + l : "Cantrips"}">${l ? NUMERAL[l] : "○"}</button>`).join("")}</div>
    <div class="results" id="results-picker">${renderBrowseResults(app, detailFor)}</div>`;
}

const chipGroup = (title, key, vals, cur, label = v => v) => `<h4 class="sbh">${title}</h4><div class="chips">${vals.map(v => `<button class="chipbtn" data-a="spSb" data-k="${key}" data-v="${esc(v)}" aria-pressed="${cur.includes(v)}">${esc(label(v))}</button>`).join("")}</div>`;
export function renderFilterModal(app) {
  const s = sbState(app), c = app.char;
  const body = `<h4 class="sbh">Sort</h4><div class="seg" role="group" aria-label="Sort">${SORTS.map(([k, l]) => `<button data-a="spSort" data-v="${k}" aria-pressed="${s.sort === k}">${l}</button>`).join("")}</div>
    ${chipGroup("School", "school", SCHOOLS, s.school)}${chipGroup("Role", "role", ROLES, s.role)}${chipGroup("Area", "shape", SHAPES, s.shape, cap)}
    ${chipGroup("Damage", "dmg", DAMAGE_TYPES, s.dmg)}${chipGroup("Saving throw", "save", SAVES, s.save, v => v.slice(0, 3))}${chipGroup("Casting time", "time", TIMES, s.time)}
    <h4 class="sbh">Other</h4><div class="chips">
      <button class="chipbtn" data-a="spFlag" data-v="conc" aria-pressed="${s.conc}">Concentration</button>
      <button class="chipbtn" data-a="spFlag" data-v="ritual" aria-pressed="${s.ritual}">Ritual</button>
      <button class="chipbtn" data-a="spFlag" data-v="hideAdded" aria-pressed="${s.hideAdded}">Hide added</button>
      <button class="chipbtn" data-a="pickerAllClasses" data-flip="1" aria-pressed="${!!app.pickerAllClasses}">Other classes</button></div>`;
  return modalShell("Filter spells", body, `<button class="btn" data-a="spSbClear">Clear</button><button class="btn pri" data-a="closeModal">Show ${browseList(app).length}</button>`);
}

// ---------- Prepare menu ----------
export function prepLimit(app, c) {
  const cls = (app.library.classes || []).find(x => x.name === c.class), t = cls ? tableCounts(cls, c.level) : null;
  return t && t.prepared != null ? t.prepared : null;
}
export function knownRows(app, c) {
  const L = app.library, pool = enabledSpells(L, app.campaign);
  return c.spellcasting.spells.map(s => ({ ...s, ref: findByName(pool, s.name) || findByName(L.spells, s.name) })).filter(s => s.ref);
}
export function preparedNames(c) { return c.spellcasting.spells.filter(s => s.prepared && !s.always).map(s => s.name); }

const gone = (app, c, l) => { const k = new Set(c.spellcasting.spells.map(s => s.name)); return l.prep.filter(n => !k.has(n)).length; };
export function renderPrepModal(app) {
  const c = app.char, rows = knownRows(app, c).filter(s => s.ref.level > 0);
  const lim = prepLimit(app, c), n = rows.filter(s => s.prepared || s.always).length;
  const q = (app.spPQ || "").trim().toLowerCase(), lv = app.spPLv == null ? null : app.spPLv;
  const levels = [...new Set(rows.map(s => s.ref.level))].sort((a, b) => a - b);
  const shown = rows.filter(s => (lv == null || s.ref.level === lv) && (!q || s.name.toLowerCase().includes(q))).sort((a, b) => a.ref.level - b.ref.level || a.name.localeCompare(b.name));
  const loads = c.spellLoadouts || [];
  const body = `<div class="prepstat ${lim != null && n > lim ? "over" : ""}"><b>${n}${lim != null ? ` / ${lim}` : ""}</b><span>Prepared</span>
      <button class="btn sm" data-a="spPrepAll">All</button><button class="btn sm" data-a="spPrepNone">None</button></div>
    ${searchBox("spprep", app.spPQ, "Search known spells")}
    <div class="seg sblv" role="group" aria-label="Spell level"><button data-a="spPLv" data-lv="" aria-pressed="${lv == null}">All</button>${levels.map(l => `<button data-a="spPLv" data-lv="${l}" aria-pressed="${lv === l}">${NUMERAL[l]}</button>`).join("")}</div>
    <div class="results" id="results-spprep">${prepList(shown)}</div>
    <h4 class="sbh">Loadouts</h4>
    ${loads.length ? `<div class="optlist">${loads.map(l => `<div class="inforow"><div class="inforow-top"><button class="optcard" data-a="spLoadPreview" data-id="${esc(l.id)}"><span class="grow"><b>${esc(l.name)}</b><span>${l.prep.length} spells${gone(app, c, l) ? ` \u00b7 ${gone(app, c, l)} removed` : ""}</span></span><span class="tag">Apply</span></button>
        <button class="iconbtn" data-a="spLoadDelete" data-id="${esc(l.id)}" aria-label="Delete ${esc(l.name)}">${ICONS.close}</button></div></div>`).join("")}</div>` : `<p class="muted small">No loadouts</p>`}
    <div class="sbsave"><input class="f" id="sp-lname" maxlength="30" placeholder="Loadout name" autocomplete="off"><button class="btn sm" data-a="spLoadSave" ${loads.length >= 8 ? "disabled" : ""}>Save current</button></div>`;
  return modalShell("Prepare spells", body, `<button class="btn pri" data-a="closeModal">Done</button>`);
}
export function prepList(shown) {
  if (!shown.length) return `<p class="muted small" style="padding:10px 0">No spells</p>`;
  return `<div class="optlist">${shown.map(s => `<div class="inforow"><div class="inforow-top"><button class="optcard prepcard" data-a="${s.always ? "noop" : "spPrepToggle"}" data-name="${esc(s.name)}" aria-pressed="${!!(s.prepared || s.always)}" ${s.always ? "disabled" : ""}>
    ${spellIcon(s.ref)}<span class="grow"><b>${esc(s.name)}${s.always ? " ✦" : ""}</b><span>${esc(spellSubLine(s.ref))}</span></span><span class="tag ${s.prepared || s.always ? "amber" : ""}">${s.always ? "Always" : s.prepared ? "Prepared" : "Off"}</span></button></div></div>`).join("")}</div>`;
}
export function prepResults(app) {
  const c = app.char, q = (app.spPQ || "").trim().toLowerCase(), lv = app.spPLv == null ? null : app.spPLv;
  return prepList(knownRows(app, c).filter(s => s.ref.level > 0 && (lv == null || s.ref.level === lv) && (!q || s.name.toLowerCase().includes(q))).sort((a, b) => a.ref.level - b.ref.level || a.name.localeCompare(b.name)));
}

export function renderLoadPreview(app, id) {
  const c = app.char, l = (c.spellLoadouts || []).find(x => x.id === id);
  if (!l) return modalShell("Loadout", `<p>Loadout gone</p>`, `<button class="btn pri" data-a="closeModal">Close</button>`);
  const known = new Set(c.spellcasting.spells.map(s => s.name)), cur = new Set(preparedNames(c)), want = new Set(l.prep);
  const on = [...want].filter(n => known.has(n) && !cur.has(n)), off = [...cur].filter(n => !want.has(n)), miss = [...want].filter(n => !known.has(n));
  const list = (t, a, tone) => a.length ? `<h4 class="sbh">${t} (${a.length})</h4><div class="chips">${a.map(n => `<span class="tag ${tone}">${esc(n)}</span>`).join("")}</div>` : "";
  return modalShell(l.name, `${list("Prepare", on, "amber")}${list("Unprepare", off, "")}${list("Removed, will be skipped", miss, "")}${!on.length && !off.length && !miss.length ? `<p class="muted small">Already matches</p>` : ""}`,
    `<button class="btn" data-a="closeModal">Back</button><button class="btn pri" data-a="spLoadApply" data-id="${esc(l.id)}">Apply</button>`);
}
