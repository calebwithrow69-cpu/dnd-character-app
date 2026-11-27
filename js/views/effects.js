// Active effects: conditions, spell effects, drains and other temporary changes in one menu.
// Anything that changes a number is a `c.custom` entry ({id,t,v,label,kind}); the effects
// engine reads it, so the sheet updates and ending it puts the number back.
import { esc, modalShell, formatText, infoRow, conditionIcon, glossaryEntry } from "../ui.js";
import { CONDITIONS, ABILITIES, ABILITY_LABEL } from "../rules.js";
import { condLine } from "../conditions.js";
import { condEffectsBlock } from "./tools.js";
import { FX_TARGETS } from "../effects.js";
import { spellsWithFx, summary } from "../spellfx.js";

export const FX_TABS = [["all", "All"], ["conditions", "Conditions"], ["spells", "Spells"], ["drains", "Drains"], ["custom", "Custom"]];

// One tap adds these. v is the default amount.
export const SPELL_FX = [
  { name: "Aid (2nd level)", t: "hp.max", v: 5, note: "Max and current HP" },
  { name: "Aid (3rd level)", t: "hp.max", v: 10, note: "Max and current HP" },
  { name: "Aid (4th level)", t: "hp.max", v: 15, note: "Max and current HP" },
  { name: "Shield of Faith", t: "ac", v: 2, note: "Concentration" },
  { name: "Shield", t: "ac", v: 5, note: "Until your next turn" },
  { name: "Longstrider", t: "speed", v: 10, note: "1 hour" }
];
const tLabel = t => { const f = FX_TARGETS.find(x => x[0] === t); if (f) return f[1]; const m = /^abil\.(\w+)$/.exec(t); return m ? ABILITY_LABEL[m[1]] + " score" : t; };
const sg = n => (n > 0 ? "+" : "") + n;
const match = (q, ...s) => !q || s.join(" ").toLowerCase().includes(q);

function condRows(app, c, q) {
  const firstLine = n => { const g = glossaryEntry(n); return g ? esc(g.text.split(/(?<=\.)\s/)[0]).slice(0, 110) : ""; };
  const rows = CONDITIONS.filter(x => match(q, x, condLine(x))).map(x => {
    const on = c.conditions.includes(x), key = "condition:" + x;
    return infoRow({ key, action: "toggleCondition", data: { name: x }, title: x, sub: condLine(x) || firstLine(x), pressed: on, open: app.info.has(key),
      detail: app.info.has(key) ? formatText(glossaryEntry(x)?.text || "") : "", badge: conditionIcon(x) });
  }).join("");
  const exh = match(q, "Exhaustion") ? `<div class="rowline"><span class="nm">${conditionIcon("Exhaustion")} <button class="term" data-term="condition:Exhaustion">Exhaustion</button></span>
    <span class="stepper"><button data-a="exhStep" data-n="-1" aria-label="Less exhaustion">\u2212</button><b>${c.exhaustion}</b><button data-a="exhStep" data-n="1" aria-label="More exhaustion">+</button></span></div>` : "";
  return rows || exh ? `<div class="condgrid">${rows}</div>${exh}` : "";
}
function activeRows(c, q) {
  const sp = (c.spellfx || []).filter(x => match(q, x.name, summary(x.effects))).map(x => `<div class="rowline"><span class="nm">${esc(x.name)} <span class="sub2">${esc(summary(x.effects))}${x.conc ? " \u00b7 Concentration" : ""}</span></span>
    <button class="btn sm" data-a="spellfxEnd" data-id="${esc(x.id)}" aria-label="End ${esc(x.name)}">End</button></div>`).join("");
  return sp + (c.custom || []).filter(x => match(q, x.label, tLabel(x.t))).map(x => `<div class="rowline"><span class="nm">${esc(x.label || "Effect")} <span class="sub2">${esc(tLabel(x.t))}</span></span><b>${sg(x.v)}</b>
    <button class="btn sm" data-a="customRemove" data-id="${esc(x.id)}" aria-label="End ${esc(x.label || "effect")}">End</button></div>`).join("");
}
function spellRows(app, q) {
  const lib = spellsWithFx(app.library);
  if (!lib.length) return SPELL_FX.map((x, i) => ({ x, i })).filter(({ x }) => match(q, x.name, x.note, tLabel(x.t))).map(({ x, i }) =>
    `<div class="rowline"><span class="nm">${esc(x.name)} <span class="sub2">${esc(tLabel(x.t))} ${sg(x.v)} \u00b7 ${esc(x.note)}</span></span><button class="btn sm" data-a="fxPreset" data-i="${i}">Apply</button></div>`).join("");
  return lib.filter(s => match(q, s.name, summary(s.effects))).map(s =>
    `<div class="rowline"><span class="nm">${esc(s.name)} <span class="sub2">${esc(summary(s.effects))}${s.conc ? " \u00b7 Concentration" : ""}</span></span><button class="btn sm" data-a="applySpellOpen" data-name="${esc(s.name)}" data-lvl="${s.level}">Apply</button></div>`).join("");
}
function drainForm(m) {
  return `<div class="grid3" style="grid-template-columns:1.2fr .8fr 1fr;gap:8px;align-items:end">
    <div class="field"><label for="fx-ab">Ability</label><select class="f" id="fx-ab">${ABILITIES.map(a => `<option value="${a}">${esc(ABILITY_LABEL[a])}</option>`).join("")}</select></div>
    <div class="field"><label for="fx-n">Lower by</label><input class="f num" id="fx-n" type="number" inputmode="numeric" min="1" max="20" value="1"></div>
    <div class="field"><label for="fx-l">Label</label><input class="f" id="fx-l" maxlength="24" placeholder="Strength Drain"></div></div>
  <div class="rowline" style="border:0"><button class="btn sm" data-a="fxRollDrain" data-d="4">Roll 1d4</button><button class="btn sm" data-a="fxRollDrain" data-d="6">Roll 1d6</button><button class="btn pri" data-a="fxDrain">Apply drain</button></div>`;
}
function customForm() {
  return `<div class="grid3" style="grid-template-columns:1.4fr .7fr 1fr;gap:8px;align-items:end">
    <div class="field"><label for="cb-t">Changes</label><select class="f" id="cb-t">${FX_TARGETS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></div>
    <div class="field"><label for="cb-v">By</label><input class="f num" id="cb-v" type="number" inputmode="numeric" value="1"></div>
    <div class="field"><label for="cb-l">Label</label><input class="f" id="cb-l" maxlength="24" placeholder="Why"></div></div>
  <button class="btn block" data-a="customAdd">Add effect</button>`;
}
const sec = (h, body) => body ? `<h3 class="bd-h"><span>${h}</span></h3>${body}` : "";

// The part under the search box; the search field re-draws only this.
export function fxList(app, c) {
  const q = String(app.fxQ || "").trim().toLowerCase(), tab = q ? "all" : (app.fxTab || "all");
  const show = k => tab === "all" || tab === k;
  const act = show("custom") || show("spells") || show("drains") ? activeRows(c, q) : "";
  let out = "";
  if (tab === "all") out += sec("Active", activeRows(c, q) || (q ? "" : `<p class="sub2">Nothing active.</p>`));
  if (show("conditions")) out += sec("Conditions", condRows(app, c, q));
  if (show("spells")) out += sec("Spell effects", spellRows(app, q)) + (tab !== "all" ? sec("Active", act) : "");
  if (show("drains") && !q) out += sec("Drains", drainForm()) + (tab !== "all" ? sec("Active", act) : "");
  if (show("custom") && !q) out += sec("Custom effect", customForm()) + (tab !== "all" ? sec("Active", act) : "");
  if (tab === "all" && !q) out += `<p class="sub2">Pick Spells, Drains or Custom to add one.</p>`;
  if (!out.trim() || (q && !out.includes("rowline") && !out.includes("condgrid"))) out = `<p class="sub2">No match.</p>`;
  return out + (show("conditions") ? condEffectsBlock(c) : "");
}

export function renderEffectsModal(app, c) {
  const tab = app.fxTab || "all", n = c.conditions.length + (c.exhaustion ? 1 : 0) + (c.custom || []).length;
  return modalShell(`Active effects${n ? ` (${n})` : ""}`,
    `<div class="search"><input class="f" type="search" id="fx-q" data-query="fx" placeholder="Search effects" aria-label="Search effects" value="${esc(app.fxQ || "")}"></div>
     <div class="seg fxtabs" role="group" aria-label="Effect type">${FX_TABS.map(([k, l]) => `<button data-a="fxTab" data-v="${k}" aria-pressed="${!app.fxQ && tab === k}">${l}</button>`).join("")}</div>
     <div id="fx-list">${fxList(app, c)}</div>`,
    `<button class="btn pri" data-a="closeModal">Done</button>`);
}
