// Classic sheet Tools: a grid of small apps. Each tile opens a tool (a modal) or runs a sheet action. ASCII only.
import { esc, modalShell } from "../ui.js";
import { rollsTab } from "./stats.js";
import { condNotes } from "../conditions.js";

const P = {
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.1"/><circle cx="15.5" cy="15.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8.5 12h1M12 12h1M15.5 12h.5M8.5 16h1M12 16h1M15.5 16h.5"/>',
  cond: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
  hp: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  init: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  short: '<path d="M6 3h12M6 21h12M7 3c0 5 5 5 5 9s-5 4-5 9M17 3c0 5-5 5-5 9s5 4 5 9"/>',
  long: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  insp: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.4 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  level: '<path d="M12 20V5M6 11l6-6 6 6"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  rules: '<path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M8 4v13"/>',
  shop: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v11H4zM9 20v-6h6v6"/>',
  pdf: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'
};
const ico = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k]}</svg>`;
export const dieIco = ico("dice");
export const toolIco = ico;

// The round hub on the sheet bar fans these out. [id, label, icon]
export const HUB = [["dice", "Dice", "dice"], ["cond", "Conditions", "cond"], ["calc", "Calculator", "calc"], ["rest", "Rest", "short"], ["init", "Initiative", "init"]];
// Phone: an arc above the hub. Wide: a column to the right of the rail. Pixel offsets from the hub centre.
const HUB_XY = [[-122, -78], [-74, -144], [0, -166], [74, -144], [122, -78]];
const HUB_WXY = [[74, -132], [116, -66], [132, 0], [116, 66], [74, 132]];
const HUB_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M13.2 2.5 5 13.2h5.6l-1 8.3 8.4-11.1h-5.7z"/></svg>';
const HUB_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
export function hubCell(app) {
  const open = !!app.hubOpen;
  const fan = open ? `<div class="hubfan" role="menu" aria-label="Quick">${HUB.map(([id, label, icon], i) =>
    `<button class="hubopt" role="menuitem" data-a="hubGo" data-id="${id}" style="--x:${HUB_XY[i][0]}px;--y:${HUB_XY[i][1]}px;--wx:${HUB_WXY[i][0]}px;--wy:${HUB_WXY[i][1]}px;--d:${i * 30}ms"><span class="ho-ic">${ico(icon)}</span><span class="ho-l">${esc(label)}</span></button>`).join("")}</div>` : "";
  return `<div class="hubcell">${open ? `<div class="hubscrim" data-a="hubClose"></div>` : ""}<div class="hubanchor">${fan}<button class="hubbtn ${open ? "open" : ""}" data-a="hubToggle" aria-haspopup="menu" aria-expanded="${open}" aria-label="Quick">${open ? HUB_CLOSE : HUB_ICON}</button></div><span class="hublbl">Quick</span></div>`;
}

// [id, label, icon, how]: how = {modal} opens a tool, {a, ...attrs} runs an action.
export const TOOLS = [
  ["dice", "Dice roller", "dice", { modal: "dice" }],
  ["calc", "Calculator", "calc", { modal: "calc" }],
  ["cond", "Conditions", "cond", { a: "openConditions" }],
  ["hp", "Hit points", "hp", { a: "openHp" }],
  ["init", "Initiative", "init", { a: "rollInit" }],
  ["short", "Short rest", "short", { a: "openShortRest" }],
  ["long", "Long rest", "long", { a: "openLongRest" }],
  ["insp", "Inspiration", "insp", { a: "toggleInsp" }],
  ["level", "Level up", "level", { a: "openLevelMenu" }],
  ["notes", "Notes", "notes", { a: "goNotes" }],
  ["rules", "Rules", "rules", { a: "sheetTab", attrs: 'data-tab="rules"' }],
  ["shop", "Shop", "shop", { a: "openShop" }],
  ["pdf", "Sheet PDF", "pdf", { a: "downloadPdf" }]
];

export function toolGrid(app, c) {
  const badge = id => id === "cond" ? (c.conditions.length + (c.exhaustion > 0 ? 1 : 0) || "") : id === "insp" ? (c.inspiration ? "On" : "") : "";
  return `<section class="toolgrid" aria-label="Tools">${TOOLS.map(([id, label, icon, how]) => {
    const b = badge(id), act = how.modal ? `data-a="toolOpen" data-id="${how.modal}"` : `data-a="${how.a}" ${how.attrs || ""}`;
    return `<button class="toolbtn press" ${act}><span class="tb-ic">${ico(icon)}${b !== "" ? `<i class="tb-b">${esc(b)}</i>` : ""}</span><span class="tb-l">${esc(label)}</span></button>`;
  }).join("")}</section>`;
}

// ---- calculator (no eval: a small parser) ----
export function calcEval(src) {
  const t = String(src).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").match(/\d*\.?\d+|[-+*/()]/g);
  if (!t || t.join("") !== String(src).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "")) return null;
  let i = 0;
  const num = () => {
    if (t[i] === "(") { i++; const v = add(); if (t[i] !== ")") throw 0; i++; return v; }
    if (t[i] === "-") { i++; return -num(); }
    if (t[i] === "+") { i++; return num(); }
    const v = parseFloat(t[i]); if (!Number.isFinite(v)) throw 0; i++; return v;
  };
  const mul = () => { let v = num(); while (t[i] === "*" || t[i] === "/") { const o = t[i++], r = num(); v = o === "*" ? v * r : v / r; } return v; };
  const add = () => { let v = mul(); while (t[i] === "+" || t[i] === "-") { const o = t[i++], r = mul(); v = o === "+" ? v + r : v - r; } return v; };
  try { const v = add(); return i === t.length && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null; } catch (e) { return null; }
}
export function calcPress(st, k) {
  const s = { expr: st.expr || "", out: st.out || "" };
  if (k === "C") return { expr: "", out: "" };
  if (k === "back") return { expr: s.expr.slice(0, -1), out: "" };
  if (k === "=") { const v = calcEval(s.expr); return v == null ? { expr: s.expr, out: "Error" } : { expr: String(v), out: "" }; }
  const base = s.out === "" && /^[-+×÷]/.test(k) ? s.expr : s.expr;
  return { expr: (base + k).slice(0, 60), out: "" };
}
const KEYS = ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "back", "="];
function calcBody(app) {
  const st = app.calc || { expr: "", out: "" }, live = st.expr ? calcEval(st.expr) : null;
  return `<div class="calc"><div class="calc-d" aria-live="polite"><span>${esc(st.expr || "0")}</span><b>${esc(st.out || (live != null && /[-+×÷−]/.test(st.expr.slice(1)) ? "= " + live : ""))}</b></div>
    <div class="calc-k">${KEYS.map(k => `<button class="calc-b${/[=]/.test(k) ? " eq" : /[÷×−+]/.test(k) ? " op" : ""}" data-a="calcKey" data-k="${k}" aria-label="${k === "back" ? "Delete" : k}">${k === "back" ? "⌫" : k}</button>`).join("")}</div></div>`;
}

export function renderToolModal(app, c, d) {
  const id = app.modal.id;
  if (id === "calc") return modalShell("Calculator", calcBody(app), `<button class="btn" data-a="closeModal">Done</button>`, "toolm");
  return modalShell("Dice roller", rollsTab(app, c, d), `<button class="btn" data-a="closeModal">Done</button>`, "toolm toolwide");
}

// What the active conditions do, for the conditions modal.
export function condEffectsBlock(c) {
  const n = condNotes(c); if (!n.length) return "";
  return `<div class="condfx"><h3>On your rolls</h3>${n.map(x => `<div class="cfx"><b>${esc(x.name)}</b>${x.applied.length ? `<span>${x.applied.map(esc).join(". ")}</span>` : ""}${x.manual.length ? `<span class="m">${x.manual.map(esc).join(". ")}</span>` : ""}</div>`).join("")}</div>`;
}
