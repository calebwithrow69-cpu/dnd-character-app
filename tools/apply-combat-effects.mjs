// Encodes Brutal Strike, Steady Aim and Blessed Strikes (Divine Strike) as effects. Idempotent.
// Run on the unlocked library: node tools/apply-combat-effects.mjs, then lock and commit the .enc.json.
import { readFileSync, writeFileSync } from "node:fs";
const P = "data/library.json";
const L = JSON.parse(readFileSync(P, "utf8"));
const feat = (cls, name, lv) => {
  const f = (L.classes.find(c => c.name === cls)?.features || []).find(x => x.name === name && (lv == null || x.lv === lv));
  if (!f) { console.error("missing", cls, name); process.exit(1); }
  return f;
};
feat("Barbarian", "Brutal Strike").effects = [{ t: "dmg", v: { dice: "1d10", steps: [[17, "2d10"]] }, rider: true, once: true, name: "Brutal Strike", note: "Forgo Advantage on one Strength attack with Reckless Attack, then pick an effect. Same damage type as the weapon.", when: { all: [{ toggle: "Reckless" }, { abil: "str" }] } }];
feat("Rogue", "Steady Aim").effects = [{ t: "atk", op: "adv", name: "Steady Aim", when: { toggle: "Steady Aim" } }];
feat("Cleric", "Blessed Strikes").effects = [{ t: "dmg", v: "1d8", rider: true, once: true, name: "Divine Strike", note: "Necrotic or Radiant, once per turn, on a weapon hit.", when: { all: [{ attack: "weapon" }, { pick: ["Blessed Strikes", "Divine Strike"] }] } }];
writeFileSync(P, JSON.stringify(L));
console.log("ok");
