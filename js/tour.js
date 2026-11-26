// Guided tour: state (localStorage dnd-tour-v1) + the overlay. The overlay lives in #tour-root,
// outside #app, so redraws do not remove it. Content is in tourdata.js. ASCII only.
import { TOURS, REWARD } from "./tourdata.js";

const KEY = "dnd-tour-v1";
export function tourState() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || "{}"); return s && typeof s === "object" ? s : {}; } catch (e) { return {}; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage denied: tour state is not kept */ } }
export function tourUnseen(id) { return !!TOURS[id] && !tourState()[id]; }
export function tourMark(id, status) { const s = tourState(); s[id] = status; save(s); }
export function rewardEarned() { return !!tourState().earned; }
// Tours start themselves the first time (app.js maybeAutoTour); the ? button replays them. Kept so older views still import it.
export function tourCard() { return ""; }

let run = null; // { id, i }
// A step can name a place to be in first (st.go); the app supplies the mover.
export const tourHooks = { go: null };
const root = () => document.getElementById("tour-root") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "tour-root" }));
const target = sel => [...document.querySelectorAll(sel)].find(el => { const r = el.getBoundingClientRect(); return el.offsetParent !== null && r.width > 4 && r.height > 4; }) || null;

export function tourActive() { return !!run; }
// A tour may start when its first target is on screen (or the step moves there itself).
export function tourReady(id) { const st = TOURS[id] && TOURS[id].steps[0]; return !!st && (!st.sel || !!st.go || !!target(st.sel)); }
export function tourStep() { return run ? { id: run.id, i: run.i, n: TOURS[run.id].steps.length } : null; }

export function startTour(id) {
  if (!TOURS[id]) return false;
  run = { id, i: 0 };
  show();
  return true;
}
export function tourGo(d) {
  if (!run) return;
  const n = TOURS[run.id].steps.length, i = run.i + d;
  if (i >= n) return finishTour();
  run.i = Math.max(0, i);
  show();
}
export function finishTour() {
  if (!run) return null;
  const id = run.id; run = null; clear(); tourMark(id, "done");
  const s = tourState(); let fresh = false;
  if (!s.earned) { s.earned = Date.now(); save(s); fresh = true; }
  document.dispatchEvent(new CustomEvent("tour-end", { detail: { id, status: "done", fresh } }));
  return { id, fresh };
}
export function skipTour() {
  if (!run) return;
  const id = run.id; run = null; clear();
  if (!tourState()[id]) tourMark(id, "skipped");
  document.dispatchEvent(new CustomEvent("tour-end", { detail: { id, status: "skipped", fresh: false } }));
}
function clear() { const r = document.getElementById("tour-root"); if (r) r.innerHTML = ""; document.body.classList.remove("touring"); }

export function show() {
  if (!run) return;
  const t = TOURS[run.id], st = t.steps[run.i], n = t.steps.length;
  if (st.go && tourHooks.go) tourHooks.go(st.go);
  const el = st.sel ? target(st.sel) : null;
  if (el) el.scrollIntoView({ block: "center", inline: "nearest" });
  const r = el ? el.getBoundingClientRect() : null, pad = 6, k = zoomOf();
  // Rects are screen pixels; the tour layer sits inside body, which Settings > Size may zoom. Divide that out.
  const hole = r ? `<div class="tour-hole" style="left:${Math.round((r.left - pad) / k)}px;top:${Math.round((r.top - pad) / k)}px;width:${Math.round((r.width + pad * 2) / k)}px;height:${Math.round((r.height + pad * 2) / k)}px"></div>` : `<div class="tour-hole none"></div>`;
  const dots = Array.from({ length: n }, (_, k) => `<i class="${k === run.i ? "on" : k < run.i ? "past" : ""}"></i>`).join("");
  root().innerHTML = `<div class="tour-veil" data-a="tourNoop"></div>${hole}
    <div class="tour-card" role="dialog" aria-modal="true" aria-label="${t.name}, step ${run.i + 1} of ${n}" id="tour-card">
      <div class="tour-prog" aria-hidden="true">${dots}<em>${run.i + 1} of ${n}</em></div>
      <h2>${st.title}</h2><p>${st.body}</p>
      <div class="tour-act">
        <button class="linkbtn" data-a="tourSkip">Skip tour</button>
        <span class="grow"></span>
        ${run.i ? `<button class="btn sm" data-a="tourBack">Back</button>` : ""}
        <button class="btn sm pri" data-a="tourNext" id="tour-next">${run.i === n - 1 ? "Done" : "Next"}</button>
      </div></div>`;
  document.body.classList.add("touring");
  place(r);
  const nx = document.getElementById("tour-next"); if (nx) nx.focus({ preventScroll: true });
}
// Page zoom applied to the tour layer (1 unless Settings > Size zooms body).
function zoomOf() { const e = root(); const k = e && e.offsetWidth ? e.getBoundingClientRect().width / e.offsetWidth : 1; return k > 0.2 && k < 5 ? k : 1; }
function place(r) {
  const c = document.getElementById("tour-card"); if (!c) return;
  const k = zoomOf(), vw = innerWidth, vh = innerHeight, w = Math.min(380, vw - 24);
  c.style.width = Math.round(w / k) + "px";
  const h = c.offsetHeight * k;
  let top, left = Math.max(12, Math.min(vw - w - 12, r ? r.left + r.width / 2 - w / 2 : (vw - w) / 2));
  if (!r) top = (vh - h) / 2;
  else if (r.bottom + 16 + h <= vh - 8) top = r.bottom + 16;
  else if (r.top - 16 - h >= 8) top = r.top - 16 - h;
  else top = Math.max(8, vh - h - 12);
  c.style.top = Math.round(top / k) + "px"; c.style.left = Math.round(left / k) + "px";
}
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => { if (run) show(); });
  document.addEventListener("keydown", e => {
    if (!run) return;
    if (e.key === "Escape") { e.preventDefault(); skipTour(); }
    else if (e.key === "ArrowRight") tourGo(1);
    else if (e.key === "ArrowLeft") tourGo(-1);
  });
}
export { REWARD, TOURS };
