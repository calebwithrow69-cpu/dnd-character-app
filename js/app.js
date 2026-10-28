import { loadData, checkForUpdates, findByName, allWeapons, allItems, LockedError, unlockWithPassword, normalizeSubclass } from "./data.js";
import * as store from "./store.js";
import { feedback, sfx, setSfxEnabled, setHaptics, setVolume, preloadSamples } from "./sfx.js";
import { mountHp, unmountHp, applyHp as hpFx } from "./hpbar.js";
import { findTile } from "./views/character.js";
import { turnBlock } from "./combat.js";
import { VERSION } from "./changelog.js";
import { loadPortraits, savePortrait, removePortrait, importPortraits, portraitsBroken } from "./portraits.js";
import { spUiDefault, favKey } from "./views/codex.js";
import { renderDm, dmActions, dmListHtml } from "./views/dm.js";
import { applyPatch, loadPatch } from "./dm.js";
import { toast, platform, setGlossary, glossaryEntry, formatText, esc, ICONS, conditionIcon } from "./ui.js";
import { renderRoster, renderUnlock } from "./views/roster.js";
import { renderHome, renderRulesPage, playTomeOpen, lastCharacter } from "./views/home.js";
import { promptInstall, downloadShortcut, appUrl } from "./install.js";
import { renderCreate, renderWizardResults, listItems, chapterId, reachIndex, prepareChoiceContext } from "./views/create.js";
import {
  CHAPTERS, ALIGNMENTS, blankDraft, saveDraft, loadDraft, clearDraft, validateChapter, validateAll, buildCharacter,
  bgAbilities, classSkillOptions, takenSkills, suggestedArray, gearChoices, finalAbilities,
  choicePlan, rollAndLock, applySuggestedArray, applyStandardArray, generateRandom,
  pickSpecies as mPickSpecies, pickClass as mPickClass, pickBackground as mPickBackground
} from "./creation.js";
import { draftChoices, randomize, optionsFor, syncLineageSpells, lineageSpells } from "./choices.js";
import { renderSheet, renderSpellResults, renderGearResults, renderRulesResults, needsFirstChoices, detailFor } from "./views/sheet.js";
import { flourish, toneFor } from "./subtone.js";
import { subList as scList } from "./views/subclass.js";
import { setSpellNames } from "./ui.js";
import { renderModal, renderRollCard, renderShopResults, shopPrice } from "./views/modals.js";
import { shopStock, pay, fmtPrice } from "./equipment.js";
import { renderLevelUp, renderLevelResults, newLevelDraft, plan as levelPlan, stepValid, asiResult, featDef } from "./views/levelup.js";
import { syncCustom, loadCustom, saveCustom, blankCustom, customValid } from "./custombg.js";
import { featAbilityIncrease, applyFeat, featHp, ASI_FEAT } from "./featfx.js";
import { stepValidFor } from "./progression.js";
import { downloadSheetPdf } from "./pdf.js";
import { featUiDefault } from "./views/feats.js";
import { SLOTS, ARMOR, itemById, fits, fitsOk, slotOf, slotsOf, wearKind, attunedCount, makeItem } from "./gear.js";
import { rollFormula, rollD20, describeGroups, spin } from "./dice.js";
import { analyzeSpell, castDice } from "./spells.js";
import {
  deriveCharacter, weaponNumbers, abilityMod, fmtMod, ABILITY_LABEL, SKILLS, slotRows,
  standardArray, roll4d6DropLowest, hpAverageGain, rollDie, ABILITIES, primaryAbility, xpForLevel
} from "./rules.js";

const LS_PREFS = "dnd-prefs-v1";
const LS_INSTALL = "dnd-install-dismissed";

const APP = {
  info: new Set(), spUi: spUiDefault(), featUi: featUiDefault(),
  screen: "loading", library: null, campaign: null,
  char: null, sheetTab: "stats", charSub: "combat", combatFilter: "All", combatSort: "avail", featFilter: "All", featSort: "level",
  turn: { on: false, round: 0, spent: {} }, gwm: false, concPrompt: null, createDraft: null, seedGandork: null,
  roll: null, history: [], diceFormula: "",
  modal: null, pickerQuery: "", pickerLevel: null, pickerAllClasses: false, rulesQuery: "",
  glossaryCat: "", glossaryClass: "", glossarySubclass: "",
  setOpen: new Set(["appearance", "feel"]),
  prefs: readPrefs(), installDismissed: readFlag(LS_INSTALL), persisted: false
};
window.APP = APP; // handy from the browser console

const mount = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
const rollRoot = document.getElementById("roll-root");

function readPrefs() { try { return JSON.parse(localStorage.getItem(LS_PREFS) || "{}"); } catch (e) { return {}; } }
function readFlag(k) { try { return localStorage.getItem(k) === "1"; } catch (e) { return false; } }
function savePrefs() { try { localStorage.setItem(LS_PREFS, JSON.stringify(APP.prefs)); } catch (e) { } }
let wakeLock = null;
async function syncWake() {
  try {
    if (APP.prefs.wake && "wakeLock" in navigator && !document.hidden) {
      if (!wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
    } else if (wakeLock) { const w = wakeLock; wakeLock = null; await w.release(); }
  } catch (e) { wakeLock = null; }
}
function applyPrefs() {
  const root = document.documentElement;
  APP.turn.on = !!APP.prefs.turns;
  const setAttr = (n, on, v) => { if (on) root.setAttribute(n, v); else root.removeAttribute(n); };
  setAttr("data-contrast", APP.prefs.contrast === "high", "high");
  setAttr("data-font", APP.prefs.font === "plain", "plain");
  setAttr("data-motion", APP.prefs.motion === "reduced", "reduced");
  setAttr("data-tap", !!APP.prefs.bigtap, "big");
  setHaptics(APP.prefs.haptics !== "off");
  setVolume(APP.prefs.vol == null ? 70 : APP.prefs.vol);
  syncWake();
  const t = APP.prefs.theme;
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t); else root.removeAttribute("data-theme");
  if (APP.prefs.size && APP.prefs.size !== "normal") root.setAttribute("data-size", APP.prefs.size); else root.removeAttribute("data-size");
  setSfxEnabled(APP.prefs.sfx !== "off");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue("--panel").trim() || "#1E1816";
}

// ---------------- boot ----------------
async function init() {
  applyPrefs();
  window.__booted = true;
  window.__boot && window.__boot(15, "Starting up");
  try {
  window.__boot && window.__boot(30, "Loading the rules");
    const { library, campaign, pendingLock } = await loadData();
  window.__boot && window.__boot(70, "Reading the rules");

    APP.rawLibrary = library; APP.rawCampaign = campaign; setRules();
    loadPortraits().then(() => { if (APP.screen === "create") spRefresh(); });
    if (pendingLock) { APP.lockErr = pendingLock; APP.needsNewPassword = true; }
    window.__boot && window.__boot(82, "Building the glossary");
    await rebuildGlossary();
    window.__boot && window.__boot(94, "Opening your characters");
  } catch (e) {
    if (e instanceof LockedError) {
      APP.lockErr = e; APP.screen = "locked";
      if (!APP._eventsBound) { bindEvents(); bindDrag(); bindTerms(); bindContext(); APP._eventsBound = true; }
      render(); setTimeout(() => document.getElementById("f-pass")?.focus(), 50);
      return;
    }
    mount.innerHTML = `<div class="empty"><h3>Can't load the rules yet</h3><p>The very first time, this app needs an internet connection. Connect to Wi-Fi or data and try again — after that it works offline.</p><p style="margin-top:14px"><button class="btn pri" onclick="location.reload()">Try again</button></p></div>`;
    return;
  }

  if (APP.prefs.seenVersion !== VERSION) {
    const first = !APP.prefs.seenVersion;
    APP.prefs.seenVersion = VERSION; savePrefs();
    if (!first) setTimeout(() => toast("Updated to " + VERSION + ". See Settings > What's new."), 800);
  }

  fetch("data/seed-gandork.json").then(r => (r.ok ? r.json() : null)).then(d => { APP.seedGandork = d; if (APP.screen === "roster" || APP.screen === "home") render(); }).catch(() => { });

  APP.screen = "home";
  { const dr = loadDraft(); if (dr && typeof dr.chapter === "number" && dr.base && dr.picks) { APP.createDraft = dr; APP.screen = "create"; } }

  if (!APP._eventsBound) { bindEvents(); bindDrag(); bindTerms(); bindContext(); APP._eventsBound = true; }
  render();

  const recheck = (manual) => checkForUpdates({ library: APP.rawLibrary, campaign: APP.rawCampaign }, (fresh) => {
    APP.rawLibrary = fresh.library; APP.rawCampaign = fresh.campaign; setRules(); rebuildGlossary();
    toast(fresh.changed.includes("campaign") ? "Your DM updated the campaign rules" : "Rules data updated");
    render();
  }, (err) => { APP.lockErr = err; APP.needsNewPassword = true; render(); }).then(() => { if (manual === true) toast(navigator.onLine ? "Checked — you're up to date" : "You're offline right now"); });
  APP.recheck = recheck;
  if (!APP._listening) {
    APP._listening = true;
    window.addEventListener("online", () => APP.recheck());
    window.addEventListener("cr-install-change", () => render());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { APP.recheck(); syncWake(); } else save(); });
    document.addEventListener("toggle", e => { const t = e.target; if (t && t.matches && t.matches("details.setsec")) { if (t.open) APP.setOpen.add(t.dataset.sec); else APP.setOpen.delete(t.dataset.sec); } }, true);
    window.addEventListener("pagehide", save);
  }
  recheck();
  store.requestPersistence().then(p => { APP.persisted = !!p; }).catch(() => { });
  if (navigator.storage?.persisted) navigator.storage.persisted().then(p => { APP.persisted = p; }).catch(() => { });
}

// ---------------- render ----------------
const FOCUS_KEYS = ["itemField", "weaponField", "edit", "editAbility", "ac", "coin", "field", "itemNotes", "modal", "query", "draft", "draftAbility"];
function focusSelector(el) {
  if (!isTextish(el) && el?.tagName !== "SELECT") return null;
  if (el.id) return "#" + CSS.escape(el.id);
  for (const k of FOCUS_KEYS) if (el.dataset[k] != null) return `[data-${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}="${CSS.escape(el.dataset[k])}"]`;
  return null;
}
// The rules everyone gets, plus this device's DM edits (if any) on top.
function setRules() {
  const r = applyPatch(APP.rawLibrary, APP.rawCampaign, loadPatch());
  APP.library = { ...r.library, subclasses: (r.library.subclasses || []).map(sc => ({ ...sc, features: normalizeSubclass(sc) })) };
  APP.campaign = r.campaign; APP._rulesIndex = null;
  syncCustom(APP.library);
}
function render() {
  const ae = document.activeElement, fsel = focusSelector(ae);
  const caret = fsel && isTextish(ae) ? [ae.selectionStart, ae.selectionEnd] : null;
  pendingRender = false;
  renderNow();
  if (fsel) {
    const el = document.querySelector(fsel);
    if (el && el !== document.activeElement) { el.focus({ preventScroll: true }); if (caret && el.setSelectionRange) try { el.setSelectionRange(caret[0], caret[1]); } catch (e) { } }
  }
}
function renderNow() {
  if (window.__boot) window.__boot(100);
  const mb = modalRoot.querySelector(".modal-body"), rs = document.querySelector(".results");
  const keep = { modal: mb ? mb.scrollTop : 0, results: rs ? rs.scrollTop : 0, modalType: APP._lastModalType };

  if (APP.screen === "locked") { mount.innerHTML = renderUnlock(APP); modalRoot.innerHTML = ""; rollRoot.innerHTML = ""; return; }
  if (APP.screen === "home") mount.innerHTML = renderHome(APP);
  else if (APP.screen === "rules") mount.innerHTML = renderRulesPage(APP);
  else if (APP.screen === "roster") mount.innerHTML = renderRoster(APP);
  else if (APP.screen === "dm" && APP.dm) mount.innerHTML = renderDm(APP);
  else if (APP.screen === "create") { prepareChoiceContext(APP); mount.innerHTML = renderCreate(APP); if (APP.createDraft) saveDraft(APP.createDraft); }
  else if (APP.screen === "sheet" && APP.char) mount.innerHTML = renderSheet(APP);
  else if (APP.screen === "levelup" && APP.char && APP.lvl) mount.innerHTML = renderLevelUp(APP);

  // Entrance animations (modal drop-in, roll card, tab pop, chip pop) belong to a NEW view/modal/roll only.
  // Every action redraws the page, so repeat draws of the same thing are marked "still" and skip them.
  const viewKey = APP.screen + "|" + (APP.sheetTab || "") + "|" + (APP.char ? APP.char.id : "");
  mount.classList.toggle("still", viewKey === APP._viewKey); APP._viewKey = viewKey;
  document.documentElement.style.setProperty("--phase", (performance.now() / 1000).toFixed(2) + "s"); // keeps looping glints in step across redraws
  const nextType = APP.modal ? APP.modal.type + (APP.modal.picker || "") : null;
  const sameModal = !!nextType && nextType === keep.modalType;
  const rollOld = rollRoot.querySelector(".rollcard .in");
  const rollOldKey = rollOld ? rollOld.textContent : null;
  if (APP.modal && !document.body.classList.contains("modal-open")) document.documentElement.style.setProperty("--sbw", Math.max(0, window.innerWidth - document.documentElement.clientWidth) + "px"); // no sideways shift when the page scrollbar hides
  modalRoot.innerHTML = renderModal(APP);
  if (sameModal && modalRoot.firstElementChild) modalRoot.firstElementChild.classList.add("still");
  rollRoot.innerHTML = APP.screen === "sheet" ? renderRollCard(APP) : "";
  const rollNew = rollRoot.querySelector(".rollcard .in");
  if (rollNew && rollOldKey != null && rollNew.textContent === rollOldKey) rollRoot.classList.add("still"); else rollRoot.classList.remove("still");
  document.body.classList.toggle("modal-open", !!APP.modal);
  // keep toasts clear of whatever is pinned to the bottom (tab bar, roll card, wizard button)
  const card = rollRoot.querySelector(".rollcard .in"), bar = mount.querySelector("nav.tabs, .stickybar");
  const lift = (bar && bar.offsetWidth >= 200 ? bar.offsetHeight : 0) + (card ? card.offsetHeight + 8 : 0) + 12;
  document.documentElement.style.setProperty("--toast-lift", lift + "px");
  document.documentElement.style.setProperty("--page-lift", Math.max(96, lift + 24) + "px");

  const type = APP.modal ? APP.modal.type + (APP.modal.picker || "") : null;
  if (type && type === keep.modalType) {
    const nmb = modalRoot.querySelector(".modal-body"); if (nmb) nmb.scrollTop = keep.modal;
    const nrs = modalRoot.querySelector(".results"); if (nrs) nrs.scrollTop = keep.results;
  }
  APP._lastModalType = type;
  animateHp();
}

let persistAsked = false;
function save() {
  if (!APP.char || APP.screen === "create") return; // during creation APP.char is only a preview
  if (!store.saveCharacter(APP.char)) toast("Couldn't save — this device's storage is full or blocked");
  if (!persistAsked) { persistAsked = true; store.requestPersistence().then(p => { if (p) APP.persisted = true; }); }
}
function saveAndRender() { save(); render(); }

function openModal(m) {
  const wasOpen = !!APP.modal;
  APP.modal = m;
  if (!wasOpen) { try { history.pushState({ modal: true }, ""); } catch (e) { } }
  render();
  const first = modalRoot.querySelector("input[type=search], input.f:not([type=number])");
  if (first && (m.type === "picker")) setTimeout(() => first.focus({ preventScroll: true }), 30);
  if (m.type === "hp") setTimeout(() => document.getElementById("hp-amt")?.focus({ preventScroll: true }), 60);
}
function closeModal() {
  if (!APP.modal) return;
  if (APP._under) {
    APP.modal = APP._under; APP._under = null; render();
    const b = modalRoot.querySelector(".modal-body"); if (b) b.scrollTop = APP._underScroll || 0;
    return;
  }
  APP.modal = null;
  render();
  if (history.state && history.state.modal) { APP._ignorePop = true; history.back(); }
}

// ---------------- rolls ----------------
function pushHistory(title, summary) {
  APP.history.unshift({ title, summary });
  APP.history = APP.history.slice(0, 20);
}
function showRoll(title, parts, alt) {
  APP.roll = { title, parts, alt };
  pushHistory(title, parts.map(p => (parts.length > 1 ? p.label + " " : "") + p.total).join(" · "));
  render();
}
function d20Test(title, mod) {
  const exh = APP.char ? APP.char.exhaustion * 2 : 0;
  const eff = mod - exh;
  const r = rollD20(eff);
  const modTxt = eff ? ` ${eff > 0 ? "+" : "−"} ${Math.abs(eff)}` : "";
  showRoll(title, [{ label: r.crit ? "Natural 20!" : r.fumble ? "Natural 1" : "Result", total: r.total, bd: `[${r.first}]${modTxt}`, crit: r.crit, fumble: r.fumble }],
    `With advantage <b>${r.adv}</b> · with disadvantage <b>${r.dis}</b> <span class="sub2">(second die ${r.second})</span>${exh ? ` · includes −${exh} exhaustion` : ""}`);
  return r;
}

// ---------------- settings toggles ----------------
const PREF_TOGGLES = {
  sfx: { get: p => (p.sfx || "on") === "on", set: (p, v) => { p.sfx = v ? "on" : "off"; } },
  haptics: { get: p => p.haptics !== "off", set: (p, v) => { p.haptics = v ? "on" : "off"; } },
  wake: { get: p => !!p.wake, set: (p, v) => { p.wake = v; } },
  vignette: { get: p => p.vignette !== false, set: (p, v) => { p.vignette = v; } },
  contrast: { get: p => p.contrast === "high", set: (p, v) => { p.contrast = v ? "high" : "normal"; } },
  bigtap: { get: p => !!p.bigtap, set: (p, v) => { p.bigtap = v; } },
  turns: { get: p => !!p.turns, set: (p, v) => { p.turns = v; } },
  concprompt: { get: p => !!p.concprompt, set: (p, v) => { p.concprompt = v; if (!v) APP.concPrompt = null; } },
  gwm: { get: () => !!APP.gwm, set: (p, v) => { APP.gwm = v; } }
};

// ---------------- HP ----------------
function hpDamageFor(amt) {
  const r = APP.hpRes;
  return r === "resist" ? Math.floor(amt / 2) : r === "vuln" ? amt * 2 : amt;
}
function updateHpPreview() {
  const p = document.getElementById("hp-preview"), input = document.getElementById("hp-amt");
  if (!p || !input) return;
  const amt = parseInt(input.value, 10);
  p.textContent = amt > 0 && APP.hpRes && APP.hpRes !== "normal" ? `Damage taken: ${amt} becomes ${hpDamageFor(amt)}` : "";
}
function applyHp(mode) {
  const input = document.getElementById("hp-amt");
  let amt = parseInt(input && input.value, 10);
  if (!amt || amt < 0) { toast("Type an amount first"); input && input.focus(); return; }
  const c = APP.char, hp = c.hp;
  if (mode === "damage" && APP.hpRes && APP.hpRes !== "normal") {
    const taken = hpDamageFor(amt);
    if (taken <= 0) { toast(`Resistance cut ${amt} to 0 damage`); if (APP.modal && APP.modal.type === "hp") closeModal(); return; }
    toast(`${APP.hpRes === "resist" ? "Resisted" : "Vulnerable"}: ${amt} became ${taken}`);
    amt = taken;
  }
  APP._hpEvent = null;
  if (mode === "damage") {
    APP._hpEvent = { dealt: amt, tempSoaked: Math.min(hp.temp, hp.cur > 0 ? amt : 0) };
    if (hp.cur <= 0) {
      if (amt >= hp.max) { c.deathSaves.fail = 3; toast("Massive damage — that's death"); }
      else { c.deathSaves.fail = Math.min(3, c.deathSaves.fail + 1); toast(c.deathSaves.fail >= 3 ? "Third failure — that's death" : "Damage while down: one death save failure"); }
    } else {
      const fromTemp = Math.min(hp.temp, amt);
      hp.temp -= fromTemp;
      const rest = amt - fromTemp;
      const overflow = rest - hp.cur;
      hp.cur = Math.max(0, hp.cur - rest);
      if (hp.cur === 0) {
        c.concentration = null; APP.concPrompt = null;
        if (overflow >= hp.max) { c.deathSaves.fail = 3; toast("Massive damage — instant death"); }
        else toast("Down to 0 HP — start death saves");
      } else if (c.concentration && rest > 0) {
        const dc = Math.min(30, Math.max(10, Math.floor(amt / 2)));
        if (APP.prefs.concprompt) APP.concPrompt = { dc, conc: c.concentration };
        else toast(`Concentration check: Con save DC ${dc}`);
      }
    }
  } else if (mode === "heal") {
    if (hp.cur <= 0) c.deathSaves = { success: 0, fail: 0 };
    hp.cur = Math.min(hp.max, hp.cur + amt);
  } else {
    hp.temp = Math.max(hp.temp, amt);
    if (amt < hp.temp) toast("Temp HP don't stack — kept the higher amount");
  }
  if (input) input.value = "";
  if (APP.modal && APP.modal.type === "hp") { save(); closeModal(); } else saveAndRender();
}

// ---------------- backups ----------------
async function shareOrDownload(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const p = platform();
  if ((p.ios || p.android) && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Backup saved to your downloads");
}
function exportChars(ids, label) {
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = (label || "characters").replace(/[^\w-]+/g, "-").slice(0, 40);
  shareOrDownload(`character-runner-${safe}-${stamp}.json`, JSON.stringify(store.backupPayload(ids), null, 1));
}
function importPrompt() {
  const input = Object.assign(document.createElement("input"), { type: "file", accept: ".json,application/json,text/plain" });
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const chars = store.parseImport(text);
      chars.forEach(c => store.saveCharacter(store.normalize(c, APP.library)));
      const pics = await importPortraits(store.parsePortraits(text));
      toast(`Restored ${chars.length} character${chars.length === 1 ? "" : "s"}${pics ? ` and ${pics} portrait${pics === 1 ? "" : "s"}` : ""}`);
      APP.modal = null; APP.screen = "roster"; APP.char = null; store.setActiveId(null);
      render();
    } catch (e) { toast(e.message || "Couldn't read that file"); }
  };
  input.click();
}

// Redraw just the species list (keeps your place on the page) and the Next button
function spRefresh() {
  const r = document.getElementById("wizard-results");
  if (r && APP.createDraft) r.innerHTML = renderWizardResults(APP);
  if (APP.createDraft) refreshWizardChrome();
}

// The moment a major choice is committed: scale + amber glow + sparks + chime + buzz (about 1.2s).
// With reduced motion it is a static outline instead of movement.
function celebrate() {
  requestAnimationFrame(() => {
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    mount.querySelectorAll(".sp-row.on .sp-thumb").forEach(el => {
      el.classList.add("achieve");
      if (!calm) for (let i = 0; i < 12; i++) {
        const sp = document.createElement("span"); sp.className = "spark";
        const a = i / 12 * 6.283, dist = 36 + Math.random() * 40;
        sp.style.setProperty("--x", Math.cos(a) * dist + "px"); sp.style.setProperty("--y", Math.sin(a) * dist + "px");
        el.appendChild(sp);
      }
      setTimeout(() => { el.classList.remove("achieve"); el.querySelectorAll(".spark").forEach(x => x.remove()); }, 1250);
    });
    sfx("confirm");
    if (APP.prefs.haptics !== "off" && navigator.vibrate) { try { navigator.vibrate([12, 40, 18]); } catch (e) { } }
  });
}

// ---------------- events ----------------
function bindEvents() {
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("input", onInput);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("scroll", e => { const t = e.target; if (t && t.classList && t.classList.contains("scscroll")) t.classList.toggle("past", t.scrollTop > 150); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && APP.progressOpen) { APP.progressOpen = false; render(); } else if (e.key === "Escape" && APP.featUi && APP.featUi.open) { APP.featUi.open = null; render(); } else if (e.key === "Escape" && APP.modal) closeModal(); });
  window.addEventListener("popstate", () => {
    if (APP._ignorePop) { APP._ignorePop = false; return; }
    if (APP.modal) { APP.modal = null; render(); }
  });

  // Hidden: hold a die for about a second.
  let holdTimer = null;
  document.addEventListener("pointerdown", e => {
    const b = e.target.closest('[data-hold="egg"]');
    if (!b) return;
    holdTimer = setTimeout(() => { APP._suppressClick = true; openModal({ type: "slots" }); }, 900);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => document.addEventListener(ev, () => clearTimeout(holdTimer)));
  document.addEventListener("contextmenu", e => { if (e.target.closest(".diebtn")) e.preventDefault(); });
}

function onClick(e) {
  const el = e.target.closest("[data-a]");
  if (!el) return;
  if (el.tagName === "SELECT") return; // a dropdown acts when its value changes, not when it is tapped open
  if (APP._suppressClick && el.dataset.hold === "egg") { APP._suppressClick = false; return; }
  const a = el.dataset.a;
  if ((a === "closeModalBackdrop" || a === "closeProgressBackdrop" || a === "featCloseBackdrop") && e.target !== el) return;
  if (APP.prefs.wake && !wakeLock) syncWake();
  if (a !== "closeModalBackdrop" && a !== "closeProgressBackdrop" && a !== "featCloseBackdrop") feedback(el);
  const fn = ACTIONS[a];
  if (fn) fn(el, e);
}

function onSubmit(e) {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  if (form.dataset.form === "customRoll") ACTIONS.customRoll();
  if (form.dataset.form === "unlock") tryUnlock(document.getElementById("f-pass").value);
}

function bindContext() {
  document.addEventListener("contextmenu", e => {
    const el = e.target.closest && e.target.closest("[data-ctx-item]");
    if (el) { e.preventDefault(); openModal({ type: "itemMenu", id: el.dataset.ctxItem }); }
  });
  let t = 0, startEl = null;
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return;
    const el = e.target.closest && e.target.closest("[data-ctx-item]");
    if (!el || (e.target.closest && e.target.closest(".bag-menu"))) return;
    startEl = el; APP._lpFired = false;
    t = setTimeout(() => { APP._lpFired = true; try { navigator.vibrate && navigator.vibrate(12); } catch (x) {} openModal({ type: "itemMenu", id: el.dataset.ctxItem }); }, 450);
  }, true);
  const cancel = () => { if (t) { clearTimeout(t); t = 0; } startEl = null; };
  ["pointerup", "pointermove", "pointercancel"].forEach(ev => document.addEventListener(ev, cancel, true));
  // swallow the click that follows a long-press so it doesn't also open the menu
  document.addEventListener("click", e => { if (APP._lpFired) { APP._lpFired = false; const el = e.target.closest && e.target.closest("[data-a=itemCell]"); if (el) { e.preventDefault(); e.stopPropagation(); } } }, true);
}


function randomGear(d) {
  for (const g of gearChoices(APP, d)) if (!g.fixed && !d.picks[g.id]) d.picks[g.id] = g.options[Math.floor(Math.random() * g.options.length)];
}
function clearPicks(d, prefix) { Object.keys(d.picks || {}).forEach(k => { if (k.startsWith(prefix)) delete d.picks[k]; }); }
// +2 to the background ability the class wants most, +1 to another
function randomBonus(d) {
  const opts = bgAbilities(APP, d);
  if (!opts.length) return;
  const cls = findByName(APP.library.classes, d.class);
  const sug = suggestedArray(APP, d.class) || {};
  const ranked = [...opts].sort((a, b) => (sug[b] || 0) - (sug[a] || 0));
  const prim = primaryAbility(cls?.primary);
  d.bonusMode = "21";
  d.plus2 = opts.includes(prim) ? prim : ranked[0];
  d.plus1 = ranked.find(a => a !== d.plus2);
}
const NAME_A = ["Bram", "Cor", "Dag", "El", "Fen", "Gar", "Hal", "Isk", "Jor", "Kael", "Lir", "Mor", "Nym", "Os", "Pell", "Quin", "Ros", "Syl", "Tor", "Ul", "Vex", "Wren", "Yor", "Zan"];
const NAME_B = ["a", "en", "ith", "or", "ia", "ric", "wyn", "ak", "is", "ell", "ow", "ra", "un", "ex", "iel", "ard"];
const NAME_C = ["the Bold", "the Quiet", "of the Vale", "Ashborn", "Thornfield", "Blackwater", "Stonehand", "the Lucky", "Swiftfoot", "Greycloak", "", "", ""];
function randomName() {
  const r = l => l[Math.floor(Math.random() * l.length)];
  return `${r(NAME_A)}${r(NAME_B)} ${r(NAME_C)}`.trim();
}

function refreshWizardChrome() {
  const d = APP.createDraft;
  const btn = mount.querySelector('[data-a="nextStep"], [data-a="finishCreate"]');
  const v = validateChapter(chapterId(d), d, APP);
  if (btn) btn.disabled = !v.valid;
  const why = document.getElementById("wizard-why");
  if (why) why.textContent = v.valid ? "" : v.reasons.join(" ");
  const fin = finalAbilities(APP, d);
  ABILITIES.forEach(a => {
    const s = mount.querySelector(`[data-final="${a}"]`);
    if (s) s.textContent = `${fin[a] !== d.base[a] ? "\u2192 " + fin[a] + " " : ""}(${fmtMod(abilityMod(fin[a]))})`;
  });
  saveDraft(d);
}

function onInput(e) {
  const el = e.target, ds = el.dataset;
  if (el.id === "f-name" && APP.createDraft) { APP.createDraft.name = el.value; refreshWizardChrome(); return; }
  if (el.id === "f-formula") { APP.diceFormula = el.value; return; }
  if (el.id === "hp-amt") { updateHpPreview(); return; }
  if (ds.prefRange) {
    APP.prefs[ds.prefRange] = parseInt(el.value, 10) || 0; savePrefs(); setVolume(APP.prefs.vol);
    const h = el.closest(".setrow") && el.closest(".setrow").querySelector(".sethint");
    if (h) h.textContent = APP.prefs.vol + "%";
    return;
  }
  if (ds.query === "dmq" && APP.dm) { APP.dm.q = el.value; const l = document.getElementById("dm-list"); if (l) l.innerHTML = dmListHtml(APP); return; }
  if (el.id === "f-dmpin" && el.value.length === 4) { ACTIONS.dmPinGo(); return; }
  if (ds.setSearch) {
    const q = el.value.trim().toLowerCase();
    let any = false;
    document.querySelectorAll(".setsec").forEach(sec => {
      let n = 0;
      sec.querySelectorAll(".setrow").forEach(r => { const hit = !q || (r.dataset.s || "").includes(q); r.classList.toggle("hide", !hit); if (hit) n++; });
      sec.classList.toggle("hide", n === 0);
      if (q && n) sec.open = true;
      if (n) any = true;
    });
    const em = document.getElementById("set-empty"); if (em) em.classList.toggle("hide", any || !q);
    return;
  }
  if (ds.draftAbility && APP.createDraft) {
    const v = parseInt(el.value, 10);
    if (!isNaN(v)) APP.createDraft.base[ds.draftAbility] = Math.max(1, Math.min(30, v));
    refreshWizardChrome(); return;
  }
  if (ds.draftText && APP.createDraft) { APP.createDraft[ds.draftText] = el.value; refreshWizardChrome(); return; }
  if (ds.pickText && APP.createDraft) { APP.createDraft.picks[ds.pickText] = el.value; refreshWizardChrome(); return; }
  if (ds.query === "wizard") { APP.createDraft.query = el.value; const r = document.getElementById("wizard-results"); if (r) r.innerHTML = renderWizardResults(APP); return; }
  if (ds.query === "picker") {
    APP.pickerQuery = el.value;
    const r = document.getElementById("results-picker");
    if (r) r.innerHTML = APP.modal.picker === "spells" ? renderSpellResults(APP) : renderGearResults(APP, APP.modal.picker);
    return;
  }
  if (ds.query === "shop") { APP.shopQuery = el.value; const r = document.getElementById("results-shop"); if (r) r.innerHTML = renderShopResults(APP); return; }
  if (ds.query === "lvl" && APP.lvl) { APP.lvl.query = el.value; const r = document.getElementById("lvl-results"); if (r) r.innerHTML = renderLevelResults(APP); return; }
  if (ds.query === "rules") { APP.rulesQuery = el.value; if (el.value.trim()) { APP.glossaryClass = ""; APP.glossarySubclass = ""; } const r = document.getElementById("results-rules"); if (r) r.innerHTML = renderRulesResults(APP); return; }
  // Text on the sheet saves on every keystroke, so closing the app mid-sentence loses nothing.
  if (ds.field && APP.char && ["notes", "profsText", "languages", "classFeatureNotes"].includes(ds.field)) { APP.char[ds.field] = el.value; save(); return; }
  if (ds.itemNotes != null && APP.char) { const it = APP.char.inventory[+ds.itemNotes]; if (it) { it.notes = el.value; save(); } return; }
  if (ds.modal && APP.modal) { APP.modal[ds.modal] = el.value; return; }
}

function onChange(e) {
  const el = e.target, ds = el.dataset, c = APP.char;
  if (ds.spFile != null && el.files && el.files[0]) {
    const f = el.files[0], name = ds.spFile;
    savePortrait(name, f).then(saved => { spRefresh(); toast(saved ? `Image saved for ${name}` : `Showing for now, but this browser would not save it`); },
      err => toast(err.message || "Couldn't use that image"));
    return;
  }
  if (ds.dmFile != null && el.files && el.files[0]) { ACTIONS.dmImportFile(el.files[0]); el.value = ""; return; }
  // a <select> that names an action (e.g. Sort) runs it on change
  if (el.tagName === "SELECT" && ds.a && ACTIONS[ds.a]) { ACTIONS[ds.a](el); return; }
  if (ds.cb != null && APP.customBg) {
    const cb = APP.customBg, k = ds.cb, v = el.value;
    if (/^ab\d$/.test(k)) cb.abilities[+k[2]] = v; else if (/^sk\d$/.test(k)) cb.skills[+k[2]] = v; else cb[k] = v;
    render(); return;
  }
  if (ds.gearPick && APP.createDraft) { if (el.value) APP.createDraft.picks[ds.gearPick] = el.value; else delete APP.createDraft.picks[ds.gearPick]; render(); return; }
  if (ds.draft && APP.createDraft) { APP.createDraft[ds.draft] = el.value; if (ds.draft === "plus2" && APP.createDraft.plus1 === el.value) APP.createDraft.plus1 = ""; render(); return; }
  if (ds.draftAbility) { render(); return; }
  if (!c) return;
  if (ds.ac) {
    const v = el.value.trim();
    if (ds.ac === "armorName") c.ac.armorName = v;
    else if (ds.ac === "dexCap") c.ac.dexCap = v === "" ? null : Number(v);
    else c.ac[ds.ac] = Number(v) || 0;
    save(); afterFieldChange(el); return;
  }
  if (ds.itemField && APP.modal && APP.modal.type === "item") {
    const it = itemById(c, APP.modal.id), v = el.value, f = ds.itemField;
    if (f === "name") it.name = v.trim() || it.name;
    else if (f === "qty") it.qty = Math.max(0, parseInt(v, 10) || 0);
    else if (f === "slot") { if (v === "none") it.slot = "none"; else it.slot = v; }
    else if (f === "armorType") { if (v) it.armor = { type: v }; else delete it.armor; }
    else it[f] = parseInt(v, 10) || 0;
    recheckEquipped(); save(); afterFieldChange(el); return;
  }
  if (ds.weaponField && APP.modal && APP.modal.type === "item") {
    const w = itemById(c, APP.modal.id).weapon, f = ds.weaponField, v = el.value;
    w[f] = f === "magic" ? parseInt(v, 10) || 0 : f === "ability" ? (v || null) : v;
    recheckEquipped(); save(); afterFieldChange(el); return;
  }
  if (ds.coin) { c.coins[ds.coin] = Math.max(0, parseInt(el.value, 10) || 0); save(); return; }
  if (ds.editAbility) { c.abilities[ds.editAbility] = Math.max(1, Math.min(30, parseInt(el.value, 10) || 10)); save(); afterFieldChange(el); return; }
  if (ds.edit) {
    const v = el.value;
    if (ds.edit === "name") c.name = v.trim() || c.name;
    else if (ds.edit === "level") { c.level = Math.max(1, Math.min(20, parseInt(v, 10) || c.level)); c.hitDice.total = c.level; c.hitDice.spent = Math.min(c.hitDice.spent, c.level); }
    else if (ds.edit === "maxhp") { c.hp.max = Math.max(1, parseInt(v, 10) || c.hp.max); c.hp.cur = Math.min(c.hp.cur, c.hp.max); }
    else if (ds.edit === "speed" || ds.edit === "initBonus") c[ds.edit] = parseInt(v, 10) || 0;
    else c[ds.edit] = v;
    save(); afterFieldChange(el); return;
  }
  if (ds.modal && APP.modal) { APP.modal[ds.modal] = el.value; return; }
}

// After a typed field changes, redraw without destroying the box the person
// is clicking into next (that swallowed their click and felt like a freeze).
const isTextish = el => el && ((el.tagName === "INPUT" && !["checkbox", "radio", "button", "submit"].includes(el.type)) || el.tagName === "TEXTAREA");
function afterFieldChange(el) {
  if (modalRoot.contains(el)) {
    if (isTextish(el)) {
      renderBehind();
      const h = modalRoot.querySelector(".modal-head h2");
      if (h && APP.modal?.type === "item") { const it = itemById(APP.char, APP.modal.id); if (it) h.textContent = it.name; }
    } else render();
    return;
  }
  if (isTextish(el)) queueRender(); else render();
}
function renderBehind() {
  if (APP.screen === "sheet" && APP.char) mount.innerHTML = renderSheet(APP);
  rollRoot.innerHTML = APP.screen === "sheet" ? renderRollCard(APP) : "";
}
let pendingRender = false;
function queueRender() { pendingRender = true; setTimeout(flushRender, 0); }
function flushRender() {
  if (!pendingRender) return;
  const ae = document.activeElement;
  if (isTextish(ae) && mount.contains(ae)) return; // still typing somewhere on the page; wait
  pendingRender = false; render();
}
document.addEventListener("focusout", () => setTimeout(flushRender, 0));

// ---------------- actions ----------------
const ACTIONS = {
  // roster
  newChar() { clearDraft(); APP.createDraft = blankDraft(); APP.spUi = spUiDefault(); APP.featUi = featUiDefault(); APP.progressOpen = false; APP.screen = "create"; render(); window.scrollTo(0, 0); },
  importGandork() {
    if (!APP.seedGandork) return;
    store.saveCharacter(store.normalize(APP.seedGandork, APP.library));
    toast("Added Gandork"); render();
  },
  goHome() { APP.screen = "home"; APP.char = null; render(); window.scrollTo(0, 0); },
  goRoster() { APP.screen = "roster"; render(); window.scrollTo(0, 0); },
  goRules() { APP.screen = "rules"; render(); window.scrollTo(0, 0); },
  homeContinue() {
    if (APP._opening) return;
    const last = lastCharacter(APP); if (!last) { ACTIONS.newChar(); return; }
    const raw = store.getCharacter(last.id); if (!raw) return;
    APP._opening = true;
    playTomeOpen(raw, APP.library, () => { ACTIONS.openChar({ dataset: { id: last.id } }); }).then(() => { APP._opening = false; });
  },
  openChar(el) {
    const raw = store.getCharacter(el.dataset.id);
    if (!raw) return;
    APP.char = store.normalize(raw, APP.library);
    const gained = syncLineageSpells(APP.char, APP.library, APP.campaign);
    save();
    if (gained.length) setTimeout(() => toast(`Added your species spells: ${gained.join(", ")}`), 300);
    APP.sheetTab = APP.prefs.startTab || "stats"; APP.roll = null; APP.turn.round = 0; APP.turn.spent = {}; APP.concPrompt = null; APP.charSub = "combat"; preloadSamples();
    store.setActiveId(APP.char.id); APP.prefs.lastChar = APP.char.id; savePrefs();
    APP.screen = "sheet"; render(); window.scrollTo(0, 0);
  },
  async installApp() {
    const ok = await promptInstall();
    if (ok === null) toast("Use your browser's menu to install");
    else if (ok) toast("Installed — open it from the new icon");
    render();
  },
  downloadShortcut() { const n = downloadShortcut(); toast(`Saved "${n}" — move it to your Desktop`); },
  async copyLink() {
    const url = appUrl();
    try { await navigator.clipboard.writeText(url); toast("Link copied — text it to your phone"); }
    catch (e) { const el = mount.querySelector("[data-copy-src]"); if (el) { el.select(); try { document.execCommand("copy"); toast("Link copied"); } catch (e2) { toast("Select the link and copy it"); } } }
  },
  dismissInstall() { APP.installDismissed = true; try { localStorage.setItem(LS_INSTALL, "1"); } catch (e) { } render(); },
  openSettings() { openModal({ type: "settings" }); },
  importPrompt() { importPrompt(); },
  exportAll() { exportChars(null, "backup"); APP.prefs.lastBackup = Date.now(); savePrefs(); },
  setTheme(el) { APP.prefs.theme = el.dataset.v; savePrefs(); applyPrefs(); render(); },
  setSize(el) { APP.prefs.size = el.dataset.v; savePrefs(); applyPrefs(); render(); },
  charSub(el) { APP.charSub = el.dataset.sub; render(); window.scrollTo(0, 0); },
  combatFilter(el) { APP.combatFilter = el.dataset.k; render(); },
  combatSort(el) { APP.combatSort = el.value; render(); },
  featFilter(el) { APP.featFilter = el.dataset.k; render(); },
  featSort(el) { APP.featSort = el.value; render(); },
  turnPip(el) { const s = APP.turn.spent, k = el.dataset.k; if (s[k]) delete s[k]; else s[k] = true; render(); },
  turnNext() { APP.turn.round += 1; APP.turn.spent = {}; render(); },
  turnEnd() { APP.turn.round = 0; APP.turn.spent = {}; render(); },
  toggleInsp() { APP.char.inspiration = !APP.char.inspiration; saveAndRender(); toast(APP.char.inspiration ? "Heroic Inspiration gained" : "Heroic Inspiration spent"); },
  concKeep() { APP.concPrompt = null; render(); },
  concLose() { APP.char.concentration = null; APP.concPrompt = null; saveAndRender(); toast("Concentration ended"); },
  openTile(el) { openModal({ type: "tile", id: el.dataset.id }); },
  useRes(el) {
    const r = APP.char.resources[+el.dataset.i];
    if (!r || r.max - r.used <= 0) { toast("No uses left"); return; }
    r.used += 1; save();
  },
  tileUse() {
    const c = APP.char, d = deriveCharacter(c), e = findTile(APP, c, d, APP.modal && APP.modal.id);
    if (!e) return;
    if (e.block) { toast(e.block); return; }
    if (APP.turn.on && ["Action", "Bonus", "Reaction"].includes(e.cost) && e.act?.a !== "attackRoll") APP.turn.spent[e.cost] = true;
    if (e.act?.a === "openCast") { ACTIONS.openCast({ dataset: { name: e.act.name } }); return; }
    closeModal();
    if (e.act && ACTIONS[e.act.a]) {
      if (e.act.a === "useRes") { ACTIONS.useRes({ dataset: { i: e.act.i } }); toast(`Used ${e.name}`); render(); }
      else ACTIONS[e.act.a]({ dataset: { id: e.act.id, name: e.act.name, close: "1" } });
    } else { toast(`Used ${e.name}`); render(); }
  },
  openHp() { APP.hpRes = "normal"; openModal({ type: "hp" }); },
  hpRes(el) {
    APP.hpRes = el.dataset.v;
    el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
    updateHpPreview();
  },
  hpQuick(el) {
    const input = document.getElementById("hp-amt");
    if (!input) return;
    const n = parseInt(el.dataset.n, 10) || 0;
    input.value = n === 0 ? "" : String((parseInt(input.value, 10) || 0) + n);
    input.focus({ preventScroll: true });
    updateHpPreview();
  },
  openChangelog() { openModal({ type: "changelog" }); },
  togglePref(el) {
    const t = PREF_TOGGLES[el.dataset.k];
    if (!t) return;
    const v = !t.get(APP.prefs);
    t.set(APP.prefs, v); savePrefs(); applyPrefs();
    el.setAttribute("aria-checked", v ? "true" : "false");
    if (el.dataset.k === "sfx") {
      document.querySelectorAll('[data-pref-range="vol"], [data-a="testSound"]').forEach(x => { x.disabled = !v; });
      if (v) sfx("confirm");
    }
    if (el.dataset.k === "haptics" && v) { try { navigator.vibrate(30); } catch (e) { } }
    if (["vignette", "contrast", "bigtap", "turns", "concprompt", "gwm"].includes(el.dataset.k)) render();
  },
  setPrefV(el) {
    APP.prefs[el.dataset.k] = el.dataset.v; savePrefs(); applyPrefs();
    el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el ? "true" : "false"));
    if (el.dataset.k === "sheetStyle") { render(); window.scrollTo(0, 0); }
    if (el.dataset.k === "startTab") toast("Characters will open on " + el.textContent);
  },
  testSound() { sfx("confirm"); sfx("dice"); },
  resetPrefs() {
    if (!window.confirm("Put every setting back to its default? Your characters are not touched.")) return;
    APP.prefs = { seenVersion: APP.prefs.seenVersion, lastBackup: APP.prefs.lastBackup, favSpecies: APP.prefs.favSpecies };
    savePrefs(); applyPrefs(); render(); toast("Settings reset");
  },
  clearOffline() {
    if (!window.confirm("Clear the offline copy of the app and reload? Your characters stay. You will enter the group password again.")) return;
    const done = () => location.reload();
    const regs = navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))) : Promise.resolve();
    Promise.resolve(regs).then(() => (window.caches ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) : null)).then(done, done);
  },
  checkUpdates() { APP.recheck && APP.recheck(true); },

  // modal plumbing
  closeModal() { closeModal(); },
  closeModalBackdrop() { closeModal(); },
  showDetail(el) { if (APP.modal && ["subclass", "detail"].includes(APP.modal.type)) { APP._under = APP.modal; APP._underScroll = modalRoot.querySelector(".modal-body")?.scrollTop || 0; } openModal({ type: "detail", kind: el.dataset.kind, name: el.dataset.name, i: el.dataset.i != null ? +el.dataset.i : null, from: el.dataset.from }); },

  // wizard
  cancelCreate() { clearDraft(); APP.screen = "roster"; APP.createDraft = null; APP.char = null; APP.lvl = null; APP.progressOpen = false; render(); },
  prevStep() {
    const d = APP.createDraft;
    if (chapterId(d) === "classChoices" && d.lvl && d.lvl.step > 0) { d.lvl.step -= 1; d.lvl.query = ""; render(); window.scrollTo(0, 0); return; }
    d.chapter = Math.max(0, d.chapter - 1); d.query = ""; render(); window.scrollTo(0, 0); },
  nextStep() {
    const d = APP.createDraft;
    if (chapterId(d) === "classChoices") {
      const cp = choicePlan(d, APP);
      if (cp && cp.lvl.step < cp.steps.length - 1) {
        if (!stepValidFor(cp.tmp, cp.lvl, cp.steps[cp.lvl.step])) return;
        cp.lvl.step += 1; cp.lvl.query = ""; render(); window.scrollTo(0, 0); return;
      }
    }
    if (!validateChapter(chapterId(d), d, APP).valid) return;
    d.chapter = Math.min(CHAPTERS.length - 1, d.chapter + 1); d.query = "";
    render(); window.scrollTo(0, 0);
  },
  gotoChapter(el) {
    const d = APP.createDraft;
    const i = el.dataset.id != null ? CHAPTERS.findIndex(c => c.id === el.dataset.id) : +el.dataset.i;
    if (i < 0 || i > reachIndex(APP, d)) return;
    d.chapter = i; d.query = ""; APP.progressOpen = false; render(); window.scrollTo(0, 0);
  },
  openProgress() { APP.progressOpen = true; render(); },
  closeProgress() { APP.progressOpen = false; render(); },
  closeProgressBackdrop() { APP.progressOpen = false; render(); },
  // codex lists (class, species, background)
  pickSpecies(el) { mPickSpecies(APP.createDraft, APP, el.dataset.name); render(); },
  pickClass(el) { mPickClass(APP.createDraft, APP, el.dataset.name); render(); },
  pickBackground(el) { mPickBackground(APP.createDraft, APP, el.dataset.name); render(); },
  openCustomBg() { APP.customBg = blankCustom(); openModal({ type: "customBg" }); },
  cbEdit(el) { const m = loadCustom().find(x => x.name === el.dataset.name); if (m) { APP.customBg = JSON.parse(JSON.stringify(m)); render(); } },
  cbDelete(el) { saveCustom(loadCustom().filter(x => x.name !== el.dataset.name)); syncCustom(APP.library); render(); },
  cbSave() {
    const cb = APP.customBg; if (customValid(cb)) return;
    cb.name = cb.name.trim();
    if (APP.rawLibrary.backgrounds.some(b => b.name === cb.name && !b.custom)) { toast("That name is already a built-in background"); return; }
    saveCustom([...loadCustom().filter(x => x.name !== cb.name), cb]);
    syncCustom(APP.library);
    closeModal();
    ACTIONS.pickBackground({ dataset: { name: cb.name } });
    toast(`${cb.name} saved on this device`);
  },
  cxOpen(el) {
    const u = APP.spUi.k[el.dataset.kind], opening = u.open !== el.dataset.name;
    u.open = opening ? el.dataset.name : null; spRefresh();
    if (opening) { const r = mount.querySelector(".sp-row.open"); if (r) r.scrollIntoView({ block: "start" }); }
  },
  cxChoose(el) {
    const kind = el.dataset.kind, name = el.dataset.name;
    ACTIONS[{ species: "pickSpecies", class: "pickClass", background: "pickBackground" }[kind]]({ dataset: { name } });
    celebrate();
  },
  cxTrait(el) { const t = APP.spUi.traits, k = el.dataset.key; if (t.has(k)) t.delete(k); else t.add(k); spRefresh(); },
  cxSort(el) { APP.spUi.k[el.dataset.kind].sort = el.value; spRefresh(); },
  cxFilter(el) { APP.spUi.k[el.dataset.kind].filter = el.value; spRefresh(); },
  cxFav(el) {
    const key = favKey(el.dataset.kind), n = el.dataset.name, f = new Set(APP.prefs[key] || []);
    if (f.has(n)) f.delete(n); else f.add(n);
    APP.prefs[key] = [...f]; savePrefs(); spRefresh();
  },
  async cxPortraitClear(el) { await removePortrait(el.dataset.name); spRefresh(); },
  // a species/background/feat choice
  pick(el) {
    const d = APP.createDraft, id = el.dataset.id, v = el.dataset.v;
    const def = [...draftChoices(APP, d, "species"), ...draftChoices(APP, d, "bg"), ...draftChoices(APP, d, "class")].find(x => x.id === id);
    if (!def) return;
    const cur = [].concat(d.picks[id] || []);
    let next;
    if (def.n > 1) {
      next = cur.includes(v) ? cur.filter(x => x !== v) : cur.length < def.n ? [...cur, v] : cur;
      if (next === cur) { toast(`You can pick ${def.n} — tap one to swap it out`); return; }
    } else next = cur[0] === v ? null : v;
    if (next == null || (Array.isArray(next) && !next.length)) delete d.picks[id]; else d.picks[id] = next;
    // answers that depended on the old pick (a feat's own choices, a lineage's traits) no longer apply
    clearPicks(d, id + ">");
    const defs = [...draftChoices(APP, d, "species"), ...draftChoices(APP, d, "bg"), ...draftChoices(APP, d, "class")];
    Object.keys(d.picks).forEach(k => {
      const dep = defs.find(x => x.id === k);
      if (!dep) { if (/^(sp|bg):/.test(k)) delete d.picks[k]; return; }
      if (dep.kind === "text") return;
      const ok = new Set(optionsFor(dep, APP, d).map(o => o.v));
      const kept = [].concat(d.picks[k]).filter(v => ok.has(v));
      if (!kept.length) delete d.picks[k]; else d.picks[k] = dep.n > 1 ? kept : kept[0];
    });
    d.classSkills = d.classSkills.filter(sk => !takenSkills(APP, d).includes(sk));
    render();
  },
  bonusMode(el) { APP.createDraft.bonusMode = el.dataset.mode; render(); },
  standardArray() { applyStandardArray(APP.createDraft, APP); render(); toast("Standard array placed. Swap numbers if you like"); },
  rollStats() { rollAndLock(APP.createDraft); render(); toast("Rolled 4d6, dropping the lowest die, for each score"); },
  pickEquip(el) { APP.createDraft[el.dataset.which] = el.dataset.k; render(); },
  randomGear() { randomGear(APP.createDraft); render(); },
  randomName() { APP.createDraft.name = randomName(); render(); },
  randomPick() {
    const d = APP.createDraft, kind = chapterId(d);
    if (!["class", "species", "background"].includes(kind)) return;
    const items = listItems(APP, d, kind);
    if (!items.length) return;
    const it = items[Math.floor(Math.random() * items.length)];
    APP.spUi.k[kind].open = it.name;
    ACTIONS.cxChoose({ dataset: { kind, name: it.name } });
  },
  randomChoices() {
    const d = APP.createDraft, kind = chapterId(d);
    const scope = kind === "background" ? "bg" : "species";
    for (let i = 0; i < 4; i++) randomize(draftChoices(APP, d, scope), APP, d); // repeat: some choices appear only after others
    d.classSkills = d.classSkills.filter(sk => !takenSkills(APP, d).includes(sk));
    render(); toast("Filled in. Change anything you like");
  },
  randomSkills() {
    const d = APP.createDraft;
    for (let i = 0; i < 2; i++) randomize(draftChoices(APP, d, "class"), APP, d);
    const taken = takenSkills(APP, d);
    const { from, n } = classSkillOptions(APP, d);
    const pool = from.filter(id => !taken.includes(id)).sort(() => Math.random() - 0.5);
    d.classSkills = pool.slice(0, n); render();
  },
  suggestedArray() {
    const d = APP.createDraft;
    if (applySuggestedArray(d, APP)) { render(); toast(`Suggested ${d.class} scores placed`); }
  },
  randomAll() {
    const d = APP.createDraft, any = l => l[Math.floor(Math.random() * l.length)];
    generateRandom(d, APP, {});
    if (!d.name.trim()) d.name = randomName();
    d.alignment = any(ALIGNMENTS);
    d.appearance = `${any(["Tall and lean", "Short and sturdy", "Broad-shouldered", "Slight and quick", "Weathered and wiry"])}, with ${any(["close-cropped", "braided", "wild", "silver-streaked", "dark and tied-back"])} hair and ${any(["a scar across one brow", "ink-stained fingers", "a crooked grin", "calloused hands", "mismatched eyes"])}.`;
    d.backstory = `A ${d.background.toLowerCase()} turned adventurer, ${d.name.split(" ")[0]} left home ${any(["after a debt came due", "chasing a rumor", "to keep a promise", "when the harvest failed", "with nothing left to lose"])}. ${any(["Blunt and loyal", "Curious to a fault", "Wary of strangers but fiercely protective of friends", "Cheerful, even when it is unwise", "Quiet, watchful and slow to trust"])}.`;
    d.chapter = CHAPTERS.length - 1; d.query = "";
    render(); window.scrollTo(0, 0); toast("Random character ready. Review it and change anything you like");
  },
  toggleSkill(el) {
    const d = APP.createDraft, id = el.dataset.id, i = d.classSkills.indexOf(id);
    if (i >= 0) d.classSkills.splice(i, 1); else d.classSkills.push(id);
    render();
  },
  finishCreate() {
    const d = APP.createDraft;
    const cp = choicePlan(d, APP);
    const char = store.normalize(buildCharacter(d, APP), APP.library);
    const goldOnly = char.inventory.length === 0 && (char.coins.gp > 0);
    APP.char = char; APP.screen = "sheet"; save();
    store.setActiveId(char.id); APP.prefs.lastChar = char.id; savePrefs();
    clearDraft(); APP.createDraft = null; APP.progressOpen = false; APP.sheetTab = "stats"; APP.roll = null; APP.lvl = null;
    APP.shopAfterChoices = goldOnly;
    if (cp && cp.steps.length) { APP.lvl = cp.lvl; applyLevelUp(); } // applies subclass, spells, invocations... and opens the sheet
    else {
      if (goldOnly) { APP.shopAfterChoices = false; APP.sheetTab = "gear"; openModal({ type: "shop" }); }
      render(); window.scrollTo(0, 0);
    }
    toast(goldOnly ? "Spend your gold on starting gear" : `${APP.char.name} is ready`);
  },

  // sheet nav
  backToRoster() { save(); store.setActiveId(null); APP.char = null; APP.roll = null; APP.screen = "roster"; render(); window.scrollTo(0, 0); },
  sheetTab(el) { APP.sheetTab = el.dataset.tab; APP.selItem = null; if (el.dataset.tab !== "rules") { APP.glossaryCat = ""; APP.glossaryClass = ""; APP.glossarySubclass = ""; } render(); window.scrollTo(0, 0); },
  glossaryCat(el) {
    const cat = el.dataset.cat;
    APP.glossaryCat = APP.glossaryCat === cat ? "" : cat;
    APP.glossaryClass = ""; APP.glossarySubclass = ""; APP.rulesQuery = "";
    APP._rulesIndex = null;
    render();
  },
  glossaryClassView(el) { APP.glossaryClass = el.dataset.class || el.dataset.name; APP.glossarySubclass = ""; render(); window.scrollTo(0, 0); },
  glossarySubclass(el) { APP.glossarySubclass = el.dataset.name; render(); window.scrollTo(0, 0); },
  glossaryBack() { APP.glossaryClass = ""; APP.glossarySubclass = ""; render(); },
  glossaryBackToClass(el) { APP.glossarySubclass = ""; render(); },
  openEdit() { openModal({ type: "edit" }); },
  askDelete() { openModal({ type: "confirmDelete" }); },
  cancelDelete() { APP.modal = { type: "edit" }; render(); },
  deleteChar() {
    const gone = JSON.parse(JSON.stringify(APP.char)), name = gone.name;
    store.deleteCharacter(gone.id);
    APP.char = null; APP.modal = null; APP.screen = "roster"; render();
    toast(`${name} is gone`, { action: "Undo", onAction: () => { store.saveCharacter(gone); render(); toast(`All that, for nothing? ${name} is back.`); } });
  },
  async downloadPdf() {
    if (!APP.char) return;
    toast("Making your character sheet...");
    try { await downloadSheetPdf(APP, APP.char); toast("Character sheet saved as a PDF"); }
    catch (e) { console.error(e); toast("Could not make the PDF. Try again, or check your connection once so it can load."); }
  },
  exportOne() { exportChars([APP.char.id], APP.char.name); APP.prefs.lastBackup = Date.now(); savePrefs(); },
  toggleSaveProf(el) {
    const a = el.dataset.ab, list = APP.char.saveProf, i = list.indexOf(a);
    if (el.checked && i < 0) list.push(a); if (!el.checked && i >= 0) list.splice(i, 1);
    saveAndRender();
  },

  // HP & rests
  hpApply(el) { applyHp(el.dataset.mode); },
  deathSave(el) {
    const ds = APP.char.deathSaves, k = el.dataset.kind, i = +el.dataset.i;
    ds[k] = ds[k] === i + 1 ? i : i + 1;
    saveAndRender();
  },
  rollDeathSave() {
    const c = APP.char, v = rollDie(20);
    let msg;
    if (v === 20) { c.hp.cur = 1; c.deathSaves = { success: 0, fail: 0 }; msg = "Natural 20 — you're back up with 1 HP!"; }
    else if (v === 1) { c.deathSaves.fail = Math.min(3, c.deathSaves.fail + 2); msg = "Natural 1 — two failures"; }
    else if (v >= 10) { c.deathSaves.success = Math.min(3, c.deathSaves.success + 1); msg = c.deathSaves.success >= 3 ? "Third success — you're stable" : "Success"; }
    else { c.deathSaves.fail = Math.min(3, c.deathSaves.fail + 1); msg = c.deathSaves.fail >= 3 ? "Third failure — that's death" : "Failure"; }
    save();
    showRoll("Death save", [{ label: msg, total: v, bd: "10 or higher succeeds", crit: v === 20, fumble: v === 1 }]);
  },
  openShortRest() { openModal({ type: "shortRest", log: [] }); },
  spendHitDie() {
    const c = APP.char;
    if (c.hitDice.spent >= c.hitDice.total) return;
    const roll = rollDie(c.hitDice.die), gain = Math.max(1, roll + abilityMod(c.abilities.con));
    c.hitDice.spent += 1;
    const before = c.hp.cur;
    c.hp.cur = Math.min(c.hp.max, c.hp.cur + gain);
    APP.modal.log.push(`Rolled ${roll} on d${c.hitDice.die} → healed ${c.hp.cur - before}`);
    saveAndRender();
  },
  finishShortRest() {
    const c = APP.char;
    slotRows(c.class, c.level).filter(r => r.pact).forEach(r => { c.spellcasting.slotsUsed[r.level - 1] = 0; });
    c.resources.forEach(r => { if (r.reset === "short") r.used = 0; });
    save(); closeModal();
    toast("Short rest done" + (c.class === "Warlock" ? " — pact slots back" : ""));
  },
  openLongRest() { openModal({ type: "longRest" }); },
  confirmLongRest() {
    const c = APP.char;
    c.hp.cur = c.hp.max; c.hp.temp = 0;
    c.spellcasting.slotsUsed = c.spellcasting.slotsUsed.map(() => 0);
    c.hitDice.spent = 0;
    c.resources.forEach(r => { r.used = 0; });
    c.deathSaves = { success: 0, fail: 0 };
    c.exhaustion = Math.max(0, c.exhaustion - 1);
    c.concentration = null;
    save(); closeModal();
    toast("Long rest: everything restored");
  },

  // level up (full screen)
  openAc() { openModal({ type: "ac" }); },
  openLevelMenu() { openModal({ type: "levelMenu" }); },
  lvlMode(el) { APP.char.levelMode = el.dataset.v; save(); render(); },
  addXp() { const v = Math.floor(Number(document.getElementById("xp-add")?.value)); if (!(v > 0)) { toast("Type how much XP to add"); return; } APP.char.xp = (APP.char.xp || 0) + v; save(); render(); toast(`+${v} XP`); },
  setXp() { const v = Math.floor(Number(document.getElementById("xp-set")?.value)); if (!(v >= 0)) return; APP.char.xp = v; save(); render(); },
  startLevelUp() { closeModal(); ACTIONS.openLevelUp(); },
  openLevelUp() { APP.lvl = newLevelDraft(APP.char); APP.screen = "levelup"; APP.roll = null; render(); window.scrollTo(0, 0); },
  startFirstChoices() { APP.lvl = newLevelDraft(APP.char, { fromCreation: true }); APP.screen = "levelup"; render(); window.scrollTo(0, 0); },
  lvlCancel() { APP.lvl = null; APP.screen = "sheet"; render(); window.scrollTo(0, 0); },
  lvlPrev() { APP.lvl.step = Math.max(0, APP.lvl.step - 1); APP.lvl.query = ""; render(); window.scrollTo(0, 0); },
  lvlNext() {
    const p = levelPlan(APP), st = p.steps[APP.lvl.step];
    if (!stepValid(APP, st)) return;
    APP.lvl.step += 1; APP.lvl.query = ""; render(); window.scrollTo(0, 0);
  },
  lvlGoto(el) { APP.lvl.step = +el.dataset.i; APP.lvl.query = ""; render(); window.scrollTo(0, 0); },
  lvlHp(el) {
    const d = APP.lvl; d.hpMode = el.dataset.mode;
    if (d.hpMode === "roll" && !d.rolled) d.rolled = rollDie(APP.char.hitDice.die || 8);
    render();
  },
  lvlGainOpen(el) { const d = APP.lvl; d.gainOpen = d.gainOpen === el.dataset.name ? "" : el.dataset.name; render(); },
  lvlSubclass(el) { APP.lvl.subclass = el.dataset.name; render(); },
  scOpen(el) { openModal({ type: "subclass", name: el.dataset.name }); },
  scStep(el) {
    const subs = scList(APP), i = subs.findIndex(x => x.name === APP.modal.name), n = subs[i + Number(el.dataset.n)];
    if (n) { APP.modal.name = n.name; render(); const b = modalRoot.querySelector(".scscroll"); if (b) b.scrollTop = 0; }
  },
  scPick(el) {
    const name = el.dataset.name, was = APP.lvl.subclass === name;
    APP.lvl.subclass = was ? "" : name; render();
    if (was) return;
    const calm = APP.prefs.motion === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sc = scList(APP).find(x => x.name === name);
    flourish(modalRoot, toneFor(sc, APP.char.class).fx, calm);
    setTimeout(() => { if (APP.modal && APP.modal.type === "subclass") closeModal(); }, calm ? 150 : 900);
  },
  lvlAsiMode(el) { APP.lvl.asiMode = el.dataset.v; APP.lvl.query = ""; render(); },
  lvlAsiSplit(el) { Object.assign(APP.lvl, { asiSplit: el.dataset.v, a2: "", a1a: "", a1b: "" }); render(); },
  lvlAsiPick(el) {
    const d = APP.lvl, ab = el.dataset.ab;
    if (d.asiSplit === "2") d.a2 = d.a2 === ab ? "" : ab;
    else if (d.a1a === ab) d.a1a = "";
    else if (d.a1b === ab) d.a1b = "";
    else if (!d.a1a) d.a1a = ab;
    else d.a1b = ab;
    render();
  },
  featOpen(el) { APP.featUi.open = el.dataset.name; render(); },
  featClose() { APP.featUi.open = null; render(); },
  featCloseBackdrop() { APP.featUi.open = null; render(); },
  featSort(el) { APP.featUi.sort = el.value; render(); },
  featType(el) { APP.featUi.type = el.value; render(); },
  featBenefit(el) { const t = APP.featUi.tOpen, k = el.dataset.key; if (t.has(k)) t.delete(k); else t.add(k); render(); },
  featChoose(el) { APP.featUi.open = null; ACTIONS[el.dataset.pick]({ dataset: { name: el.dataset.name } }); },
  lvlFeat(el) {
    const d = APP.lvl, name = el.dataset.name;
    d.feat = d.feat === name ? "" : name;
    Object.assign(d, { featAb: "", featNeedsAb: false, fxOpen: false, a2: "", a1a: "", a1b: "" });
    d.asiMode = d.feat === ASI_FEAT ? "asi" : "feat";
    const f = d.feat && d.feat !== ASI_FEAT ? featDef(APP, d.feat) : null;
    const inc = f && featAbilityIncrease(f, APP.char);
    if (inc) {
      const open = inc.options.filter(a => APP.char.abilities[a] < inc.cap);
      if (open.length === 1) d.featAb = open[0];
      else if (open.length > 1) d.featNeedsAb = true;
      d.fxOpen = true;
    }
    render();
  },
  lvlFeatClear() { Object.assign(APP.lvl, { feat: "", featAb: "", featNeedsAb: false, fxOpen: false }); render(); },
  lvlFeatAb(el) { APP.lvl.featAb = APP.lvl.featAb === el.dataset.ab ? "" : el.dataset.ab; render(); },
  fxToggle() { APP.lvl.fxOpen = !APP.lvl.fxOpen; render(); },
  lvlStyle(el) { APP.lvl.style = el.dataset.name; render(); },
  lvlExpertise(el) { toggleIn(APP.lvl.expertise, el.dataset.id); render(); },
  lvlMastery(el) { toggleIn(APP.lvl.mastery, el.dataset.name); render(); },
  lvlOption(el) { toggleIn(APP.lvl.options, el.dataset.name); render(); },
  lvlCantrip(el) { toggleIn(APP.lvl.cantrips, el.dataset.name); refreshLevelResults(); },
  lvlSpell(el) { toggleIn(APP.lvl.spells, el.dataset.name); refreshLevelResults(); },
  lvlShowAll(el) { APP.lvl.showAll = el.checked; render(); },
  lvlConfirm() { applyLevelUp(); },

  // conditions & concentration
  openConditions() { openModal({ type: "conditions" }); },
  toggleCondition(el) {
    const list = APP.char.conditions, n = el.dataset.name, i = list.indexOf(n);
    if (i >= 0) list.splice(i, 1); else list.push(n);
    saveAndRender();
  },
  removeCondition(el) { APP.char.conditions = APP.char.conditions.filter(x => x !== el.dataset.name); saveAndRender(); },
  exhStep(el) { APP.char.exhaustion = Math.max(0, Math.min(6, APP.char.exhaustion + +el.dataset.n)); saveAndRender(); },
  endConc() { APP.char.concentration = null; saveAndRender(); },

  // trackers
  openResource(el) {
    const i = el.dataset.i != null ? +el.dataset.i : null;
    openModal({ type: "resource", i });
  },
  resReset(el) { APP.modal.reset = el.dataset.v; render(); },
  saveResource() {
    const m = APP.modal, c = APP.char;
    const existing = m.i != null ? c.resources[m.i] : null;
    const name = String(m.name ?? existing?.name ?? "").trim();
    if (!name) { toast("Give the tracker a name"); return; }
    const max = Math.max(1, Math.min(99, parseInt(m.max ?? existing?.max ?? 1, 10) || 1));
    const r = { ...(existing || { used: 0 }), name, max, reset: m.reset ?? existing?.reset ?? "long" };
    r.used = Math.min(r.used, max);
    if (existing) c.resources[m.i] = r; else c.resources.push(r);
    closeModal(); save(); render();
  },
  deleteResource() { APP.char.resources.splice(APP.modal.i, 1); closeModal(); save(); render(); },
  toggleResource(el) {
    const r = APP.char.resources[+el.dataset.i], k = +el.dataset.k, avail = r.max - r.used;
    r.used = k < avail ? r.used + 1 : r.used - 1;
    r.used = Math.max(0, Math.min(r.max, r.used));
    saveAndRender();
  },
  resStep(el) { const r = APP.char.resources[+el.dataset.i]; r.used = Math.max(0, Math.min(r.max, r.used + +el.dataset.n)); saveAndRender(); },

  // skills, abilities, rolls on the sheet
  cycleSkill(el) {
    const c = APP.char, id = el.dataset.id;
    const p = c.skillProf.includes(id), x = c.skillExpertise.includes(id);
    c.skillProf = c.skillProf.filter(s => s !== id); c.skillExpertise = c.skillExpertise.filter(s => s !== id);
    if (!p && !x) c.skillProf.push(id);
    else if (p && !x) { c.skillProf.push(id); c.skillExpertise.push(id); }
    saveAndRender();
  },
  rollSkill(el) { const s = deriveCharacter(APP.char).skills.find(x => x.id === el.dataset.id); d20Test(`${s.label} check`, s.bonus); },
  rollSave(el) { const a = el.dataset.ab; d20Test(`${ABILITY_LABEL[a]} save`, deriveCharacter(APP.char).saves[a]); },
  rollAbility(el) { const a = el.dataset.ab; d20Test(`${ABILITY_LABEL[a]} check`, deriveCharacter(APP.char).mods[a]); },
  rollInit() { d20Test("Initiative", deriveCharacter(APP.char).initiative); },
  rollSpellAttack() { d20Test("Spell attack", deriveCharacter(APP.char).spellInfo.attackBonus); },

  // spells
  toggleSlot(el) {
    const lvl = +el.dataset.lvl, i = +el.dataset.i, max = +el.dataset.max, used = APP.char.spellcasting.slotsUsed;
    const avail = max - (used[lvl - 1] || 0);
    used[lvl - 1] = Math.max(0, Math.min(max, (used[lvl - 1] || 0) + (i < avail ? 1 : -1)));
    saveAndRender();
  },
  togglePrepared(el) { const s = APP.char.spellcasting.spells.find(x => x.name === el.dataset.name); if (s) s.prepared = el.checked; saveAndRender(); },
  openCast(el) { openModal({ type: "cast", name: el.dataset.name }); },
  castWith(el) {
    const c = APP.char, lvl = +el.dataset.lvl, name = APP.modal.name;
    const sp = findByName(APP.library.spells, name);
    if (lvl > 0) {
      const row = slotRows(c.class, c.level).find(r => r.level === lvl);
      const used = c.spellcasting.slotsUsed;
      if (!row || (used[lvl - 1] || 0) >= row.max) { toast("No slots of that level left"); return; }
      used[lvl - 1] = (used[lvl - 1] || 0) + 1;
    }
    if (sp && sp.conc) c.concentration = name;
    save(); closeModal();
    const rolled = spellRoll(sp, lvl || sp?.level || 1);
    if (!rolled) toast(`Cast ${name}${lvl ? ` with a level ${lvl} slot` : ""}${sp && sp.conc ? " — concentrating" : ""}`);
    else if (sp && sp.conc) toast("Concentrating on " + name);
  },
  castCantrip(el) {
    const sp = findByName(APP.library.spells, el.dataset.name);
    if (!spellRoll(sp, 0)) toast(`Cast ${el.dataset.name}`);
  },
  addSpell(el) { APP.char.spellcasting.spells.push({ name: el.dataset.name, prepared: true, always: false }); saveAndRender(); },
  removeSpell(el) {
    const c = APP.char, name = el.dataset.name;
    const i = c.spellcasting.spells.findIndex(s => s.name === name);
    if (i < 0) return;
    const [gone] = c.spellcasting.spells.splice(i, 1);
    const wasConc = c.concentration === name;
    if (wasConc) c.concentration = null;
    saveAndRender();
    toast(`Removed ${name}`, { action: "Undo", onAction: () => { c.spellcasting.spells.splice(i, 0, gone); if (wasConc) c.concentration = name; saveAndRender(); } });
  },
  pickerLevel(el) { APP.pickerLevel = el.dataset.lv === "" ? null : +el.dataset.lv; render(); },
  pickerAllClasses(el) { APP.pickerAllClasses = el.checked; render(); },

  // pickers
  openShop() { APP.shopQuery = ""; APP.shopCat = "All"; openModal({ type: "shop" }); },
  shopCat(el) { APP.shopCat = el.dataset.cat; render(); },
  buyItem(el) {
    const c = APP.char, L = APP.library, C = APP.campaign, name = el.dataset.name;
    const row = shopStock(L, C, allWeapons(L, C), allItems(L, C), Object.keys(ARMOR).filter(a => a !== "Clothing")).find(r => r.name === name);
    if (!row) return;
    const cost = Math.round(shopPrice(c, row) * 100);
    const paid = pay(c.coins, cost);
    if (!paid) { toast("Not enough money"); return; }
    const before = { coins: { ...c.coins }, inv: c.inventory.map(i => ({ ...i })) };
    c.coins = paid;
    const same = c.inventory.find(i => i.name === name && !i.notes && !slotOf(c, i.id));
    if (same && !row.magic) same.qty += 1;
    else c.inventory.push(makeItem(name, { weapons: allWeapons(L, C), items: allItems(L, C) }, store.newId));
    saveAndRender();
    toast(`Bought ${name} for ${fmtPrice(cost / 100)}`, { action: "Undo", onAction: () => { c.coins = before.coins; c.inventory = before.inv; saveAndRender(); } });
  },
  openPicker(el) { APP.pickerQuery = ""; APP.pickerLevel = null; openModal({ type: "picker", picker: el.dataset.picker }); },
  pickFrom(el) { addPicked(el.dataset.picker, el.dataset.name, false); },
  pickCustom(el) { addPicked(el.dataset.picker, APP.pickerQuery.trim(), true); },
  askRemove(el) { APP._rm = { act: el.dataset.do, data: { ...el.dataset }, what: el.dataset.what, name: el.dataset.name }; APP._rmUnder = APP.modal || null; openModal({ type: "confirmRemove" }); },
  cancelRemove() { APP._rm = null; if (APP._rmUnder) { APP.modal = APP._rmUnder; APP._rmUnder = null; render(); } else closeModal(); },
  confirmRemove() { const r = APP._rm, under = APP._rmUnder; APP._rm = null; APP._rmUnder = null; if (under) APP.modal = under; else closeModal(); if (r && ACTIONS[r.act]) ACTIONS[r.act]({ dataset: r.data }); },
  removeFeat(el) { APP.char.feats.splice(+el.dataset.i, 1); closeModal(); saveAndRender(); },
  toggleShield(el) { APP.char.ac.shield = el.checked; saveAndRender(); },

  // bag & equipment
  itemTap(el) {
    const c = APP.char, id = el.dataset.id, it = itemById(c, id);
    if (!it) return;
    if (APP.selItem === id || !SLOTS.some(s => fitsOk(it, s.key, c))) { APP.selItem = null; openModal({ type: "itemMenu", id }); return; }
    APP.selItem = id; render();
  },
  clearSel() { APP.selItem = null; render(); },
  slotTap(el) {
    const slot = el.dataset.slot, c = APP.char;
    if (APP.selItem) {
      const it = itemById(c, APP.selItem), r = fits(it, slot, c);
      if (r === true) { equip(APP.selItem, slot); flashSlot(slot); } else toast(r);
      return;
    }
    openModal({ type: "slot", slot });
  },
  equipHere(el) { equip(el.dataset.id, el.dataset.slot); closeModal(); },
  unequip(el) { unequip(el.dataset.id, false, el.dataset.slot); if (APP.modal && APP.modal.type === "slot") closeModal(); else render(); },
  openItem(el) { openModal({ type: "item", id: el.dataset.id }); },
  openItemEdit(el) { openModal({ type: "item", id: el.dataset.id }); },
  // left-tap: select-to-equip if it fits a slot, else open its details (BG3: right-click/long-press/⋮ = menu)
  itemCell(el) {
    const c = APP.char, id = el.dataset.id, it = itemById(c, id);
    if (!it) return;
    if (APP.selItem === id || !SLOTS.some(s => fitsOk(it, s.key, c))) { APP.selItem = null; openModal({ type: "itemMenu", id }); return; }
    APP.selItem = id; render();
  },
  itemMenu(el) { openModal({ type: "itemMenu", id: el.dataset.id }); },
  bagSort(el) { APP.bagSort = el.value; render(); },
  noop() {},
  useItem(el) {
    const c = APP.char, it = itemById(c, el.dataset.id);
    if (!it) return;
    if ((it.qty || 0) <= 0) { toast(`No ${it.name} left`); return; }
    it.qty -= 1;
    closeModal(); saveAndRender();
    toast(`Used ${it.name}${it.qty === 0 ? " — last one" : ` · ${it.qty} left`}`, it.qty === 0 ? {} : undefined);
  },
  ctxAttune(el) {
    const c = APP.char, it = itemById(c, el.dataset.id);
    if (!it) return;
    if (!it.attuned && attunedCount(c) >= 3) { toast("You can attune to 3 items at most — end one first"); return; }
    it.attuned = !it.attuned; closeModal(); saveAndRender();
  },
  // hotbar
  openHotbarAdd() { openModal({ type: "hotbarAdd" }); },
  toggleHotbarEdit() { APP.hotbarEdit = !APP.hotbarEdit; render(); },
  addHotbar(el) {
    const c = APP.char, kind = el.dataset.kind;
    const entry = (kind === "spell" || kind === "ability") ? { kind, name: el.dataset.name } : { kind, id: el.dataset.id };
    c.hotbar = c.hotbar || [];
    const key = kind + ":" + (entry.id || entry.name);
    if (c.hotbar.some(h => h.kind + ":" + (h.id || h.name) === key)) { toast("Already on your hotbar"); return; }
    if (c.hotbar.length >= 12) { toast("Hotbar is full (12). Remove one first."); return; }
    c.hotbar.push(entry);
    save();
    if (el.dataset.close) { closeModal(); }
    render();
    toast(`Added ${entry.name || itemById(c, entry.id)?.name || "to hotbar"}`);
  },
  removeHotbar(el) {
    const c = APP.char, i = +el.dataset.i;
    c.hotbar.splice(i, 1);
    if (!c.hotbar.length) APP.hotbarEdit = false;
    saveAndRender();
  },
  hotbarUse(el) {
    const c = APP.char, h = (c.hotbar || [])[+el.dataset.i];
    if (!h) return;
    if (h.kind === "attack") { ACTIONS.attackRoll({ dataset: { id: h.id } }); return; }
    if (h.kind === "spell") {
      const sp = findByName(APP.library.spells, h.name);
      if (sp && sp.level === 0) { ACTIONS.castCantrip({ dataset: { name: h.name } }); }
      else { openModal({ type: "cast", name: h.name }); }
      return;
    }
    if (h.kind === "item") {
      const it = itemById(c, h.id);
      if (!it) return;
      if (it.weapon) { ACTIONS.attackRoll({ dataset: { id: h.id } }); return; }
      openModal({ type: "itemMenu", id: h.id });
      return;
    }
    if (h.kind === "ability") { openModal({ type: "detail", kind: "classFeature", name: h.name, from: c.class }); }
  },
  removeItem(el) {
    const c = APP.char, id = el.dataset.id;
    unequip(id, true);
    c.inventory = c.inventory.filter(i => i.id !== id);
    closeModal(); saveAndRender();
  },
  qtyStep(el) {
    const it = itemById(APP.char, el.dataset.id);
    it.qty = Math.max(0, (it.qty || 0) + +el.dataset.n);
    if (it.qty === 0) toast(`Out of ${it.name} — tap its name to remove it`);
    saveAndRender();
  },
  ammoStep(el) { const w = itemById(APP.char, el.dataset.id).weapon; w.ammo.cur = Math.max(0, w.ammo.cur + +el.dataset.n); saveAndRender(); },
  toggleAttuneReq(el) { const it = itemById(APP.char, APP.modal.id); it.attune = el.checked; if (!el.checked) it.attuned = false; saveAndRender(); },
  toggleAttuned(el) {
    const c = APP.char, it = itemById(c, APP.modal.id);
    if (el.checked && attunedCount(c) >= 3) { el.checked = false; toast("You can be attuned to 3 items at most — end one first"); return; }
    it.attuned = el.checked; saveAndRender();
  },
  makeWeapon() { const it = itemById(APP.char, APP.modal.id); it.weapon = { dice: "1d6", dtype: "", kind: "Melee", props: "", ability: null, magic: 0 }; delete it.slot; saveAndRender(); },

  // attacks
  attackRoll(el) {
    if (el.dataset && el.dataset.close && APP.modal) closeModal();
    const c = APP.char, it = itemById(c, el.dataset.id); if (!it || !it.weapon) return;
    const w = it.weapon;
    if (w.ammo) {
      if (w.ammo.cur <= 0) { toast(`Out of ${w.ammo.name}`); return; }
      w.ammo.cur -= 1; save();
    }
    const n = weaponNumbers(w, c);
    const exh = c.exhaustion * 2;
    const hit = rollD20(n.toHit - exh);
    const pb = APP.gwm && c.feats.includes("Great Weapon Master") && /heavy/i.test(w.props || "") ? deriveCharacter(c).prof : 0;
    if (APP.turn.on && APP.turn.spent.Action !== true) APP.turn.spent.Action = "attack";
    const dmg = rollFormula(`${n.dice}${n.dmgMod ? (n.dmgMod > 0 ? "+" : "") + n.dmgMod : ""}${pb ? "+" + pb : ""}`);
    const extra = rollFormula(n.dice);
    if (!dmg) { toast(`Can't read the damage dice "${n.dice}"`); return; }
    const critTotal = dmg.total + (extra ? extra.total : 0);
    const modTxt = hit.mod ? ` ${hit.mod > 0 ? "+" : "−"} ${Math.abs(hit.mod)}` : "";
    const parts = [
      { label: hit.crit ? "Natural 20!" : hit.fumble ? "Natural 1" : "To hit", total: hit.total, bd: `[${hit.first}]${modTxt}`, crit: hit.crit, fumble: hit.fumble },
      hit.crit
        ? { label: "Crit damage", total: Math.max(0, critTotal), bd: describeGroups(dmg) + (extra ? " + " + describeGroups(extra) : ""), crit: true }
        : { label: `Damage${w.dtype ? " · " + w.dtype : ""}`, total: Math.max(0, dmg.total), bd: describeGroups(dmg) }
    ];
    const gwmTxt = pb ? ` \u00b7 includes +${pb} Heavy Weapon Mastery on a hit` : "";
    const mastery = w.mastery && (c.masteries || []).includes(it.name) ? ` · mastery: <b>${w.mastery}</b>` : "";
    showRoll(`${it.name} attack${w.ammo ? ` · ${w.ammo.cur} ${w.ammo.name} left` : ""}`, parts,
      `Advantage to hit <b>${hit.adv}</b> · disadvantage <b>${hit.dis}</b>${hit.crit ? "" : ` · if it's a crit: <b>${Math.max(0, critTotal)}</b> damage`}${gwmTxt}${mastery}`);
  },

  // dice tab
  quickRoll(el) {
    const sides = +el.dataset.sides, count = +(el.dataset.count || 1);
    if (sides === 20 && count === 1) { d20Test("d20", 0); return; }
    const r = rollFormula(`${count}d${sides}`);
    showRoll(`${count}d${sides}`, [{ label: "Total", total: r.total, bd: describeGroups(r) }]);
  },
  customRoll() {
    const f = (APP.diceFormula || "").trim() || "1d20";
    const r = rollFormula(f);
    if (!r) { toast("Couldn't read that. Try something like 2d6+3 or 1d8+1d6+2"); return; }
    showRoll(r.formula, [{ label: "Total", total: r.total, bd: describeGroups(r) }]);
  },
  dismissRoll() { APP.roll = null; render(); },
  clearHistory() { APP.history = []; render(); },

  // egg
  spinSlots() { const r = spin(5); APP.modal.reels = r.reels; APP.modal.msg = r.winnings > 0 ? `You won ${r.winnings}!` : "The house wins this one."; render(); }
};

function addPicked(kind, name, custom) {
  const c = APP.char;
  if (!name) return;
  if (kind === "items") {
    const made = custom ? { id: store.newId(), name, qty: 1, notes: "" }
      : makeItem(name, { weapons: allWeapons(APP.library, APP.campaign), items: allItems(APP.library, APP.campaign) }, store.newId);
    const same = c.inventory.find(x => x.name.toLowerCase() === name.toLowerCase() && !x.weapon && !made.weapon && !wearKind(x));
    if (same) same.qty += 1; else c.inventory.push(made);
  } else if (kind === "feats") {
    if (!c.feats.includes(name)) c.feats.push(name);
  }
  save();
  toast(`Added ${name}`);
  if (custom) APP.pickerQuery = "";
  render();
}

function toggleIn(list, v) { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); }

function equip(id, slot, from) {
  const c = APP.char, it = itemById(c, id);
  const r = fits(it, slot, c);
  if (r !== true) { toast(r); return; }
  const eq = c.equipment;
  if (eq[slot] === id) { APP.selItem = null; render(); return; }
  // A stack (qty 2 daggers) can fill several slots, one copy each. With no spare copy left, or when
  // dragging out of a slot, equipping moves the item instead.
  const used = slotsOf(c, id), spare = (it.qty || 1) > used.length;
  let added = false;
  if (from && eq[from] === id) delete eq[from];
  else if (used.length && spare) added = true;
  else if (used.length > 1) { toast(`All ${used.length} ${it.name} are already in use. Take one off first.`); return; }
  else used.forEach(k => delete eq[k]);
  const bumped = eq[slot] && eq[slot] !== id ? itemById(c, eq[slot]) : null;
  eq[slot] = id;
  if (added) toast(`Using another ${it.name} (${used.length + 1} of ${it.qty || 1})`);
  if (slot === "main" && /two-handed/i.test(it.weapon?.props || "") && eq.off) { toast("Off hand emptied — that weapon needs both hands"); delete eq.off; }
  if (wearKind(it) === "shield") c.ac.shield = false;
  APP.selItem = null;
  save(); render();
  if (it.attune && !it.attuned) toast(`${it.name} needs attunement to work — tap it to attune`);
  else if (bumped) toast(`Swapped out ${bumped.name}`);
  flashSlot(slot);
}
function flashSlot(key) {
  requestAnimationFrame(() => { const el = document.querySelector(`[data-drop-slot="${key}"]`); if (el) { el.classList.add("just-equipped"); setTimeout(() => el.classList.remove("just-equipped"), 700); }
    const w = document.querySelector(`g[data-worn="${key}"]`); if (w) { w.classList.add("pop"); setTimeout(() => w.classList.remove("pop"), 700); } });
}
function unequip(id, quiet, slot) {
  const eq = APP.char.equipment;
  if (slot && eq[slot] === id) delete eq[slot];
  else Object.keys(eq).forEach(k => { if (eq[k] === id) delete eq[k]; });
  if (!quiet) save();
}
function recheckEquipped() {
  const c = APP.char;
  Object.entries(c.equipment).forEach(([k, id]) => { const it = itemById(c, id); if (!it || !fitsOk(it, k, c)) delete c.equipment[k]; });
  // fewer copies than slots (qty lowered): drop the extras
  const seen = {};
  Object.keys(c.equipment).forEach(k => { const id = c.equipment[k], it = itemById(c, id); seen[id] = (seen[id] || 0) + 1; if (it && seen[id] > (it.qty || 1)) delete c.equipment[k]; });
}

async function tryUnlock(pw) {
  if (!pw || APP.unlocking) return;
  APP.unlocking = true; APP.unlockError = ""; render();
  try {
    await unlockWithPassword(APP.lockErr, pw);
    APP.unlocking = false; APP.lockErr = null;
    if (APP.needsNewPassword) { APP.needsNewPassword = false; APP.screen = APP.char ? "sheet" : "roster"; await init(); toast("Unlocked — you have the latest rules"); return; }
    await init();
  } catch (e) {
    APP.unlocking = false; APP.unlockError = "That password didn't work. Check capital letters and try again."; render();
    setTimeout(() => { const f = document.getElementById("f-pass"); if (f) { f.focus(); f.select(); } }, 30);
  }
}
ACTIONS.enterNewPassword = () => { APP.screen = "locked"; render(); };

// ---- Glossary + definition popover (tap anywhere; hover on laptops)
async function rebuildGlossary() {
  if (!APP.terms) {
    try { const r = await fetch("data/terms.json"); APP.terms = r.ok ? (await r.json()).terms : []; } catch (e) { APP.terms = []; }
  }
  setSpellNames((APP.library?.spells || []).map(x => x.name));
  setGlossary([...(APP.library?.rules || []), ...(APP.campaign?.homebrew?.rules || []), ...APP.terms]);
}
const pop = () => document.getElementById("term-pop");
function termContent(key) {
  const i = key.indexOf(":");
  const kind = i > 0 ? key.slice(0, i) : "rule", name = i > 0 ? key.slice(i + 1) : key;
  if (kind === "rule" || kind === "condition" || kind === "mastery") {
    const g = glossaryEntry(name);
    return { title: g?.name || name, body: g ? formatText(g.text) : `<p class="muted">No definition in your rules data yet.</p>`, icon: kind === "condition" || /^(Blinded|Charmed|Deafened|Frightened|Grappled|Incapacitated|Invisible|Paralyzed|Petrified|Poisoned|Prone|Restrained|Stunned|Unconscious|Exhaustion)$/.test(name) ? conditionIcon(g?.name || name) : "" };
  }
  if (kind === "classFeature" || kind === "subclassFeature") {
    const [from, nm] = name.includes("|") ? name.split("|") : [APP.char?.class, name];
    const d = detailFor(APP, kind, nm, null, from);
    return { title: d.title, body: d.body, icon: "" };
  }
  const d = detailFor(APP, kind, name);
  return { title: d.title, body: d.body, icon: "" };
}
function showTerm(key, anchor, pinned) {
  const el = pop(); if (!el) return;
  const { title, body, icon } = termContent(key);
  el.innerHTML = `<div class="pop-head">${icon}<b>${esc(title)}</b><button class="iconbtn" data-a="closeTerm" aria-label="Close" style="width:34px;height:34px">${ICONS.close}</button></div><div class="pop-body">${body}</div>`;
  el.dataset.key = key; el.dataset.pinned = pinned ? "1" : "";
  el.classList.add("show");
  const r = anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  const w = Math.min(360, vw - 24);
  el.style.width = w + "px";
  let left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12);
  el.style.left = left + "px";
  const h = el.offsetHeight;
  const below = r.bottom + 8, above = r.top - 8 - h;
  el.style.top = (below + h < vh - 8 || above < 8 ? Math.min(below, vh - h - 8) : above) + "px";
}
function hideTerm() { const el = pop(); if (el) { el.classList.remove("show"); el.dataset.key = ""; } }
function bindTerms() {
  let hoverT = null, leaveT = null;
  const fine = matchMedia("(hover:hover) and (pointer:fine)");
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-term]");
    if (t) { e.preventDefault(); e.stopPropagation(); showTerm(t.dataset.term, t, true); return; }
    if (e.target.closest('[data-a="closeTerm"]')) { hideTerm(); return; }
    if (!e.target.closest("#term-pop")) hideTerm();
  }, true);
  document.addEventListener("mouseover", e => {
    if (!fine.matches) return;
    const t = e.target.closest("[data-term]");
    if (t) { clearTimeout(leaveT); clearTimeout(hoverT); hoverT = setTimeout(() => showTerm(t.dataset.term, t, false), 280); return; }
    if (e.target.closest("#term-pop")) { clearTimeout(leaveT); return; }
  });
  document.addEventListener("mouseout", e => {
    if (!fine.matches) return;
    if (e.target.closest("[data-term], #term-pop")) {
      clearTimeout(hoverT);
      leaveT = setTimeout(() => { const el = pop(); if (el && !el.dataset.pinned && !el.matches(":hover")) hideTerm(); }, 220);
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") hideTerm(); });
  // Scrolling closes a hover preview, but a definition you tapped open stays until you tap away.
  window.addEventListener("scroll", () => { const el = pop(); if (el && !el.dataset.pinned && !el.matches(":hover")) hideTerm(); }, { passive: true });
}
ACTIONS.toggleInfo = (el) => {
  const k = el.dataset.key;
  if (APP.info.has(k)) APP.info.delete(k); else APP.info.add(k);
  const y = window.scrollY; render(); window.scrollTo(0, y);
};

// Roll what casting a spell actually rolls (attack/save + damage or healing).
// Returns false when the text has nothing to roll.
function spellRoll(sp, slotLevel) {
  if (!sp) return false;
  const c = APP.char, info = analyzeSpell(sp), d = deriveCharacter(c), si = d.spellInfo;
  if (!si || (!info.attack && !info.save && !info.damage && !info.heal)) return false;
  const opts = { charLevel: c.level, slotLevel, spellLevel: sp.level };
  const parts = [];
  let crit = false, altBits = [];
  if (info.attack) {
    const r = rollD20(si.attackBonus - c.exhaustion * 2);
    crit = r.crit;
    parts.push({ label: r.crit ? "Natural 20!" : r.fumble ? "Natural 1" : info.attack, total: r.total, bd: `[${r.first}] ${fmtMod(r.mod).replace("+", "+ ").replace("−", "− ")}`, crit: r.crit, fumble: r.fumble });
    altBits.push(`Advantage <b>${r.adv}</b> · disadvantage <b>${r.dis}</b>`);
  }
  if (info.save) parts.push({ label: `${info.save} save`, total: si.dc, bd: `DC${info.half ? " · half damage on a success" : ""}` });
  const fx = info.damage || info.heal;
  if (fx) {
    const dice = castDice(fx.dice, info, opts);
    const mod = (fx.flat || 0) + (fx.addMod ? si.mod : 0);
    const f = `${crit ? dice.replace(/^(\d+)/, n => 2 * n) : dice}${mod ? (mod > 0 ? "+" : "") + mod : ""}`;
    const r = rollFormula(f);
    if (r) parts.push({ label: info.heal ? "Healing" : `${crit ? "Crit damage" : "Damage"}${info.damage?.type ? " · " + info.damage.type : ""}`, total: Math.max(0, r.total), bd: describeGroups(r), crit });
    if (slotLevel > sp.level && info.upcast) altBits.push(`upcast at level ${slotLevel}`);
    if (sp.level === 0 && info.cantripScale && dice !== fx.dice) altBits.push(`${dice} at your level`);
  }
  showRoll(`${sp.name}${slotLevel ? ` · level ${slotLevel} slot` : sp.level === 0 ? " · cantrip" : ""}`, parts, altBits.join(" · "));
  return true;
}

// Health feedback: trailing bar, floating number, shake on hits, and a red
// screen edge when a character is below 10% (stronger at 0).
function animateHp() {
  const v = document.getElementById("vignette");
  const c = APP.screen === "sheet" ? APP.char : null;
  if (!c) { v && v.classList.remove("on", "dying"); APP._hpSeen = null; unmountHp(); return; }
  const frac = c.hp.cur / Math.max(1, c.hp.max);
  if (v) { v.classList.toggle("on", frac < 0.10 && APP.prefs.vignette !== false); v.classList.toggle("dying", c.hp.cur <= 0); }
  const calm = APP.prefs.motion === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const seen = APP._hpSeen;
  APP._hpSeen = { id: c.id, cur: c.hp.cur, max: c.hp.max, temp: c.hp.temp };
  const ev = APP._hpEvent; APP._hpEvent = null;
  const canvas = mount.querySelector("#hpc");
  if (!canvas) { unmountHp(); return; }
  mountHp(canvas, { id: c.id, cur: c.hp.cur, max: c.hp.max, temp: c.hp.temp, dead: c.deathSaves.fail >= 3, calm });
  if (!seen || seen.id !== c.id || seen.max !== c.hp.max) return;
  if (c.hp.cur === seen.cur && c.hp.temp === seen.temp && !ev) return;
  const r = hpFx(seen, { cur: c.hp.cur, max: c.hp.max, temp: c.hp.temp }, { calm, haptics: APP.prefs.haptics !== "off", ev });
  if (r && r.big && v && !calm) { v.classList.remove("flash"); void v.offsetWidth; v.classList.add("flash"); setTimeout(() => v.classList.remove("flash"), 650); }
}

function refreshLevelResults() { const y = window.scrollY; render(); window.scrollTo(0, y); }

function applyLevelUp() {
  const c = APP.char, d = APP.lvl, p = levelPlan(APP);
  const ids = new Set(p.steps.map(s => s.id));
  const before = { level: c.level, con: c.abilities.con };
  const log = [];
  let featHpNow = 0;
  // Tough and similar: +2 for every level gained after the feat was taken
  const perLevel = (c.feats || []).reduce((n, name) => n + (featHp(featDef(APP, name))?.perLevel || 0), 0);
  if (ids.has("asi")) {
    if (d.feat && d.feat !== ASI_FEAT) {
      const f = featDef(APP, d.feat);
      c.feats.push(d.feat); log.push("Feat: " + d.feat);
      if (f) { const r = applyFeat(c, f, d.next, d.featAb); log.push(...r.log); featHpNow = r.hp; }
    }
    else { const r = asiResult(c, d); ABILITIES.forEach(a => { if (r[a] !== c.abilities[a]) log.push(`${ABILITY_LABEL[a]} ${c.abilities[a]}→${r[a]}`); }); c.abilities = r; }
  }
  if (!d.fromCreation) {
    const conMod = abilityMod(c.abilities.con), oldConMod = abilityMod(before.con);
    const die = c.hitDice.die || 8;
    const gain = (d.hpMode === "roll" && d.rolled ? Math.max(1, d.rolled + conMod) : hpAverageGain(die, conMod)) + (conMod - oldConMod) * before.level;
    const extra = featHpNow + (d.fromCreation ? 0 : perLevel);
    c.xp = Math.max(c.xp || 0, xpForLevel(d.next));
    c.level = d.next; c.hp.max += gain + extra; c.hp.cur += gain + extra; c.hitDice.total = c.level;
    log.unshift(`+${gain + extra} HP`);
  }
  if (d.fromCreation && featHpNow) { c.hp.max += featHpNow; c.hp.cur += featHpNow; }
  if (ids.has("subclass") && d.subclass) { c.subclass = d.subclass; log.push("Subclass: " + d.subclass); }
  if (ids.has("style") && d.style) { c.feats.push(d.style); log.push("Fighting style: " + d.style); }
  if (ids.has("expertise")) d.expertise.forEach(id => { if (!c.skillExpertise.includes(id)) c.skillExpertise.push(id); if (!c.skillProf.includes(id)) c.skillProf.push(id); });
  if (ids.has("mastery")) c.masteries = [...new Set([...(c.masteries || []), ...d.mastery])];
  const og = p.steps.find(s => s.id === "options");
  if (og) { c.choices[og.group.key] = [...new Set([...(c.choices[og.group.key] || []), ...d.options])]; log.push(`${og.group.label}: ${d.options.join(", ")}`); }
  if (ids.has("cantrips") || ids.has("spells")) [...d.cantrips, ...d.spells].forEach(name => {
    if (!c.spellcasting.spells.some(s => s.name === name)) c.spellcasting.spells.push({ name, prepared: true, always: false });
  });
  const lineage = syncLineageSpells(c, APP.library, APP.campaign);
  if (lineage.length) log.push(`Species spells: ${lineage.join(", ")}`);
  c.levelLog.push({ level: d.next, at: new Date().toISOString().slice(0, 10), summary: log.join("; ") });
  save();
  APP.lvl = null; APP.screen = "sheet"; APP.sheetTab = "stats";
  if (APP.shopAfterChoices) { APP.shopAfterChoices = false; APP.sheetTab = "gear"; openModal({ type: "shop" }); }
  render(); window.scrollTo(0, 0);
  toast(d.fromCreation ? (APP.sheetTab === "gear" ? "Now spend your gold on starting gear" : "Level 1 choices saved") : `${c.name} is now level ${c.level}!`);
}

// ---- drag and drop (laptop; phones use tap-then-tap)
function bindDrag() {
  const mark = id => document.querySelectorAll("[data-drop-slot]").forEach(el => {
    const it = itemById(APP.char, id);
    el.classList.toggle("can-drop", !!it && fitsOk(it, el.dataset.dropSlot, APP.char));
  });
  document.addEventListener("pointerdown", e => { APP._pressTarget = e.target; }, true);
  const clear = () => document.querySelectorAll(".can-drop,.drag-over").forEach(el => el.classList.remove("can-drop", "drag-over"));
  document.addEventListener("dragstart", e => {
    const el = e.target.closest && e.target.closest("[data-drag-item]");
    if (!el || !APP.char) return;
    // +/- and fields never start a drag (the browser reports the row as the target, so check where the press began)
    if (APP._pressTarget && APP._pressTarget.closest && APP._pressTarget.closest(".stepper, input, select, textarea, .infobtn, .bag-menu")) { e.preventDefault(); return; }
    APP.dragId = el.dataset.dragItem;
    APP.dragFrom = el.dataset.dropSlot || null;
    e.dataTransfer.setData("text/plain", APP.dragId);
    e.dataTransfer.effectAllowed = "move";
    const it = itemById(APP.char, APP.dragId);
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost"; ghost.textContent = it ? it.name : "";
    document.body.appendChild(ghost);
    try { e.dataTransfer.setDragImage(ghost, 16, 16); } catch (err) { }
    setTimeout(() => ghost.remove(), 0);
    mark(APP.dragId);
    document.body.classList.add("dragging");
  });
  document.addEventListener("dragend", () => { APP.dragId = null; clear(); document.body.classList.remove("dragging"); });
  document.addEventListener("dragover", e => {
    if (!APP.dragId) return;
    const slot = e.target.closest("[data-drop-slot]");
    const bag = e.target.closest("[data-drop-bag]");
    const it = itemById(APP.char, APP.dragId);
    if ((slot && it && fitsOk(it, slot.dataset.dropSlot, APP.char)) || (bag && slotOf(APP.char, APP.dragId))) {
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".drag-over").forEach(x => x.classList.remove("drag-over"));
      (slot || bag).classList.add("drag-over");
    }
  });
  document.addEventListener("drop", e => {
    if (!APP.dragId) return;
    const id = APP.dragId, from = APP.dragFrom; APP.dragId = null; APP.dragFrom = null;
    const slot = e.target.closest("[data-drop-slot]");
    const bag = e.target.closest("[data-drop-bag]");
    e.preventDefault(); clear(); document.body.classList.remove("dragging");
    if (slot) { equip(id, slot.dataset.dropSlot, from); }
    else if (bag && slotOf(APP.char, id)) { unequip(id, false, from); render(); toast("Moved to your bag"); }
  });
}

Object.assign(ACTIONS, dmActions(APP, { render, toast, setRules: () => { setRules(); rebuildGlossary(); } }));
init();
