// What a feat changes on the character sheet, read from the feat's own rules
// text (nothing reworded): ability score increases (fixed, a short list, or any
// score), Resilient's saving throw proficiency, and Hit Point maximum bonuses.
import { ABILITIES, ABILITY_LABEL, abilityMod } from "./rules.js";
import { featHpGain } from "./effects.js";

const NAME_TO_ID = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
export const ASI_FEAT = "Ability Score Improvement";

// -> null (no increase) or { options: [ids], cap, saveProf }
export function featAbilityIncrease(feat, c) {
  const text = feat?.text || "";
  const m = /Ability Score Increase\.?\s*([^\n]*)/i.exec(text);
  if (!m) return null;
  const s = m[1];
  const cap = /maximum of 30/i.test(s) ? 30 : 20;
  if (/lack saving throw proficiency/i.test(s)) {
    const have = c?.saveProf || [];
    return { options: ABILITIES.filter(a => !have.includes(a)), cap, saveProf: true };
  }
  if (/one ability score of your choice|any ability score/i.test(s)) return { options: [...ABILITIES], cap };
  const head = s.split(/\bby \d/i)[0];
  const ids = [...head.matchAll(/Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma/gi)].map(x => NAME_TO_ID[x[0].toLowerCase()]);
  return ids.length ? { options: [...new Set(ids)], cap } : null;
}

// Tough: "Hit Point maximum increases by an amount equal to twice your character level ... +2 each level"
export function featHp(feat) {
  const t = feat?.text || "";
  if (/Hit Point maximum increases by an amount equal to twice your character level/i.test(t)) return { perLevel: 2, now: lvl => 2 * lvl };
  return null;
}

// Rows for the little "what changes" box: [{ label, from, to, extra }]
export function previewFeat(feat, c, level, pickAb) {
  const rows = [];
  const inc = featAbilityIncrease(feat, c);
  let conMod0 = abilityMod(c.abilities.con), conMod1 = conMod0;
  if (inc && pickAb && inc.options.includes(pickAb)) {
    const to = Math.min(inc.cap, c.abilities[pickAb] + 1);
    rows.push({ label: ABILITY_LABEL[pickAb], from: c.abilities[pickAb], to,
      extra: `modifier ${abilityMod(c.abilities[pickAb]) >= 0 ? "+" : ""}${abilityMod(c.abilities[pickAb])} to ${abilityMod(to) >= 0 ? "+" : ""}${abilityMod(to)}` });
    if (pickAb === "con") conMod1 = abilityMod(to);
    if (inc.saveProf) rows.push({ label: ABILITY_LABEL[pickAb] + " saves", from: "no proficiency", to: "proficient" });
  }
  let hpGain = 0;
  hpGain += featHpGain(feat, level);
  if (conMod1 !== conMod0) hpGain += (conMod1 - conMod0) * level;
  if (hpGain) rows.push({ label: "Hit point maximum", delta: hpGain, hp: true, extra: "on top of this level's hit die" });
  return rows;
}

// Apply a feat's sheet changes. Returns { log: [...], hp: n } where hp is the extra
// maximum from the feat itself (the retroactive Constitution change is handled by the caller).
export function applyFeat(c, feat, level, pickAb) {
  const log = [];
  const inc = featAbilityIncrease(feat, c);
  if (inc && pickAb && inc.options.includes(pickAb)) {
    const from = c.abilities[pickAb], to = Math.min(inc.cap, from + 1);
    c.abilities = { ...c.abilities, [pickAb]: to };
    log.push(`${ABILITY_LABEL[pickAb]} ${from}→${to}`);
    if (inc.saveProf && !(c.saveProf || []).includes(pickAb)) { c.saveProf = [...(c.saveProf || []), pickAb]; log.push(`${ABILITY_LABEL[pickAb]} saving throws`); }
  }
  return { log, hp: 0 }; // hit point bonuses come from the feat's effects now (js/effects.js)
}
