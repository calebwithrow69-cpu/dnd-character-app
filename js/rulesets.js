// Rulesets: which books and which single entries a table allows. Anyone can make one on their device and
// share it as a code. No DOM in here. ASCII only.
//   ruleset = { id, name, defaultBooks: bool, books: { "<book key>": bool }, entries: { kind: { "<entry key>": bool } } }
// An entry is allowed when its own switch says so, otherwise when its book's switch says so, otherwise defaultBooks.

export const KINDS = [["classes", "Classes"], ["subclasses", "Subclasses"], ["species", "Species"], ["backgrounds", "Backgrounds"], ["feats", "Feats"], ["spells", "Spells"]];
export const LS_RULESETS = "dnd-rulesets-v1";
export const GROUP_ID = "group";

// ---- books: "PHB'24 p87" and "Phb'24" are the same book
export const bookName = e => String((e && e.source) || "").replace(/\s+p\.?\s?\d[\d–-]*\s*$/i, "").replace(/\s+/g, " ").trim() || "Unlabelled";
export const bookKey = e => bookName(e).toLowerCase();
export const entryKey = (kind, e) => kind === "subclasses" ? `${e.cls}|${e.name}` : e.name;

// Every book in the rules, with its most common spelling and how much it holds.
export function listBooks(L, homebrew = {}) {
  const map = new Map();
  KINDS.forEach(([kind]) => [...(L[kind] || []), ...(homebrew[kind] || [])].forEach(e => {
    const k = bookKey(e), name = bookName(e), b = map.get(k) || { key: k, spellings: {}, counts: {}, total: 0 };
    b.spellings[name] = (b.spellings[name] || 0) + 1; b.counts[kind] = (b.counts[kind] || 0) + 1; b.total++; map.set(k, b);
  }));
  return [...map.values()].map(b => ({ key: b.key, name: Object.entries(b.spellings).sort((a, c) => c[1] - a[1])[0][0], counts: b.counts, total: b.total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export function allowed(rs, kind, e) {
  const ov = rs && rs.entries && rs.entries[kind] && rs.entries[kind][entryKey(kind, e)];
  if (ov === true || ov === false) return ov;
  const b = rs && rs.books && rs.books[bookKey(e)];
  if (typeof b === "boolean") return b;
  return !rs || rs.defaultBooks !== false;
}
// Why an entry is on or off: "entry" (its own switch), "book" or "default".
export function allowedBy(rs, kind, e) {
  const ov = rs && rs.entries && rs.entries[kind] && rs.entries[kind][entryKey(kind, e)];
  if (ov === true || ov === false) return "entry";
  return rs && rs.books && typeof rs.books[bookKey(e)] === "boolean" ? "book" : "default";
}

export const blankRuleset = (name = "New ruleset") => ({ id: "rs" + Math.random().toString(36).slice(2, 9), name, defaultBooks: true, books: {}, entries: {} });
export const copyRuleset = (rs, name) => ({ ...JSON.parse(JSON.stringify({ defaultBooks: rs.defaultBooks !== false, books: rs.books || {}, entries: rs.entries || {} })), id: "rs" + Math.random().toString(36).slice(2, 9), name: name || (rs.name + " copy") });

// The group's own rules (data/campaign.json) as a ruleset: a fixed list for the kinds it limits, everything else on.
export function groupRuleset(C, L) {
  const rs = { id: GROUP_ID, name: (C && C.name) || "Group campaign", builtin: true, defaultBooks: true, books: {}, entries: {} };
  const en = (C && C.enabled) || {};
  if (L) ["classes", "species", "backgrounds", "feats"].forEach(kind => {
    if (!Array.isArray(en[kind])) return;
    const on = new Set(en[kind]); rs.entries[kind] = {};
    (L[kind] || []).forEach(e => { rs.entries[kind][entryKey(kind, e)] = on.has(e.name); });
  });
  return rs;
}

// A campaign object the rest of the app reads (enabled name lists), made from the chosen ruleset.
export function effectiveCampaign(rawC, L, rs) {
  if (!rs || rs.builtin) return { ...rawC, _subAllow: null, rulesetName: rs ? rs.name : "" };
  const enabled = {}, hb = (rawC && rawC.homebrew) || {};
  ["classes", "species", "backgrounds", "feats", "spells"].forEach(kind => { enabled[kind] = [...(L[kind] || [])].filter(e => allowed(rs, kind, e)).map(e => e.name); });
  const subs = (L.subclasses || []).filter(e => allowed(rs, "subclasses", e)).map(e => entryKey("subclasses", e));
  return { ...rawC, enabled: { ...enabled, subclasses: subs }, _subAllow: new Set(subs), rulesetName: rs.name };
}

// ---- storage: { active, sets: [ruleset] }
export function loadSets() {
  try { const d = JSON.parse(localStorage.getItem(LS_RULESETS) || "null"); if (d && Array.isArray(d.sets)) return { active: d.active || GROUP_ID, sets: d.sets.map(clean).filter(Boolean) }; } catch (e) { /* damaged */ }
  return { active: GROUP_ID, sets: [] };
}
export function saveSets(s) { try { localStorage.setItem(LS_RULESETS, JSON.stringify(s)); return true; } catch (e) { return false; } }
export const findSet = (s, C, id, L) => id === GROUP_ID || !id ? groupRuleset(C, L) : (s.sets.find(x => x.id === id) || null);
export const activeSet = (s, C, L) => findSet(s, C, s.active, L) || groupRuleset(C, L);

// Accepts anything, returns a safe ruleset or null.
export function clean(x) {
  if (!x || typeof x !== "object") return null;
  const bool = v => v === true || v === false;
  const out = { id: typeof x.id === "string" && /^[\w-]{1,24}$/.test(x.id) ? x.id : "rs" + Math.random().toString(36).slice(2, 9), name: String(x.name || "Ruleset").slice(0, 60).trim() || "Ruleset", defaultBooks: x.defaultBooks !== false, books: {}, entries: {} };
  let n = 0;
  Object.entries(x.books || {}).forEach(([k, v]) => { if (bool(v) && k.length <= 80 && n++ < 400) out.books[k.toLowerCase()] = v; });
  Object.entries(x.entries || {}).forEach(([kind, m]) => {
    if (!KINDS.some(k => k[0] === kind) || !m || typeof m !== "object") return;
    out.entries[kind] = {}; Object.entries(m).forEach(([k, v]) => { if (bool(v) && k.length <= 120 && n++ < 6000) out.entries[kind][k] = v; });
  });
  return out;
}

// ---- share codes
export const toB64 = s => { const bytes = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
export const fromB64 = t => { const b = atob(String(t).replace(/-/g, "+").replace(/_/g, "/")); const bytes = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i); return new TextDecoder().decode(bytes); };
export const encodeRuleset = rs => "CRR1." + toB64(JSON.stringify({ n: rs.name, d: rs.defaultBooks !== false, b: rs.books || {}, e: rs.entries || {} }));
export function decodeRuleset(code) {
  try {
    const m = /^\s*CRR1\.([\w-]+)\s*$/.exec(String(code || "")); if (!m) return null;
    const o = JSON.parse(fromB64(m[1]));
    return clean({ name: o.n, defaultBooks: o.d, books: o.b, entries: o.e });
  } catch (e) { return null; }
}

export function countAllowed(rs, L) {
  return KINDS.map(([kind, label]) => { const list = L[kind] || []; return [label, list.filter(e => allowed(rs, kind, e)).length, list.length]; });
}

// Reasons a ruleset cannot be used yet (a table with no class could not make a character).
export function problems(rs, L) {
  const out = [];
  [["classes", "class"], ["species", "species"], ["backgrounds", "background"]].forEach(([kind, one]) => { if (!(L[kind] || []).some(e => allowed(rs, kind, e))) out.push(`It allows no ${one}, so nobody could make a character.`); });
  return out;
}
