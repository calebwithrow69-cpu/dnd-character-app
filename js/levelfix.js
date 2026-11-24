// Level history: what a level-up changed, how to take it back, and a repair for characters
// whose level was lowered by hand (the old Level field only changed the number).
// Pure data, no DOM. ASCII only.
import { ABILITIES, ABILITY_BY_LABEL, abilityMod, hpAverageGain, xpForLevel } from "./rules.js";

const clone = v => JSON.parse(JSON.stringify(v));
const arr = v => (Array.isArray(v) ? v : []);

// The parts of a character a level-up can touch.
export function captureLevel(c) {
  return {
    abilities: clone(c.abilities || {}), feats: arr(c.feats).slice(), hpBase: c.hp && c.hp.base != null ? c.hp.base : null,
    xp: c.xp || 0, subclass: c.subclass || "", choices: clone(c.choices || {}), profs: clone(c.profs || { armor: [], weapons: [] }),
    languages: c.languages || "", skillProf: arr(c.skillProf).slice(), skillExpertise: arr(c.skillExpertise).slice(),
    masteries: arr(c.masteries).slice(), spells: arr(c.spellcasting && c.spellcasting.spells).map(s => s.name)
  };
}

// What changed between a capture and the character now. Stored on the level log entry.
export function diffLevel(before, c) {
  const after = captureLevel(c), u = { abil: {}, feats: [], choices: {}, profs: { armor: [], weapons: [] } };
  ABILITIES.forEach(a => { const d = (after.abilities[a] || 0) - (before.abilities[a] || 0); if (d) u.abil[a] = d; });
  const left = before.feats.slice();
  after.feats.forEach(f => { const i = left.indexOf(f); if (i >= 0) left.splice(i, 1); else u.feats.push(f); });
  if (before.hpBase != null && after.hpBase != null && after.hpBase !== before.hpBase) u.hp = after.hpBase - before.hpBase;
  if (after.subclass !== before.subclass) u.subclass = before.subclass;
  Object.keys(after.choices).forEach(k => { if (JSON.stringify(after.choices[k]) !== JSON.stringify(before.choices[k])) u.choices[k] = k in before.choices ? before.choices[k] : null; });
  ["armor", "weapons"].forEach(g => { u.profs[g] = arr(after.profs[g]).filter(x => !arr(before.profs[g]).includes(x)); });
  if (after.languages !== before.languages) u.languages = before.languages;
  const added = (a, b) => b.filter(x => !a.includes(x));
  u.skillProf = added(before.skillProf, after.skillProf); u.skillExpertise = added(before.skillExpertise, after.skillExpertise);
  u.masteries = added(before.masteries, after.masteries); u.spells = added(before.spells, after.spells);
  u.xp = before.xp;
  return u;
}

const dropOne = (list, v) => { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); };

// Take one level-up back. u comes from diffLevel, or from heuristicUndo for old log entries.
export function applyUndo(c, u) {
  ABILITIES.forEach(a => { if (u.abil && u.abil[a]) c.abilities[a] = Math.max(1, (c.abilities[a] || 10) - u.abil[a]); });
  arr(u.feats).forEach(f => dropOne(c.feats, f));
  if (u.hp && c.hp && c.hp.base != null) c.hp.base = Math.max(0, c.hp.base - u.hp);
  if (u.subclass !== undefined) c.subclass = u.subclass;
  Object.keys(u.choices || {}).forEach(k => { if (u.choices[k] === null) delete c.choices[k]; else c.choices[k] = u.choices[k]; });
  if (u.profs && c.profs) ["armor", "weapons"].forEach(g => arr(u.profs[g]).forEach(x => dropOne(c.profs[g], x)));
  if (u.languages !== undefined) c.languages = u.languages;
  arr(u.skillExpertise).forEach(x => dropOne(c.skillExpertise, x));
  arr(u.skillProf).forEach(x => dropOne(c.skillProf, x));
  arr(u.masteries).forEach(x => dropOne(c.masteries, x));
  if (c.spellcasting) arr(u.spells).forEach(n => { const i = c.spellcasting.spells.findIndex(s => s.name === n); if (i >= 0) c.spellcasting.spells.splice(i, 1); });
}

// Old log entries have no diff, only text ("Feat: X; Strength 15→16; Subclass: Y").
// Read what the text states, and take the average hit die for the HP.
export function heuristicUndo(c, entry) {
  const u = { abil: {}, feats: [], hp: hpAverageGain((c.hitDice && c.hitDice.die) || 8, 0), choices: {}, profs: { armor: [], weapons: [] } };
  String(entry.summary || "").split(/;\s*/).forEach(t => {
    let m;
    if ((m = /^(?:Feat|Fighting style): (.+)$/.exec(t))) u.feats.push(m[1].trim());
    else if ((m = /^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) (\d+)→(\d+)$/.exec(t))) u.abil[ABILITY_BY_LABEL[m[1]]] = (u.abil[ABILITY_BY_LABEL[m[1]]] || 0) + (+m[3] - +m[2]);
    else if ((m = /^Subclass: (.+)$/.exec(t))) { u.subclass = ""; u.subclassName = m[1].trim(); }
  });
  // The log states the max HP change. With no Constitution or HP feat in that level, the die was that change less Con.
  const hm = /([+-]\d+) HP/.exec(String(entry.summary || ""));
  const die = (c.hitDice && c.hitDice.die) || 8;
  if (hm && !u.abil.con && !u.feats.some(f => /Tough|Hearty|Durable|Hill Giant/i.test(f))) {
    const dice = +hm[1] - abilityMod((c.abilities || {}).con || 10);
    if (dice >= 1 && dice <= die) u.hp = dice;
  }
  return u;
}

// Levels in the log the character no longer has: above its level, or earlier copies of a level taken again.
export function staleEntries(c) {
  const log = arr(c.levelLog);
  return log.filter((e, i) => e.level > (c.level || 1) || log.slice(i + 1).some(x => x.level === e.level));
}

// Fix a character whose level was lowered by hand. Returns what it changed (empty when nothing).
export function repairLevels(c) {
  const stale = staleEntries(c);
  if (!stale.length) return [];
  const keep = arr(c.levelLog).filter(e => !stale.includes(e));
  const keptFeats = new Set(keep.flatMap(e => (String(e.summary || "").match(/(?:Feat|Fighting style): [^;]+/g) || []).map(t => t.replace(/^[^:]+: /, "").trim())));
  const keptSub = new Set(keep.flatMap(e => (String(e.summary || "").match(/Subclass: [^;]+/g) || []).map(t => t.replace(/^[^:]+: /, "").trim())));
  const lines = [];
  stale.slice().reverse().forEach(e => {
    const u = e.undo || heuristicUndo(c, e);
    if (!e.undo) {
      u.feats = u.feats.filter(f => !keptFeats.has(f));
      if (u.subclassName && (keptSub.has(u.subclassName) || c.subclass !== u.subclassName)) delete u.subclass;
      delete u.subclassName;
    }
    applyUndo(c, u);
    lines.push(`Level ${e.level} removed`);
  });
  c.levelLog = keep;
  return lines;
}

// Lower the level by one, undoing the last level-up. Returns false at level 1.
export function deLevel(c) {
  if ((c.level || 1) <= 1) return false;
  const log = arr(c.levelLog);
  let at = -1;
  for (let i = log.length - 1; i >= 0; i--) if (log[i].level === c.level) { at = i; break; }
  const entry = at >= 0 ? log[at] : { level: c.level, summary: "" };
  applyUndo(c, entry.undo || heuristicUndo(c, entry));
  if (at >= 0) log.splice(at, 1);
  c.levelLog = log;
  c.level -= 1;
  c.hitDice.total = c.level; c.hitDice.spent = Math.min(c.hitDice.spent || 0, c.level);
  const had = entry.undo && entry.undo.xp != null ? entry.undo.xp : null;
  c.xp = had != null ? Math.min(c.xp || 0, Math.max(had, 0)) : Math.min(c.xp || 0, xpForLevel(c.level + 1) - 1);
  delete c.hpRoll;
  return true;
}
