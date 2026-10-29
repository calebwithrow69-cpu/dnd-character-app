// The hit point vial: a canvas liquid bar with a spring-driven fill, a trailing
// damage chip, a wobbling surface, slash and sparks on a hit, shield shards when
// temp HP soaks it, a heal swell with motes, cracks as it empties, and floating
// numbers. It keeps its own animation state across screen redraws; the sheet only
// renders an empty <canvas id="hpc"> and calls mount() / apply() after each draw.
import { playSample, sfx } from "./sfx.js";

const PADX = 14, PADT = 24, PADB = 12, TH = 28;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

const view = {
  id: null, init: false, disp: 0, vel: 0, ghost: 0, hold: 0, tdisp: 0, tvel: 0, amp: 0, t: 0,
  flash: 0, flashCol: "255,80,70", slash: 0, slashX: 0, shake: 0, soft: false, shown: 0,
  bubbles: [], part: [], max: 1, cur: 0, temp: 0, down: false, dead: false, calm: false
};
for (let i = 0; i < 12; i++) view.bubbles.push({ f: Math.random(), y: Math.random(), r: rnd(1.1, 2.6), sp: rnd(0.12, 0.45) });
const cracks = (() => { const out = []; let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) { let x = r(), y = r(); const pts = [[x, y]]; for (let k = 0; k < 4; k++) { x += (r() - 0.35) * 0.09; y = clamp(y + (r() - 0.5) * 0.9, 0, 1); pts.push([x, y]); } out.push(pts); } return out; })();

let cv = null, ctx = null, CW = 0, CH = 0, dpr = 1, CS = null, raf = 0, last = 0, idleSkip = 0;

function theme() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  CS = { panel2: g("--panel2"), line: g("--line"), frame: g("--frame"), red: g("--red"), amber: g("--amber"), ink: g("--ink") };
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const edgeX = v => PADX + (CW - PADX * 2) * clamp(v / view.max, 0, 1);
function spawn(n, f) { for (let i = 0; i < n && view.part.length < 220; i++) view.part.push(f(i)); }

// ---- mounting: called after every screen draw ----
export function mountHp(canvas, st) {
  cv = canvas; ctx = cv.getContext("2d"); theme();
  const stage = cv.parentElement;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  CW = stage.clientWidth + PADX * 2; CH = TH + PADT + PADB;
  cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr);
  cv.style.width = CW + "px"; cv.style.height = CH + "px";
  view.max = Math.max(1, st.max); view.cur = st.cur; view.temp = st.temp;
  view.down = st.cur <= 0; view.dead = !!st.dead; view.calm = !!st.calm;
  if (!view.init || view.id !== st.id) {
    Object.assign(view, { id: st.id, init: true, disp: st.cur, vel: 0, ghost: st.cur, hold: 0, tdisp: st.temp, tvel: 0, shown: st.cur, part: [], amp: 0, flash: 0, slash: 0, shake: 0, soft: false });
  } else if (Math.abs(view.disp - st.cur) > view.max) { view.disp = st.cur; view.ghost = st.cur; view.shown = st.cur; }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  draw();
}
export function unmountHp() { cv = null; }

// ---- the loop ----
function active() {
  return view.vel || view.hold > 0 || view.ghost > view.disp + 0.01 || view.amp > 0.05 || view.flash > 0.01 || view.slash > 0.01 || view.shake > 0.02 || view.part.length || view.soft || Math.abs(view.tdisp - view.temp) > 0.01 || Math.abs(view.disp - view.cur) > 0.01 || Math.abs(view.shown - view.cur) > 0.4;
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!cv || !cv.isConnected || document.hidden) { last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // idle: the surface only glints, so draw about 12 times a second
  if (!active() && !view.calm) { idleSkip += dt; if (idleSkip < 0.08) return; update(idleSkip); idleSkip = 0; draw(); return; }
  update(dt); draw();
  const num = cv.closest(".hpwrap")?.querySelector(".hpnum"), v = Math.round(view.shown);
  if (num) { if (num.textContent !== String(v)) num.textContent = v; num.classList.toggle("low", view.cur / view.max < 0.34); }
}
function update(dt) {
  view.t += dt;
  const k = view.soft ? 38 : 230, damp = view.soft ? 8 : 24;
  view.vel += ((view.cur - view.disp) * k - view.vel * damp) * dt; view.disp += view.vel * dt;
  if (Math.abs(view.cur - view.disp) < 0.01 && Math.abs(view.vel) < 0.05) { view.disp = view.cur; view.vel = 0; view.soft = false; }
  view.tvel += ((view.temp - view.tdisp) * 160 - view.tvel * 18) * dt; view.tdisp += view.tvel * dt;
  if (view.hold > 0) view.hold -= dt; else if (view.ghost > view.disp) view.ghost = Math.max(view.disp, view.ghost - view.max * 0.55 * dt);
  if (view.ghost < view.disp) view.ghost = view.disp;
  view.amp *= Math.exp(-2.1 * dt); view.flash *= Math.exp(-4.5 * dt); view.slash = Math.max(0, view.slash - dt * 2.6); view.shake *= Math.exp(-7 * dt);
  const pct = view.cur / view.max;
  if (pct < 0.25 && !view.down && !view.calm && Math.random() < dt * 12) {
    const x = edgeX(view.disp) - rnd(0, 20);
    spawn(1, () => ({ ty: "ember", x, y: PADT + TH * rnd(0.2, 0.9), vx: rnd(-8, 8), vy: rnd(-30, -60), g: 0, life: 0, max: rnd(0.8, 1.4), s: rnd(1, 2.2), c: "255,150,70" }));
  }
  if (view.soft && view.cur > view.disp + 0.4 && !view.calm && Math.random() < dt * 40) {
    const x = rnd(PADX + 4, Math.max(PADX + 6, edgeX(view.disp)));
    spawn(1, () => ({ ty: "mote", x, y: PADT + TH * 0.9, vx: 0, vy: rnd(-40, -90), g: 0, life: 0, max: rnd(0.7, 1.3), s: rnd(1.5, 3), c: "130,255,170", ph: rnd(0, 6) }));
  }
  for (const b of view.bubbles) { b.y -= b.sp * dt * (view.soft ? 3 : 1); if (b.y < 0) { b.y = 1; b.f = Math.random(); } }
  for (let i = view.part.length - 1; i >= 0; i--) {
    const p = view.part[i]; p.life += dt;
    if (p.life >= p.max) { view.part.splice(i, 1); continue; }
    p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.ty === "mote") p.x += Math.sin(p.life * 6 + p.ph) * 14 * dt;
    if (p.rot != null) p.rot += p.vr * dt;
  }
  view.shown += (view.cur - view.shown) * Math.min(1, dt * 9);
  if (Math.abs(view.cur - view.shown) < 0.4) view.shown = view.cur;
}

// ---- drawing ----
function draw() {
  if (!ctx) return;
  const max = view.max, x0 = PADX, y0 = PADT, w = CW - PADX * 2, h = TH, R = h / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, CW, CH);
  const pct = clamp(view.disp / max, 0, 1), down = view.down, hue = 118 * pct, calm = view.calm;
  // the vial is a capsule; the glass is drawn last, over the liquid
  rr(x0, y0, w, h, R);
  const tg = ctx.createLinearGradient(0, y0, 0, y0 + h); tg.addColorStop(0, "rgba(10,8,8,.55)"); tg.addColorStop(1, "rgba(30,22,18,.35)");
  ctx.fillStyle = CS.panel2; ctx.fill(); ctx.fillStyle = tg; ctx.fill();
  ctx.save(); rr(x0, y0, w, h, R); ctx.clip();
  if (down) { ctx.strokeStyle = "rgba(120,20,20,.45)"; ctx.lineWidth = 6; for (let i = -h; i < w; i += 14) { ctx.beginPath(); ctx.moveTo(x0 + i, y0 + h); ctx.lineTo(x0 + i + h, y0); ctx.stroke(); } }
  if (view.ghost > view.disp + 0.05) {
    const gx = x0 + w * clamp(view.ghost / max, 0, 1), fx0 = x0 + w * pct;
    ctx.fillStyle = "#F6E7B8"; ctx.globalAlpha = 0.92; ctx.fillRect(fx0, y0, gx - fx0, h);
    ctx.globalAlpha = 0.35; ctx.fillStyle = "#fff"; ctx.fillRect(fx0, y0, gx - fx0, h * 0.3); ctx.globalAlpha = 1;
  }
  const fx = x0 + w * pct;
  if (fx > x0 + 0.5) {
    const amp = view.amp * (calm ? 0.3 : 1);
    ctx.beginPath(); ctx.moveTo(x0 - 2, y0); ctx.lineTo(fx, y0);
    for (let y = 0; y <= h; y += 2) ctx.lineTo(fx + (Math.sin(y * 0.42 + view.t * 7) * 0.6 + Math.sin(y * 0.9 - view.t * 11) * 0.4) * amp, y0 + y);
    ctx.lineTo(x0 - 2, y0 + h); ctx.closePath();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, `hsl(${hue},58%,64%)`); g.addColorStop(0.55, `hsl(${hue},56%,46%)`); g.addColorStop(1, `hsl(${hue},60%,30%)`);
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    const gl = x0 + ((view.t * 0.22) % 1.7 - 0.35) * w, gr = ctx.createLinearGradient(gl - 30, 0, gl + 30, 0);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.26)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gr; ctx.fillRect(gl - 30, y0, 60, h);
    for (const b of view.bubbles) { ctx.beginPath(); ctx.arc(x0 + b.f * (fx - x0), y0 + b.y * h, b.r, 0, 7); ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fill(); }
    ctx.restore();
    if (view.soft && view.cur > view.disp + 0.2) { const hx = x0 + w * clamp(view.cur / max, 0, 1); ctx.fillStyle = `rgba(150,255,180,${0.35 + 0.2 * Math.sin(view.t * 12)})`; ctx.fillRect(fx, y0, hx - fx, h); }
  } else if (view.soft && view.cur > 0) { const hx = x0 + w * clamp(view.cur / max, 0, 1); ctx.fillStyle = "rgba(150,255,180,.4)"; ctx.fillRect(x0, y0, hx - x0, h); }
  // measure marks, kept to about a dozen
  let step = max <= 40 ? 5 : 10; while (max / step > 14) step *= 2;
  ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 1;
  for (let v = step; v < max; v += step) { const tx = Math.round(x0 + w * v / max) + 0.5; ctx.beginPath(); ctx.moveTo(tx, y0 + h - 6); ctx.lineTo(tx, y0 + h); ctx.stroke(); }
  // temp HP shield
  const tw = w * clamp(view.tdisp / max, 0, 1);
  if (tw > 1) {
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, tw, h); ctx.clip();
    const sg = ctx.createLinearGradient(0, y0, 0, y0 + h); sg.addColorStop(0, "rgba(150,205,255,.62)"); sg.addColorStop(1, "rgba(70,130,230,.42)");
    ctx.fillStyle = sg; ctx.fillRect(x0, y0, tw, h);
    ctx.strokeStyle = "rgba(220,240,255,.5)"; ctx.lineWidth = 1;
    for (let i = -h; i < tw + h; i += 10) { const o = (view.t * 12) % 10; ctx.beginPath(); ctx.moveTo(x0 + i + o, y0 + h); ctx.lineTo(x0 + i + o + h, y0); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.shadowColor = "rgba(140,200,255,1)"; ctx.shadowBlur = 8 + 4 * Math.sin(view.t * 5); ctx.strokeStyle = "rgba(200,230,255,.95)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0 + tw, y0 + 1); ctx.lineTo(x0 + tw, y0 + h - 1); ctx.stroke(); ctx.restore();
  }
  const cr = clamp((0.55 - pct) * 1.9, 0, 1) * (down ? 1 : 0.8);
  if (cr > 0.02) { ctx.strokeStyle = `rgba(0,0,0,${0.5 * cr})`; ctx.lineWidth = 1.1; for (const c of cracks) { ctx.beginPath(); c.forEach((p, i) => { const px = x0 + p[0] * w, py = y0 + p[1] * h; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); } }
  if (view.flash > 0.01) { ctx.fillStyle = `rgba(${view.flashCol},${view.flash * 0.65})`; ctx.fillRect(x0, y0, w, h); }
  // glass: a highlight strip along the top and a soft shade along the bottom
  const hl = ctx.createLinearGradient(0, y0, 0, y0 + h);
  hl.addColorStop(0, "rgba(255,255,255,.34)"); hl.addColorStop(0.32, "rgba(255,255,255,.06)"); hl.addColorStop(0.7, "rgba(0,0,0,0)"); hl.addColorStop(1, "rgba(0,0,0,.28)");
  ctx.fillStyle = hl; ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = "rgba(255,255,255,.28)"; rr(x0 + R, y0 + 3, w - R * 2, 2.2, 1.1); ctx.fill();
  ctx.restore();
  // the glass edge
  const bcol = down ? CS.red : pct < 0.34 ? CS.red : pct < 0.6 ? "#D9A441" : CS.frame;
  ctx.save(); rr(x0, y0, w, h, R); ctx.lineWidth = 1.6; ctx.strokeStyle = bcol; ctx.stroke(); ctx.restore();
  if (view.slash > 0.01) {
    const sx = view.slashX, a = view.slash, grow = 1 - a;
    ctx.save(); ctx.lineCap = "round"; ctx.shadowColor = "#fff"; ctx.shadowBlur = 10;
    for (const [dx, off] of [[0, 0], [9, 4]]) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3.4 * a + 0.6;
      const ax = sx - 16 + dx, ay = y0 - 8 + off; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 30 * Math.min(1, grow * 4 + 0.2), ay + (h + 16) * Math.min(1, grow * 4 + 0.2)); ctx.stroke(); }
    ctx.restore();
  }
  for (const p of view.part) {
    const a = 1 - p.life / p.max; ctx.save(); ctx.globalAlpha = clamp(a * 1.4, 0, 1);
    if (p.ty === "spark") { ctx.strokeStyle = `rgb(${p.c})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); }
    else if (p.ty === "drop") { ctx.fillStyle = `rgb(${p.c})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * 0.8, p.s * 1.3, Math.atan2(p.vy, p.vx) - Math.PI / 2, 0, 7); ctx.fill(); }
    else if (p.ty === "shard") { ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = `rgba(${p.c},.9)`; ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(p.s * 0.7, p.s * 0.8); ctx.lineTo(-p.s * 0.6, p.s * 0.5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 0.8; ctx.stroke(); }
    else if (p.ty === "plus") { ctx.strokeStyle = `rgb(${p.c})`; ctx.lineWidth = 2.2; ctx.shadowColor = `rgb(${p.c})`; ctx.shadowBlur = 6; ctx.beginPath(); ctx.moveTo(p.x - p.s, p.y); ctx.lineTo(p.x + p.s, p.y); ctx.moveTo(p.x, p.y - p.s); ctx.lineTo(p.x, p.y + p.s); ctx.stroke(); }
    else if (p.ty === "ring") { ctx.strokeStyle = `rgb(${p.c})`; ctx.lineWidth = 2.5 * a; ctx.beginPath(); ctx.arc(p.x, p.y, p.life / p.max * p.s, 0, 7); ctx.stroke(); }
    else { ctx.fillStyle = `rgb(${p.c})`; ctx.shadowColor = `rgb(${p.c})`; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (p.ty === "ember" ? a : 1), 0, 7); ctx.fill(); }
    ctx.restore();
  }
}

// ---- floating numbers: a layer on the page so they survive a screen redraw ----
function floater(text, cls, x, dx) {
  if (!cv) return;
  const layer = document.getElementById("hpfloat"); if (!layer) return;
  const r = cv.getBoundingClientRect(), el = document.createElement("span");
  el.className = "hpfl " + cls; el.textContent = text;
  const n = cls.includes("txt") ? layer.querySelectorAll(".hpfl.txt").length : 0;
  el.style.left = Math.round(r.left + x) + "px"; el.style.top = Math.round(r.top + PADT - 4 + n * 20) + "px"; el.style.setProperty("--dx", (dx != null ? dx : rnd(-24, 24)) + "px");
  layer.appendChild(el); setTimeout(() => el.remove(), 2600);
}
function shakeScreen(mag) {
  if (view.calm) return;
  const m = document.querySelector("main.page"); if (!m || !m.animate) return;
  m.animate([{ transform: "translate(0,0)" }, { transform: `translate(${-mag}px,${mag * 0.4}px)` }, { transform: `translate(${mag}px,${-mag * 0.5}px)` }, { transform: `translate(${-mag * 0.6}px,0)` }, { transform: `translate(${mag * 0.3}px,0)` }, { transform: "translate(0,0)" }], { duration: 380, easing: "ease-out" });
}
function buzz(p, on) { if (on && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { } } }
const BIG = 0.25;

// ---- called after a redraw when hit points changed ----
// prev/now: { cur, temp, max }; opts: { calm, haptics, ev: { dealt } | null, dead, wasDown }
export function applyHp(prev, now, o) {
  if (!cv) return { big: false };
  view.calm = !!o.calm;
  const f = view.calm ? 0 : 1, max = now.max, lost = prev.cur - now.cur, tlost = Math.max(0, prev.temp - now.temp), gain = now.cur - prev.cur;
  const dealt = o.ev ? o.ev.dealt : lost + tlost, frac = dealt / max, big = frac >= BIG;
  const num = cv.closest(".hpwrap")?.querySelector(".hpnum"); if (num) { num.textContent = Math.round(view.shown); num.classList.remove("pop"); void num.offsetWidth; num.classList.add("pop"); }
  if (o.ev || lost > 0 || tlost > 0) {
    if (tlost > 0) {
      const broke = now.temp === 0, sx = broke ? PADX + 20 : edgeX(Math.min(max, now.temp));
      view.flash = Math.max(view.flash, 0.75); view.flashCol = "130,190,255";
      spawn(Math.round((broke ? 26 : 12) * f), () => ({ ty: "shard", x: sx + rnd(-10, 10), y: PADT + rnd(2, TH - 2), vx: rnd(-160, 220), vy: rnd(-200, 40), g: 700, life: 0, max: rnd(0.5, 0.95), s: rnd(3, 6.5), rot: rnd(0, 6), vr: rnd(-12, 12), c: "150,205,255" }));
      if (broke) spawn(f, () => ({ ty: "ring", x: sx, y: PADT + TH / 2, vx: 0, vy: 0, life: 0, max: 0.5, s: 46, c: "170,215,255" }));
      floater("-" + tlost, "shield", sx, rnd(-20, 20)); if (broke && !view.calm) floater("SHIELD BROKEN", "shield txt", PADX + 70, 0);
      view.shake = Math.max(view.shake, 0.18); sfx("tap");
    }
    if (lost > 0) {
      view.ghost = Math.max(view.ghost, view.disp); view.hold = 0.5 + frac * 0.5; view.soft = false;
      view.amp = Math.min(9, 2 + frac * 22) * f; view.flash = 0.9; view.flashCol = "255,70,60";
      const ex = edgeX(now.cur); view.slash = 1; view.slashX = ex; view.shake = 0.35 + Math.min(1, frac * 2.2);
      spawn(Math.round((10 + frac * 70) * f), () => { const a = rnd(-1.2, 1.2) + (Math.random() < 0.5 ? 0 : Math.PI), sp = rnd(120, 340) * (0.6 + frac); return { ty: "spark", x: ex, y: PADT + rnd(2, TH - 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 40, g: 520, life: 0, max: rnd(0.25, 0.55), c: Math.random() < 0.5 ? "255,190,110" : "255,110,90" }; });
      spawn(Math.round((6 + frac * 40) * f), () => ({ ty: "drop", x: ex + rnd(-8, 8), y: PADT + rnd(4, TH - 4), vx: rnd(-90, 130), vy: rnd(-210, -40), g: 900, life: 0, max: rnd(0.55, 1.0), s: rnd(1.6, 3.8), c: "170,25,30" }));
      floater("-" + lost, "dmg" + (big ? " big" : ""), ex, rnd(-24, 24));
      if (big && !view.calm) floater("CRUSHING BLOW", "dmg txt", ex, 0);
      shakeScreen(big ? 9 : 4.5);
    } else if (tlost <= 0) { view.shake = 0.5; view.flash = 0.8; view.flashCol = "255,70,60"; shakeScreen(5); if (dealt > 0) floater("-" + dealt, "dmg", PADX + 60, 0); }
    if (now.cur <= 0 && prev.cur > 0) {
      view.flash = 1; view.flashCol = "255,30,30"; view.shake = 1;
      spawn(Math.round(40 * f), () => ({ ty: "ember", x: rnd(PADX, CW - PADX), y: PADT + rnd(0, TH), vx: rnd(-20, 20), vy: rnd(-40, -110), g: 0, life: 0, max: rnd(1, 2), s: rnd(1.5, 3), c: "200,60,50" }));
      floater("DOWN", "dmg txt big", PADX + (CW - PADX * 2) / 2, 0); shakeScreen(12); buzz([80, 60, 160], o.haptics); sfx("warn");
    }
    // the hit sound: the big one when it took 25% of max HP or more
    if (dealt > 0) { playSample(big ? "hitbig" : "hit", big ? 0.75 : 0.9); buzz(big ? [30, 40, 60] : 25, o.haptics); }
    return { big };
  }
  if (gain > 0) {
    const ex = edgeX(now.cur), x1 = edgeX(prev.cur);
    view.soft = true; view.amp = Math.min(6, 1.5 + gain / max * 14) * f; view.flash = 0.55; view.flashCol = "120,255,170";
    spawn(Math.round((14 + gain * 1.5) * f), () => ({ ty: Math.random() < 0.35 ? "plus" : "mote", x: rnd(Math.min(x1, ex), ex), y: PADT + rnd(6, TH), vx: rnd(-10, 10), vy: rnd(-60, -150), g: -20, life: 0, max: rnd(0.8, 1.5), s: rnd(2, 4.2), c: "120,255,170", ph: rnd(0, 6) }));
    floater("+" + gain, "heal" + (gain / max >= 0.3 ? " big" : ""), ex, rnd(-18, 18));
    if (prev.cur <= 0) {
      view.flash = 1; view.flashCol = "255,230,140";
      spawn(Math.round(46 * f), () => { const a = rnd(0, 6.28), sp = rnd(60, 220); return { ty: "mote", x: PADX + 24, y: PADT + TH / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: 0, max: rnd(0.7, 1.4), s: rnd(2, 4), c: "255,225,130", ph: rnd(0, 6) }; });
      floater("BACK UP", "heal txt big", PADX + (CW - PADX * 2) / 2, 0); buzz([40, 40, 40, 40, 120], o.haptics);
    }
    sfx("confirm"); buzz([15, 30, 15], o.haptics);
    return {};
  }
  if (now.temp > prev.temp) {
    const tx = edgeX(Math.min(max, now.temp));
    view.flash = 0.6; view.flashCol = "130,190,255";
    spawn(Math.round(22 * f), () => ({ ty: "mote", x: rnd(PADX, Math.max(PADX + 10, tx)), y: PADT + rnd(4, TH), vx: 0, vy: rnd(-50, -110), g: 0, life: 0, max: rnd(0.7, 1.2), s: rnd(1.5, 3.4), c: "160,210,255", ph: rnd(0, 6) }));
    spawn(f, () => ({ ty: "ring", x: tx, y: PADT + TH / 2, vx: 0, vy: 0, life: 0, max: 0.6, s: 40, c: "170,215,255" }));
    floater("+" + (now.temp - prev.temp) + " temp", "shield", tx, 0); sfx("tick");
  }
  return {};
}
