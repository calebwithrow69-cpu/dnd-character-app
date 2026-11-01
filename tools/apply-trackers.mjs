// Writes `trackers` (limited-use counters) onto class and subclass features of the UNLOCKED data/library.json.
//   node tools/apply-trackers.mjs [--dry]
// Uses come from the book's own class tables where they exist (Rages, Channel Divinity, Wild Shape...)
// and otherwise from the feature text ("a number of times equal to your Wisdom modifier", "can't use it again
// until you finish a Long Rest"...). Idempotent: running it again replaces the trackers it wrote.
// A tracker: { name, max: Expr, reset: "long"|"short", shortRegain?: n, resetAt?: [[level, reset]], lv?, note? }
import fs from "node:fs";
const dry = process.argv.includes("--dry");
const path = "data/library.json";
const L = JSON.parse(fs.readFileSync(path, "utf8"));
const ABIL = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
const NUM = { once: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6 };

// steps [[level, n]] from a class table column (index from the left of the whitespace-split row)
function tableSteps(cls, col) {
  const rows = cls.table.split("\n").slice(1).map(l => l.trim().split(/\s{2,}|\s*\|\s*/)).filter(r => /^\d+$/.test(r[0]));
  const steps = []; let last = null;
  for (const r of rows) { const n = parseInt(r[col], 10); const v = Number.isFinite(n) ? n : 0; if (v !== last) { steps.push([Number(r[0]), v]); last = v; } }
  return steps.filter(s => s[1] > 0 || false);
}
const stepsExpr = st => ({ steps: st });

// ---- explicit class trackers (name must match the feature so its button finds the counter)
const CLASS = {
  Barbarian: [{ feature: "Rage", name: "Rage", col: 3, reset: "long" }],
  Cleric: [{ feature: "Channel Divinity", name: "Channel Divinity", col: 3, reset: "long" }],
  Druid: [{ feature: "Wild Shape", name: "Wild Shape", col: 3, reset: "long" }],
  Fighter: [
    { feature: "Second Wind", name: "Second Wind", col: 3, reset: "long" },
    { feature: "Action Surge", name: "Action Surge", max: stepsExpr([[2, 1], [17, 2]]), reset: "short" },
    { feature: "Indomitable", name: "Indomitable", max: stepsExpr([[9, 1], [13, 2], [17, 3]]), reset: "long" }],
  Monk: [{ feature: "Monk's Focus", name: "Focus Points", max: { lvl: true }, reset: "short", note: "Monk's Focus: your Focus Points. Back on a Short or Long Rest." }],
  Paladin: [{ feature: "Lay on Hands", name: "Lay on Hands", max: { mul: [5, { lvl: true }] }, reset: "long", note: "A pool of Hit Points: 5 times your Paladin level. Tap the pencil to spend several at once." },
    { feature: "Channel Divinity", name: "Channel Divinity", col: 3, reset: "long" }],
  Ranger: [{ feature: "Favored Enemy", name: "Favored Enemy", col: 3, reset: "long" }],
  Sorcerer: [{ feature: "Font of Magic", name: "Sorcery Points", max: { lvl: true }, reset: "long", note: "Font of Magic: your Sorcery Points." }],
  Bard: [{ feature: "Bardic Inspiration", name: "Bardic Inspiration", max: { abil: "cha", min: 1 }, reset: "long", resetAt: [[5, "short"]] }],
  Warlock: [{ feature: "Mystic Arcanum", name: "Mystic Arcanum", max: stepsExpr([[11, 1], [13, 2], [15, 3], [17, 4]]), reset: "long", note: "One use for each Mystic Arcanum spell you have (levels 6 to 9)." }]
};
// features the explicit list owns, so the text reader leaves them alone
const OWNED = new Set(["Lay on Hands", "Rage", "Channel Divinity", "Wild Shape", "Second Wind", "Action Surge", "Indomitable", "Bardic Inspiration", "Mystic Arcanum", "Persistent Rage", "Font of Inspiration", "Superior Inspiration", "Favored Enemy", "Monk's Focus", "Font of Magic"]);

// ---- text reader
const SENT = /number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier|number of times equal to your Proficiency Bonus|can use (?:this feature|it|this ability) (once|twice|two|three|four|five|six) times?|can use (?:this feature|it) (once|twice|two|three|four|five|six)\b|can't (?:do so|use (?:this feature|it|this benefit)|do this) again until you finish a|regain all (?:your )?expended uses|regain one expended use/i;
function readUse(text) {
  const m = SENT.exec(text); if (!m) return null;
  const win = text.slice(m.index, m.index + 420);
  let max;
  if (/Proficiency Bonus/i.test(m[0])) max = { prof: true };
  else if (m[1] && ABIL[m[1].toLowerCase()]) max = { abil: ABIL[m[1].toLowerCase()], min: 1 };
  else if (NUM[(m[2] || m[3] || "").toLowerCase()]) max = NUM[(m[2] || m[3]).toLowerCase()];
  else max = 1;
  const shortAll = /regain all[^.]*(?:short or long|short and long) rest|until you finish a short or long rest/i.test(win);
  const shortOne = /regain one expended use when you finish a short rest/i.test(win);
  return { max, reset: shortAll ? "short" : "long", shortRegain: shortOne ? 1 : undefined, index: m.index };
}
function nameFor(f, text, idx) {
  const before = text.slice(0, idx);
  const heads = [...before.matchAll(/^Level (\d+): (.+)$/gm)];
  if (heads.length) { const h = heads[heads.length - 1]; return { name: h[2].replace(/^["“](.*)["”]$/, "$1").trim(), lv: Number(h[1]) }; }
  if (f.name && !/Spells$/.test(f.name)) return { name: f.name, lv: null };
  const lead = [...before.matchAll(/(?:^|\n)([A-Z][A-Za-z' ]{2,32})\.\s/g)];
  if (lead.length) return { name: lead[lead.length - 1][1].trim(), lv: null };
  return null;
}
const skipped = [], made = [];
function attach(feature, trackers) {
  if (dry) return;
  if (trackers.length) feature.trackers = trackers; else delete feature.trackers;
}

for (const cls of L.classes) {
  const explicit = CLASS[cls.name] || [];
  const seen = new Set();
  for (const f of cls.features) {
    const mine = explicit.filter(e => e.feature === f.name);
    const list = [];
    for (const e of mine) {
      if (seen.has(e.name)) continue; // later levels of the same feature (Indomitable 13, 17...) ride on the first
      seen.add(e.name);
      const max = e.max || stepsExpr(tableSteps(cls, e.col));
      const t = { name: e.name, max, reset: e.reset };
      const txt = f.text || "";
      if (/regain one expended use when you finish a short rest/i.test(txt) || (e.name === "Channel Divinity" && /short rest/i.test(txt) && /one expended/i.test(txt))) t.shortRegain = 1;
      if (e.resetAt) t.resetAt = e.resetAt;
      if (e.note) t.note = e.note;
      list.push(t);
    }
    if (!mine.length && !OWNED.has(f.name) && !f.intro) {
      const u = readUse(f.text || "");
      const nm = u && nameFor(f, f.text || "", u.index);
      if (u && nm) {
        const key = cls.name + "|" + nm.name;
        if (!seen.has(nm.name)) { seen.add(nm.name); const t = { name: nm.name, max: u.max, reset: u.reset }; if (u.shortRegain) t.shortRegain = 1; if (nm.lv && nm.lv > f.lv) t.lv = nm.lv; list.push(t); }
      } else if (u) skipped.push(`${cls.name} L${f.lv} "${f.name}"`);
    }
    attach(f, list); list.forEach(t => made.push(`class|${cls.name}|L${f.lv}|${f.name}|${t.name}|${JSON.stringify(t.max)}|${t.reset}${t.shortRegain ? "+1short" : ""}${t.resetAt ? " resetAt" + JSON.stringify(t.resetAt) : ""}`));
  }
}
for (const sc of L.subclasses) {
  const seen = new Set();
  for (const f of sc.features) {
    const list = [];
    if (!f.intro) {
      let text = f.text || "", off = 0;
      for (let guard = 0; guard < 4; guard++) {
        const u = readUse(text);
        if (!u) break;
        const nm = nameFor(f, f.text, off + u.index);
        if (nm && !seen.has(nm.name)) { seen.add(nm.name); const t = { name: nm.name, max: u.max, reset: u.reset }; if (u.shortRegain) t.shortRegain = 1; if (nm.lv && nm.lv > f.lv) t.lv = nm.lv; list.push(t); }
        else if (!nm) skipped.push(`${sc.name} L${f.lv} "${f.name}"`);
        off += u.index + 40; text = f.text.slice(off);
      }
    }
    // hand fixes where the text reads wrong
    if (sc.name === "Light Domain") { const w = list.find(t => t.name === "Warding Flare"); if (w) w.resetAt = [[6, "short"]]; const i = list.findIndex(t => t.name === "Improved Warding Flare"); if (i >= 0) list.splice(i, 1); }
    if (sc.name === "Psi Warrior") {
      const i = list.findIndex(t => t.name === "Psionic Power"); if (i >= 0) list.splice(i, 1);
      const j = list.find(t => t.name === "Telekinetic Adept"); if (j) j.name = "Psi-Powered Leap";
      if (f.name === "Psionic Power") list.push({ name: "Psionic Energy Dice", max: { steps: [[3, 4], [5, 6], [9, 8]] }, reset: "long", shortRegain: 1, note: "Die size and count from the subclass table (the rules file stops at level 9)." });
    }
    attach(f, list); list.forEach(t => made.push(`sub|${sc.name}|L${f.lv}|${f.name}|${t.name}|${JSON.stringify(t.max)}|${t.reset}${t.shortRegain ? "+1short" : ""}${t.lv ? " lv" + t.lv : ""}`));
  }
}
if (!dry) fs.writeFileSync(path, JSON.stringify(L));
console.log(made.join("\n")); console.log("\ntrackers:", made.length, "\nskipped (no name):", skipped.length ? "\n  " + skipped.join("\n  ") : 0);
