// UI copy lint: finds visible strings in the app code that read like chatbot or tutorial text.
//   node tools/copy-lint.mjs            prints findings (exit 1 if there are more than the allowed baseline)
//   node tools/copy-lint.mjs --all      prints every string checked
// The rules and the definition are in docs/ (see CLAUDE.md "UI copy"). Book text lives in the rules file, not here.
import fs from "node:fs";
const files = ["js/app.js", "js/ui.js", "js/combat.js", ...fs.readdirSync("js/views").map(f => "js/views/" + f)];

export const RULES = [
  ["tutorial", /\b(tap|click|press|swipe|hit) (a|an|the|any|on|your|to|one|it|here|below|above)\b|\b(see|check|read) (below|above|the table)\b/i, "tells the user how to use the screen"],
  ["reassure", /\b(don'?t worry|nothing (is|will be|gets) (lost|deleted|changed)|is safe|are safe|no need|feel free|rest assured|no problem|for now)\b/i, "reassurance and filler"],
  ["hedge", /\b(simply|just|easily|quickly|a bit|a little|actually|basically|maybe|probably|usually|typically|obviously|of course|please)\b/i, "softeners"],
  ["marketing", /(!|\b(powerful|perfect|amazing|awesome|magical|seamless|effortless|beautiful|stunning|enjoy|welcome|get started|ready to|special)\b)/i, "enthusiasm and sales words"],
  ["chatty", /(—|–| - |\b(would you like|if you'?d like|let me|here'?s|i'?ll|we'?ll|we |our |you'?ll|you'?re|you'?ve|let'?s|whether you|not just|feel)\b)/i, "conversational voice, dashes as asides"],
  ["narrating", /\b(the app|this app|this screen|this page|this menu|this will|this lets you|this means|this is where|here you can)\b/i, "the screen describing itself"],
  ["youcan", /\byou can\b/i, "permission statements"],
];
const words = t => t.trim().split(/\s+/).filter(Boolean).length;

export function strings() {
  const out = [];
  for (const f of files) {
    fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      const l = line.replace(/\$\{[^}]*\}/g, "X");
      const texts = [...l.matchAll(/>([^<>{}`]{8,}?)</g)].map(m => [m[1].trim(), "text"]);
      [...l.matchAll(/toast\(\s*[`"']([^`"']{5,})[`"']/g)].forEach(m => texts.push([m[1], "toast"]));
      [...l.matchAll(/(?:placeholder|aria-label|title)="([^"]{8,})"/g)].forEach(m => texts.push([m[1], "attr"]));
      [...l.matchAll(/<(?:button|label)[^>]*>([^<>{}`]{3,}?)</g)].forEach(m => texts.push([m[1].trim(), "label"]));
      texts.forEach(([t, kind]) => { if (/[A-Za-z]{3}/.test(t) && !/^[\w\-./:#%]+$/.test(t) && !/[=\[\]{}]|\)\s*[:;?]|\bif\s*\(|=>/.test(t)) out.push({ f, line: i + 1, t, kind }); });
    });
  }
  return out;
}
export function check(s) {
  const hits = RULES.filter(([, re]) => re.test(s.t)).map(r => r[0]);
  const w = words(s.t);
  if (s.kind === "label" && w > 4) hits.push("long-label");
  if (s.kind === "toast" && w > 9) hits.push("long-toast");
  if (s.kind === "text" && w > 12 && /[.!?]$/.test(s.t)) hits.push("prose");
  return hits;
}
if (process.argv[1].endsWith("copy-lint.mjs")) {
  const all = strings(), found = all.map(s => ({ ...s, hits: check(s) })).filter(s => s.hits.length);
  if (process.argv.includes("--all")) all.forEach(s => console.log(`${s.f}:${s.line} [${s.kind}] ${s.t}`));
  else found.forEach(s => console.log(`${s.f}:${s.line} [${s.hits.join(",")}] ${s.t.slice(0, 140)}`));
  const by = {}; found.forEach(s => s.hits.forEach(h => { by[h] = (by[h] || 0) + 1; }));
  console.error(`\n${all.length} strings checked, ${found.length} flagged`, JSON.stringify(by));
  const base = fs.existsSync("tools/copy-baseline.json") ? JSON.parse(fs.readFileSync("tools/copy-baseline.json", "utf8")).max : 0;
  if (found.length > base) { console.error(`over the baseline of ${base}`); process.exit(1); }
}
