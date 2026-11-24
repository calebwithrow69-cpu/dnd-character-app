// Add the 2024 SRD (SRD 5.2) monsters to data/library.json as `library.monsters`.
// Idempotent: the list is rebuilt from the SRD every run; text is kept as written.
//
// Usage: node tools/srd-monsters.mjs <path to 5e-database/src/2024/en>
//   (data from https://github.com/5e-bits/5e-database, MIT; content is SRD 5.2 by
//    Wizards of the Coast, CC-BY-4.0; the credit lives in library.credits)
// Then lock: CR_PASSWORD=... node tools/crypt.mjs lock
import fs from "fs";
import path from "path";

const dir = process.argv[2];
if (!dir) { console.error("Give the folder with 5e-SRD-Monsters.json"); process.exit(1); }
const LIB = new URL("../data/library.json", import.meta.url);
const L = JSON.parse(fs.readFileSync(LIB, "utf8"));
const src = JSON.parse(fs.readFileSync(path.join(dir, "5e-SRD-Monsters.json"), "utf8"));

const nm = x => (typeof x === "string" ? x : (x && (x.name || x.index)) || "");
const cap = s => String(s || "").replace(/^./, c => c.toUpperCase());
const crStr = n => (n === 0.125 ? "1/8" : n === 0.25 ? "1/4" : n === 0.5 ? "1/2" : String(n));
const AB = ["str", "dex", "con", "int", "wis", "cha"];

function speed(o) {
  o = o || {}; const parts = [];
  if (o.walk) parts.push(o.walk);
  Object.entries(o).forEach(([k, v]) => { if (k === "walk" || k === "hover") return; parts.push(`${cap(k)} ${v}${k === "fly" && o.hover ? " (hover)" : ""}`); });
  return parts.join(", ");
}
function senses(o) {
  o = o || {}; const parts = Object.entries(o).filter(([k]) => k !== "passive_perception").map(([k, v]) => `${cap(k.replace(/_/g, " "))} ${v}`);
  if (o.passive_perception != null) parts.push(`Passive Perception ${o.passive_perception}`);
  return parts.join(", ");
}
function usage(u) {
  if (!u || !u.type) return "";
  if (u.type === "per day") return `${u.times}/Day`;
  if (u.type === "recharge on roll") return `Recharge ${u.min_value}-6`;
  if (u.type === "recharge after short or long rest") return "Recharge after a Short or Long Rest";
  if (u.type === "at will") return "At Will";
  return cap(u.type);
}
const entries = list => (Array.isArray(list) ? list : []).map(e => {
  const o = { n: String(e.name || "").trim(), d: String(e.desc || "").trim() };
  const u = usage(e.usage); if (u) o.u = u;
  return o;
}).filter(e => e.n && e.d);

const out = src.map(m => {
  const saves = {}, skills = {};
  (m.proficiencies || []).forEach(p => {
    const idx = String(p.proficiency && p.proficiency.index || "");
    if (idx.startsWith("saving-throw-")) saves[idx.slice(13)] = p.value;
    else if (idx.startsWith("skill-")) skills[cap(idx.slice(6).replace(/-/g, " "))] = p.value;
  });
  const ac = (m.armor_class || [])[0] || {};
  const r = {
    id: m.index, name: m.name, size: m.size, type: m.type, align: m.alignment || "",
    ac: ac.value || 10, acNote: ac.type && ac.type !== "dex" ? String(ac.type).replace(/_/g, " ") : "",
    hp: m.hit_points || 1, hpRoll: m.hit_points_roll || m.hit_dice || "",
    speed: speed(m.speed), abil: [m.strength, m.dexterity, m.constitution, m.intelligence, m.wisdom, m.charisma].map(v => Number(v) || 10),
    saves, skills,
    dr: (m.damage_resistances || []).map(nm), dv: (m.damage_vulnerabilities || []).map(nm), di: (m.damage_immunities || []).map(nm), ci: (m.condition_immunities || []).map(nm),
    senses: senses(m.senses), langs: m.languages || "", cr: crStr(m.challenge_rating), xp: m.xp || 0, pb: m.proficiency_bonus || 2,
    traits: entries(m.special_abilities), actions: entries(m.actions), bonus: entries(m.bonus_actions), reactions: entries(m.reactions), legendary: entries(m.legendary_actions)
  };
  if (m.xp_in_lair) r.xpLair = m.xp_in_lair;
  if (m.gear) r.gear = String(m.gear);
  if (Array.isArray(m.forms) && m.forms.length) r.forms = m.forms.map(nm);
  AB.forEach(a => { if (!(a in saves)) delete saves[a]; });
  return r;
}).sort((a, b) => a.name.localeCompare(b.name));

L.monsters = out;
fs.writeFileSync(LIB, JSON.stringify(L));
const bytes = JSON.stringify(out).length;
console.log(`monsters: ${out.length} (${Math.round(bytes / 1024)} KB), CR ${out[0].cr}..${out.reduce((m, x) => (parseFloat(x.cr.includes("/") ? eval(x.cr) : x.cr) > m ? parseFloat(x.cr.includes("/") ? eval(x.cr) : x.cr) : m), 0)}`);
console.log("credit present:", JSON.stringify(L.credits || "").includes("SRD 5.2"));
