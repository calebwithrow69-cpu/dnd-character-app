// Subclass model (pure): the level template from the class's own subclass levels, which slots are empty,
// which abilities a subclass leans on (read from its rules text) and a loose fit against a character's scores. ASCII only.
import { SUBCLASS_LEVELS } from "./data.js";

export const ABS = [["str", "Strength"], ["dex", "Dexterity"], ["con", "Constitution"], ["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"]];
const KEY = Object.fromEntries(ABS.map(([k, n]) => [n.toLowerCase(), k]));
const NAMES = ABS.map(a => a[1]).join("|");
export const abShort = k => k.toUpperCase();
export const abLong = k => (ABS.find(a => a[0] === k) || [k, k])[1];

// "Primary Ability: Strength or Dexterity" in the class core text.
export function classPrimary(cls) {
  const m = /Primary Ability:\s*\n?\s*([^\n]+)/i.exec((cls && cls.core) || "");
  return m ? [...m[1].matchAll(new RegExp(NAMES, "gi"))].map(x => KEY[x[0].toLowerCase()]) : [];
}

// Abilities the subclass's own features use: "your X modifier", "X or Y modifier", "X is your spellcasting ability".
// A creature's modifier ("the target's Strength modifier") is not the player's.
export function needs(sc) {
  const text = (sc.features || []).map(f => String(f.text || "")).join("\n");
  const count = {};
  const bump = (name, at) => {
    if (/(?:'s|its|their|target's|creature's)\s+(?:your\s+)?$/i.test(text.slice(Math.max(0, at - 14), at))) return;
    const k = KEY[name.toLowerCase()]; if (k) count[k] = (count[k] || 0) + 1;
  };
  const mod = new RegExp(`\\b(?:your\\s+)?((?:${NAMES})(?:\\s*(?:,|or|and)\\s*(?:${NAMES}))*)\\s+(?:modifier|score)`, "gi");
  for (const m of text.matchAll(mod)) for (const a of m[1].matchAll(new RegExp(NAMES, "gi"))) bump(a[0], m.index);
  for (const m of text.matchAll(new RegExp(`spellcasting ability (?:is|for these spells is)\\s+(${NAMES})`, "gi"))) bump(m[1], m.index);
  for (const m of text.matchAll(new RegExp(`(${NAMES}) is your spellcasting ability`, "gi"))) bump(m[1], m.index);
  return Object.entries(count).map(([ab, n]) => ({ ab, n })).sort((a, b) => b.n - a.n || ABS.findIndex(x => x[0] === a.ab) - ABS.findIndex(x => x[0] === b.ab));
}

// One row per level the class expects a subclass feature at (plus any other level the subclass has features at).
export function template(sc) {
  const feats = (sc.features || []).filter(f => !f.intro);
  const levels = [...new Set([...(SUBCLASS_LEVELS[sc.cls] || []), ...feats.map(f => f.lv)])].sort((a, b) => a - b);
  return levels.map(lv => { const fs = feats.filter(f => f.lv === lv); return { lv, feats: fs, missing: fs.length === 0 }; });
}
export const missingLevels = sc => template(sc).filter(r => r.missing).map(r => r.lv);

// How an ability score reads for a subclass that leans on it: ok (+2 or more), low (+0 or +1), poor (below +0).
const modOf = s => Math.floor(((+s || 10) - 10) / 2);
export const toneOf = score => { const m = modOf(score); return m >= 2 ? "ok" : m >= 0 ? "low" : "poor"; };

// The 2024 Player's Handbook subclasses: a new player's safe bets, used to break ties.
const CORE = {
  Barbarian: /berserker|wild heart|world tree|zealot/, Bard: /dance|glamour|lore|valor/, Cleric: /^life|^light|^trickery|^war/,
  Druid: /land|moon|sea|stars/, Fighter: /battle master|champion|eldritch knight|psi warrior/, Monk: /mercy|shadow|elements|open hand/,
  Paladin: /devotion|glory|ancients|vengeance/, Ranger: /beast master|fey wanderer|gloom stalker|hunter/, Rogue: /arcane trickster|assassin|soulknife|thief/,
  Sorcerer: /aberrant|clockwork|draconic|wild magic/, Warlock: /archfey|celestial|fiend|great old one/, Wizard: /abjur|diviner|divination|evoker|evocation|illusion/
};
const isCore = (cls, name) => !!(CORE[cls] && CORE[cls].test(String(name).toLowerCase().replace(/^(path|college|circle|oath|school|way|domain)s? (of )?(the )?/, "")));
// Constitution is everyone's stat: it only counts as a need when a subclass leans on it heavily.
const shown = n => n.filter(x => x.ab !== "con" || x.n >= 2);

// Loose fit, 0..1: how well the character's scores cover the abilities the subclass uses (Constitution aside).
function fit(sc, cls, abil) {
  const n = needs(sc).filter(x => x.ab !== "con"), prim = classPrimary(cls);
  const v = ab => Math.max(0, Math.min(1, (modOf(abil[ab]) + 1) / 4));
  if (!n.length) return prim.length ? Math.max(...prim.map(v)) : 0.5;
  const tot = n.reduce((a, u) => a + u.n, 0);
  return n.reduce((a, u) => a + u.n * v(u.ab), 0) / tot;
}
// Map of subclass name -> {rec, fit, needs: [{ab, n, score, tone, off}]}. One subclass is recommended: the best fit
// (to the nearest 0.05), then Player's Handbook before the rest, then the most use of the character's strong scores,
// then name. Nothing is recommended unless the best fit clearly suits the scores.
export function assess(subs, cls, abil) {
  abil = abil || {};
  const prim = new Set(classPrimary(cls));
  const rows = subs.map(sc => {
    const n = needs(sc);
    const strong = n.filter(x => x.ab !== "con" && modOf(abil[x.ab]) >= 2).reduce((a, x) => a + x.n, 0);
    return { name: sc.name, f: Math.round(fit(sc, cls, abil) * 20) / 20, core: isCore(sc.cls || (cls && cls.name), sc.name) ? 1 : 0, strong,
      needs: shown(n).map(x => ({ ...x, score: abil[x.ab], tone: toneOf(abil[x.ab]), off: !prim.has(x.ab) && x.ab !== "con" })) };
  });
  const best = rows.slice().sort((a, b) => b.f - a.f || b.core - a.core || b.strong - a.strong || a.name.localeCompare(b.name))[0];
  const out = new Map();
  rows.forEach(r => out.set(r.name, { rec: !!best && best.name === r.name && r.f >= 0.7, fit: r.f, needs: r.needs }));
  return out;
}
