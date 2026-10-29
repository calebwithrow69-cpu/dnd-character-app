import { rollDie } from "./rules.js";

// Parses and rolls formulas like "2d6+3", "1d8+1d6+2", "d20-1", "4d6kh3".
// Returns null if the text isn't a dice formula.
export function rollFormula(formula, { doubleDice = false } = {}) {
  const src = String(formula || "").replace(/\s+/g, "").toLowerCase();
  if (!src) return null;
  const re = /([+-]?)(?:(\d*)d(\d+)(?:k([hl])(\d+))?|(\d+))/g;
  let pos = 0, m, total = 0, mod = 0;
  const groups = [];
  while ((m = re.exec(src)) !== null) {
    if (m.index !== pos) return null;             // junk between terms
    if (m[0] === "") return null;
    pos = re.lastIndex;
    const sign = m[1] === "-" ? -1 : 1;
    if (m[6] !== undefined) { mod += sign * parseInt(m[6], 10); continue; }
    let n = Math.min(100, Math.max(1, parseInt(m[2] || "1", 10)));
    const sides = parseInt(m[3], 10);
    if (!sides || sides > 1000) return null;
    if (doubleDice) n *= 2;
    const rolls = Array.from({ length: n }, () => rollDie(sides));
    let keptIdx = rolls.map((_, i) => i);
    if (m[4]) {
      const k = Math.min(n, parseInt(m[5], 10));
      const byValue = keptIdx.slice().sort((i, j) => rolls[j] - rolls[i]);
      keptIdx = m[4] === "h" ? byValue.slice(0, k) : byValue.slice(-k);
    }
    const kept = keptIdx.map(i => rolls[i]);
    const sum = kept.reduce((a, b) => a + b, 0);
    total += sign * sum;
    groups.push({ n, sides, rolls, kept, keptIdx: new Set(keptIdx), sign });
  }
  if (pos !== src.length || !groups.length && mod === 0 && !/^\d+$/.test(src)) return null;
  total += mod;
  const allRolls = groups.flatMap(g => g.kept);
  return { total, mod, groups, rolls: allRolls, formula: src };
}

// A d20 test rolls two dice so the card can show advantage and
// disadvantage too — players pick whichever applies.
export function rollD20(mod = 0) {
  const a = rollDie(20), b = rollDie(20);
  return {
    first: a, second: b, mod,
    total: a + mod,
    adv: Math.max(a, b) + mod,
    dis: Math.min(a, b) + mod,
    crit: a === 20, fumble: a === 1
  };
}

export function describeGroups(r) {
  if (!r) return "";
  const parts = r.groups.map(g => {
    const shown = g.rolls.map((v, i) => (g.keptIdx.has(i) ? v : `<s>${v}</s>`));
    return (g.sign < 0 ? "− " : "") + `[${shown.join(", ")}]`;
  });
  if (r.mod) parts.push((r.mod > 0 ? "+ " : "− ") + Math.abs(r.mod));
  return parts.join(" ");
}

// --- Hidden slot machine. Play money only.
const LS_CREDITS = "dnd-slots-credits-v1";
const SYMBOLS = ["🗡️", "🛡️", "🔥", "🌙", "⭐", "💀", "🍀"];

export function getCredits() {
  try { return parseInt(localStorage.getItem(LS_CREDITS) || "100", 10); } catch (e) { return 100; }
}
function setCredits(n) { try { localStorage.setItem(LS_CREDITS, String(Math.max(0, n))); } catch (e) { } }

export function spin(bet = 5) {
  let credits = getCredits();
  if (credits < bet) credits = 100; // the house restocks the jar
  const reels = [0, 1, 2].map(() => SYMBOLS[rollDie(SYMBOLS.length) - 1]);
  let winnings = 0;
  const [a, b, c] = reels;
  if (a === b && b === c) winnings = a === "🍀" ? 100 : a === "⭐" ? 50 : a === "💀" ? 0 : 30;
  else if (a === b || b === c || a === c) winnings = bet * 2;
  credits = credits - bet + winnings;
  setCredits(credits);
  return { reels, bet, winnings, credits };
}

// Damage-die rules from the effects engine: { atMost, as? }. With `as`, a die showing atMost or less
// counts as that number (Great Weapon Fighting); without it the die is rolled again once and the
// new roll stands (Tavern Brawler). Changes r in place and returns short notes for the roll card.
export function applyDieRules(r, rules) {
  const notes = [];
  if (!r || !rules || !rules.length) return notes;
  r.groups.forEach(g => {
    if (g.sign < 0) return;
    g.rolls.forEach((v, i) => {
      rules.forEach(rule => {
        const cur = g.rolls[i];
        if (cur > rule.atMost) return;
        const next = rule.as != null ? Math.max(cur, rule.as) : rollDie(g.sides);
        if (next === cur) return;
        g.rolls[i] = next;
        if (g.keptIdx.has(i)) { const k = g.kept.indexOf(cur); if (k >= 0) g.kept[k] = next; r.total += next - cur; }
        notes.push(`${cur}→${next}`);
      });
    });
  });
  r.rolls = r.groups.flatMap(g => g.kept);
  return notes;
}
