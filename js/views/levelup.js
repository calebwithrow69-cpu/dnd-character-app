// Full-screen level-up, one decision per step (Baldur's Gate style).
import { esc, topbar, formatText, searchBox } from "../ui.js";
import { ABILITIES, ABILITY_LABEL, SKILLS, abilityMod, fmtMod, hpAverageGain, slotRows } from "../rules.js";
import { findByName, enabledFeats, allWeapons, subclassesFor } from "../data.js";
import { levelUpPlan, featEligible, optionPrereq, spellsFor } from "../progression.js";

export function newLevelDraft(char, { fromCreation = false } = {}) {
  return {
    next: fromCreation ? char.level : char.level + 1, fromCreation, step: 0,
    hpMode: "avg", rolled: null, subclass: "",
    asiMode: "asi", asiSplit: "2", a2: "", a1a: "", a1b: "", feat: "",
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

export function stepValid(app, step) {
  const d = app.lvl, c = app.char;
  switch (step.id) {
    case "hp": return d.hpMode === "avg" || !!d.rolled;
    case "subclass": return !!d.subclass;
    case "asi":
      if (d.asiMode === "feat") return !!d.feat;
      return d.asiSplit === "2" ? !!d.a2 && c.abilities[d.a2] < 20 : !!d.a1a && !!d.a1b && d.a1a !== d.a1b;
    case "style": return !!d.style;
    case "expertise": return d.expertise.length === Math.min(step.n, expertiseChoices(c).length);
    case "mastery": return d.mastery.length === step.n;
    case "options": return d.options.length === step.n;
    default: return true; // spells/cantrips: picking fewer is allowed
  }
}
const why = {
  hp: "Roll the die or take the average.", subclass: "Pick a subclass.", asi: "Choose your increase or a feat.",
  style: "Pick a fighting style.", expertise: "Pick your expertise skills.", mastery: "Pick your weapons.", options: "Make your picks."
};

function expertiseChoices(c) {
  return SKILLS.filter(s => c.skillProf.includes(s.id) && !c.skillExpertise.includes(s.id));
}

function pickList(items, chosen, action, { max, render, disabled }) {
  return items.map(it => {
    const on = chosen.includes(it.name);
    const off = disabled ? disabled(it) : null;
    const full = !on && max != null && chosen.length >= max;
    return `<div><button class="optcard" data-a="${action}" data-name="${esc(it.name)}" aria-pressed="${on}" ${off || full ? "disabled" : ""}>
        <span class="grow"><b>${esc(it.name)}</b><span>${render ? render(it, off) : ""}</span></span>
        ${on ? `<span class="tag amber">Chosen</span>` : ""}</button></div>`;
  }).join("");
}

export function renderLevelResults(app) {
  const d = app.lvl, c = app.char, L = app.library;
  const p = plan(app), step = p.steps[d.step];
  const q = (d.query || "").trim().toLowerCase();
  const match = x => !q || x.name.toLowerCase().includes(q);
  if (step.id === "asi") {
    const all = enabledFeats(L, app.campaign).filter(f => /^General|^Epic/i.test(f.type || "") && !c.feats.includes(f.name) && match(f));
    const okList = all.filter(f => featEligible(f, { ...c }, d.next).ok);
    const nope = all.filter(f => !featEligible(f, c, d.next).ok);
    return pickList(okList, [d.feat], "lvlFeat", { render: f => esc((f.type || "").replace(/^General Feat\s*/, "").replace(/^\(|\)$/g, "") || "No prerequisite") })
      + (nope.length ? `<div class="grouph">Not available yet (${nope.length})</div>` + pickList(nope, [], "lvlFeat", { disabled: f => featEligible(f, c, d.next).why, render: (f, w) => esc(w) }) : "");
  }
  if (step.id === "cantrips" || step.id === "spells") {
    const list = spellsFor(L, app.campaign, c, { cantrips: step.id === "cantrips", maxLevel: step.maxLevel || 0, all: d.showAll })
      .filter(s => !(step.id === "spells" ? d.cantrips : d.spells).includes(s.name)).filter(match);
    const chosen = step.id === "cantrips" ? d.cantrips : d.spells;
    if (!list.length) return `<p class="muted small">No spells match.</p>`;
    return pickList(list.slice(0, 120), chosen, step.id === "cantrips" ? "lvlCantrip" : "lvlSpell",
      { max: step.n, render: s => `${s.level ? "Level " + s.level : "Cantrip"} · ${esc(s.school || "")}${s.conc ? " · concentration" : ""}` });
  }
  return "";
}

export function renderLevelUp(app) {
  const d = app.lvl, c = app.char, L = app.library;
  const p = plan(app);
  if (d.step >= p.steps.length) d.step = p.steps.length - 1;
  const step = p.steps[d.step];
  const cls = p.cls;
  let body = "";

  if (step.id === "hp") {
    const die = c.hitDice.die || 8, conMod = abilityMod(c.abilities.con);
    body = `<p>Each level adds hit points: one d${die} plus your Constitution modifier (${fmtMod(conMod)}).</p>
      <div class="lvl-choice-row">
        <button class="bigchoice" data-a="lvlHp" data-mode="avg" aria-pressed="${d.hpMode === "avg"}"><b>+${hpAverageGain(die, conMod)}</b><span>Take the average</span></button>
        <button class="bigchoice" data-a="lvlHp" data-mode="roll" aria-pressed="${d.hpMode === "roll"}"><b>${d.rolled ? "+" + Math.max(1, d.rolled + conMod) : "d" + die}</b><span>${d.rolled ? `Rolled ${d.rolled} ${fmtMod(conMod)}` : "Roll for it"}</span></button>
      </div>
      <p class="sub2" style="margin-top:10px">Rolling can beat the average or fall short. You only get one roll.</p>`;
  }

  else if (step.id === "subclass") {
    const subs = subclassesFor(L, c.class).slice().sort((a, b) => a.name.localeCompare(b.name));
    body = `<p class="small muted">Your subclass shapes the rest of your ${esc(c.class)} levels.</p><div class="optlist">` + subs.map(s => {
      const on = d.subclass === s.name;
      const intro = (s.features || []).find(f => f.intro) || (s.features || [])[0];
      const now = (s.features || []).filter(f => f.lv === d.next && !f.intro).map(f => f.name);
      return `<div><button class="optcard" data-a="lvlSubclass" data-name="${esc(s.name)}" aria-pressed="${on}">
          <span class="grow"><b>${esc(s.name)}</b><span>${esc(s.source || "")}${now.length ? " · gains " + esc(now.join(", ")) : ""}</span></span>${on ? `<span class="tag amber">Chosen</span>` : ""}</button>
        ${on && intro ? `<div class="about"><div class="clip">${formatText(intro.text)}</div></div>` : ""}</div>`;
    }).join("") + `</div>`;
  }

  else if (step.id === "asi") {
    const res = asiResult(c, d);
    body = `<div class="seg" role="group"><button data-a="lvlAsiMode" data-v="asi" aria-pressed="${d.asiMode === "asi"}">Raise abilities</button>
        <button data-a="lvlAsiMode" data-v="feat" aria-pressed="${d.asiMode === "feat"}">Take a feat</button></div>`;
    if (d.asiMode === "asi") {
      body += `<div class="seg" style="margin-top:10px" role="group"><button data-a="lvlAsiSplit" data-v="2" aria-pressed="${d.asiSplit === "2"}">+2 to one</button>
          <button data-a="lvlAsiSplit" data-v="11" aria-pressed="${d.asiSplit === "11"}">+1 to two</button></div>
        <div class="grid3" style="margin-top:12px">${ABILITIES.map(a => {
          const picked = d.asiSplit === "2" ? d.a2 === a : (d.a1a === a || d.a1b === a);
          const capped = c.abilities[a] >= 20;
          return `<button class="abil ${picked ? "picked" : ""}" data-a="lvlAsiPick" data-ab="${a}" ${capped && !picked ? "disabled" : ""}>
            <span class="an">${ABILITY_LABEL[a]}</span><span class="am" style="display:block">${res[a]}</span>
            <span class="as">${res[a] !== c.abilities[a] ? `was ${c.abilities[a]}` : capped ? "max 20" : fmtMod(abilityMod(res[a]))}</span></button>`;
        }).join("")}</div>
        <p class="sub2" style="margin-top:10px">Scores can't go above 20.</p>`;
    } else {
      body += `<div style="margin-top:12px">${searchBox("lvl", d.query, "Search feats")}</div>
        <div class="optlist" id="lvl-results">${renderLevelResults(app)}</div>`;
    }
  }

  else if (step.id === "style") {
    const styles = enabledFeats(L, app.campaign).filter(f => /^Fighting Style Feat/i.test(f.type || "") && !c.feats.includes(f.name));
    body = `<div class="optlist" style="margin-top:0">` + styles.map(f => {
      const on = d.style === f.name;
      return `<div><button class="optcard" data-a="lvlStyle" data-name="${esc(f.name)}" aria-pressed="${on}"><span class="grow"><b>${esc(f.name)}</b></span>${on ? `<span class="tag amber">Chosen</span>` : ""}</button>
        ${on ? `<div class="about">${formatText(f.text)}</div>` : ""}</div>`;
    }).join("") + `</div>`;
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
      <div class="optlist">${pickList(ws, d.mastery, "lvlMastery", { max: step.n, render: w => `${esc(w.mastery)} · ${esc(w.cat || "")} ${esc(w.kind || "")}` })}</div>`;
  }

  else if (step.id === "options") {
    const g = step.group;
    const have = c.choices[g.key] || [];
    const picked = new Set([...have, ...d.options]);
    const opts = g.options.filter(o => !have.includes(o.name));
    body = `<p class="small muted">Pick ${step.n}. ${d.options.length}/${step.n} chosen. Tap one to read it.</p>
      <div class="optlist">${opts.map(o => {
        const pre = optionPrereq(o);
        const lockedLevel = pre.level > d.next;
        const missing = pre.needs.filter(n => !picked.has(n) && g.options.some(x => x.name === n));
        const off = lockedLevel ? `Needs level ${pre.level}` : missing.length ? `Needs ${missing.join(", ")}` : null;
        const on = d.options.includes(o.name);
        return `<div><button class="optcard" data-a="lvlOption" data-name="${esc(o.name)}" aria-pressed="${on}" ${off || (!on && d.options.length >= step.n) ? "disabled" : ""}>
            <span class="grow"><b>${esc(o.name)}</b><span>${esc(off || pre.text || "No prerequisite")}</span></span>${on ? `<span class="tag amber">Chosen</span>` : ""}</button>
          ${on || d.open === o.name ? `<div class="about"><div class="clip">${formatText(o.text)}</div></div>` : ""}</div>`;
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
    if (d.asiMode === "feat" && d.feat) lines.push(["Feat", d.feat]);
    if (d.asiMode === "asi" && (d.a2 || d.a1a)) { const r = asiResult(c, d); lines.push(["Abilities", ABILITIES.filter(a => r[a] !== c.abilities[a]).map(a => `${ABILITY_LABEL[a]} ${c.abilities[a]} → ${r[a]}`).join(", ")]); }
    if (d.style) lines.push(["Fighting style", d.style]);
    if (d.expertise.length) lines.push(["Expertise", d.expertise.map(id => SKILLS.find(s => s.id === id).label).join(", ")]);
    if (d.mastery.length) lines.push(["Weapon mastery", d.mastery.join(", ")]);
    if (d.options.length) lines.push([p.steps.find(s => s.id === "options")?.label || "Choices", d.options.join(", ")]);
    if (d.cantrips.length) lines.push(["Cantrips", d.cantrips.join(", ")]);
    if (d.spells.length) lines.push(["Spells", d.spells.join(", ")]);
    const oldSlots = slotRows(c.class, c.level).map(r => r.max).join("/"), newSlots = slotRows(c.class, d.next).map(r => r.max).join("/");
    if (!d.fromCreation && oldSlots !== newSlots) lines.push(["Spell slots", `${oldSlots || "none"} → ${newSlots}`]);
    const feats = p.features;
    body = `<dl class="kv">${lines.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("") || "<dt>Changes</dt><dd>None to choose this level.</dd>"}</dl>
      ${feats.length ? `<p class="lab" style="margin-top:6px">New features</p><div>${feats.map(f => `<button class="rowline rollable" data-a="showDetail" data-kind="${f.kind}" data-name="${esc(f.name)}" data-from="${esc(f.from)}"><span class="nm">${esc(f.name)}</span><span class="sub2">${f.from === c.class ? "" : esc(f.from)}</span></button>`).join("")}</div>`
        : p.open ? `<p class="sub2">Your rules data stops at level 10, so new features for level ${d.next} aren't listed. Add them from your book.</p>` : ""}`;
  }

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
