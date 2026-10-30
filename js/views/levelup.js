// Full-screen level-up, one decision per step (Baldur's Gate style).
import { subRow } from "./subclass.js";
import { esc, topbar, formatText, searchBox, infoRow, glossaryEntry, ICONS, kRow, kGroup } from "../ui.js";
import { detailFor, spellSub } from "./sheet.js";
import { ABILITIES, ABILITY_LABEL, SKILLS, abilityMod, fmtMod, hpAverageGain, slotRows } from "../rules.js";
import { findByName, findFeat, enabledFeats, allWeapons, subclassesFor } from "../data.js";
import { levelUpPlan, featEligible, optionPrereq, spellsFor, stepValidFor, expertiseOptions } from "../progression.js";
import { lineageSpells } from "../choices.js";
import { renderFeatControls, renderFeatGrid, renderFeatSheet } from "./feats.js";
import { featAbilityIncrease, previewFeat, ASI_FEAT } from "../featfx.js";

export function newLevelDraft(char, { fromCreation = false } = {}) {
  const next = fromCreation ? char.level : char.level + 1;
  // a hit-die roll is kept on the character, so closing and reopening level up cannot re-roll or swap to the average
  const kept = !fromCreation && char.hpRoll && char.hpRoll.level === next ? char.hpRoll.v : null;
  return {
    next, fromCreation, step: 0,
    hpMode: kept ? "roll" : "avg", rolled: kept, subclass: "",
    asiMode: "asi", asiSplit: "2", a2: "", a1a: "", a1b: "", feat: "", featAb: "", fxOpen: false,
    style: "", expertise: [], mastery: [], options: [], cantrips: [], spells: [],
    query: "", showAll: false, open: null
  };
}

export function plan(app) {
  const d = app.lvl;
  return levelUpPlan(app.library, app.char, d.next, d, { fromCreation: d.fromCreation });
}

export function asiResult(c, d) {
  const out = { ...c.abilities };
  if (d.asiMode !== "asi") return out;
  if (d.asiSplit === "2") { if (d.a2) out[d.a2] = Math.min(20, out[d.a2] + 2); }
  else { if (d.a1a) out[d.a1a] = Math.min(20, out[d.a1a] + 1); if (d.a1b && d.a1b !== d.a1a) out[d.a1b] = Math.min(20, out[d.a1b] + 1); }
  return out;
}

export function hpGain(c, d) {
  const conMod = abilityMod(asiResult(c, d).con);
  const die = c.hitDice.die || 8;
  return d.hpMode === "roll" && d.rolled ? Math.max(1, d.rolled + conMod) : hpAverageGain(die, conMod);
}

export function stepValid(app, step) { return stepValidFor(app.char, app.lvl, step); }
const why = {
  gains: "", hp: "Roll the die or take the average.", subclass: "Pick a subclass.", asi: "Choose your increase or a feat.",
  style: "Pick a fighting style.", cantrips: "Pick all your cantrips, or press Randomize.", expertise: "Pick your expertise skills.", mastery: "Pick your weapons.", options: "Make your picks."
};

const expertiseChoices = expertiseOptions;

let APPREF = null; // set at render time so pickers can read which rows are expanded
function pickList(items, chosen, action, { max, render, disabled, detail, kind = action }) {
  return items.map(it => {
    const on = chosen.includes(it.name);
    const off = disabled ? disabled(it) : null;
    const full = !on && max != null && chosen.length >= max;
    const key = kind + ":" + it.name, open = !!APPREF?.info.has(key);
    return infoRow({ key, action, data: { name: it.name }, title: it.name, sub: render ? render(it, off) : "", pressed: on,
      disabled: !!(off || full), open, detail: open && detail ? detail(it) : "",
      badge: on ? `<span class="tag amber">Chosen</span>` : "" });
  }).join("");
}
const featDetail = f => `${f.type ? `<p class="sub2" style="margin-bottom:8px">${esc(f.type)}</p>` : ""}${formatText(f.text)}`;
const masteryDetail = w => `<p class="sub2" style="margin-bottom:8px">${esc([w.cat, w.kind, w.dice + " " + (w.dtype || ""), w.props].filter(Boolean).join(" · "))}</p>${formatText(glossaryEntry(w.mastery)?.text || "")}`;


function asiFeatItems(app) {
  const c = app.char, d = app.lvl;
  return enabledFeats(app.library, app.campaign).filter(f => /^General|^Epic|^Origin/i.test(f.type || "") && (!c.feats.includes(f.name) || /Repeatable/i.test(f.text || "")))
    .map(f => { const e = featEligible(f, { ...c }, d.next); return { f, ok: e.ok, why: e.why || "" }; });
}
function styleFeatItems(app) {
  const c = app.char;
  return enabledFeats(app.library, app.campaign).filter(f => /^Fighting Style Feat/i.test(f.type || "") && !c.feats.includes(f.name))
    .map(f => ({ f, ok: true, why: "" }));
}

const sgn = n => (n >= 0 ? "+" : "") + n;
const MAG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg>';
export function featDef(app, name) { return findFeat(enabledFeats(app.library, app.campaign), name) || findFeat(app.library.feats || [], name); }

// The selected feat: choose the ability it raises, and see what changes (magnifier).
function renderFeatChosen(app) {
  const d = app.lvl, c = app.char;
  if (!d.feat) return `<p class="sub2" style="margin-top:8px">No feat picked yet.</p>`;
  const f = featDef(app, d.feat);
  let pick = "";
  if (d.feat === ASI_FEAT) {
    const res = asiResult(c, d);
    pick = `<div class="seg" style="margin-top:10px" role="group"><button data-a="lvlAsiSplit" data-v="2" aria-pressed="${d.asiSplit === "2"}">+2 to one</button>
        <button data-a="lvlAsiSplit" data-v="11" aria-pressed="${d.asiSplit === "11"}">+1 to two</button></div>
      <div class="grid3" style="margin-top:10px">${ABILITIES.map(a => {
        const picked = d.asiSplit === "2" ? d.a2 === a : (d.a1a === a || d.a1b === a);
        const capped = c.abilities[a] >= 20;
        return `<button class="abil ${picked ? "picked" : ""}" data-a="lvlAsiPick" data-ab="${a}" ${capped && !picked ? "disabled" : ""}>
          <span class="an">${ABILITY_LABEL[a]}</span><span class="am" style="display:block">${res[a]}</span>
          <span class="as">${res[a] !== c.abilities[a] ? `was ${c.abilities[a]}` : capped ? "max 20" : fmtMod(abilityMod(res[a]))}</span></button>`;
      }).join("")}</div><p class="sub2" style="margin-top:8px">Scores can't go above 20.</p>`;
  } else if (f) {
    const inc = featAbilityIncrease(f, c);
    if (inc && inc.options.length > 1) pick = `<p class="small" style="margin-top:10px">${inc.saveProf ? "Choose the ability (and its saving throws) to raise:" : "This feat raises one ability by 1. Choose which:"}</p>
      <div class="grid3" style="margin-top:6px">${inc.options.map(a => `<button class="abil ${d.featAb === a ? "picked" : ""}" data-a="lvlFeatAb" data-ab="${a}" ${c.abilities[a] >= inc.cap ? "disabled" : ""}>
        <span class="an">${ABILITY_LABEL[a]}</span><span class="am" style="display:block">${d.featAb === a ? Math.min(inc.cap, c.abilities[a] + 1) : c.abilities[a]}</span>
        <span class="as">${d.featAb === a ? `was ${c.abilities[a]}` : c.abilities[a] >= inc.cap ? "max " + inc.cap : fmtMod(abilityMod(c.abilities[a]))}</span></button>`).join("")}</div>`;
  }
  let fx = "";
  if (d.feat !== ASI_FEAT && f) {
    const rows = previewFeat(f, c, d.next, d.featAb);
    if (d.fxOpen) fx = rows.length ? `<dl class="kv" style="margin-top:10px">${rows.map(r => r.delta != null
        ? `<dt>${esc(r.label)}</dt><dd>${sgn(r.delta)}${r.extra ? ` <span class="sub2">${esc(r.extra)}</span>` : ""}</dd>`
        : `<dt>${esc(r.label)}</dt><dd>${esc(r.from)} \u2192 <b>${esc(r.to)}</b>${r.extra ? ` <span class="sub2">${esc(r.extra)}</span>` : ""}</dd>`).join("")}</dl>`
      : `<p class="sub2" style="margin-top:10px">${featAbilityIncrease(f, c) && !d.featAb ? "Choose an ability above to see the result." : "This feat doesn't change your scores or hit points."}</p>`;
  }
  return `<div class="panel" style="margin-top:12px"><div class="panel-body">
    <div style="display:flex;align-items:center;gap:8px"><b class="grow">${esc(d.feat)}</b>
      ${d.feat !== ASI_FEAT ? `<button class="iconbtn" data-a="fxToggle" aria-label="What this feat changes" aria-pressed="${!!d.fxOpen}">${MAG}</button>` : ""}
      <button class="btn sm" data-a="lvlFeatClear">Change</button></div>${pick}${fx}</div></div>`;
}

export function renderLevelResults(app) {
  APPREF = app;
  const d = app.lvl, c = app.char, L = app.library;
  const p = plan(app), step = p.steps[d.step];
  const q = (d.query || "").trim().toLowerCase();
  const match = x => !q || x.name.toLowerCase().includes(q);
  if (step.id === "asi") {
    return renderFeatGrid(app, asiFeatItems(app), d.feat);
  }
  if (step.id === "cantrips" || step.id === "spells") {
    const list = spellsFor(L, app.campaign, c, { cantrips: step.id === "cantrips", maxLevel: step.maxLevel || 0, all: d.showAll })
      .filter(s => !(step.id === "spells" ? d.cantrips : d.spells).includes(s.name)).filter(match);
    const chosen = step.id === "cantrips" ? d.cantrips : d.spells;
    if (!list.length) return `<p class="muted small">No spells match.</p>`;
    return pickList(list.slice(0, 120), chosen, step.id === "cantrips" ? "lvlCantrip" : "lvlSpell",
      { kind: "spell", max: step.n, render: s => esc(spellSub(s)), detail: s => detailFor(app, "spell", s.name).body });
  }
  return "";
}

// The body of the current step (shared with character creation)
export function levelBody(app) {
  APPREF = app;
  const d = app.lvl, c = app.char, L = app.library;
  const p = plan(app);
  if (d.step >= p.steps.length) d.step = p.steps.length - 1;
  const step = p.steps[d.step];
  const cls = p.cls;
  let body = "";

  if (step.id === "gains") {
    const feats = p.features, oldSlots = slotRows(c.class, c.level), newSlots = slotRows(c.class, d.next);
    const prof = lv => Math.ceil(lv / 4) + 1;
    const facts = [];
    facts.push([prof(c.level) === prof(d.next) ? "Proficiency (same)" : "Proficiency bonus", prof(c.level) === prof(d.next) ? `+${prof(d.next)}` : `+${prof(c.level)} \u2192 +${prof(d.next)}`]);
    const os = oldSlots.map(r => r.max).join("/"), ns = newSlots.map(r => r.max).join("/");
    if (ns && os !== ns) facts.push(["Spell slots", `${os || "none"} \u2192 ${ns}`]);
    facts.push(["Hit die gained", `+1d${c.hitDice.die || 8}`]);
    body = `<p class="small muted">Here is everything level ${d.next} gives you. Tap a feature to read it, then continue to make your choices.</p>
      <div class="quick" style="grid-template-columns:repeat(${facts.length},1fr);margin:12px 0 4px">${facts.map(([k, v]) => `<div><b style="font-size:${String(v).length > 12 ? ".95rem" : "1.15rem"}">${esc(v)}</b><span>${esc(k)}</span></div>`).join("")}</div>
      ${feats.length ? kGroup("New features", feats.length, { tone: "amber" }) + `<div class="k-list">${feats.map(f => {
        const open = d.gainOpen === f.name;
        return kRow({ icon: ICONS.star, tone: "amber", title: f.name, cap: f.from === c.class ? "Class feature" : f.from, status: open ? "\u25b4" : "\u25be",
          mainAttrs: `data-a="lvlGainOpen" data-name="${esc(f.name)}" aria-expanded="${open}"`, extra: "" }) + (open ? `<div class="about" style="margin:0 0 8px;border:1px solid var(--line);border-radius:var(--radius-sm)">${formatText(f.text || "")}</div>` : "");
      }).join("")}</div>`
        : p.open ? `<p class="sub2">Your rules data stops at level 10, so new features for level ${d.next} aren't listed. Add them from your book.</p>` : `<p class="sub2">No new class features.</p>`}`;
  }

  else if (step.id === "hp") {
    const die = c.hitDice.die || 8, conMod = abilityMod(c.abilities.con);
    body = `<p>Each level adds hit points: one d${die} plus your Constitution modifier (${fmtMod(conMod)}).</p>
      <div class="lvl-choice-row">
        <button class="bigchoice" data-a="lvlHp" data-mode="avg" aria-pressed="${d.hpMode === "avg"}" ${d.rolled ? "disabled" : ""}><b>+${hpAverageGain(die, conMod)}</b><span>Take the average</span></button>
        <button class="bigchoice" data-a="lvlHp" data-mode="roll" aria-pressed="${d.hpMode === "roll"}"><b>${d.rolled ? "+" + Math.max(1, d.rolled + conMod) : "d" + die}</b><span>${d.rolled ? `Rolled ${d.rolled} ${fmtMod(conMod)}` : "Roll for it"}</span></button>
      </div>
      <p class="sub2" style="margin-top:10px">Roll is final once made.</p>`;
  }

  else if (step.id === "subclass") {
    const subs = subclassesFor(L, c.class).slice().sort((a, b) => a.name.localeCompare(b.name));
    body = `<p class="small muted">Your subclass shapes the rest of your ${esc(c.class)} levels. Tap one to read all of it, then choose from that page.</p><div class="sclist">` + subs.map(sc => subRow(app, sc)).join("") + `</div>`;
  }

  else if (step.id === "asi") {
    const fi = asiFeatItems(app);
    body = `<p class="small muted">In the 2024 rules an Ability Score Improvement is a feat. Pick one: a General feat, an Origin feat, or Ability Score Improvement itself. Tap a feat to read it.</p>
      ${renderFeatChosen(app)}
      <div style="margin-top:12px">${searchBox("lvl", d.query, "Search feats")}</div>${renderFeatControls(app, fi)}
      <div id="lvl-results">${renderLevelResults(app)}</div>${renderFeatSheet(app, fi, d.feat, "lvlFeat")}`;
  }

  else if (step.id === "style") {
    const si = styleFeatItems(app);
    body = renderFeatControls(app, si) + renderFeatGrid(app, si, d.style) + renderFeatSheet(app, si, d.style, "lvlStyle");
  }

  else if (step.id === "expertise") {
    const opts = expertiseChoices(c);
    body = `<p class="small muted">Expertise doubles your proficiency bonus for a skill. Pick ${step.n} you're already proficient in. ${d.expertise.length}/${Math.min(step.n, opts.length)} chosen.</p>
      <div class="optlist">${opts.map(s => {
        const on = d.expertise.includes(s.id);
        return `<button class="optcard" data-a="lvlExpertise" data-id="${s.id}" aria-pressed="${on}" ${!on && d.expertise.length >= step.n ? "disabled" : ""}>
          <span class="grow"><b>${s.label}</b><span>${ABILITY_LABEL[s.ability]}</span></span>${on ? `<span class="tag amber">Chosen</span>` : ""}</button>`;
      }).join("") || `<p class="muted">No proficient skills to choose from.</p>`}</div>`;
  }

  else if (step.id === "mastery") {
    const have = c.masteries || [];
    const ws = allWeapons(L, app.campaign).filter(w => w.mastery && !have.includes(w.name)).sort((a, b) => a.name.localeCompare(b.name));
    body = `<p class="small muted">Mastery unlocks a weapon's special trick (shown on each). Pick ${step.n}. ${d.mastery.length}/${step.n} chosen.</p>
      <div class="optlist">${pickList(ws, d.mastery, "lvlMastery", { kind: "mastery", max: step.n, detail: masteryDetail, render: w => `${esc(w.mastery)} · ${esc(w.cat || "")} ${esc(w.kind || "")}` })}</div>`;
  }

  else if (step.id === "options") {
    const g = step.group;
    const have = c.choices[g.key] || [];
    const picked = new Set([...have, ...d.options]);
    const opts = g.options.filter(o => !have.includes(o.name));
    body = `<p class="small muted">Pick ${step.n}. ${d.options.length}/${step.n} chosen. Tap (i) to read any of them, even locked ones.</p>
      <div class="optlist">${opts.map(o => {
        const pre = optionPrereq(o);
        const lockedLevel = pre.level > d.next;
        const missing = pre.needs.filter(n => !picked.has(n) && g.options.some(x => x.name === n));
        const off = lockedLevel ? `Needs level ${pre.level}` : missing.length ? `Needs ${missing.join(", ")}` : null;
        const on = d.options.includes(o.name), key = "option:" + o.name;
        return infoRow({ key, action: "lvlOption", data: { name: o.name }, title: o.name, sub: esc(off || pre.text || "No prerequisite"),
          pressed: on, disabled: !!(off || (!on && d.options.length >= step.n)), open: app.info.has(key) || on,
          detail: app.info.has(key) || on ? formatText(o.text) : "", badge: on ? `<span class="tag amber">Chosen</span>` : "" });
      }).join("")}</div>`;
  }

  else if (step.id === "cantrips" || step.id === "spells") {
    const chosen = step.id === "cantrips" ? d.cantrips : d.spells;
    body = `<p class="small muted">${step.n == null
        ? `Your rules data has no table for level ${d.next}, so pick as many as your class allows.`
        : step.id === "cantrips" ? `Learn ${step.n} new cantrip${step.n === 1 ? "" : "s"}.` : `You can prepare ${step.n} more spell${step.n === 1 ? "" : "s"}, up to level ${step.maxLevel}.`}
        ${chosen.length}${step.n != null ? "/" + step.n : ""} chosen. You can also add spells later on the Spells tab.</p>

      <div style="margin-top:10px">${searchBox("lvl", d.query, "Search spells")}</div>
      <label class="rowline" style="cursor:pointer"><span class="nm small">Include other classes' spells</span><input type="checkbox" data-a="lvlShowAll" ${d.showAll ? "checked" : ""}></label>
      <div class="optlist" id="lvl-results">${renderLevelResults(app)}</div>`;
  }

  else if (step.id === "review") {
    const lines = [];
    if (!d.fromCreation) lines.push(["Hit points", `+${hpGain(c, d)} (max ${c.hp.max} → ${c.hp.max + hpGain(c, d)})`]);
    if (d.subclass) lines.push(["Subclass", d.subclass]);
    if (d.feat && d.feat !== ASI_FEAT) {
      lines.push(["Feat", d.feat]);
      const f = featDef(app, d.feat);
      if (f) previewFeat(f, c, d.next, d.featAb).forEach(r => lines.push([r.label, r.delta != null ? sgn(r.delta) : `${r.from} \u2192 ${r.to}`]));
    }
    if (d.feat === ASI_FEAT && (d.a2 || d.a1a)) { const r = asiResult(c, d); lines.push(["Abilities", ABILITIES.filter(a => r[a] !== c.abilities[a]).map(a => `${ABILITY_LABEL[a]} ${c.abilities[a]} → ${r[a]}`).join(", ")]); }
    if (d.style) lines.push(["Fighting style", d.style]);
    if (d.expertise.length) lines.push(["Expertise", d.expertise.map(id => SKILLS.find(s => s.id === id).label).join(", ")]);
    if (d.mastery.length) lines.push(["Weapon mastery", d.mastery.join(", ")]);
    if (d.options.length) lines.push([p.steps.find(s => s.id === "options")?.label || "Choices", d.options.join(", ")]);
    if (d.cantrips.length) lines.push(["Cantrips", d.cantrips.join(", ")]);
    if (d.spells.length) lines.push(["Spells", d.spells.join(", ")]);
    const fromSpecies = lineageSpells(c, app.library, app.campaign).filter(x => x.level <= d.next && x.level > c.level && !(c.lineageGranted || []).includes(x.name));
    if (fromSpecies.length) lines.push(["Species spells", fromSpecies.map(x => x.name).join(", ") + " (always prepared)"]);
    const oldSlots = slotRows(c.class, c.level).map(r => r.max).join("/"), newSlots = slotRows(c.class, d.next).map(r => r.max).join("/");
    if (!d.fromCreation && oldSlots !== newSlots) lines.push(["Spell slots", `${oldSlots || "none"} → ${newSlots}`]);
    const feats = p.features;
    body = `<dl class="kv">${lines.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("") || "<dt>Changes</dt><dd>None to choose this level.</dd>"}</dl>
      ${feats.length ? `<p class="lab" style="margin-top:6px">New features</p><div>${feats.map(f => `<button class="rowline rollable" data-a="showDetail" data-kind="${f.kind}" data-name="${esc(f.name)}" data-from="${esc(f.from)}"><span class="nm">${esc(f.name)}</span><span class="sub2">${f.from === c.class ? "" : esc(f.from)}</span></button>`).join("")}</div>`
        : p.open ? `<p class="sub2">Your rules data stops at level 10, so new features for level ${d.next} aren't listed. Add them from your book.</p>` : ""}`;
  }

  const RAND = { subclass: "subclass", style: "fighting style", expertise: "expertise", mastery: "weapons", options: "picks", cantrips: "cantrips", spells: "spells" };
  if (RAND[step.id]) body = `<div class="randrow"><button class="btn sm" data-a="lvlRandomStep">Randomize ${RAND[step.id]}</button><span class="small muted">Fills this screen. Change anything after.</span></div>` + body;
  return { body, step, plan: p };
}
export const levelWhy = id => why[id] || "";

export function renderLevelUp(app) {
  const { body, step, plan: p } = levelBody(app);
  const d = app.lvl, c = app.char;
  const valid = stepValid(app, step);
  const last = d.step === p.steps.length - 1;
  const title = d.fromCreation ? "Level 1 choices" : `Level ${c.level} → ${d.next}`;
  return `
    ${topbar(title, `${c.name} · ${c.class}${d.subclass || c.subclass ? " · " + (d.subclass || c.subclass) : ""}`, { back: "lvlCancel" })}
    <main class="wrap page has-stickybar">
      <ol class="lvl-steps" aria-label="Steps">${p.steps.map((s, i) => `<li><button data-a="lvlGoto" data-i="${i}" class="${i === d.step ? "now" : i < d.step ? "done" : ""}" ${i > d.step && !p.steps.slice(0, i).every(x => stepValid(app, x)) ? "disabled" : ""}>
        <span>${i + 1}</span>${esc(s.label)}</button></li>`).join("")}</ol>
      <div class="panel"><div class="panel-head"><h2>${esc(step.label)}</h2><span class="sub2">Step ${d.step + 1} of ${p.steps.length}</span></div>
        <div class="panel-body">${body}</div></div>
    </main>
    <div class="stickybar"><div class="wrap">
      ${valid ? "" : `<p class="why">${why[step.id] || ""}</p>`}
      <div class="btnrow">
        ${d.step > 0 ? `<button class="btn" data-a="lvlPrev">Back</button>` : ""}
        <button class="btn pri" data-a="${last ? "lvlConfirm" : "lvlNext"}" ${valid ? "" : "disabled"}>${last ? (d.fromCreation ? "Save choices" : `Become level ${d.next}`) : "Next"}</button>
      </div>
    </div></div>`;
}
