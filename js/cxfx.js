// Effects for the creation screens: a fixed canvas of falling or rising particles whose kind and
// colour follow what the player is looking at (leaves, forge sparks, snow, bubbles, stars, ash,
// fireflies, embers), a colour wash when the accent changes, and a burst for the final seal.
// Honours "reduce motion". ASCII only.
let cv = null, ctx = null, P = [], raf = 0, on = false, W = 0, H = 0;
let AMB = { kind: "leaves", hue: 9 }, lastHue = null;
const reduced = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

function ensureCanvas() {
  if (cv) return;
  cv = document.createElement("canvas"); cv.id = "cx-fx"; cv.setAttribute("aria-hidden", "true");
  document.body.appendChild(cv); ctx = cv.getContext("2d"); size();
  window.addEventListener("resize", size);
}
function size() { if (!cv) return; W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
function dropCanvas() {
  cancelAnimationFrame(raf); raf = 0;
  if (cv) { cv.remove(); window.removeEventListener("resize", size); }
  cv = null; ctx = null; P = [];
}

function spawn() {
  const k = AMB.kind, p = { x: Math.random() * W, y: H + 10, vx: 0, vy: -0.5, r: 1.5, l: 400, t: 0, k, h: AMB.hue, rot: Math.random() * 6, tw: Math.random() * 6 };
  if (k === "leaves") { p.y = -10; p.vy = 0.5 + Math.random() * 0.7; p.r = 3 + Math.random() * 3; p.l = H / p.vy + 20; }
  else if (k === "snow") { p.y = -10; p.vy = 0.4 + Math.random() * 0.7; p.r = 1 + Math.random() * 2.2; p.l = H / p.vy + 20; }
  else if (k === "ash") { p.y = -10; p.vy = 0.25 + Math.random() * 0.35; p.r = 1 + Math.random() * 1.6; p.l = H / p.vy + 20; }
  else if (k === "bubbles") { p.vy = -0.4 - Math.random() * 0.5; p.r = 2 + Math.random() * 4; p.l = H / -p.vy; }
  else if (k === "sparks") { p.y = H * (0.5 + Math.random() * 0.5); p.vy = -1.6 - Math.random() * 2; p.vx = (Math.random() - 0.5) * 1.2; p.r = 1.2; p.l = 45 + Math.random() * 30; }
  else if (k === "stars") { p.y = Math.random() * H; p.vy = -0.03; p.r = 1 + Math.random() * 1.6; p.l = 220 + Math.random() * 260; }
  else if (k === "motes") { p.vy = -0.2 - Math.random() * 0.25; p.r = 1 + Math.random() * 1.5; p.l = H / -p.vy; }
  else { p.vy = -0.4 - Math.random() * 0.5; p.l = H / -p.vy; }
  return p;
}
function colour(p, a) {
  if (p.k === "ash") return "hsla(30,8%,62%," + a + ")";
  if (p.k === "snow") return "hsla(205,40%,92%," + a + ")";
  if (p.k === "burst") return "hsla(" + (20 + Math.random() * 30) + ",100%," + (60 + Math.random() * 15) + "%," + a + ")";
  return "hsla(" + (p.h + (p.k === "leaves" ? p.rot * 4 - 10 : 0)) + ",75%," + (p.k === "stars" || p.k === "motes" ? 78 : 62) + "%," + a + ")";
}
function frame() {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  if (on && P.filter(p => p.k !== "burst").length < 34 && Math.random() < 0.3) P.push(spawn());
  P = P.filter(p => p.t < p.l);
  for (const p of P) {
    p.t++; p.x += p.vx; p.y += p.vy;
    if (p.k === "leaves") { p.x += Math.sin(p.t / 30 + p.rot) * 0.8; p.rot += 0.02; }
    else if (p.k === "snow" || p.k === "ash" || p.k === "motes" || p.k === "bubbles") p.x += Math.sin(p.t / 45 + p.rot) * 0.35;
    else if (p.k === "burst") { p.vy += 0.06; p.vx *= 0.985; }
    const k = p.t / p.l;
    let al = (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88) * (p.k === "burst" ? 0.95 : 0.42);
    if (p.k === "stars") al *= 0.55 + 0.45 * Math.sin(p.t / 12 + p.tw);
    al = Math.max(0, al); ctx.beginPath();
    if (p.k === "leaves") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = colour(p, al); ctx.scale(1, 0.45); ctx.arc(0, 0, p.r, 0, 6.283); ctx.fill(); ctx.restore(); }
    else if (p.k === "stars") { ctx.strokeStyle = colour(p, al); ctx.lineWidth = 1; const r = p.r * 2.2; ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r); ctx.stroke(); }
    else if (p.k === "bubbles") { ctx.strokeStyle = colour(p, al); ctx.lineWidth = 1; ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.stroke(); }
    else if (p.k === "sparks") { ctx.strokeStyle = "hsla(" + (24 + p.h % 20) + ",100%,62%," + al + ")"; ctx.lineWidth = 1.4; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4); ctx.stroke(); }
    else { ctx.fillStyle = colour(p, al); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
  }
  if (!on && !P.length) { dropCanvas(); return; }
  raf = requestAnimationFrame(frame);
}

// Call after every creation redraw. kind: particle kind. hue: accent hue (0-359). enabled: false turns it all off.
export function cxSync(kind, hue, enabled = true) {
  document.body.classList.add("cx-on");
  if (lastHue !== null && hue !== lastHue && enabled && !reduced()) cxWash(hue);
  lastHue = hue; AMB = { kind, hue };
  if (!enabled || reduced()) { on = false; if (!P.length) dropCanvas(); return; }
  if (!on) { on = true; ensureCanvas(); for (let i = 0; i < 28; i++) { const p = spawn(); p.y = Math.random() * H; p.t = Math.random() * 100; P.push(p); } }
  if (!raf) raf = requestAnimationFrame(frame);
}
export function cxStop() {
  document.body.classList.remove("cx-on"); lastHue = null; on = false;
  for (const p of P) if (p.k !== "burst") p.l = Math.min(p.l, p.t + 40); // fade out soon instead of drifting over the sheet
  if (!P.length) dropCanvas();
}
export function cxWash(hue) {
  const w = document.createElement("div"); w.className = "cx-wash";
  w.style.background = "radial-gradient(circle at 50% 40%,hsl(" + hue + " 70% 55% / .45),transparent 65%)";
  document.body.appendChild(w); setTimeout(() => w.remove(), 1200);
}
export function cxBurst() {
  if (reduced()) return;
  ensureCanvas();
  for (let i = 0; i < 150; i++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5; P.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.5 + Math.random() * 2.5, l: 60 + Math.random() * 50, t: 0, k: "burst", h: 20 }); }
  if (!raf) raf = requestAnimationFrame(frame);
}
// The wax seal that stamps over the new sheet. Does not block taps and removes itself.
export function cxSeal(name, hue) {
  if (reduced()) return;
  const el = document.createElement("div"); el.className = "cx-seal"; el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<div class="cx-seal-in"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#a63a2c"/><circle cx="50" cy="50" r="38" fill="none" stroke="#e98a78" stroke-width="2" opacity=".8"/><path d="M50 22c12 4 20 14 18 26-2 12-10 20-18 24-8-4-16-12-18-24-2-12 6-22 18-26Z" fill="none" stroke="#f6c0b3" stroke-width="2.4" stroke-linejoin="round"/><path d="M50 72V38M50 52l8-6M50 60l-8-6" fill="none" stroke="#f6c0b3" stroke-width="2.4" stroke-linecap="round"/></svg><b></b></div>';
  el.querySelector("b").textContent = name;
  el.style.setProperty("--cx-h", hue);
  document.body.appendChild(el); cxBurst();
  setTimeout(() => el.classList.add("out"), 1500); setTimeout(() => el.remove(), 2100);
}
