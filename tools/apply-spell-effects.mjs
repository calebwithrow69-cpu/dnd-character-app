// Adds `effects` to spells whose benefit is a number on the caster's own sheet (run on the UNLOCKED library, then lock).
// An effect may carry `up: n` = how much `v` grows per spell slot level above the spell's own level.
// Idempotent. Spells that need a choice (Enhance Ability, Protection from Energy), a weapon (Magic Weapon) or a doubled
// Speed (Haste) are left out: the engine has no way to express them yet.
//   node tools/apply-spell-effects.mjs [data/library.json]
import { readFileSync, writeFileSync } from "node:fs";
import { validateEffect } from "../js/effects.js";

const file = process.argv[2] || "data/library.json";
const L = JSON.parse(readFileSync(file, "utf8"));
const FX = {
  "Longstrider": [{ t: "speed", v: 10 }],
  "Shield of Faith": [{ t: "ac", v: 2 }],
  "Shield": [{ t: "ac", v: 5, note: "Until the start of your next turn" }],
  "Mage Armor": [{ t: "ac.base", op: "max", v: { add: [13, { abil: "dex" }] }, when: { armor: "none" } }],
  "Barkskin": [{ t: "ac.floor", op: "max", v: 17 }],
  "Aid": [{ t: "hp.max", v: 5, up: 5 }],
  "Bless": [{ t: "atk", v: "1d4" }, { t: "save.all", v: "1d4" }],
  "Pass without Trace": [{ t: "skill.stealth", v: 10 }],
  "Divine Favor": [{ t: "dmg", v: "1d4", when: { attack: "weapon" }, note: "Radiant" }],
  "Hunter's Mark": [{ t: "dmg", v: "1d6", rider: true, note: "Force, against the marked target" }],
  "Hex": [{ t: "dmg", v: "1d6", rider: true, note: "Necrotic, against the cursed target" }],
  "Stoneskin": [{ t: "grant.resist.Bludgeoning", op: "grant" }, { t: "grant.resist.Piercing", op: "grant" }, { t: "grant.resist.Slashing", op: "grant" }],
  "Darkvision": [{ t: "grant.sense.Darkvision", op: "grant", v: 150 }]
};
let n = 0;
for (const [name, effects] of Object.entries(FX)) {
  const sp = L.spells.find(s => s.name === name);
  if (!sp) { console.log("missing spell:", name); continue; }
  effects.forEach(e => { const bad = validateEffect(e); if (bad.length) throw new Error(name + ": " + bad.join(", ")); });
  sp.effects = effects; n++;
}
writeFileSync(file, JSON.stringify(L));
console.log("effects set on", n, "spells");
