// Roll stage: a full-screen die roll that plays over the sheet when a roll is made.
// A tumbling d20, the modifier, then the other results; a natural 20 and a natural 1
// each get their own effect (particles, flash, shake, cracking glass). Tap, Esc or
// Space skips ahead, then closes. The roll card underneath keeps the result.
// ASCII only in this file: use \u escapes for symbols.
import { sfx, buzz } from "./sfx.js";

let root = null, run = 0, pending = null, parts = [], raf = 0, closeT = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => 1 + Math.floor(Math.random() * n);
const reduced = () => document.documentElement.getAttribute("data-motion") === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = s => root.querySelector(s);

function build() {
  if (root) return;
  root = document.createElement("div");
  root.className = "rstage"; root.id = "rstage"; root.setAttribute("role", "status"); root.setAttribute("aria-live", "assertive"); root.hidden = true;
  root.innerHTML = '<div class="rs-scrim"></div><div class="rs-rays"></div><div class="rs-vig"></div><svg class="rs-cracks" preserveAspectRatio="none" aria-hidden="true"></svg><canvas class="rs-canvas" aria-hidden="true"></canvas>' +
    '<div class="rs-card"><div class="rs-title"></div><div class="rs-die"><i class="rs-ring"></i><div class="rs-dd"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon class="rs-pg" points="50,4 90,27 90,73 50,96 10,73 10,27"/><polygon class="rs-ln" points="50,24 78,68 22,68"/><path class="rs-ln" d="M50 24L10 27M50 24L90 27M50 24L50 4M78 68L90 27M78 68L90 73M78 68L50 96M22 68L10 27M22 68L10 73M22 68L50 96"/></svg><b class="rs-num"></b></div></div>' +
    '<div class="rs-line"></div><div class="rs-res"></div><div class="rs-banner"></div><div class="rs-note"></div></div>' +
    '<div class="rs-flash"></div><div class="rs-hint">Tap to continue</div>';
  document.body.appendChild(root);
  root.addEventListener("click", () => dismissRollStage());
}

function fit() { const c = $(".rs-canvas"), r = Math.min(2, window.devicePixelRatio || 1); c.width = innerWidth * r; c.height = innerHeight * r; c.getContext("2d").setTransform(r, 0, 0, r, 0, 0); }
function center() { const r = $(".rs-die").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

function loop() {
  const c = $(".rs-canvas"), g = c.getContext("2d");
  g.clearRect(0, 0, innerWidth, innerHeight); g.globalCompositeOperation = "lighter";
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 60 && p.y > -80);
  parts.forEach(p => {
    p.life--; p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.r += p.spin;
    g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.6)); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
    if (p.kind === "spark" || p.kind === "ember") { g.beginPath(); g.arc(0, 0, p.s, 0, 6.3); g.fill(); }
    else if (p.kind === "conf") { g.globalCompositeOperation = "source-over"; g.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s); }
    else { g.globalCompositeOperation = "source-over"; g.beginPath(); g.moveTo(0, -p.s); g.lineTo(p.s * 0.7, p.s * 0.8); g.lineTo(-p.s * 0.8, p.s * 0.5); g.closePath(); g.fill(); g.strokeStyle = "rgba(255,90,70,.6)"; g.lineWidth = 1; g.stroke(); }
    g.restore();
  });
  raf = parts.length ? requestAnimationFrame(loop) : 0;
  if (!raf) g.clearRect(0, 0, innerWidth, innerHeight);
}
function spawn(list) { parts.push(...list); if (!raf) raf = requestAnimationFrame(loop); }
function burst20() {
  const { x, y } = center(), L = [], gold = ["#FFD768", "#FFF1B8", "#FFBB33", "#FF9A00", "#fff"], cols = ["#FFD768", "#FFB020", "#FF7A59", "#8EE3C8", "#FFF1B8", "#B79CFF"];
  const n = innerWidth < 700 ? 110 : 190, k = innerWidth < 700 ? 90 : 150;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = 3 + Math.random() * 15; L.push({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.14, drag: 0.975, s: 1.5 + Math.random() * 3.5, r: 0, spin: 0, life: 70 + Math.random() * 90, max: 160, c: gold[i % 5] }); }
  for (let i = 0; i < k; i++) L.push({ kind: "conf", x: Math.random() * innerWidth, y: -20 - Math.random() * 300, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, g: 0.05, drag: 0.995, s: 3 + Math.random() * 5, r: Math.random() * 6, spin: (Math.random() - 0.5) * 0.3, life: 220 + Math.random() * 120, max: 340, c: cols[i % cols.length] });
  spawn(L);
}
function burst1() {
  const { x, y } = center(), L = [];
  for (let i = 0; i < 46; i++) { const a = Math.random() * 6.283, v = 2 + Math.random() * 11; L.push({ kind: "shard", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, g: 0.45, drag: 0.985, s: 5 + Math.random() * 13, r: Math.random() * 6, spin: (Math.random() - 0.5) * 0.4, life: 100 + Math.random() * 60, max: 160, c: ["#3a0b0b", "#6a1410", "#1a0505", "#8a1c14"][i % 4] }); }
  for (let i = 0; i < 60; i++) L.push({ kind: "ember", x: Math.random() * innerWidth, y: innerHeight + Math.random() * 60, vx: (Math.random() - 0.5) * 1.2, vy: -1 - Math.random() * 2.6, g: -0.004, drag: 0.999, s: 1 + Math.random() * 2.6, r: 0, spin: 0, life: 150 + Math.random() * 120, max: 270, c: ["#ff5a2a", "#ff2a1a", "#ffa030"][i % 3] });
  spawn(L);
}
function cracks() {
  const svg = $(".rs-cracks"), w = innerWidth, h = innerHeight, c = center(); svg.setAttribute("viewBox", "0 0 " + w + " " + h); let d = "";
  const mk = (x, y, a, len, depth) => {
    let p = "M" + x.toFixed(0) + " " + y.toFixed(0), cx = x, cy = y;
    for (let s = 0; s < len; s++) { a += (Math.random() - 0.5) * 0.9; const l = 24 + Math.random() * 46; cx += Math.cos(a) * l; cy += Math.sin(a) * l; p += " L" + cx.toFixed(0) + " " + cy.toFixed(0); if (depth < 2 && Math.random() < 0.35) d += mk(cx, cy, a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), Math.max(2, len - 3), depth + 1); }
    return '<path d="' + p + '" pathLength="1"/>';
  };
  for (let i = 0; i < 11; i++) d += mk(c.x, c.y, i / 11 * 6.283 + Math.random() * 0.4, 8 + Math.floor(Math.random() * 6), 0);
  svg.innerHTML = d;
  svg.querySelectorAll("path").forEach((p, i) => { p.style.animationDelay = (i % 11) * 28 + "ms"; });
}
function shake(cls) { const a = document.getElementById("app"); a.classList.remove("rs-shake", "rs-shake20"); void a.offsetWidth; a.classList.add(cls); setTimeout(() => a.classList.remove(cls), 700); }
function banner(txt) { const b = $(".rs-banner"); b.textContent = ""; txt.split("").forEach((ch, i) => { const s = document.createElement("span"); s.style.animationDelay = i * 48 + "ms"; s.textContent = ch === " " ? "\u00a0" : ch; b.appendChild(s); }); }

// Turn the roll card's parts into steps: the d20 (if any) first, then the rest.
function plan(title, ps) {
  const steps = [];
  ps.forEach((p, i) => {
    const m = /^\[(\d+)\]/.exec(String(p.bd || ""));
    const death = i === 0 && /death save/i.test(title);
    if (i === 0 && (m || death)) {
      const val = m ? +m[1] : +p.total, rest = m ? String(p.bd).slice(m[0].length).trim() : "";
      steps.push({ t: "d20", val, mod: rest, total: +p.total, label: p.label, nat: val === 20 ? "20" : val === 1 ? "1" : null });
    } else steps.push({ t: "num", label: p.label, total: p.total, bd: String(p.bd || "").replace(/<[^>]*>/g, ""), crit: !!p.crit, dmg: /damage/i.test(p.label || "") });
  });
  return steps;
}

export function playRollStage(title, ps, mode) {
  if (mode === "off" || !ps || !ps.length) return;
  const steps = plan(title, ps), anyNat = steps.some(s => s.t === "d20" && s.nat);
  if (mode === "crits" && !anyNat) return;
  build(); if (pending) finish();
  const id = ++run, calm = reduced();
  pending = { id, skip: false, done: false };
  root.hidden = false; root.className = "rstage on"; fit(); parts = [];
  $(".rs-title").textContent = title; $(".rs-line").textContent = ""; $(".rs-line").classList.remove("on"); $(".rs-res").textContent = ""; $(".rs-banner").textContent = ""; $(".rs-note").textContent = ""; $(".rs-note").classList.remove("on");
  $(".rs-die").className = "rs-die"; $(".rs-die").hidden = !steps.some(s => s.t === "d20"); $(".rs-cracks").innerHTML = ""; $(".rs-hint").style.opacity = 0;
  const die = $(".rs-die"), num = $(".rs-num"), skipped = () => pending && pending.skip;
  const wait = async ms => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (skipped() || id !== run) return false; await sleep(30); } return true; };
  (async () => {
    let missed = false;
    for (const st of steps) {
      if (id !== run) return;
      if (st.t === "d20") {
        die.className = "rs-die"; void die.offsetWidth; die.classList.add("roll"); num.textContent = "";
        if (!skipped() && !calm) { let i = 0, d = 26; while (i < 20 && !skipped() && id === run) { num.textContent = String(rnd(20)); sfx("rtick"); await sleep(d); d += 3; i++; } }
        if (id !== run) return;
        num.textContent = st.val; die.className = "rs-die land"; sfx("rland");
        const ln = $(".rs-line"); ln.textContent = ""; const a = document.createElement("span"), b = document.createElement("b");
        a.textContent = st.val + (st.mod ? " " + st.mod : "") + " = "; b.textContent = st.total; if (st.nat === "1") b.className = "rs-struck"; ln.append(a, b); ln.classList.add("on");
        if (st.nat === "20") {
          root.classList.add("c20"); banner("Critical Hit"); sfx("nat20"); buzz([30, 40, 30, 40, 80]);
          if (!calm) { const f = $(".rs-flash"); f.className = "rs-flash go"; const rg = $(".rs-ring"); rg.classList.remove("go"); void rg.offsetWidth; rg.classList.add("go"); burst20(); shake("rs-shake20"); }
          $(".rs-note").textContent = "Natural 20"; $(".rs-note").classList.add("on"); await wait(calm ? 700 : 1500);
        } else if (st.nat === "1") {
          missed = true; root.classList.add("c1"); banner("Critical Miss"); sfx("nat1"); buzz([140]);
          if (!calm) { const f = $(".rs-flash"); f.className = "rs-flash red go"; cracks(); burst1(); shake("rs-shake"); document.getElementById("app").classList.add("rs-gray"); setTimeout(() => die.classList.add("shatter"), 500); setTimeout(() => document.getElementById("app").classList.remove("rs-gray"), 2400); }
          $(".rs-note").textContent = "Natural 1"; $(".rs-note").classList.add("on"); await wait(calm ? 700 : 1900);
        } else await wait(380);
      } else {
        if (missed && st.dmg) continue;
        const row = document.createElement("div"), big = document.createElement("b"), lab = document.createElement("small"), bd = document.createElement("span");
        row.className = "rs-r" + (st.crit ? " xtra" : ""); lab.textContent = st.label; bd.textContent = st.bd; row.append(lab, big, bd); $(".rs-res").appendChild(row);
        const to = Number(st.total);
        if (!skipped() && !calm && isFinite(to)) { for (let k = 0; k < 9 && !skipped() && id === run; k++) { big.textContent = String(rnd(Math.max(6, Math.abs(to) + 6))); sfx("rchip"); await sleep(65); } }
        if (id !== run) return;
        big.textContent = st.total; sfx("rdone"); await wait(450);
      }
    }
    if (id !== run) return;
    pending.done = true; $(".rs-hint").style.opacity = 1;
    closeT = setTimeout(() => { if (pending && pending.id === id) finish(); }, anyNat ? 3000 : 1600);
  })();
}
function finish() {
  if (!pending) return; pending = null; run++; clearTimeout(closeT);
  root.classList.remove("on", "c20", "c1"); root.hidden = true; parts = [];
  const a = document.getElementById("app"); if (a) { a.classList.remove("rs-shake", "rs-shake20", "rs-gray"); }
}
export function dismissRollStage() { if (!pending) return; if (!pending.done) { pending.skip = true; return; } finish(); }
export function rollStageOpen() { return !!pending; }
document.addEventListener("keydown", e => { if (pending && (e.key === "Escape" || e.key === " " || e.key === "Enter")) { e.preventDefault(); e.stopPropagation(); dismissRollStage(); } }, true);
