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

// Effects engine. A Feature (feat, class/subclass feature, species trait, item, homebrew, or a
// player's custom bonus) carries `effects: [Effect]`. An Effect is
//   { t: target, op?: "add"|"set"|"max"|"min"|"adv"|"dis"|"reroll"|"grant", v?: Expr, when?: Cond, lv?: n, name?: label }
// Targets (stat):  ac  ac.base  speed  init  hp.max  pp  save.<ab>|save.all  skill.<id>|skill.all|skill.nonprof  spell.dc  spell.atk
// Targets (roll):  atk  dmg  (use `when` with {attack:..} / {wield:..} to narrow them), plus save.* skill.* init for adv/dis
// Targets (grant): grant.resist.<type>  grant.immune.<type>  grant.prof.<skill|save|armor|weapon|tool>.<name>  grant.sense.<name>  grant.language.<name>
// Expr:   a number, or { perLevel } { lvl } { prof } { halfProf } { abil, min } { classLevel } { steps:[[lvl,n]..] }
//         { add:[..] } { mul:[a,b] } { half:e } { neg:e } { max:[..] } { min:[..] } { if:Cond, then:e, else:e }
//         dice (roll targets only): "1d8" or { dice:"1d4", steps:[[9,"2d4"],[16,"4d4"]] }
// Cond:   "armored"|"unarmored"|"notHeavy"|"unarmoredNoShield" (older strings) or
//         { all:[..] } { any:[..] } { not:c } { armor:"none|any|light|medium|heavy" } { shield:bool }
//         { wield:"melee|ranged|twoHanded|oneHanded|alone|light|finesse|thrown|versatile|dual|unarmed" } { abil:"str|dex|..." } { pick:[choiceLabel, option] } { attack:"melee|ranged|spell|weapon|unarmed|cantrip" }
//         { hpBelow:fraction } { level:{gte,lte} } { class:name } { toggle:id } { condition:name } { uses:{id,gte} }
// The engine is the one place that knows how to read all this; the DM block editor will only ever
// write and read this same JSON. No DOM in here. ASCII only.

export const FX_TARGETS = [
  ["ac", "Armor Class"], ["speed", "Speed (ft)"], ["init", "Initiative"], ["hp.max", "Hit point maximum"], ["pp", "Passive Perception"],
  ["save.all", "All saving throws"], ["skill.all", "All skills"], ["spell.dc", "Spell save DC"], ["spell.atk", "Spell attack"]
];
const ABS = "str|dex|con|int|wis|cha";
const TARGET_RES = [/^(ac|ac\.base|speed|init|hp\.max|pp|spell\.dc|spell\.atk|atk|dmg|unarmed|attacks)$/, new RegExp("^save\\.(all|" + ABS + ")$"), /^skill\.[a-z]+$/, /^skill\.(all|nonprof)$/,
  /^grant\.(resist|immune|prof|sense|language)\.[A-Za-z. ]+$/];
const OPS = ["add", "set", "max", "min", "adv", "dis", "reroll", "grant"];
const EXPR_KEYS = ["ctx", "perLevel", "lvl", "prof", "halfProf", "abil", "classLevel", "steps", "add", "mul", "half", "neg", "max", "min", "if", "dice"];
const COND_KEYS = ["all", "any", "not", "armor", "shield", "wield", "attack", "hpBelow", "level", "class", "toggle", "condition", "uses", "abil", "pick"];
const LEGACY_COND = ["armored", "unarmored", "notHeavy", "unarmoredNoShield"];

// Returns a list of problems (empty = valid). Used by the tests, the audit tool and the DM editor.
export function validateEffect(e) {
  const bad = [];
  if (!e || typeof e !== "object") return ["effect is not an object"];
  if (!TARGET_RES.some(r => r.test(String(e.t)))) bad.push("unknown target: " + e.t);
  const op = e.op || "add";
  if (!OPS.includes(op)) bad.push("unknown op: " + op);
  const exprOk = x => {
    if (typeof x === "number") return true;
    if (typeof x === "string") return /^\d*d\d+([+-]\d+)?$/.test(x);
    if (!x || typeof x !== "object") return false;
    const k = Object.keys(x).filter(y => EXPR_KEYS.includes(y));
    if (!k.length) return false;
    for (const key of k) {
      const v = x[key];
      if (["add", "max", "min"].includes(key)) { if (!Array.isArray(v) || !v.every(exprOk)) return false; }
      else if (key === "mul") { if (!Array.isArray(v) || v.length !== 2 || !v.every(exprOk)) return false; }
      else if (key === "half" || key === "neg") { if (!exprOk(v)) return false; }
      else if (key === "if") { if (!condOk(v) || !exprOk(x.then) || (x.else != null && !exprOk(x.else))) return false; }
    }
    return true;
  };
  const condOk = c => {
    if (c == null) return true;
    if (typeof c === "string") return LEGACY_COND.includes(c);
    if (typeof c !== "object") return false;
    const k = Object.keys(c);
    if (!k.length || !k.every(y => COND_KEYS.includes(y))) return false;
    if (c.all && !(Array.isArray(c.all) && c.all.every(condOk))) return false;
    if (c.any && !(Array.isArray(c.any) && c.any.every(condOk))) return false;
    if (c.not && !condOk(c.not)) return false;
    return true;
  };
  if (e.t === "unarmed") {
    const u = e.v;
    if (!u || typeof u !== "object" || (u.dice != null && !/^\d*d\d+$/.test(String(u.dice))) || (u.flat != null && typeof u.flat !== "number") || (u.abil != null && !new RegExp("^(" + ABS + ")$").test(u.abil))) bad.push("unarmed needs { dice, dtype?, abil? }");
    if (!condOk(e.when)) bad.push("bad condition");
    return bad;
  }
  if (op === "reroll") {
    const u = e.v;
    if (!u || typeof u !== "object" || typeof u.atMost !== "number" || (u.as != null && typeof u.as !== "number")) bad.push("reroll needs { atMost, as? }");
    if (!condOk(e.when)) bad.push("bad condition");
    return bad;
  }
  if (op === "add" || op === "set" || op === "max" || op === "min" || op === "reroll" || (op === "grant" && e.v != null)) { if (e.v == null || !exprOk(e.v)) bad.push("bad value"); }
  if (!condOk(e.when)) bad.push("bad condition");
  return bad;
}

const DICE_RE = /^(\d*)d(\d+)([+-]\d+)?$/;

// ---- values ----
export function evalExpr(v, c, ctx = {}) {
  if (typeof v === "number") return v;
  if (!v || typeof v !== "object") return 0;
  const L = c.level || 1, ev = x => evalExpr(x, c, ctx);
  if (v.ctx) return Number(ctx[v.ctx]) || 0;
  if (v.perLevel != null) return v.perLevel * L;
  if (v.lvl) return L;
  if (v.prof) return pbOf(L) * (v.prof === true ? 1 : v.prof);
  if (v.halfProf) return Math.floor(pbOf(L) / 2);
  if (v.abil) return Math.max(v.min == null ? -99 : v.min, modOf((c.abilities || {})[v.abil]));
  if (v.classLevel) return c.class === v.classLevel ? L : 0;
  if (v.steps) { let r = 0; v.steps.forEach(([lv, n]) => { if (L >= lv) r = n; }); return r; }
  if (v.add) return v.add.reduce((n, x) => n + ev(x), 0);
  if (v.mul) return ev(v.mul[0]) * ev(v.mul[1]);
  if (v.half != null) return Math.floor(ev(v.half) / 2);
  if (v.neg != null) return -ev(v.neg);
  if (v.max) return Math.max(...v.max.map(ev));
  if (v.min) return Math.min(...v.min.map(ev));
  if (v.if) return evalCond(v.if, ctx, c) ? ev(v.then) : (v.else == null ? 0 : ev(v.else));
  return 0;
}
export const resolveV = evalExpr; // older name

// Dice for roll targets: "1d8" (or a scaling { dice, steps }) -> "2d6" style string at this character's level; numbers stay numbers.
export function evalDice(v, c) {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && v.dice) { let r = v.dice; (v.steps || []).forEach(([lv, d]) => { if ((c.level || 1) >= lv) r = d; }); return r; }
  return null;
}
export function diceAverage(d) { const m = DICE_RE.exec(d || ""); return m ? (Number(m[1] || 1) * (Number(m[2]) + 1)) / 2 + Number(m[3] || 0) : 0; }

// ---- conditions ----
function norm(ctx) {
  const x = { ...ctx };
  if (x.armor == null) x.armor = !x.armored ? "none" : x.heavy ? "heavy" : (x.armorCat || "any");
  x.wield = x.wield || {};
  return x;
}
export function evalCond(w, ctx = {}, c = {}) {
  if (w == null) return true;
  const x = norm(ctx);
  if (typeof w === "string") {
    if (w === "armored") return x.armor !== "none";
    if (w === "unarmored") return x.armor === "none";
    if (w === "notHeavy") return x.armor !== "heavy";
    if (w === "unarmoredNoShield") return x.armor === "none" && !x.shield;
    return true;
  }
  if (w.all) return w.all.every(y => evalCond(y, ctx, c));
  if (w.any) return w.any.some(y => evalCond(y, ctx, c));
  if (w.not) return !evalCond(w.not, ctx, c);
  let ok = true;
  if (w.armor) ok = ok && (w.armor === "any" ? x.armor !== "none" : x.armor === w.armor);
  if (w.shield != null) ok = ok && !!x.shield === !!w.shield;
  if (w.wield) ok = ok && !!x.wield[w.wield];
  if (w.attack) ok = ok && ([].concat(x.attack || [])).includes(w.attack);
  if (w.abil) ok = ok && x.abil === w.abil;
  if (w.pick) ok = ok && [].concat((c.choices || {})[w.pick[0]] || []).includes(w.pick[1]);
  if (w.hpBelow != null) ok = ok && (c.hp ? c.hp.cur / Math.max(1, c.hp.max) : 1) < w.hpBelow;
  if (w.level) ok = ok && (w.level.gte == null || (c.level || 1) >= w.level.gte) && (w.level.lte == null || (c.level || 1) <= w.level.lte);
  if (w.class) ok = ok && c.class === w.class;
  if (w.toggle) ok = ok && ((x.toggles || (c.active || []).map(a => a.id)).some(id => String(id).includes(w.toggle)));
  if (w.condition) ok = ok && ((c.conditions || []).includes(w.condition) || (x.conditions || []).includes(w.condition));
  if (w.uses) { const r = (c.resources || []).find(q => q.name === w.uses.id); ok = ok && !!r && r.max - r.used >= (w.uses.gte == null ? 1 : w.uses.gte); }
  return ok;
}
export const whenOk = (w, ctx) => evalCond(w, ctx || {}, {}); // older name (no character)

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

const applies = (e, c, ctx) => evalCond(e.when, ctx, c);

// [{ src, v }] of the plain "add" effects for the given targets, conditions applied.
export function fxList(c, targets, ctx = {}) {
  const want = [].concat(targets);
  return collectEffects(c).filter(e => want.includes(e.t) && (e.op || "add") === "add" && applies(e, c, ctx))
    .map(e => ({ src: e.src, v: evalExpr(e.v, c, ctx), custom: e.custom, id: e.id, when: e.when }));
}
export const fxSum = list => list.reduce((n, x) => n + x.v, 0);

// A stat with formulas: "set" replaces the base, "max"/"min" pick the better/worse of base and formula, then "add" bonuses stack.
// Returns { total, parts: [[source, value]] } (parts is for the breakdown screen).
export function fxStat(c, target, base, ctx = {}) {
  const list = collectEffects(c).filter(e => e.t === target && applies(e, c, ctx));
  let total = base; const parts = [];
  list.filter(e => e.op === "set").forEach(e => { total = evalExpr(e.v, c, ctx); parts.push([e.src + " (sets)", total]); });
  list.filter(e => e.op === "max").forEach(e => { const v = evalExpr(e.v, c, ctx); if (v > total) { total = v; parts.push([e.src + " (better base)", v]); } });
  list.filter(e => e.op === "min").forEach(e => { const v = evalExpr(e.v, c, ctx); if (v < total) { total = v; parts.push([e.src + " (cap)", v]); } });
  list.filter(e => (e.op || "add") === "add").forEach(e => { const v = evalExpr(e.v, c, ctx); total += v; parts.push([e.src, v]); });
  return { total, parts };
}

// Things that change a ROLL: flat bonuses, bonus dice, advantage, disadvantage, rerolls.
// target: "atk" | "dmg" | "init" | "save.dex" | "skill.stealth" ... ; ctx says what kind of attack/weapon this roll is.
export function rollMods(c, target, ctx = {}) {
  const out = { flat: 0, dice: [], adv: [], dis: [], reroll: [], parts: [], riders: [] };
  collectEffects(c).filter(e => e.t === target && applies(e, c, ctx)).forEach(e => {
    const op = e.op || "add";
    // rider: the player decides on the roll (once-per-turn extras, "if thrown", "if within 5 feet")
    if (e.rider && op === "add") { const d = evalDice(e.v, c); out.riders.push({ src: e.src, dice: d || null, flat: d ? 0 : evalExpr(e.v, c, ctx), once: !!e.once, note: e.note || "" }); return; }
    if (op === "adv") out.adv.push(e.src);
    else if (op === "dis") out.dis.push(e.src);
    else if (op === "reroll") out.reroll.push({ src: e.src, ...(typeof e.v === "object" ? e.v : {}) });
    else if (op === "add") {
      const d = evalDice(e.v, c);
      if (d) { out.dice.push({ src: e.src, dice: d, once: !!e.once }); out.parts.push([e.src, d]); }
      else { const v = evalExpr(e.v, c, ctx); out.flat += v; out.parts.push([e.src, v]); }
    }
  });
  return out;
}

// Resistances, immunities, senses, languages and proficiencies a character has: ["fire", ...] or [{name, v}].
export function grantsOf(c, kind, ctx = {}) {
  const out = [];
  collectEffects(c).filter(e => (e.op === "grant" || String(e.t).startsWith("grant.")) && String(e.t).startsWith("grant." + kind + ".") && applies(e, c, ctx))
    .forEach(e => { const name = String(e.t).slice(("grant." + kind + ".").length); if (!out.some(x => x.name === name)) out.push({ name, v: e.v == null ? null : evalExpr(e.v, c, ctx), src: e.src }); });
  return out;
}

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

// Unarmed Strike profiles the character has: the basic 1 + Str, plus any a trait or feat grants
// ({ t:"unarmed", op:"grant", v:{ dice, dtype, abil, flat } }). Each is { src, dice, dtype, abil }.
export function unarmedOptions(c, ctx = {}) {
  return collectEffects(c).filter(e => e.t === "unarmed" && applies(e, c, ctx))
    .map(e => ({ src: e.src, dice: e.v.dice || null, flat: e.v.flat || 0, dtype: e.v.dtype || "bludgeoning", abil: e.v.abil || "str", separate: !!e.v.separate }));
}
