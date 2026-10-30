#!/usr/bin/env node
// Gives Druid "Primal Order" and Cleric "Divine Order" their skill bonus (Wisdom modifier, minimum +1) as effects that read the
// player's pick (c.choices["Primal Order"] = "Magician", c.choices["Divine Order"] = "Thaumaturge").
//   CR_PASSWORD=... node tools/crypt.mjs unlock ; node tools/apply-order-effects.mjs ; CR_PASSWORD=... node tools/crypt.mjs lock
// ASCII only.
import { readFileSync, writeFileSync } from "node:fs";
const LIB = "data/library.json", L = JSON.parse(readFileSync(LIB, "utf8"));
const SETS = [["Druid", "Primal Order", "Magician", ["arcana", "nature"]], ["Cleric", "Divine Order", "Thaumaturge", ["arcana", "religion"]]];
for (const [cls, feat, opt, skills] of SETS) {
  const f = L.classes.find(c => c.name === cls).features.find(x => x.name === feat && x.lv === 1);
  f.effects = skills.map(s => ({ t: "skill." + s, v: { abil: "wis", min: 1 }, when: { pick: [feat, opt] }, name: feat + ": " + opt }));
  console.log(cls, feat, JSON.stringify(f.effects));
}
writeFileSync(LIB, JSON.stringify(L));
