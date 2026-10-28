// Roll stage: a full-screen die roll that plays over the sheet when a roll is made.
// A tumbling d20, the modifier, then the other results; a natural 20 and a natural 1
// each get their own effect (particles, flash, shake, cracking glass). Tap, Esc or
// Space skips ahead, then closes. The roll card underneath keeps the result.
// ASCII only in this file: use \u escapes for symbols.
import { sfx, buzz } from "./sfx.js";
import { rollDie } from "./rules.js";
import { rollFormula, describeGroups } from "./dice.js";

let root = null, run = 0, pending = null, parts = [], raf = 0, closeT = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => 1 + Math.floor(Math.random() * n);
const reduced = () => document.documentElement.getAttribute("data-motion") === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = s => root.querySelector(s);

const DIE = '<div class="rs-die"><i class="rs-ring"></i><div class="rs-dd"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon class="rs-pg" points="50,4 90,27 90,73 50,96 10,73 10,27"/><polygon class="rs-ln" points="50,24 78,68 22,68"/><path class="rs-ln" d="M50 24L10 27M50 24L90 27M50 24L50 4M78 68L90 27M78 68L90 73M78 68L50 96M22 68L10 27M22 68L10 73M22 68L50 96"/></svg><b class="rs-num"></b></div></div>';
function build() {
  if (root) return;
  root = document.createElement("div");
  root.className = "rstage"; root.id = "rstage"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Dice roll"); root.setAttribute("aria-live", "polite"); root.hidden = true;
  root.innerHTML = '<div class="rs-scrim"></div><div class="rs-rays"></div><div class="rs-vig"></div><svg class="rs-cracks" preserveAspectRatio="none" aria-hidden="true"></svg><canvas class="rs-canvas" aria-hidden="true"></canvas>' +
    '<div class="rs-adv" role="group" aria-label="Roll mode"><button type="button" data-m="dis">Disadvantage</button><button type="button" data-m="normal">Normal</button><button type="button" data-m="adv">Advantage</button></div>' +
    '<div class="rs-card"><div class="rs-title"></div><div class="rs-sub"></div><div class="rs-dice">' + DIE + DIE.replace('class="rs-die"', 'class="rs-die rs-d2" hidden') + '</div>' +
    '<div class="rs-line"></div><div class="rs-res"></div><div class="rs-banner"></div><div class="rs-note"></div><div class="rs-opts"></div>' +
    '<div class="rs-go"><button type="button" class="rs-btn rs-main"></button><button type="button" class="rs-btn ghost rs-done">Close</button></div></div>' +
    '<div class="rs-flash"></div><div class="rs-hint">Tap to continue</div>';
  document.body.appendChild(root);
  root.addEventListener("click", e => {
    const m = e.target.closest && e.target.closest(".rs-adv button");
    if (m) { e.stopPropagation(); setMode(m.dataset.m); return; }
    const o = e.target.closest && e.target.closest(".rs-opts button");
    if (o) { e.stopPropagation(); useOpt(o.dataset.k, o.dataset.id); return; }
    if (e.target.closest && e.target.closest(".rs-done")) { dismissRollStage(true); return; }
    tap();
  });
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
  $(".rs-d2").hidden = true; $(".rs-opts").textContent = ""; $(".rs-go").hidden = true; $(".rs-adv").hidden = true; $(".rs-sub").textContent = ""; $(".rs-die").className = "rs-die"; $(".rs-die").hidden = !steps.some(s => s.t === "d20"); $(".rs-cracks").innerHTML = ""; $(".rs-hint").style.opacity = 0;
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
  const st = pending; if (!st) return;
  pending = null; run++; clearTimeout(closeT);
  root.classList.remove("on", "c20", "c1", "inter", "two"); root.hidden = true; parts = [];
  const a = document.getElementById("app"); if (a) { a.classList.remove("rs-shake", "rs-shake20", "rs-gray"); }
  if (st.inter && st.rolled && !st.committed) { st.committed = true; try { st.opts.commit(st.out(), st.altText()); } catch (e) { /* ignore */ } }
}
export function dismissRollStage(force) {
  if (!pending) return;
  if (pending.inter) { if (force || pending.phase === "done") finish(); return; }
  if (!pending.done) { pending.skip = true; return; } finish();
}
export function rollStageOpen() { return !!pending; }

// ---------------- interactive roll ----------------
// spec: { title, d20: {mod, label} | null, info: [{label,total,bd}], dmg: {dice, mod, type, label} | null,
//         riders: {pre, attack, damage}, notes }  opts: { mode, commit(parts, alt), spend(res), markOnce(id), onceUsed(id) }
const effAdv = st => st.lucky ? (st.adv === "dis" ? "normal" : "adv") : st.adv;
const sg = n => (n < 0 ? "\u2212 " : "+ ") + Math.abs(n);

function paint() {
  const st = pending; if (!st || !st.inter) return;
  const sp = st.spec, ph = st.phase, eff = effAdv(st);
  root.querySelectorAll(".rs-adv button").forEach(b => b.classList.toggle("on", b.dataset.m === st.adv));
  $(".rs-adv").hidden = !(sp.d20 && ph === "ready");
  const two = !!sp.d20 && (ph === "ready" || st.two) && eff !== "normal";
  if (ph === "ready") { $(".rs-d2").hidden = !two; root.classList.toggle("two", two); }
  const main = $(".rs-main");
  let txt = "";
  if (ph === "ready") txt = sp.d20 ? "Roll d20" : (sp.dmg ? "Roll " + (sp.dmg.label || "damage").toLowerCase() : "Roll");
  else if (ph === "rolled") txt = "Roll " + (sp.dmg.label || "damage").toLowerCase();
  main.hidden = !txt || st.busy; main.textContent = txt;
  $(".rs-done").hidden = ph === "ready" ? false : st.busy;
  $(".rs-done").textContent = ph === "done" ? "Done" : ph === "ready" ? "Cancel" : "Skip";
  $(".rs-go").hidden = false;
  $(".rs-hint").style.opacity = 0;
  // options: before the roll (Lucky), after the d20 (riders on the attack), after damage (riders on damage)
  const list = ph === "ready" ? sp.riders.pre : ph === "rolled" && !st.dmgDone ? sp.riders.attack : st.dmgDone || (ph === "ready" && !sp.d20) ? sp.riders.damage : [];
  const box = $(".rs-opts"); box.textContent = "";
  if (!st.busy) list.forEach(r => {
    const b = document.createElement("button"); b.type = "button"; b.dataset.k = ph === "ready" ? "pre" : st.dmgDone ? "damage" : "attack"; b.dataset.id = r.id;
    const used = st.used[r.id] || (r.once && st.opts.onceUsed && st.opts.onceUsed(r.id));
    b.className = "rs-chip" + (used ? " used" : "") + (r.id === "lucky" && st.lucky ? " on" : ""); b.disabled = !!used && r.id !== "lucky";
    const t = r.id === "lucky" ? (st.lucky ? "Lucky: on" : r.label) : "+ " + r.label + (r.dice ? " " + r.dice : r.flat ? " " + (r.flat > 0 ? "+" : "") + r.flat : "");
    const a = document.createElement("b"); a.textContent = t; const n = document.createElement("small"); n.textContent = used && r.once ? "Used this turn" : r.note || "";
    b.append(a, n); box.appendChild(b);
  });
}

function setMode(m) {
  const st = pending; if (!st || !st.inter || st.phase !== "ready") return;
  st.adv = m; sfx("rchip"); paint();
}

function addRow(label, total, bd, xtra) {
  const row = document.createElement("div"), big = document.createElement("b"), lab = document.createElement("small"), bdel = document.createElement("span");
  row.className = "rs-r" + (xtra ? " xtra" : ""); lab.textContent = label; bdel.textContent = bd; big.textContent = total; row.append(lab, big, bdel); $(".rs-res").appendChild(row);
  return { row, big, bd: bdel };
}
async function flick(el, to, calm) {
  if (calm || !isFinite(to)) { el.textContent = to; return; }
  const st = pending, id = st && st.id;
  for (let k = 0; k < 8 && pending && pending.id === id; k++) { el.textContent = String(rnd(Math.max(6, Math.abs(to) + 6))); sfx("rchip"); await sleep(55); }
  el.textContent = to;
}

function lineText(st) {
  const d = st.spec.d20; if (!d) return "";
  return `${st.pick}${d.mod ? " " + sg(d.mod) : ""}${st.atkExtra.map(x => " + " + x.total).join("")} = `;
}
function setLine(st) {
  const ln = $(".rs-line"); ln.textContent = ""; const a = document.createElement("span"), b = document.createElement("b");
  const total = st.pick + st.spec.d20.mod + st.atkExtra.reduce((t, x) => t + x.total, 0);
  a.textContent = lineText(st); b.textContent = total; if (st.nat === "1") b.className = "rs-struck"; ln.append(a, b); ln.classList.add("on"); st.d20total = total;
}

async function rollD20(st) {
  const sp = st.spec, calm = st.calm, id = st.id, eff = effAdv(st), two = eff !== "normal";
  st.busy = true; st.two = two; paint();
  const dice = root.querySelectorAll(".rs-die"), d1 = dice[0], d2 = dice[1];
  const vals = two ? [rollDie(20), rollDie(20)] : [rollDie(20)];
  const idx = eff === "adv" ? (vals[0] >= vals[1] ? 0 : 1) : eff === "dis" ? (vals[0] <= vals[1] ? 0 : 1) : 0;
  st.pick = vals[idx]; st.vals = vals; st.nat = st.pick === 20 ? "20" : st.pick === 1 ? "1" : null;
  if (st.lucky && st.opts.spend) st.opts.spend("Luck Points");
  d2.hidden = !two; root.classList.toggle("two", two);
  const els = two ? [d1, d2] : [d1], nums = els.map(e => e.querySelector(".rs-num"));
  els.forEach(e => { e.className = "rs-die" + (e === d2 ? " rs-d2" : ""); void e.offsetWidth; e.classList.add("roll"); });
  nums.forEach(n => { n.textContent = ""; });
  $(".rs-title").textContent = sp.title + (eff === "adv" ? " \u00b7 Advantage" : eff === "dis" ? " \u00b7 Disadvantage" : "");
  if (!calm && st.opts.mode !== "crits") { let i = 0, dly = 26; while (i < 20 && pending && pending.id === id) { nums.forEach(n => { n.textContent = String(rnd(20)); }); sfx("rtick"); await sleep(dly); dly += 3; i++; } }
  if (!pending || pending.id !== id) return;
  els.forEach((e, k) => { e.className = "rs-die land" + (e === d2 ? " rs-d2" : "") + (two && k !== idx ? " lose" : ""); nums[k].textContent = vals[k]; });
  sfx("rland");
  st.atkExtra = []; setLine(st);
  if (two) { $(".rs-sub").textContent = `${vals[0]} and ${vals[1]}: keeps the ${eff === "adv" ? "higher" : "lower"}`; }
  if (st.nat === "20") {
    root.classList.add("c20"); banner("Critical Hit"); sfx("nat20"); buzz([30, 40, 30, 40, 80]);
    if (!calm) { const f = $(".rs-flash"); f.className = "rs-flash go"; const rg = els[idx].querySelector(".rs-ring"); rg.classList.remove("go"); void rg.offsetWidth; rg.classList.add("go"); burst20(); shake("rs-shake20"); }
    $(".rs-note").textContent = "Natural 20"; $(".rs-note").classList.add("on");
  } else if (st.nat === "1") {
    root.classList.add("c1"); banner("Critical Miss"); sfx("nat1"); buzz([140]);
    if (!calm) { const f = $(".rs-flash"); f.className = "rs-flash red go"; cracks(); burst1(); shake("rs-shake"); document.getElementById("app").classList.add("rs-gray"); setTimeout(() => els[idx].classList.add("shatter"), 500); setTimeout(() => document.getElementById("app").classList.remove("rs-gray"), 2400); }
    $(".rs-note").textContent = "Natural 1"; $(".rs-note").classList.add("on");
  }
  await sleep(st.nat && !calm ? 900 : 250);
  if (!pending || pending.id !== id) return;
  st.rolled = true; st.busy = false;
  const miss = st.nat === "1";
  st.phase = sp.dmg && !miss ? "rolled" : "done";
  paint();
}

async function rollDamage(st) {
  const sp = st.spec, d = sp.dmg, id = st.id, crit = st.nat === "20";
  st.busy = true; paint();
  const base = `${d.dice}${d.mod ? (d.mod > 0 ? "+" : "") + d.mod : ""}`;
  const r = rollFormula(base), extra = crit ? rollFormula(d.dice) : null;
  if (!r) { st.busy = false; st.phase = "done"; paint(); return; }
  const total = Math.max(0, r.total + (extra ? extra.total : 0));
  st.dmgRows = []; st.dmgBase = { total, bd: describeGroups(r).replace(/<[^>]*>/g, "") + (extra ? " + " + describeGroups(extra).replace(/<[^>]*>/g, "") : "") };
  const row = addRow(crit ? "Crit damage" : (d.label || "Damage") + (d.type ? " \u00b7 " + d.type : ""), "", st.dmgBase.bd, crit);
  await flick(row.big, total, st.calm);
  if (!pending || pending.id !== id) return;
  sfx("rdone"); st.dmgDone = true; st.rolled = true; st.dmgSum = total; st.busy = false; st.phase = "done"; st.hasRolledDmg = true;
  showTotal(st); paint();
}
function showTotal(st) {
  let t = $(".rs-res .tot");
  if (!st.dmgRows.length) { if (t) t.remove(); return; }
  if (!t) { t = document.createElement("div"); t.className = "rs-r tot"; t.innerHTML = "<small></small><b></b><span></span>"; $(".rs-res").appendChild(t); }
  t.querySelector("small").textContent = (st.spec.dmg.label || "Damage") + " total"; t.querySelector("b").textContent = st.dmgSum; t.querySelector("span").textContent = "";
}

async function useOpt(kind, rid) {
  const st = pending; if (!st || !st.inter || st.busy) return;
  const sp = st.spec, r = (sp.riders[kind] || []).find(x => x.id === rid); if (!r) return;
  if (kind === "pre") { if (r.id === "lucky") { st.lucky = !st.lucky; sfx("rchip"); paint(); } return; }
  if (st.used[rid]) return;
  st.used[rid] = true; st.busy = true; const id = st.id;
  const crit = st.nat === "20";
  let total, bd;
  if (r.dice) {
    const f = rollFormula((crit && kind === "damage" ? r.dice.replace(/^(\d+)/, n => 2 * n) : r.dice) + (r.flat ? (r.flat > 0 ? "+" : "") + r.flat : ""));
    total = f ? f.total : 0; bd = f ? describeGroups(f).replace(/<[^>]*>/g, "") : r.dice;
  } else { total = r.flat || 0; bd = (r.flat > 0 ? "+" : "") + r.flat; }
  if (r.once && st.opts.markOnce) st.opts.markOnce(r.id);
  paint();
  if (kind === "attack") {
    st.atkExtra.push({ label: r.label, total, bd });
    const row = addRow(r.label, "", bd, false); await flick(row.big, total, st.calm);
    if (!pending || pending.id !== id) return;
    setLine(st); sfx("rdone"); st.busy = false; paint(); return;
  }
  const row = addRow(r.label, "", bd, crit); await flick(row.big, total, st.calm);
  if (!pending || pending.id !== id) return;
  sfx("rdone"); st.dmgRows.push({ label: r.label, total, bd }); st.dmgSum += total; showTotal(st); st.busy = false; paint();
}

async function tap() {
  const st = pending; if (!st) return;
  if (!st.inter) { dismissRollStage(); return; }
  if (st.busy) return;
  if (st.phase === "ready") {
    if (!st.fired) { st.fired = true; if (st.opts.onRoll) st.opts.onRoll(); }
    if (st.spec.d20) await rollD20(st);
    else if (st.spec.dmg) await rollDamage(st);
    else { st.phase = "done"; paint(); }
  } else if (st.phase === "rolled") await rollDamage(st);
  else if (st.phase === "done") finish();
}

export function startRoll(spec, opts) {
  build(); if (pending) finish();
  const id = ++run, calm = reduced() || opts.mode === "off";
  const st = { id, inter: true, phase: "ready", adv: "normal", lucky: false, busy: false, used: {}, spec, opts, calm, rolled: false, committed: false, atkExtra: [], dmgRows: [], dmgSum: 0, nat: null, pick: 0, d20total: 0 };
  spec.riders = spec.riders || { pre: [], attack: [], damage: [] };
  st.out = () => {
    const parts = [];
    if (spec.d20 && st.vals) {
      const mod = spec.d20.mod, ex = st.atkExtra.reduce((t, x) => t + x.total, 0);
      parts.push({ label: st.nat === "20" ? "Natural 20!" : st.nat === "1" ? "Natural 1" : spec.d20.label, total: st.pick + mod + ex,
        bd: `[${st.pick}]${mod ? " " + sg(mod) : ""}${st.atkExtra.map(x => " + " + x.total).join("")}`, crit: st.nat === "20", fumble: st.nat === "1" });
    }
    (spec.info || []).forEach(p => parts.push(p));
    if (st.hasRolledDmg) {
      parts.push({ label: st.nat === "20" ? "Crit damage" : (spec.dmg.label || "Damage") + (spec.dmg.type ? " \u00b7 " + spec.dmg.type : ""), total: st.dmgSum,
        bd: st.dmgBase.bd + st.dmgRows.map(r => " + " + r.label + " [" + r.bd + "]").join(""), crit: st.nat === "20" });
    }
    return parts;
  };
  st.altText = () => {
    const bits = [];
    if (st.vals && st.vals.length > 1) bits.push(`Rolled ${st.vals[0]} and ${st.vals[1]}, kept ${st.pick}`);
    if (spec.notes) bits.push(spec.notes);
    return bits.join(" \u00b7 ");
  };
  pending = st;
  root.hidden = false; root.className = "rstage on inter"; fit(); parts = [];
  $(".rs-title").textContent = spec.title; $(".rs-sub").textContent = spec.sub || ""; $(".rs-line").textContent = ""; $(".rs-line").classList.remove("on"); $(".rs-res").textContent = ""; $(".rs-banner").textContent = ""; $(".rs-note").textContent = ""; $(".rs-note").classList.remove("on");
  $(".rs-cracks").innerHTML = "";
  const dice = root.querySelectorAll(".rs-die");
  dice.forEach((e, i) => { e.className = "rs-die idle" + (i ? " rs-d2" : ""); e.querySelector(".rs-num").textContent = "20"; });
  dice[0].hidden = !spec.d20; dice[1].hidden = true;
  // info rows that exist before any roll (a save DC, for example)
  (spec.info || []).forEach(p => { const row = addRow(p.label, p.total, p.bd, false); row.row.classList.add("info"); });
  paint();
  const m = root.querySelector(".rs-main"); if (m && !m.hidden) m.focus({ preventScroll: true });
}
export function rollStageInteractive() { return !!(pending && pending.inter); }

document.addEventListener("keydown", e => {
  if (!pending) return;
  const st = pending;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dismissRollStage(true); return; }
  if (st.inter && st.phase === "ready" && st.spec.d20 && /^[adn]$/i.test(e.key) && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); setMode({ a: "adv", d: "dis", n: "normal" }[e.key.toLowerCase()]); return; }
  if (e.key === " " || e.key === "Enter") {
    if (e.target && e.target.closest && e.target.closest(".rs-opts button, .rs-adv button, .rs-done")) return;
    e.preventDefault(); e.stopPropagation(); tap();
  }
}, true);
