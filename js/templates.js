// Character templates: a creation draft saved as a file or a short code so it can be reused or sent to someone.
// Also reads what people send back: a template, or a character file. No DOM in here. ASCII only.
import { sanitizeDraft, pruneDraftToLibrary, finalAbilities, CHAPTERS } from "./creation.js";
import { toB64, fromB64 } from "./rulesets.js";
import { ABILITIES, ABILITY_LABEL } from "./rules.js";

const MAX_TEXT = 3 * 1024 * 1024;

export function templatePayload(d, name) {
  const draft = JSON.parse(JSON.stringify(d));
  delete draft.query; delete draft.savedAt; delete draft.templateId;
  return { app: "character-runner", kind: "template", version: 1, name: String(name || d.name || "Template").slice(0, 60), savedAt: new Date().toISOString(), draft };
}
export const templateCode = payload => "CRT1." + toB64(JSON.stringify({ n: payload.name, d: payload.draft }));

// Returns { type: "template", name, draft } or { type: "characters", chars }. Throws an Error with a plain message.
export function readShared(text, app, parseChars) {
  const t = String(text || "").trim();
  if (!t) throw new Error("Empty.");
  if (t.length > MAX_TEXT) throw new Error("Too large.");
  let data = null;
  const m = /^CRT1\.([\w-]+)$/.exec(t);
  if (m) {
    try { const o = JSON.parse(fromB64(m[1])); data = { kind: "template", name: o.n, draft: o.d }; } catch (e) { throw new Error("Invalid code."); }
  } else {
    try { data = JSON.parse(t); } catch (e) { throw new Error("Invalid file or code."); }
  }
  if (data && data.kind === "template" && data.draft) {
    const draft = sanitizeDraft(data.draft);
    if (!draft) throw new Error("Invalid template.");
    pruneDraftToLibrary(draft, app);
    return { type: "template", name: String(data.name || draft.name || "Template").slice(0, 60), draft };
  }
  try { const chars = parseChars(t); if (chars.length) return { type: "characters", chars }; } catch (e) { /* fall through */ }
  throw new Error("Invalid file or code.");
}

// One-line facts for the preview.
export function describeDraft(d, app) {
  const fin = d.class ? finalAbilities(app, d) : null;
  return {
    line: [d.species, d.class, d.background ? `(${d.background})` : ""].filter(Boolean).join(" ") || "Nothing chosen yet",
    scores: fin ? ABILITIES.map(a => [ABILITY_LABEL[a].slice(0, 3).toUpperCase(), fin[a]]) : [],
    chapter: CHAPTERS[Math.min(d.chapter || 0, CHAPTERS.length - 1)].title || ""
  };
}
