// Focus Point damage for the Monk and the Warrior of the Street (VSS:PP):
//  - rolls with a cost: Deflect Attacks redirect, Energy Blast, Guard Breaker (`actions`, read by js/combat.js)
//  - Combo as an optional bonus on the Unarmed Strike attack roll (rider that spends a Focus Point)
// Run on the unlocked library: node tools/apply-monk-focus.mjs, then lock and commit the .enc.json. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";
const P = "data/library.json";
const L = JSON.parse(readFileSync(P, "utf8"));
const die2 = { dice: "2d6", steps: [[5, "2d8"], [11, "2d10"], [17, "2d12"]] };
const defl = L.classes.find(c => c.name === "Monk")?.features.find(f => f.name === "Deflect Attacks");
const sub = L.subclasses.find(s => s.name === "Warrior of the Street");
const intro = sub && sub.features.find(f => f.intro && f.lv === 3);
if (!defl || !intro) { console.error("Monk features not found"); process.exit(1); }
defl.actions = [{ name: "Deflect Redirect", cost: "Other", dice: die2, mod: "dex", type: "same as the attack", label: "Damage", res: "Focus Points", save: "Dexterity", dcAbil: "wis", note: "Only when Deflect Attacks reduced the damage to 0. Range 5 ft (melee) or 60 ft (ranged)" }];
// Effects and actions on the subclass sit on its intro entry: the book text is split into features at load and only the intro keeps them.
intro.effects = [{ t: "atk", rider: true, v: 2, name: "Combo", res: "Focus Points", note: "Begins a combo: +2 to Unarmed Strike attacks this turn, +2 more per hit, max +6. Resets on a miss or when you take damage", when: { attack: "unarmed" } }];
intro.actions = [
  { name: "Energy Blast", lv: 6, cost: "Action", dice: die2, type: "force", label: "Damage", res: "Focus Points", save: "Dexterity", dcAbil: "wis", half: true, note: "Replaces one attack. 60 ft" },
  { name: "Guard Breaker", lv: 6, cost: "Other", dice: null, mod: "dex", type: "", label: "Damage", res: "Focus Points", note: "After you miss with an Unarmed Strike. Keeps your Combo" }
];
writeFileSync(P, JSON.stringify(L));
console.log("Monk focus data written");
