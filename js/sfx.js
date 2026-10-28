// Button feedback: tiny synthesized sounds (Web Audio), a press pulse and a light buzz.
// No audio files, so it works offline and costs nothing to download.
// ASCII only in this file (see HANDOFF: non-ASCII breaks when served without a charset).

let ctx = null;
let enabled = true;
let last = 0;
let noiseBuf = null;
let master = null;
let haptics = true;
let volume = 0.7;

export function setSfxEnabled(v) { enabled = !!v; }
export function buzz(pattern) { if (haptics && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { } } }
export function setHaptics(v) { haptics = !!v; }
export function setVolume(pct) { volume = Math.max(0, Math.min(100, +pct)) / 100; if (master) master.gain.value = volume; }

function audio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination); } catch (e) { return null; }
  }
  if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) { } }
  return ctx;
}

function tone(c, o) {
  const t0 = c.currentTime + (o.t || 0), d = o.d || 0.08, v = o.v || 0.06;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + d + 0.03);
}

function noise(c, o) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.2), c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + (o.t || 0), d = o.d || 0.03, v = o.v || 0.03;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf;
  f.type = "bandpass"; f.frequency.value = o.f || 3000; f.Q.value = 0.8;
  g.gain.setValueAtTime(v, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + d + 0.02);
}

const SOUNDS = {
  // soft wooden knock
  tap: c => { tone(c, { f: 420, f2: 300, d: 0.07, type: "triangle", v: 0.08 }); noise(c, { d: 0.025, v: 0.03, f: 2400 }); },
  // light tick for chips and toggles
  tick: c => { tone(c, { f: 820, f2: 640, d: 0.045, type: "sine", v: 0.05 }); },
  // page turn for tabs
  tab: c => { tone(c, { f: 300, f2: 420, d: 0.11, type: "triangle", v: 0.06 }); noise(c, { d: 0.08, v: 0.02, f: 1800 }); },
  // bell-like confirm for primary buttons
  confirm: c => {
    tone(c, { f: 392, d: 0.18, v: 0.06 }); tone(c, { f: 784, d: 0.14, v: 0.02 });
    tone(c, { f: 587, t: 0.07, d: 0.26, v: 0.06 }); tone(c, { f: 1174, t: 0.07, d: 0.18, v: 0.02 });
  },
  // low thud for destructive buttons
  warn: c => { tone(c, { f: 170, f2: 80, d: 0.2, type: "triangle", v: 0.1 }); noise(c, { d: 0.05, v: 0.04, f: 500 }); },
  // back / close
  back: c => { tone(c, { f: 330, f2: 230, d: 0.08, type: "triangle", v: 0.06 }); },
  // pips (slots, death saves)
  pip: c => { tone(c, { f: 900, f2: 600, d: 0.05, type: "sine", v: 0.06 }); },
  // dice clatter
  dice: c => {
    for (let i = 0; i < 5; i++) noise(c, { t: i * 0.045 + Math.random() * 0.02, d: 0.03, v: 0.05, f: 1500 + Math.random() * 2500 });
    tone(c, { f: 260, f2: 200, t: 0.2, d: 0.08, type: "triangle", v: 0.05 });
  },
  // roll stage: a tick while the die tumbles, a thump when it lands
  rtick: c => { tone(c, { f: 700 + Math.random() * 500, d: 0.03, type: "square", v: 0.02 }); },
  rland: c => { tone(c, { f: 150, f2: 60, d: 0.16, type: "sine", v: 0.16 }); noise(c, { d: 0.06, v: 0.05, f: 900 }); },
  rchip: c => { tone(c, { f: 520 + Math.random() * 200, d: 0.05, type: "triangle", v: 0.04 }); },
  rdone: c => { tone(c, { f: 440, d: 0.08, v: 0.05 }); tone(c, { f: 660, t: 0.07, d: 0.12, v: 0.05 }); },
  nat20: c => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, { f, t: i * 0.09, d: 0.5, v: 0.07, type: "triangle" }));
    tone(c, { f: 130, f2: 60, d: 0.9, type: "sine", v: 0.2 }); noise(c, { d: 0.18, v: 0.05, f: 6000 });
    [1568, 2093].forEach((f, i) => tone(c, { f, t: 0.45 + i * 0.12, d: 0.9, v: 0.03 }));
  },
  nat1: c => {
    tone(c, { f: 110, f2: 38, d: 1, type: "sawtooth", v: 0.16 }); tone(c, { f: 77, f2: 30, t: 0.05, d: 1.2, type: "square", v: 0.08 });
    noise(c, { d: 0.2, v: 0.18, f: 3000 }); noise(c, { t: 0.12, d: 0.2, v: 0.14, f: 500 });
    [392, 370, 349, 311].forEach((f, i) => tone(c, { f, f2: f * 0.94, t: 0.3 + i * 0.16, d: 0.3, type: "sawtooth", v: 0.04 }));
  }
};

// Recorded sounds (assets/sfx), fetched once and decoded on first use. Used for hit points.
const SAMPLE_FILE = { hit: "assets/sfx/hit.mp3", hitbig: "assets/sfx/hit-big.mp3" };
const samples = {};
function loadSample(name) {
  if (samples[name]) return samples[name];
  const c = audio();
  if (!c || !SAMPLE_FILE[name]) return Promise.resolve(null);
  samples[name] = fetch(SAMPLE_FILE[name]).then(r => r.arrayBuffer())
    .then(buf => new Promise((ok, no) => { const p = c.decodeAudioData(buf, ok, no); if (p && p.then) p.then(ok, no); }))
    .catch(() => { delete samples[name]; return null; });
  return samples[name];
}
export function preloadSamples() { if (enabled) Object.keys(SAMPLE_FILE).forEach(loadSample); }
export function playSample(name, gain) {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  loadSample(name).then(b => {
    if (!b) return;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = b; g.gain.value = gain == null ? 1 : gain;
    src.connect(g); g.connect(master); src.start();
  });
}

export function sfx(kind) {
  if (!enabled) return;
  const now = performance.now();
  if (now - last < 35 && !/^(r|nat)/.test(kind)) return;
  last = now;
  const c = audio();
  if (!c) return;
  try { if (SOUNDS[kind]) SOUNDS[kind](c); } catch (e) { }
}

function kindFor(el) {
  const a = el.dataset.a || "";
  if (el.matches(".btn.danger")) return "warn";
  if (el.matches(".btn.pri")) return "confirm";
  if (el.matches("nav.tabs button") || a === "sheetTab") return "tab";
  if (el.matches(".diebtn")) return "dice";
  if (el.matches(".pip")) return "pip";
  if (el.matches(".gloss-chip, .seg button, .chip")) return "tick";
  if (/^(closeModal|glossaryBack|back|cancel)/i.test(a)) return "back";
  return "tap";
}

// Called from the global click handler for anything with data-a.
export function feedback(el) {
  if (el.disabled || el.getAttribute("aria-disabled") === "true") return;
  const kind = kindFor(el);
  sfx(kind);
  if (haptics && navigator.vibrate) { try { navigator.vibrate(kind === "warn" ? [10, 30, 10] : 6); } catch (e) { } }
  if (el.matches(".btn, .iconbtn, .gloss-chip, .seg button")) {
    el.classList.remove("fx-pulse");
    void el.offsetWidth;
    el.classList.add("fx-pulse");
    el.addEventListener("animationend", () => el.classList.remove("fx-pulse"), { once: true });
  }
}
