// Reads a species' rules text into facts and traits for the picker.
// Nothing is rewritten: every paragraph of the original text ends up in exactly
// one place (a fact line, a trait body, or the intro), word for word.
// What IS the app's own reading, and is labelled that way on screen:
//   - level:  the character level a trait starts at (1 unless its first sentence says otherwise)
//   - kind:   "active" (an action, a reaction, a limited-use trait) or "passive" (always on)
//   - usage:  a short summary of the action and recharge, e.g. "Bonus Action - Long Rest"
// ASCII only in this file.

const FACT = /^(Creature Type|Size|Speed|Life ?Span|Age)\s*:\s*(.+)$/i;
const LEAD = /^([A-Z][\w'()\/\u2019-]*(?: (?:[A-Z0-9][\w'()\/\u2019-]*|of|the|and|or|to|in|a|an|with|for|on|at)){0,5})\.\s+(?=\S)/;
const LEVEL = /(?:reach(?:es)?|at|starting at|beginning at|beginning when you reach|from)\s+(?:character\s+)?level\s+(\d+)|(\d+)(?:st|nd|rd|th)[ -]level/i;

const ACTIVE = [
  /\bas an? (?:Bonus Action|Magic action|action|Reaction)\b/i,
  /\b(?:Bonus Action|Magic action|Reaction)\b/i,
  /\bnumber of times equal to your Proficiency Bonus\b/i,
  /\b(?:can't|cannot) (?:use|do so|use it|use this trait)(?: it)? again until\b/i,
  /\bonce you use this trait\b/i,
  /\bonce per (?:short|long) rest\b/i
];

function usageOf(text) {
  const t = text.replace(/\u2019/g, "'");
  const action = (/\b(Bonus Action|Magic action|Reaction)\b/i.exec(t) || [])[1]
    || (/\bas an action\b/i.test(t) ? "Action" : "");
  const rest = /Short or Long Rest/i.test(t) ? "Short or Long Rest" : /Long Rest/i.test(t) ? "Long Rest" : /Short Rest/i.test(t) ? "Short Rest" : "";
  const pb = /number of times equal to your Proficiency Bonus/i.test(t);
  const once = /\b(?:can't|cannot) (?:use|do so)(?: it| this trait)? again until/i.test(t);
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const limit = pb ? "Proficiency Bonus uses" + (rest ? ", back on " + rest : "") : once ? "Once" + (rest ? " per " + rest : "") : rest;
  return [cap(action), limit].filter(Boolean).join(" \u00b7 ");
}

const cache = new WeakMap();
export function parseSpecies(sp) {
  if (!sp) return { facts: [], intro: [], traits: [] };
  if (cache.has(sp)) return cache.get(sp);
  const paras = String(sp.traits || "").split(/\n{2,}/).map(p => p.replace(/\s+$/, "")).filter(p => p.trim());
  const facts = [], intro = [], traits = [];
  let cur = null;
  for (const p of paras) {
    const f = FACT.exec(p);
    if (f && !cur) { facts.push({ k: f[1], v: f[2], raw: p }); continue; }
    if (f && cur && !/\n/.test(p) && /^(Creature Type|Size|Speed)$/i.test(f[1])) { facts.push({ k: f[1], v: f[2], raw: p }); continue; }
    const m = LEAD.exec(p);
    // "Here are the options:" followed by named options: they belong to the trait that lists them
    if (m && cur && (cur.opts || /:\s*$/.test(cur.paras[cur.paras.length - 1] || ""))) { cur.opts = true; cur.paras.push(p); continue; }
    if (m) {
      cur = { name: m[1], paras: [p.slice(m[0].length)] };
      traits.push(cur);
    } else if (cur) cur.paras.push(p);
    else intro.push(p);
  }
  for (const t of traits) {
    const body = t.paras.join("\n\n");
    const first = (t.paras[0] || "").split(/(?<=[.!?])\s+/)[0] || "";
    const lv = LEVEL.exec(first);
    t.level = lv ? +(lv[1] || lv[2]) : 1;
    t.body = body;
    t.kind = ACTIVE.some(re => re.test(body)) ? "active" : "passive";
    t.usage = t.kind === "active" ? (usageOf(body) || "Limited use") : "Always on";
    // corrections stored with the entry in the rules file: traitFix: { "Trait name": { kind, usage, level } }
    const fx = sp.traitFix && sp.traitFix[t.name];
    if (fx) { if (fx.kind) t.kind = fx.kind; if (fx.usage) t.usage = fx.usage; if (fx.level) t.level = fx.level; }
  }
  const out = { facts, intro, traits };
  cache.set(sp, out);
  return out;
}

// Level a named trait starts at (1 when unknown): used to hold later choices for later.
export function traitLevel(sp, name) {
  const n = String(name || "").toLowerCase();
  const t = parseSpecies(sp).traits.find(x => x.name.toLowerCase() === n);
  return t ? t.level : 1;
}
