// Level history: undo of a level-up, repair of hand-lowered levels, feat recommendations. Pure Node.
import { captureLevel, diffLevel, applyUndo, deLevel, repairLevels, staleEntries } from "../js/levelfix.js";
import { recommendFeats } from "../js/featfit.js";
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log("  ok  " + name); } catch (e) { fail++; console.log("  FAIL " + name + " - " + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); };
const mk = () => ({ level: 4, class: "Fighter", xp: 2700, abilities: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 8 }, feats: ["Tough"], hp: { base: 30, cur: 40, max: 40, temp: 0 },
  hitDice: { total: 4, spent: 1, die: 10 }, subclass: "", choices: {}, profs: { armor: [], weapons: [] }, languages: "Common", skillProf: ["athletics"], skillExpertise: [], masteries: [], spellcasting: { spells: [] }, levelLog: [{ level: 1, summary: "created" }], saveProf: ["str", "con"] });

t("a level-up diff undoes cleanly", () => {
  const c = mk(), snap = captureLevel(c), before = JSON.parse(JSON.stringify(c));
  c.level = 5; c.hitDice.total = 5; c.xp = 6500; c.hp.base += 6; c.abilities.str = 17; c.feats.push("Alert"); c.subclass = "Champion"; c.choices.x = "y"; c.languages = "Common, Elvish"; c.skillExpertise.push("athletics"); c.spellcasting.spells.push({ name: "Shield" });
  c.levelLog.push({ level: 5, summary: "x", undo: diffLevel(snap, c) });
  eq(deLevel(c), true);
  eq(c.level, 4); eq(c.hp.base, before.hp.base); eq(c.abilities, before.abilities); eq(c.feats, before.feats); eq(c.subclass, ""); eq(c.choices, {}); eq(c.languages, "Common"); eq(c.skillExpertise, []); eq(c.spellcasting.spells, []);
  eq(c.levelLog.length, 1); eq(c.hitDice.total, 4); eq(c.xp, 2700);
});
t("level 1 cannot be lowered", () => { const c = mk(); c.level = 1; eq(deLevel(c), false); eq(c.level, 1); });
t("a log entry without a diff is read from its text, HP uses the average die", () => {
  const c = mk(); c.level = 5; c.hp.base = 36; c.abilities.str = 17; c.feats.push("Alert"); c.levelLog.push({ level: 5, summary: "+8 HP; Feat: Alert; Strength 15→17" });
  deLevel(c);
  eq(c.level, 4); eq(c.feats, ["Tough"]); eq(c.abilities.str, 15); eq(c.hp.base, 30);
});
t("repair removes levels above the character's level", () => {
  const c = mk(); c.hp.base = 36; c.abilities.str = 17; c.feats.push("Alert"); c.subclass = "Champion";
  c.levelLog.push({ level: 5, summary: "Feat: Alert; Strength 15→17; Subclass: Champion" });
  eq(staleEntries(c).length, 1);
  const lines = repairLevels(c);
  eq(lines.length, 1); eq(c.feats, ["Tough"]); eq(c.abilities.str, 15); eq(c.subclass, ""); eq(c.hp.base, 36 - 6); eq(c.levelLog.length, 1);
  eq(repairLevels(c), [], "second run changes nothing");
});
t("repair handles a level taken twice: the earlier copy is removed", () => {
  const c = mk(); c.level = 5; c.hp.base = 30 + 12; c.feats.push("Alert");
  c.levelLog.push({ level: 5, summary: "Feat: Alert" }, { level: 5, summary: "+7 HP" });
  const lines = repairLevels(c);
  eq(lines.length, 1); eq(c.hp.base, 36); eq(c.levelLog.length, 2); eq(c.feats, ["Tough"]);
});
t("the logged HP change gives the die when Constitution and HP feats are not involved", () => {
  const c = mk(); c.level = 5; c.hp.base = 36; c.levelLog.push({ level: 5, summary: "+8 HP" });
  c.level = 4; repairLevels(c); eq(c.hp.base, 36 - (8 - 2), "Con 14 is +2, so the die was 6");
});
t("repair leaves a healthy character alone", () => { const c = mk(); eq(repairLevels(c), []); eq(c.hp.base, 30); });
t("a feat kept by a later entry is not removed by the repair", () => {
  const c = mk(); c.level = 5; c.feats.push("Alert");
  c.levelLog.push({ level: 5, summary: "Feat: Alert" }, { level: 5, summary: "Feat: Alert" });
  repairLevels(c); eq(c.feats.includes("Alert"), true);
});

const TXT = { "Ability Score Improvement": "", Actor: "Ability Score Increase. Increase your Charisma score by 1, to a maximum of 20." };
const F = names => names.map(n => ({ f: { name: n, text: n in TXT ? TXT[n] : "Ability Score Increase. Increase one ability score of your choice by 1, to a maximum of 20." }, ok: true, why: "" }));
t("Fighter: Great Weapon Master outranks an unlisted feat, ASI is recommended below 20", () => {
  const c = mk(), r = recommendFeats(c, F(["Actor", "Great Weapon Master", "Ability Score Improvement", "Lucky"]));
  eq(r.has("Actor"), false); eq(r.get("Great Weapon Master").top, true); eq(r.get("Ability Score Improvement").why, "Raises Strength (15)");
});
t("an ability maxed at 20 is not recommended for the increase", () => {
  const c = mk(); c.abilities.str = 20; c.abilities.dex = 12;
  const r = recommendFeats(c, F(["Ability Score Improvement"]));
  eq(r.get("Ability Score Improvement").score < 20, true);
});
t("feats that are not allowed yet are never recommended", () => {
  const items = F(["Great Weapon Master"]); items[0].ok = false;
  eq(recommendFeats(mk(), items).size, 0);
});
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
