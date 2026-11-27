// Hints: one-time bubbles over the parts of this app that are new to a D&D sheet. Each is shown once,
// until "Got it", and can be switched back on in Settings. State: localStorage dnd-hints-v1 {id: time}.
// The bubble lives in #hint-root, outside #app. Content is in HINTS (not copy-linted). ASCII only.

const KEY = "dnd-hints-v1";
// where = screen the hint belongs to; sel = first visible match; wideSel/wideBody = laptop wording (1100px and up).
export const HINTS = [
  { id: "quick", where: "sheet", sel: ".hubbtn", wideSel: ".hubfan", title: "Quick tools",
    body: "Tap for dice, effects, rest, initiative and your own shortcuts. Edit the list in Settings.",
    wideBody: "Always open at the side: dice, effects, rest, initiative. Edit the list in Settings." },
  { id: "effects", where: "sheet", sel: ".addcond", title: "Active effects",
    body: "Conditions, spell effects and drains that change your numbers. End any of them with one tap." },
  { id: "hotbar", where: "sheet", sel: ".hotbar-panel, .hb-slim", title: "Hotbar",
    body: "Pin attacks, spells and items here. One tap uses them." },
  { id: "trackers", where: "sheet", sel: ".trkpanel", title: "Trackers",
    body: "Limited uses with their reset. Tap a pip to spend one. Long rest refills them." },
  { id: "tools", where: "sheet", sel: ".toolgrid", title: "Tools",
    body: "Small apps for the table. The ones you star show in Quick tools." }
];

HINTS.splice(0, 0,
  { id: "subtabs", where: "sheet", sel: ".classic .subtabs", title: "Sheet sections",
    body: "Play, Sheet, Features, Spells, Gear and Tools. Play is the same screen on the Classic and Advanced sheets." },
  { id: "hpbar", where: "sheet", sel: '[data-a="openHp"]', title: "Hit points",
    body: "Tap the bar to take damage, heal or add temporary HP." });
HINTS.push(
  { id: "playsort", where: "sheet", sel: ".pm-top .psm", title: "Sort and show",
    body: "Sort by type, level or uses left. Hotbar items stay on top. Choose which sources appear." },
  { id: "playview", where: "sheet", sel: ".pvseg", title: "One list at a time",
    body: "Action, Bonus, Reaction, Spells or More. Each shows only its own rows." },
  { id: "playdetail", where: "sheet", sel: ".pm-side .det", title: "Details",
    body: "Select a row to read it here. Your last rolls are listed underneath." },
  { id: "playturn", where: "sheet", sel: ".pm .tracker", title: "Turn tracker",
    body: "Mark Action, Bonus and Reaction as you use them. Next turn clears them." },
  { id: "slots", where: "sheet", sel: ".pm-rail .pips .pip, .pm-slots .pips .pip", title: "Spell slots",
    body: "Tap a gem to spend a slot or give it back." },
  { id: "rests", where: "sheet", sel: '[data-a="openShortRest"]', title: "Rests",
    body: "Short rest spends hit dice. Long rest refills HP, slots and trackers, then offers changes." },
  { id: "shop", where: "sheet", sel: ".shopban", title: "Shop",
    body: "Spend gold on gear. Price and weight show before you buy." },
  { id: "backup", where: "home", sel: ".hbk", title: "Backups",
    body: "Export every character to a file. Do it before clearing browser data." }
);

const wideNow = () => typeof matchMedia === "function" && matchMedia("(min-width:1100px)").matches;
export function hintState() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || "{}"); return s && typeof s === "object" ? s : {}; } catch (e) { return {}; }
}
export const hintsOn = prefs => !prefs || prefs.hints !== false;
export function hintMark(id) { const s = hintState(); s[id] = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* not kept */ } }
export function hintsReset() { try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ } }
export function hintsLeft() { const s = hintState(); return HINTS.filter(h => !s[h.id]).length; }

const visible = sel => [...document.querySelectorAll(sel)].find(el => { const r = el.getBoundingClientRect(); return el.offsetParent !== null && r.width > 4 && r.height > 4; }) || null;
// The first unseen hint on this screen whose target is on screen: { hint, el }.
export function nextHint(screen) {
  const s = hintState(), wide = wideNow();
  for (const h of HINTS) {
    if (h.where !== screen || s[h.id]) continue;
    const el = visible(wide && h.wideSel ? h.wideSel : h.sel);
    if (el) return { hint: h, el, body: wide && h.wideBody ? h.wideBody : h.body };
  }
  return null;
}

let shown = null;
const root = () => document.getElementById("hint-root") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "hint-root" }));
export function hintShownId() { return shown; }
export function clearHint() { shown = null; const r = document.getElementById("hint-root"); if (r) r.innerHTML = ""; }
function zoomOf() { const e = root(); const k = e && e.offsetWidth ? e.getBoundingClientRect().width / e.offsetWidth : 1; return k > 0.2 && k < 5 ? k : 1; }
export function showHint({ hint, el, body }) {
  shown = hint.id;
  const r = el.getBoundingClientRect(), k = zoomOf(), vw = innerWidth, vh = innerHeight, w = Math.min(300, vw - 24);
  root().innerHTML = `<div class="hint-ring" style="left:${Math.round((r.left - 4) / k)}px;top:${Math.round((r.top - 4) / k)}px;width:${Math.round((r.width + 8) / k)}px;height:${Math.round((r.height + 8) / k)}px"></div>
    <div class="hint-bubble" id="hint-bubble" role="note" aria-label="Hint: ${hint.title}">
      <h3>${hint.title}</h3><p>${body}</p>
      <div class="hint-act"><button class="linkbtn" data-a="hintsOff">Turn off hints</button><span class="grow"></span><button class="btn sm pri" data-a="hintDone" data-id="${hint.id}">Got it</button></div>
    </div>`;
  const b = document.getElementById("hint-bubble");
  b.style.width = Math.round(w / k) + "px";
  const h = b.offsetHeight * k, cx = r.left + r.width / 2;
  const left = Math.max(12, Math.min(vw - w - 12, cx - w / 2));
  const below = r.bottom + 14 + h <= vh - 70 || r.top - 14 - h < 8;
  const top = below ? Math.min(r.bottom + 14, vh - h - 70) : r.top - 14 - h;
  b.style.left = Math.round(left / k) + "px"; b.style.top = Math.round(Math.max(8, top) / k) + "px";
  b.style.setProperty("--ax", Math.round(Math.max(18, Math.min(w - 18, cx - left)) / k) + "px");
  b.classList.toggle("up", !below);
}
