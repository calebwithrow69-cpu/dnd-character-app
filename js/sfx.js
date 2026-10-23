// Button feedback: tiny synthesized sounds (Web Audio), a press pulse and a light buzz.
// No audio files, so it works offline and costs nothing to download.
// ASCII only in this file (see HANDOFF: non-ASCII breaks when served without a charset).

let ctx = null;
let enabled = true;
let last = 0;
let noiseBuf = null;

export function setSfxEnabled(v) { enabled = !!v; }

function audio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch (e) { return null; }
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
  osc.connect(g); g.connect(c.destination);
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
  src.connect(f); f.connect(g); g.connect(c.destination);
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
  }
};

export function sfx(kind) {
  if (!enabled) return;
  const now = performance.now();
  if (now - last < 35) return;
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
  if (enabled && navigator.vibrate) { try { navigator.vibrate(kind === "warn" ? [10, 30, 10] : 6); } catch (e) { } }
  if (el.matches(".btn, .iconbtn, .gloss-chip, .seg button")) {
    el.classList.remove("fx-pulse");
    void el.offsetWidth;
    el.classList.add("fx-pulse");
    el.addEventListener("animationend", () => el.classList.remove("fx-pulse"), { once: true });
  }
}
