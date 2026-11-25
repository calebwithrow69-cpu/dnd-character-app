// Conditions and the math they change on the character's own rolls (2024 rules). Pure, no DOM. ASCII only.
// effects feed the effects engine (collectEffects adds them); notes are the parts the app cannot apply.
const ABS = ["str", "dex", "con", "int", "wis", "cha"];
const ZERO_SPEED = ["Grappled", "Restrained", "Paralyzed", "Petrified", "Stunned", "Unconscious"];
const FAIL_STR_DEX = ["Paralyzed", "Petrified", "Stunned", "Unconscious"];

// rolls: what the app applies to this creature's own d20 rolls. others: what it cannot apply (shown as a note).
export const COND_INFO = {
  Blinded: { tag: "Dis. attacks", rolls: ["Disadvantage on attacks"], dis: ["atk"], others: ["Attacks against you have advantage", "Fails checks that need sight"] },
  Charmed: { tag: "", rolls: [], others: ["Cannot attack the charmer", "The charmer has advantage on social checks against you"] },
  Deafened: { tag: "", rolls: [], others: ["Fails checks that need hearing"] },
  Frightened: { tag: "Dis. attacks, checks", rolls: ["Disadvantage on attacks and ability checks"], dis: ["atk", ...ABS.map(a => "check." + a)], others: ["While the source is in sight", "Cannot move closer to the source"] },
  Grappled: { tag: "Speed 0", rolls: ["Speed 0"], others: ["Disadvantage on attacks against anyone but the grappler"] },
  Incapacitated: { tag: "", rolls: [], others: ["No actions, bonus actions or reactions", "Concentration ends"] },
  Invisible: { tag: "Adv. attacks", rolls: ["Advantage on attacks"], adv: ["atk"], others: ["Attacks against you have disadvantage"] },
  Paralyzed: { tag: "Speed 0, auto-fail", rolls: ["Speed 0", "Auto-fail Str and Dex saves"], others: ["Incapacitated", "Attacks against you have advantage", "Hits from within 5 ft are critical"] },
  Petrified: { tag: "Speed 0, auto-fail", rolls: ["Speed 0", "Auto-fail Str and Dex saves"], others: ["Incapacitated", "Attacks against you have advantage", "Resistance to all damage"] },
  Poisoned: { tag: "Dis. attacks, checks", rolls: ["Disadvantage on attacks and ability checks"], dis: ["atk", ...ABS.map(a => "check." + a)], others: [] },
  Prone: { tag: "Dis. attacks", rolls: ["Disadvantage on attacks"], dis: ["atk"], others: ["Standing costs half your speed", "Melee attacks against you have advantage, ranged have disadvantage"] },
  Restrained: { tag: "Speed 0, dis. attacks", rolls: ["Speed 0", "Disadvantage on attacks and Dex saves"], dis: ["atk", "save.dex"], others: ["Attacks against you have advantage"] },
  Stunned: { tag: "Speed 0, auto-fail", rolls: ["Speed 0", "Auto-fail Str and Dex saves"], others: ["Incapacitated", "Attacks against you have advantage"] },
  Unconscious: { tag: "Speed 0, auto-fail", rolls: ["Speed 0", "Auto-fail Str and Dex saves"], others: ["Incapacitated, prone, drops what it holds", "Attacks against you have advantage", "Hits from within 5 ft are critical"] },
  Exhaustion: { rolls: ["-2 per level on d20 Tests", "-5 ft speed per level"], others: ["Dies at level 6"] }
};

export const hasCond = (c, n) => (c.conditions || []).includes(n);
// Names that set speed to 0 right now.
export const zeroSpeedBy = c => ZERO_SPEED.filter(n => hasCond(c, n));
// Names that make a Str or Dex save fail automatically right now.
export const autoFailBy = (c, ab) => (ab === "str" || ab === "dex") ? FAIL_STR_DEX.filter(n => hasCond(c, n)) : [];

// Effect objects for collectEffects: { t, op, v, src }.
export function conditionEffects(c) {
  const out = [], list = c.conditions || [];
  list.forEach(n => {
    const i = COND_INFO[n]; if (!i) return;
    (i.dis || []).forEach(t => out.push({ t, op: "dis", src: n }));
    (i.adv || []).forEach(t => out.push({ t, op: "adv", src: n }));
  });
  const ex = Math.max(0, Math.min(6, Number(c.exhaustion) || 0)), base = Number(c.speed) || 30, z = zeroSpeedBy(c);
  if (z.length) out.push({ t: "speed", op: "add", v: -base, src: z.join(" + ") });
  if (ex) out.push({ t: "speed", op: "add", v: z.length ? 0 : -5 * ex, src: "Exhaustion " + ex });
  return out;
}

// One-line summary under a condition's name.
export const condTag = n => (COND_INFO[n] || {}).tag || "";
export const condLine = n => { const i = COND_INFO[n]; return i && i.rolls.length ? i.rolls.join(". ") : (i && i.others[0]) || ""; };
// Everything about the active conditions, split into what the sheet applies and what the player tracks.
export function condNotes(c) {
  const names = [...(c.conditions || []), ...((c.exhaustion || 0) > 0 ? ["Exhaustion"] : [])];
  return names.map(n => ({ name: n, applied: (COND_INFO[n] || {}).rolls || [], manual: (COND_INFO[n] || {}).others || [] }));
}
