// Effects engine, phase 1: what features, feats, species traits and custom bonuses
// change on the sheet. An effect is { t: target, v: value, when?, lv?, name? }.
// Targets: hp.max, ac, speed, init, pp, save.<ab>, save.all, skill.<id>, skill.all,
// skill.nonprof, spell.dc, spell.atk. Values: a number, or { perLevel }, { prof },
// { halfProf }, { abil, min }, { steps: [[level, n], ...] }. No DOM in here. ASCII only.
// Book-derived effects live in the locked rules file (an `effects` list on the entry);
// homebrew effects sit inline in campaign.json; players add their own as custom bonuses.

let SRC = () => null;
// fn returns { feats, classes, subclasses, species, effectsV } or null while rules are locked.
export function setEffectsSource(fn) { SRC = fn; }
export function effectsReady() { const s = SRC(); return !!(s && s.effectsV >= 1); }

const pbOf = l => Math.ceil((l || 1) / 4) + 1;
const modOf = s => Math.floor((Number(s || 10) - 10) / 2);
const baseName = n => String(n || "").replace(/\s*\(.*$/, "");

export const FX_TARGETS = [
  ["ac", "Armor Class"], ["speed", "Speed (ft)"], ["init", "Initiative"], ["hp.max", "Hit point maximum"], ["pp", "Passive Perception"],
  ["save.all", "All saving throws"], ["skill.all", "All skills"], ["spell.dc", "Spell save DC"], ["spell.atk", "Spell attack"]
];

export function resolveV(v, c) {
  if (typeof v === "number") return v;
  if (!v || typeof v !== "object") return 0;
  const L = c.level || 1;
  if (v.perLevel != null) return v.perLevel * L;
  if (v.prof) return pbOf(L) * (v.prof === true ? 1 : v.prof);
  if (v.halfProf) return Math.floor(pbOf(L) / 2);
  if (v.abil) return Math.max(v.min == null ? -99 : v.min, modOf((c.abilities || {})[v.abil]));
  if (v.steps) { let r = 0; v.steps.forEach(([lv, n]) => { if (L >= lv) r = n; }); return r; }
  return 0;
}

export function whenOk(w, ctx) {
  if (!w) return true;
  if (w === "armored") return !!ctx.armored;
  if (w === "unarmored") return !ctx.armored;
  if (w === "notHeavy") return !ctx.heavy;
  if (w === "unarmoredNoShield") return !ctx.armored && !ctx.shield;
  return true;
}

// Every effect that applies to this character (conditions are checked later, with the armor in hand).
export function collectEffects(c) {
  const s = SRC(), out = [];
  const add = (label, list) => (list || []).forEach(e => { if (e && e.t && (e.lv || 0) <= (c.level || 1)) out.push({ ...e, src: e.name || label }); });
  (c.custom || []).forEach(e => { if (e && e.t) out.push({ t: e.t, v: Number(e.v) || 0, src: e.label || "Custom", custom: true, id: e.id }); });
  if (!s) return out;
  (c.feats || []).forEach(f => { const b = baseName(f), e = s.feats.find(x => x.name === f) || s.feats.find(x => x.name === b); if (e) add(b, e.effects); });
  const cls = s.classes.find(x => x.name === c.class);
  ((cls && cls.features) || []).forEach(f => { if (f.lv <= (c.level || 1)) add(f.name, f.effects); });
  const sub = c.subclass ? s.subclasses.find(x => x.name === c.subclass) : null;
  ((sub && sub.features) || []).forEach(f => { if (f.lv <= (c.level || 1)) add(f.name, f.effects); });
  const sp = s.species.find(x => x.name === c.species);
  if (sp) add(sp.name, sp.effects);
  return out;
}

// [{ src, v }] for the given targets, with conditions applied.
export function fxList(c, targets, ctx = {}) {
  const want = [].concat(targets);
  return collectEffects(c).filter(e => want.includes(e.t) && whenOk(e.when, ctx)).map(e => ({ src: e.src, v: resolveV(e.v, c), custom: e.custom, id: e.id, when: e.when }));
}
export const fxSum = list => list.reduce((n, x) => n + x.v, 0);

// What a feat adds to the hit point maximum at a given level (for the level-up preview).
export function featHpGain(feat, level) {
  return ((feat && feat.effects) || []).filter(e => e.t === "hp.max").reduce((n, e) => n + resolveV(e.v, { level, abilities: {} }), 0);
}

// ---- Hit points: max = dice + Con per level + effects + hand adjustment ----
export function hpParts(c) {
  const level = c.level || 1, con = modOf((c.abilities || {}).con);
  const fx = fxList(c, "hp.max");
  const base = c.hp.base == null ? 0 : c.hp.base, adjust = c.hp.adjust || 0;
  const parts = [["Hit dice", base], [`Constitution (${con >= 0 ? "+" : ""}${con} x level ${level})`, con * level], ...fx.map(x => [x.src, x.v])];
  if (adjust) parts.push(["Set by hand", adjust]);
  return { parts, total: Math.max(1, parts.reduce((n, p) => n + p[1], 0)) };
}

const TOUGH_OLD = /Hit Point maximum increases by an amount equal to twice your character level/i;

// Recomputes hp.max. Returns true when something changed. Characters made before this engine
// get their dice total worked out once from the old stored maximum.
export function syncHp(c) {
  if (!c || !c.hp || !effectsReady()) return false;
  const s = SRC(), level = c.level || 1, con = modOf((c.abilities || {}).con);
  let changed = false;
  if (c.hp.base == null) {
    const toughOld = (c.feats || []).reduce((n, f) => { const e = s.feats.find(x => x.name === f) || s.feats.find(x => x.name === baseName(f)); return n + (e && TOUGH_OLD.test(e.text || "") ? 2 * level : 0); }, 0);
    c.hp.base = c.hp.max - con * level - toughOld; c.hp.adjust = 0; changed = true;
  }
  const max = hpParts(c).total;
  if (max !== c.hp.max) {
    const diff = max - c.hp.max;
    c.hp.max = max;
    if (c.hp.cur > 0 && diff > 0) c.hp.cur += diff;
    c.hp.cur = Math.max(0, Math.min(max, c.hp.cur));
    changed = true;
  }
  return changed;
}
