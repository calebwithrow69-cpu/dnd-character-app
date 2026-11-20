// Adds the SRD 5.2 rules glossary and its reference lists (skills, abilities, damage types,
// languages, alignments, schools, weapon properties, masteries, poisons) to data/library.json
// as `library.glossary`: [{name, cat, text, source, link?}]. Idempotent: entries from "SRD 5.2"
// are rebuilt on every run, everything else in `glossary` is kept. Names already in
// `library.rules` are skipped (the book text wins).
//
// Usage: node tools/srd-glossary.mjs <dndsrd5.2_markdown/src> <5e-database/src/2024/en>
//   markdown: https://github.com/springbov/dndsrd5.2_markdown (08_RulesGlossary.md)
//   data: https://github.com/5e-bits/5e-database (MIT)
//   Content is SRD 5.2 by Wizards of the Coast, CC-BY-4.0 (credit is in library.credits).
// Then lock: CR_PASSWORD=... node tools/crypt.mjs lock
import fs from "fs";
import path from "path";

const [mdDir, dbDir] = process.argv.slice(2);
if (!mdDir || !dbDir) { console.error("Give the markdown src folder and the 5e-database 2024 folder"); process.exit(1); }
const LIB = new URL("../data/library.json", import.meta.url);
const L = JSON.parse(fs.readFileSync(LIB, "utf8"));
const SRC = "SRD 5.2";
const db = f => JSON.parse(fs.readFileSync(path.join(dbDir, `5e-SRD-${f}.json`), "utf8"));

// Names that are safe to turn into tap-for-definition links inside other rules text.
const LINK = new Set(["Blindsight", "Truesight", "Tremorsense", "Heavily Obscured", "Lightly Obscured", "Occupied Space", "Unoccupied Space",
  "Damage Threshold", "Climb Speed", "Fly Speed", "Swim Speed"]);

// ---- rules glossary (markdown)
const plain = s => s.replace(/\r/g, "").replace(/<br\s*\/?>/gi, " ").replace(/\*\*\*([^*]+)\*\*\*/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => plain(c).trim());
function body(name, raw) {
  const paras = []; let buf = [], tab = [], cap = "";
  const flush = () => { if (buf.length) paras.push(buf.join(" ")); buf = []; };
  const flushTab = () => {
    if (!tab.length) return;
    const rows = tab.filter(r => !r.every(c => /^:?-+:?$/.test(c)));
    const head = rows[0], data = rows.slice(1);
    if (head.every(c => !c)) paras.push(data.flat().filter(Boolean).join("\n")); // bare list of names
    else paras.push(`${cap || name}\n` + [head, ...data].map(r => r.join("\t")).join("\n"));
    tab = []; cap = "";
  };
  for (const line of raw.split("\n")) {
    if (/^\s*\|/.test(line)) { flush(); tab.push(cells(line)); continue; }
    flushTab();
    if (!line.trim()) { flush(); continue; }
    const t = /^Table:\s*(.+)$/.exec(plain(line.trim()));
    if (t) { flush(); cap = t[1].trim(); continue; }
    buf.push(plain(line.trim()));
  }
  flush(); flushTab();
  return paras
    .map(p => p.replace(/\s*See also\s+(?:"[^"]*"|\([^)]*\)|,|;|\band\b|\bor\b|\s)+\.?/g, " ").replace(/[ \t]+\n/g, "\n").trim())  // cross-references point at pages this app does not have
    .filter(Boolean).join("\n\n");
}
const md = fs.readFileSync(path.join(mdDir, "08_RulesGlossary.md"), "utf8");
const defs = md.slice(md.indexOf("## Rules Definitions"));
const parts = defs.split(/^#### /m).slice(1);
const entries = [];
for (const part of parts) {
  const nl = part.indexOf("\n"), head = part.slice(0, nl).trim(), rest = part.slice(nl + 1);
  if (/^\*\*/.test(head)) { // a sub-heading inside the previous entry
    const prev = entries[entries.length - 1];
    if (prev) prev.text += `\n\n${body(plain(head), rest)}`;
    continue;
  }
  const m = /^(.*?)\s*\[([^\]]+)\]$/.exec(head);
  const name = (m ? m[1] : head).trim(), cat = m ? m[2].trim() : "Rule";
  entries.push({ name, cat, text: body(name, rest.replace(/\n## [\s\S]*$/, "")) });
}

// ---- reference lists (5e-database)
const abil = Object.fromEntries(db("Ability-Scores").map(a => [a.name, a.full_name]));
for (const s of db("Skills")) entries.push({ name: s.name, cat: "Skill", text: `${abil[s.ability_score?.name] || s.ability_score?.name} skill. ${s.description}` });
for (const a of db("Ability-Scores")) entries.push({ name: a.full_name, cat: "Ability", text: `${a.description}.${a.skills?.length ? `\n\nSkills. ${a.skills.map(x => x.name).join(", ")}` : ""}` });
for (const d of db("Damage-Types")) entries.push({ name: d.name, cat: "Damage Type", text: `${d.description.replace(/\.$/, "")}.` });
for (const l of db("Languages")) entries.push({ name: l.name, cat: "Language", text: `${l.is_rare ? "Rare" : "Standard"} language.${l.note ? `\n\n${l.note}` : ""}` });
for (const a of db("Alignments")) entries.push({ name: a.name, cat: "Alignment", text: a.description });
for (const s of db("Magic-Schools")) entries.push({ name: s.name, cat: "Magic School", text: `${s.description.replace(/\.$/, "")}.` });
for (const w of db("Weapon-Properties")) entries.push({ name: w.name, cat: "Weapon Property", text: w.description });
for (const w of db("Weapon-Mastery-Properties")) entries.push({ name: w.name, cat: "Weapon Mastery", text: w.description });
for (const p of db("Poisons")) entries.push({ name: p.name, cat: "Poison", text: `${p.type[0].toUpperCase()}${p.type.slice(1)} poison. ${p.cost} gp per dose.\n\n${p.description}` });

// ---- merge
// Rules-style entries are unique by name (the book's `library.rules` wins); reference lists
// (skills, damage types...) are unique by name within their own list, so "Illusions" and the
// Illusion school can both exist.
const RULEISH = /^(Rule|Action|Area of Effect|Hazard|Attitude|Condition)$/;
const slot = e => (RULEISH.test(e.cat) ? "" : e.cat) + "|" + String(e.name).toLowerCase();
const SKIP = new Set(["|surprise"]); // the book glossary already has "Surprised"
const keep = (L.glossary || []).filter(g => g.source !== SRC);
const seen = new Set([...(L.rules || []).map(r => "|" + r.name.toLowerCase()), ...SKIP, ...keep.map(slot)]);
const add = [];
for (const e of entries) {
  if (seen.has(slot(e)) || !e.text.trim()) continue;
  seen.add(slot(e));
  add.push({ name: e.name, cat: e.cat, text: e.text.trim(), source: SRC, ...(LINK.has(e.name) ? { link: true } : {}) });
}
L.glossary = [...keep, ...add].sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(LIB, JSON.stringify(L));
const by = {}; add.forEach(g => by[g.cat] = (by[g.cat] || 0) + 1);
console.log(`glossary: ${L.glossary.length} entries (${add.length} from SRD 5.2)`, by);
