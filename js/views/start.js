// New character: the start menu (build it, random, load), the random screen with locks, and the load/preview screen.
import { esc, topbar, ICONS } from "../ui.js";
import { enabledClasses, enabledSpecies, enabledBackgrounds } from "../data.js";
import { describeDraft } from "../templates.js";
import { validateAll } from "../creation.js";

export const rndDefault = () => ({ lock: { class: false, species: false, background: false, name: false }, scores: "suggested" });
export const loadDefault = () => ({ preview: null, error: "", text: "" });

const OPTION = (ic, title, text, action) => `<button class="cx-opt" data-a="${action}"><span class="cx-opt-ic" aria-hidden="true">${ic}</span><span class="cx-opt-t"><b>${esc(title)}</b><span>${esc(text)}</span></span><span class="cx-opt-go" aria-hidden="true">&rsaquo;</span></button>`;

export function startMenu(app) {
  return `${topbar("New character", "Choose how to start", { back: "startBack" })}
    <main class="wrap page cx-start">
      ${OPTION(ICONS.edit, "Build it step by step", "Choose your class, species and background yourself, one choice at a time.", "startManual")}
      ${OPTION(ICONS.dice, "Random character", "Roll a character, lock the parts you want to keep, and roll the rest again.", "startRandom")}
      ${OPTION(ICONS.scroll, "Load a template or character", "Open a file or code someone sent you, check it, then change it or create it.", "startLoad")}
    </main>`;
}

export function randomScreen(app) {
  const d = app.createDraft, r = app.rnd, L = app.library, C = app.campaign;
  const info = describeDraft(d, app);
  const row = (key, label, names) => {
    const locked = r.lock[key];
    return `<div class="rnd-row${locked ? " on" : ""}">
      <div class="rnd-main"><span class="rnd-k">${label}</span><b class="rnd-v">${esc(d[key] || "None")}</b></div>
      <select class="f rnd-sel" data-a="rndPick" data-k="${key}" aria-label="Choose a ${label.toLowerCase()}">${names.map(n => `<option ${n === d[key] ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      <button class="rnd-btn" data-a="rndReroll" data-k="${key}" aria-label="Roll a new ${label.toLowerCase()}" ${locked ? "disabled" : ""}>${ICONS.dice}</button>
      <button class="rnd-btn lock" data-a="rndLock" data-k="${key}" aria-pressed="${locked}" aria-label="${locked ? "Unlock" : "Lock"} ${label.toLowerCase()}">${locked ? "Locked" : "Lock"}</button>
    </div>`;
  };
  const nm = r.lock.name;
  const scoreBtn = (v, t) => `<button data-a="rndScores" data-v="${v}" aria-pressed="${r.scores === v}">${t}</button>`;
  return `${topbar("Random character", "Lock what you want to keep", { back: "startMenu" })}
    <main class="wrap page cx-rnd">
      <button class="btn pri block" data-a="rndAgain">Roll again (keeps locked parts)</button>
      <div class="panel" style="margin-top:12px"><div class="panel-body">
        ${row("class", "Class", enabledClasses(L, C).map(x => x.name))}
        ${row("species", "Species", enabledSpecies(L, C).map(x => x.name))}
        ${row("background", "Background", enabledBackgrounds(L, C).map(x => x.name))}
        <div class="rnd-row${nm ? " on" : ""}"><div class="rnd-main"><span class="rnd-k">Name</span>
          <input class="f" data-rnd-name maxlength="60" value="${esc(d.name)}" autocomplete="off" aria-label="Character name"></div>
          <button class="rnd-btn" data-a="rndName" aria-label="Roll a new name" ${nm ? "disabled" : ""}>${ICONS.dice}</button>
          <button class="rnd-btn lock" data-a="rndLock" data-k="name" aria-pressed="${nm}">${nm ? "Locked" : "Lock"}</button></div>
        <div class="rnd-row"><div class="rnd-main"><span class="rnd-k">Ability scores</span></div>
          <div class="seg" role="group" aria-label="How to set ability scores">${scoreBtn("suggested", "Suggested")}${scoreBtn("standard", "Standard array")}${scoreBtn("roll", "Roll 4d6")}</div></div>
      </div></div>
      <div class="panel cx-sum"><div class="panel-head"><h2>${esc(d.name || "Unnamed")}</h2></div><div class="panel-body">
        <p>Level 1 ${esc(info.line)}</p>
        <div class="cx-scores">${info.scores.map(([k, v]) => `<span><b>${v}</b>${k}</span>`).join("")}</div>
      </div></div>
      <div class="stack" style="margin-top:12px">
        <button class="btn pri block" data-a="finishCreate">Create character</button>
        <button class="btn block" data-a="rndBuilder">Open in the builder to change more</button>
        <div class="btnrow"><button class="btn" data-a="tplSave">Save as a template</button><button class="btn" data-a="tplCopy">Copy a code</button></div>
      </div>
    </main>`;
}

export function loadScreen(app) {
  const s = app.load, p = s.preview;
  if (!p) return `${topbar("Load", "A template or a character file", { back: "startMenu" })}
    <main class="wrap page">
      <p class="small muted">A template holds the choices of a character that was not created yet. A character file holds a finished one. Both are made with Save or Export in this app.</p>
      <label class="btn pri block" style="text-align:center">Choose a file<input type="file" accept=".json,application/json,text/plain" data-load-file hidden></label>
      <label class="field" style="margin-top:14px"><span class="lab">Or paste a code</span><textarea class="f mono" id="load-code" rows="4" placeholder="CRT1...." spellcheck="false">${esc(s.text)}</textarea></label>
      <button class="btn block" data-a="loadCode">Preview the code</button>
      ${s.error ? `<p class="small lrwarn" role="alert">${esc(s.error)}</p>` : ""}
    </main>`;
  if (p.type === "template") {
    const d = p.draft, info = describeDraft(d, app), v = validateAll(d, app).valid;
    return `${topbar("Template", p.name, { back: "loadBack" })}
      <main class="wrap page">
        <div class="panel cx-sum"><div class="panel-body">
          <label class="field"><span class="lab">Name</span><input class="f" data-load-name maxlength="60" value="${esc(d.name)}" autocomplete="off" placeholder="Name your character"></label>
          <p>Level 1 ${esc(info.line)}</p>
          ${info.scores.length ? `<div class="cx-scores">${info.scores.map(([k, n]) => `<span><b>${n}</b>${k}</span>`).join("")}</div>` : ""}
          <p class="sub2">Saved at the step: ${esc(info.chapter)}</p>
          ${v ? "" : `<p class="sub2 lrwarn">Not finished yet. Open it in the builder to choose what is missing.</p>`}
        </div></div>
        <div class="stack" style="margin-top:12px">
          <button class="btn pri block" data-a="loadCreate" ${v ? "" : "disabled"}>Create character</button>
          <button class="btn block" data-a="loadEdit">Change it in the builder</button>
          <button class="btn ghost block" data-a="loadBack">Choose something else</button>
        </div>
      </main>`;
  }
  return `${topbar("Character file", `${p.chars.length} character${p.chars.length === 1 ? "" : "s"}`, { back: "loadBack" })}
    <main class="wrap page">
      <div class="panel"><div class="panel-body flush">${p.chars.map((c, i) => `<div class="rowline"><span class="nm" style="flex-direction:column;align-items:flex-start;gap:0"><span>${esc(c.name || "Unnamed")}</span><span class="sub2">Level ${esc(c.level || 1)} ${esc([c.species, c.class].filter(Boolean).join(" "))}</span></span></div>`).join("")}</div></div>
      <p class="small muted">They are added as new characters. Anything you already have stays as it is.</p>
      <div class="stack" style="margin-top:12px">
        <button class="btn pri block" data-a="loadAdd">Add to my characters</button>
        <button class="btn ghost block" data-a="loadBack">Choose something else</button>
      </div>
    </main>`;
}
