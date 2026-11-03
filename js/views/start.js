// New character: the start menu (build it, random, load), the random screen with locks, and the load/preview screen.
import { esc, topbar, ICONS } from "../ui.js";
import { enabledClasses, enabledSpecies, enabledBackgrounds } from "../data.js";
import { describeDraft } from "../templates.js";
import { validateAll } from "../creation.js";

export const rndDefault = () => ({ lock: { class: false, species: false, background: false, name: false }, scores: "suggested" });
export const loadDefault = () => ({ preview: null, error: "", text: "" });

const OPTION = (ic, title, action) => `<button class="cx-opt" data-a="${action}"><span class="cx-opt-ic" aria-hidden="true">${ic}</span><span class="cx-opt-t"><b>${esc(title)}</b></span><span class="cx-opt-go" aria-hidden="true">&rsaquo;</span></button>`;

export function startMenu(app) {
  return `${topbar("New character", "", { back: "startBack" })}
    <main class="wrap page cx-start">
      ${OPTION(ICONS.edit, "Manual", "startManual")}
      ${OPTION(ICONS.dice, "Random", "startRandom")}
      ${OPTION(ICONS.scroll, "Load", "startLoad")}
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
  return `${topbar("Random", "", { back: "startMenu" })}
    <main class="wrap page cx-rnd">
      <button class="btn pri block" data-a="rndAgain">Reroll</button>
      <div class="panel" style="margin-top:12px"><div class="panel-body">
        ${row("class", "Class", enabledClasses(L, C).map(x => x.name))}
        ${row("species", "Species", enabledSpecies(L, C).map(x => x.name))}
        ${row("background", "Background", enabledBackgrounds(L, C).map(x => x.name))}
        <div class="rnd-row${nm ? " on" : ""}"><div class="rnd-main"><span class="rnd-k">Name</span></div>
          <input class="f" data-rnd-name maxlength="60" value="${esc(d.name)}" autocomplete="off" aria-label="Character name">
          <button class="rnd-btn" data-a="rndName" aria-label="Roll a new name" ${nm ? "disabled" : ""}>${ICONS.dice}</button>
          <button class="rnd-btn lock" data-a="rndLock" data-k="name" aria-pressed="${nm}">${nm ? "Locked" : "Lock"}</button></div>
        <div class="rnd-row"><div class="rnd-main"><span class="rnd-k">Scores</span></div>
          <div class="seg" role="group" aria-label="How to set ability scores">${scoreBtn("suggested", "Suggested")}${scoreBtn("standard", "Array")}${scoreBtn("roll", "4d6")}</div></div>
      </div></div>
      <div class="panel cx-sum"><div class="panel-head"><h2>${esc(d.name || "Unnamed")}</h2></div><div class="panel-body">
        <p>Level 1 ${esc(info.line)}</p>
        <div class="cx-scores">${info.scores.map(([k, v]) => `<span><b>${v}</b>${k}</span>`).join("")}</div>
      </div></div>
      <div class="stack" style="margin-top:12px">
        <button class="btn pri block" data-a="finishCreate">Create</button>
        <button class="btn block" data-a="rndBuilder">Builder</button>
        <div class="btnrow"><button class="btn" data-a="tplSave">Save</button><button class="btn" data-a="tplCopy">Code</button></div>
      </div>
    </main>`;
}

export function loadScreen(app) {
  const s = app.load, p = s.preview;
  if (!p) return `${topbar("Load", "", { back: "startMenu" })}
    <main class="wrap page">
      <label class="btn pri block" style="text-align:center">File<input type="file" accept=".json,application/json,text/plain" data-load-file hidden></label>
      <label class="field" style="margin-top:14px"><span class="lab">Code</span><textarea class="f mono" id="load-code" rows="4" placeholder="CRT1..." spellcheck="false">${esc(s.text)}</textarea></label>
      <button class="btn block" data-a="loadCode">Preview</button>
      ${s.error ? `<p class="small lrwarn" role="alert">${esc(s.error)}</p>` : ""}
    </main>`;
  if (p.type === "template") {
    const d = p.draft, info = describeDraft(d, app), v = validateAll(d, app).valid;
    return `${topbar("Template", p.name, { back: "loadBack" })}
      <main class="wrap page">
        <div class="panel cx-sum"><div class="panel-body">
          <label class="field"><span class="lab">Name</span><input class="f" data-load-name maxlength="60" value="${esc(d.name)}" autocomplete="off"></label>
          <p>Level 1 ${esc(info.line)}</p>
          ${info.scores.length ? `<div class="cx-scores">${info.scores.map(([k, n]) => `<span><b>${n}</b>${k}</span>`).join("")}</div>` : ""}
          ${v ? "" : `<p class="sub2 lrwarn">Incomplete</p>`}
        </div></div>
        <div class="stack" style="margin-top:12px">
          <button class="btn pri block" data-a="loadCreate" ${v ? "" : "disabled"}>Create</button>
          <button class="btn block" data-a="loadEdit">Edit</button>
          <button class="btn ghost block" data-a="loadBack">Back</button>
        </div>
      </main>`;
  }
  return `${topbar("Character file", `${p.chars.length}`, { back: "loadBack" })}
    <main class="wrap page">
      <div class="panel"><div class="panel-body flush">${p.chars.map(c => `<div class="rowline"><span class="nm" style="flex-direction:column;align-items:flex-start;gap:0"><span>${esc(c.name || "Unnamed")}</span><span class="sub2">Level ${esc(c.level || 1)} ${esc([c.species, c.class].filter(Boolean).join(" "))}</span></span></div>`).join("")}</div></div>
      <div class="stack" style="margin-top:12px">
        <button class="btn pri block" data-a="loadAdd">Add</button>
        <button class="btn ghost block" data-a="loadBack">Back</button>
      </div>
    </main>`;
}
