#!/usr/bin/env node
// Content update: fold a DM-editor changes file into the rules AND append a record to the history behind the
// "Content update" popup (library.updates). Each device shows everything since the update it last checked,
// squashed per entry (oldest Before, newest After), so records are only ever appended, never replaced.
// The tool keeps the newest KEEP records and mirrors the newest into library.update for older app versions.
//
//   CR_PASSWORD=... node tools/crypt.mjs unlock
//   node tools/content-update.mjs <changes.json> <notes.json> [--title "Content update"] [--date YYYY-MM-DD] [--dry]
//   CR_PASSWORD=... node tools/crypt.mjs lock      (commit only the .enc.json and campaign.json)
//
// notes.json (written by whoever runs this, in plain words, no book text needed):
//   { "items": { "spells|Evil Eye": { "summary": "...", "effect": "nerf",
//       "changes": { "text": { "effect": "nerf", "note": "..." }, "classes": { "effect": "nerf", "note": "..." } } } } }
//   effect is buff, nerf, mixed or neutral. Items without notes are listed and left without an explanation.
// This is the same fold as tools/apply-dm.mjs plus the record, so run one or the other for a given changes file.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { applyPatch, SCHEMA, KIND_ORDER, keyOf } from "../js/dm.js";

const args = process.argv.slice(2), flag = n => { const i = args.indexOf(n); return i < 0 ? null : args.splice(i, 2)[1]; };
const dry = args.includes("--dry"); if (dry) args.splice(args.indexOf("--dry"), 1);
const title = flag("--title") || "Content update", date = flag("--date") || new Date().toISOString().slice(0, 10);
const [changesFile, notesFile] = args;
if (!changesFile) { console.error("Usage: node tools/content-update.mjs <changes.json> <notes.json> [--title T] [--date D] [--dry]"); process.exit(1); }

const patch = JSON.parse(readFileSync(changesFile, "utf8"));
const notes = notesFile ? JSON.parse(readFileSync(notesFile, "utf8")).items || {} : {};
const lib = JSON.parse(readFileSync("data/library.json", "utf8"));
const camp = JSON.parse(readFileSync("data/campaign.json", "utf8"));

// "sorcerer" -> "Sorcerer" so class filters and spell lists find the spell
const classNames = new Map((lib.classes || []).map(c => [c.name.toLowerCase(), c.name]));
const fixed = [];
const fixClasses = (kind, e) => {
  if (!Array.isArray(e.classes)) return e;
  const classes = e.classes.map(c => classNames.get(String(c).toLowerCase()) || c);
  if (classes.some((c, i) => c !== e.classes[i])) fixed.push(`${kind}|${e.name}: ${e.classes.join(", ")} -> ${classes.join(", ")}`);
  return { ...e, classes };
};
for (const kind of Object.keys(patch)) {
  const p = patch[kind]; if (!SCHEMA[kind]) continue;
  p.add = (p.add || []).map(e => fixClasses(kind, e));
  for (const k of Object.keys(p.edit || {})) p.edit[k] = fixClasses(kind, p.edit[k]);
}

const labelOf = (kind, field) => (SCHEMA[kind].fields.find(f => f.k === field) || {}).label || field;
const oneOf = kind => { const o = SCHEMA[kind].one; return o[0].toUpperCase() + o.slice(1); };
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const items = [];
const note = (kind, name) => notes[`${kind}|${name}`] || {};
const done = (kind, name, status, before, after, changes) => {
  const n = note(kind, name);
  const ch = changes.map(c => ({ ...c, ...(n.changes && n.changes[c.field] ? { effect: n.changes[c.field].effect, note: n.changes[c.field].note } : {}) }));
  const eff = [...new Set(ch.map(c => c.effect).filter(e => e && e !== "neutral"))];
  const effect = n.effect || (status !== "changed" ? "" : eff.length === 0 ? (ch.some(c => c.effect === "neutral") ? "neutral" : "") : eff.length === 1 ? eff[0] : "mixed");
  items.push({ status, kind, label: oneOf(kind), name, effect, summary: n.summary || "", before, after, changes: ch });
};
for (const kind of KIND_ORDER) {
  const p = patch[kind]; if (!p) continue;
  const cur = lib[kind] || [];
  for (const a of p.add || []) if (!cur.some(x => keyOf(kind, x) === keyOf(kind, a))) done(kind, a.name, "new", null, a, []);
  for (const [key, after] of Object.entries(p.edit || {})) {
    const before = cur.find(x => keyOf(kind, x) === key); if (!before) continue;
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(f => f !== "bookLv");
    const changes = fields.filter(f => !sameJson(before[f], after[f])).map(f => ({ field: f, label: labelOf(kind, f), before: before[f] ?? null, after: after[f] ?? null }));
    if (changes.length) done(kind, after.name || before.name, "changed", before, after, changes);
  }
  for (const key of p.remove || []) { const before = cur.find(x => keyOf(kind, x) === key); if (before) done(kind, before.name, "removed", before, null, []); }
}
if (!items.length) { console.error("No new, changed or removed entries in that file (already applied?)."); process.exit(1); }

const id = `${date}-${createHash("sha1").update(JSON.stringify(items)).digest("hex").slice(0, 6)}`;
export const UPDATES_NOTE = "NOTE FOR FUTURE CLAUDE: library.updates is the history behind the Content update popup (js/contentupdate.js, js/views/contentupdate.js, tools/content-update.mjs). Each rules roll-out APPENDS one record; never replace or hand-edit records. A device shows everything since the update its player last checked (they press Done), squashed per entry: the oldest Before against the newest After, so players who skipped several updates read one total. Run tools/content-update.mjs <changes.json> <notes.json> on the unlocked library for each roll-out: it builds the record, applies the changes, keeps the newest 12 records and mirrors the newest into library.update for older app versions. Write each changed item's summary in plain words and mark every change buff, nerf, mixed or neutral in the notes file. Lock the library afterwards. If there are no new changes, leave all of this untouched.";
const record = { id, date, title, items };
const count = s => items.filter(i => i.status === s).length;
console.log(`${id}: ${count("new")} new, ${count("changed")} changed, ${count("removed")} removed`);
for (const f of fixed) console.log("fixed class name:", f);
for (const i of items) console.log(` ${i.status.padEnd(7)} ${i.kind}|${i.name}  ${i.effect || "-"}${i.summary ? "" : "  (no summary)"}${i.changes.map(c => `\n           ${c.field}: ${c.effect || "-"}${c.note ? "" : " (no note)"}`).join("")}`);
if (dry) process.exit(0);

const KEEP = 12;
const history = (Array.isArray(lib.updates) ? lib.updates : lib.update ? [lib.update] : []).map(({ _note, ...rec }) => rec);
if (history.some(h => h.id === id)) { console.error("This update is already in the history."); process.exit(1); }
const r = applyPatch(lib, camp, patch);
r.library.updates = [...history, record].slice(-KEEP);
r.library.update = record;
r.library.updatesNote = UPDATES_NOTE;
writeFileSync("data/library.json", JSON.stringify(r.library, null, 0));
writeFileSync("data/campaign.json", JSON.stringify(r.campaign, null, 2) + "\n");
console.log("Applied. Now lock the library and commit. Then clear the changes on your device (DM editor > Clear).");
