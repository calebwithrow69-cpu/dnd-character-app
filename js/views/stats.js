// Advanced sheet > Stats (scores radar, saves, skills, proficiencies) and Rolls (dice tray, pinned checks, formulas).
// Rolls themselves go through the shared roll card in app.js; this file only draws.
import { esc, ICONS, kRow, kGroup } from "../ui.js";
import { ABILITIES, ABILITY_LABEL, ABILITY_SHORT, fmtMod } from "../rules.js";
import { findByName } from "../data.js";
import { profsChecks } from "./classic.js";

const AB = a => ABILITY_SHORT[a].toUpperCase();
const DICE = [4, 6, 8, 10, 12, 20, 100];
const PTS = { 4: "24,5 44,40 4,40", 6: "9,9 39,9 39,39 9,39", 8: "24,3 43,24 24,45 5,24", 10: "24,3 42,18 36,43 12,43 6,18", 12: "24,4 43,18 36,41 12,41 5,18", 20: "24,3 43,14 43,34 24,45 5,34 5,14" };
const dieShape = n => `<svg class="shape" viewBox="0 0 48 48" aria-hidden="true">${n === 100 ? `<circle cx="24" cy="24" r="20"/>` : `<polygon points="${PTS[n]}" stroke-linejoin="round"/>`}</svg>`;
const FILTERS = ["All", "Proficient", ...ABILITIES];

// A check the player can pin: key -> { label, bonus }
export function checkInfo(d, key) {
  if (key === "init") return { label: "Initiative", bonus: d.initiative };
  const [t, id] = key.split(":");
  if (t === "abil" && d.mods[id] != null) return { label: ABILITY_LABEL[id] + " check", bonus: d.mods[id] };
  if (t === "save" && d.saves[id] != null) return { label: ABILITY_LABEL[id] + " save", bonus: d.saves[id] };
  if (t === "skill") { const s = d.skills.find(x => x.id === id); if (s) return { label: s.label, bonus: s.bonus }; }
  return null;
}

const dieIcon = ICONS.dice;
const rollBtn = (attrs, bonus, label) => `<button class="btn pri sm st-roll" ${attrs} aria-label="Roll ${esc(label)}, ${fmtMod(bonus)}">${dieIcon}<b>${fmtMod(bonus)}</b></button>`;
const starBtn = (c, key, label) => { const on = (c.pins || []).includes(key); return `<button class="st-star ${on ? "on" : ""}" data-a="togglePin" data-k="${esc(key)}" aria-pressed="${on}" aria-label="${on ? "Unpin" : "Pin"} ${esc(label)}">${ICONS.star}</button>`; };

// ---------------- Stats ----------------
function radar(c) {
  const R = 88, cx = 110, cy = 104, pt = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ring = f => `<polygon points="${ABILITIES.map((_, i) => pt(i, R * f).map(v => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="var(--line)" stroke-width="1" opacity=".7"/>`;
  const poly = ABILITIES.map((a, i) => pt(i, R * Math.min(20, c.abilities[a]) / 20).map(v => v.toFixed(1)).join(",")).join(" ");
  return `<svg class="st-radar" viewBox="0 -8 220 226" role="img" aria-label="Ability scores: ${ABILITIES.map(a => ABILITY_LABEL[a] + " " + c.abilities[a]).join(", ")}">${[0.25, 0.5, 0.75, 1].map(ring).join("")}${ABILITIES.map((_, i) => { const q = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="var(--line-soft)"/>`; }).join("")}<polygon points="${poly}" fill="var(--amber)" fill-opacity=".28" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round"/>${ABILITIES.map((a, i) => { const q = pt(i, R * Math.min(20, c.abilities[a]) / 20); return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3" fill="var(--amber)"/>`; }).join("")}${ABILITIES.map((a, i) => { const q = pt(i, R + 15); return `<text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" fill="var(--faint)" stroke="none">${AB(a)} <tspan fill="var(--ink)" font-weight="600">${c.abilities[a]}</tspan></text>`; }).join("")}</svg>`;
}

function skillRows(app, c, d) {
  const f = app.stF || "All", q = (app.stQ || "").trim().toLowerCase();
  return d.skills.filter(s => (f === "All" || (f === "Proficient" ? (s.proficient || s.expert) : s.ability === f)) && (!q || s.label.toLowerCase().includes(q)));
}

function statParts(app, c, d) {
  const cls = findByName(app.library.classes, c.class);
  const prim = a => cls && String(cls.primary || "").includes(ABILITY_LABEL[a]);
  const tiles = ABILITIES.map(a => `<button class="st-six ${prim(a) ? "p" : ""}" data-a="rollAbility" data-ab="${a}" aria-label="${ABILITY_LABEL[a]} ${c.abilities[a]}, modifier ${fmtMod(d.mods[a])}. Roll check">
      ${c.saveProf.includes(a) ? `<i class="sv" title="Save proficiency"></i>` : ""}<span class="dc">${dieIcon}</span><span class="n">${AB(a)}</span><b>${c.abilities[a]}</b><em>${fmtMod(d.mods[a])}</em></button>`).join("");
  const saves = ABILITIES.map(a => {
    const key = "save:" + a, p = c.saveProf.includes(a);
    return kRow({ glyph: AB(a), tone: p ? "amber" : "faint", title: ABILITY_LABEL[a] + " save", cap: p ? "Proficient" : "", mainAttrs: `data-a="rollSave" data-ab="${a}"`,
      actions: `${starBtn(c, key, ABILITY_LABEL[a] + " save")}${rollBtn(`data-a="rollSave" data-ab="${a}"`, d.saves[a], ABILITY_LABEL[a] + " save")}` });
  }).join("");
  const sk = skillRows(app, c, d);
  const skills = sk.map(s => {
    const key = "skill:" + s.id;
    return kRow({ glyph: AB(s.ability || "str"), tone: s.expert ? "amber" : s.proficient ? "blue" : "faint", title: s.label, cap: s.expert ? "Expertise" : s.proficient ? "Proficient" : "",
      mainAttrs: `data-a="rollSkill" data-id="${s.id}"`,
      actions: `<button class="pip st-pip" data-a="cycleSkill" data-id="${s.id}" aria-label="${esc(s.label)} proficiency: ${s.expert ? "expertise" : s.proficient ? "proficient" : "none"}"><i style="width:14px;height:14px;${s.expert ? "box-shadow:0 0 0 3px var(--amber-dim),0 0 0 5px var(--amber);" : ""}${s.proficient || s.expert ? "" : "background:transparent;border-color:var(--faint)"}"></i></button>${starBtn(c, key, s.label)}${rollBtn(`data-a="rollSkill" data-id="${s.id}"`, s.bonus, s.label)}` });
  }).join("");
  const seg = FILTERS.map(k => `<button data-a="stFilter" data-k="${k}" aria-pressed="${(app.stF || "All") === k}">${k === "All" || k === "Proficient" ? k : AB(k)}</button>`).join("");
  const card = `<aside class="st-card" aria-label="Ability scores">
      ${radar(c)}<div class="st-sixg">${tiles}</div>
      <button class="st-init" data-a="rollInit">${dieIcon}<span>Initiative</span><b>${fmtMod(d.initiative)}</b></button>
    </aside>`;
  const main = `<section class="st-main">
      ${kGroup("Saving throws", c.saveProf.length + " proficient", { tone: "amber" })}<div class="k-list">${saves}</div>
      ${kGroup("Skills", sk.length, { tone: "blue" })}
      <div class="st-find"><div class="seg" role="group" aria-label="Filter skills">${seg}</div>
        <label class="st-q"><span class="sr">Search skills</span>${ICONS.search || ""}<input id="st-q" type="search" placeholder="Search" value="${esc(app.stQ || "")}" autocomplete="off"></label></div>
      <div class="k-list">${skills || `<p class="muted small" style="padding:12px 0">Nothing matches.</p>`}</div>
    </section>`;
  return { card, main };
}
export const statCard = (app, c, d) => statParts(app, c, d).card;
export const skillsMain = (app, c, d) => statParts(app, c, d).main;

export function statsTab(app, c, d) {
  const { card, main } = statParts(app, c, d);
  return `<div class="st-grid">
    ${card}
    ${main}
    <aside class="st-side">
      <div class="panel"><div class="panel-head"><h2>Proficiencies &amp; languages</h2></div><div class="panel-body stack">
        ${profsChecks(c)}
        <div class="field"><label>Tools and other training</label><textarea class="f" data-field="profsText" style="min-height:60px">${esc(c.profsText)}</textarea></div>
        <div class="field"><label>Languages</label><input class="f" data-field="languages" value="${esc(c.languages)}"></div>
      </div></div>
      <button class="btn block pdfbtn" data-a="downloadPdf">Download character sheet (PDF)</button>
    </aside></div>`;
}

// ---------------- Rolls ----------------
export function trayFormula(tray) {
  const parts = DICE.filter(s => (tray.n || {})[s]).map(s => `${tray.n[s]}d${s}`);
  const mod = tray.mod || 0;
  return parts.join("+") + (mod ? (mod > 0 ? "+" : "-") + Math.abs(mod) : "");
}

export function rollsTab(app, c, d) {
  const tray = app.tray || { n: {}, mod: 0 }, text = trayFormula(tray), empty = !DICE.some(s => (tray.n || {})[s]);
  const tiles = DICE.map(s => { const n = (tray.n || {})[s] || 0; return `<button class="st-die ${n ? "has" : ""}" data-a="trayAdd" data-sides="${s}" aria-label="Add d${s}${n ? ", " + n + " in tray" : ""}">${n ? `<i class="n">${n}</i>` : ""}${dieShape(s)}<b>d${s}</b></button>`; }).join("");
  const pins = (c.pins || []).map(k => ({ k, i: checkInfo(d, k) })).filter(x => x.i);
  const forms = c.formulas || [];
  const hist = (app.history || []).slice(0, 8).map(h => `<li><b>${esc(h.title)}</b><span>${esc(h.summary)}</span></li>`).join("");
  return `<div class="rl-grid">
    <section class="panel rl-tray"><div class="panel-body">
      <div class="st-dice" role="group" aria-label="Dice tray">${tiles}</div>
      <div class="rl-formula" aria-live="polite">${empty ? "No dice" : esc(text.replace(/\+/g, " + ").replace(/-/g, " - "))}</div>
      <div class="rl-ctl"><span class="stepper" role="group" aria-label="Modifier"><button data-a="trayMod" data-n="-1" aria-label="Lower modifier">−</button><b>${fmtMod(tray.mod || 0)}</b><button data-a="trayMod" data-n="1" aria-label="Raise modifier">+</button></span>
        <button class="btn sm" data-a="trayClear" ${empty && !tray.mod ? "disabled" : ""}>Clear</button>
        <button class="btn sm" data-a="saveFormula" ${empty ? "disabled" : ""}>Save formula</button></div>
      <button class="btn pri block rl-go" data-a="trayRoll" ${empty ? "disabled" : ""}>Roll</button>
      <form data-form="customRoll" class="field" style="margin-top:12px"><label for="f-formula">Formula</label>
        <div class="row"><input class="f grow" id="f-formula" value="${esc(app.diceFormula || "")}" placeholder="2d6+3" autocomplete="off" enterkeyhint="go"><button class="btn" type="submit">Roll</button></div></form>
    </div></section>
    <aside class="rl-side">
      <div class="panel"><div class="panel-head"><h2>Pinned checks</h2></div><div class="panel-body"><div class="rl-pins">${pins.length
        ? pins.map(({ k, i }) => `<button class="rl-pin" data-a="rollPin" data-k="${esc(k)}"><span>${esc(i.label)}</span><b>${fmtMod(i.bonus)}</b></button>`).join("")
        : `<p class="muted small" style="margin:0">None pinned.</p>`}</div></div></div>
      <div class="panel"><div class="panel-head"><h2>Formulas</h2></div><div class="panel-body"><div class="rl-pins one">${forms.length
        ? forms.map(f => `<span class="rl-pin f"><button class="rl-fm" data-a="rollFormula" data-f="${esc(f)}"><span>${esc(f)}</span></button><button class="rl-x" data-a="dropFormula" data-f="${esc(f)}" aria-label="Remove ${esc(f)}">${ICONS.close}</button></span>`).join("")
        : `<p class="muted small" style="margin:0">None saved.</p>`}</div></div></div>
      <div class="panel"><div class="panel-head"><h2>History</h2>${hist ? `<button class="btn sm" data-a="clearHistory">Clear</button>` : ""}</div><div class="panel-body"><ol class="rl-hist">${hist || `<li class="none">No rolls yet.</li>`}</ol></div></div>
    </aside></div>`;
}
