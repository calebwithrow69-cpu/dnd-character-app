// Rules glossary data layer: one flat list of everything you can look up, category tabs,
// filters, search and per-device bookmarks. Pure (no DOM); the screen is js/views/glossary.js.

export const LS_MARKS = "dnd-bookmarks-v1";
export const CONDITIONS = new Set(["Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"]);

// tab id, label, singular tag
export const CATS = [
  ["all", "All", ""], ["marks", "Saved", ""], ["rule", "Rules", "Rule"], ["condition", "Conditions", "Condition"],
  ["spell", "Spells", "Spell"], ["feat", "Feats", "Feat"], ["class", "Classes", "Class"], ["subclass", "Subclasses", "Subclass"],
  ["species", "Species", "Species"], ["background", "Backgrounds", "Background"], ["item", "Items", "Item"], ["weapon", "Weapons", "Weapon"],
  ["feature", "Features", "Feature"]
];
export const TAG = Object.fromEntries(CATS.map(c => [c[0], c[2]]));
export const DEFAULT_CAT = "rule";

// Rule-style groups are unique by name; reference lists (Skill, Damage Type...) only within their own group.
const RULEISH = /^(Rule|Action|Area of Effect|Hazard|Attitude|Condition)$/;
const plural = s => String(s).toLowerCase().replace(/s$/, "");

export const entryId = (kind, name, from, lv) => `${kind}|${from || ""}|${name}${lv != null ? "#" + lv : ""}`;
const lvLabel = l => (Number(l) === 0 ? "Cantrip" : `Level ${l}`);
const typeHead = t => String(t || "").split(/[(,]/)[0].trim();

// src: { classes, subclasses, species, backgrounds, feats, spells, items, weapons, rules, glossary, terms }
// book: entry -> book name ("" when it has none)
export function buildEntries(src, book = e => String((e && e.source) || "")) {
  const out = [];
  const add = e => { e.id = entryId(e.kind, e.name, e.from, e.lv); e.src = e.src || ""; out.push(e); };

  for (const c of src.classes || []) add({ kind: "class", cat: "class", name: c.name, meta: [c.hd ? `d${String(c.hd).replace(/^d/i, "")}` : "", c.primary || ""].filter(Boolean).join(" · "), src: book(c) });
  for (const sc of src.subclasses || []) add({ kind: "subclass", cat: "subclass", name: sc.name, from: sc.cls, meta: sc.cls, classes: [sc.cls], src: book(sc) });
  for (const s of src.species || []) add({ kind: "species", cat: "species", name: s.name, meta: "", src: book(s) });
  for (const b of src.backgrounds || []) add({ kind: "background", cat: "background", name: b.name, meta: b.feat || "", src: book(b) });
  for (const f of src.feats || []) add({ kind: "feat", cat: "feat", name: f.name, meta: typeHead(f.type), type: typeHead(f.type), src: book(f) });
  for (const s of src.spells || []) add({ kind: "spell", cat: "spell", name: s.name, lv: s.level || 0, school: s.school || "", classes: s.classes || [],
    meta: `${s.level ? "Lv " + s.level : "Cantrip"} · ${s.school || ""}${s.conc ? " · C" : ""}${s.ritual ? " · R" : ""}`, src: book(s) });
  for (const i of src.items || []) add({ kind: "libItem", cat: "item", name: i.name, meta: i.type || "", type: typeHead(i.type), src: book(i) });
  for (const w of src.weapons || []) add({ kind: "libWeapon", cat: "weapon", name: w.name, meta: [w.cat, w.kind].filter(Boolean).join(" "), type: w.cat || "", type2: w.kind || "", src: book(w) });

  // class and subclass features
  for (const c of src.classes || []) for (const f of c.features || [])
    add({ kind: "classFeature", cat: "feature", name: f.name, from: c.name, lv: f.lv, meta: `${c.name} · Lv ${f.lv}`, classes: [c.name], src: "" });
  for (const sc of src.subclasses || []) for (const f of sc.features || [])
    add({ kind: "subclassFeature", cat: "feature", name: f.name, from: sc.name, lv: f.lv, meta: `${sc.name} · Lv ${f.lv}`, classes: [sc.cls], src: "" });

  // rules: the book's glossary first, then the SRD list, then the app's short terms
  const seen = new Set();
  const rule = (r, srcName) => {
    const group = r.cat || (CONDITIONS.has(r.name) ? "Condition" : "Rule");
    const key = RULEISH.test(group) ? "|" + plural(r.name) : group + "|" + r.name.toLowerCase();
    if (!r.name || !r.text || seen.has(key)) return;
    seen.add(key);
    const cond = group === "Condition" || CONDITIONS.has(r.name);
    add({ kind: cond ? "condition" : "rule", cat: cond ? "condition" : "rule", name: r.name, from: RULEISH.test(group) ? "" : group, group: cond ? "Condition" : group, meta: cond ? "Condition" : group, text: r.text, src: r.source || srcName || "" });
  };
  (src.rules || []).forEach(r => rule(r, ""));
  (src.glossary || []).forEach(r => rule(r, ""));
  (src.terms || []).forEach(r => rule(r, ""));
  return out;
}

// ---- filters
const FDEF = {
  lv: { label: "Level", get: e => e.lv == null ? null : String(e.lv), cmp: (a, b) => a - b, fmt: v => lvLabel(v) },
  school: { label: "School", get: e => e.school },
  cls: { label: "Class", get: e => e.classes },
  src: { label: "Book", get: e => e.src },
  type: { label: "Type", get: e => e.type },
  type2: { label: "Range", get: e => e.type2 },
  group: { label: "Type", get: e => e.group },
  tag: { label: "Type", get: e => TAG[e.cat] }
};
const FOR = {
  all: ["tag", "src"], marks: ["tag"], rule: ["group", "src"], condition: [], spell: ["lv", "school", "cls", "src"], feat: ["type", "src"],
  class: [], subclass: ["cls", "src"], species: ["src"], background: ["src"], item: ["type", "src"], weapon: ["type", "type2"], feature: ["cls"]
};
const vals = (def, e) => { const v = def.get(e); return v == null || v === "" ? [] : Array.isArray(v) ? v : [v]; };

export function filtersFor(cat, list) {
  return (FOR[cat] || []).map(id => {
    const def = FDEF[id], set = new Set();
    for (const e of list) vals(def, e).forEach(v => set.add(v));
    const opts = [...set].sort(def.cmp || ((a, b) => String(a).localeCompare(String(b)))).map(v => ({ v, label: def.fmt ? def.fmt(v) : v }));
    return { id, label: def.label, opts };
  }).filter(f => f.opts.length > 1);
}
export const applyFilters = (list, f) => list.filter(e => Object.entries(f || {}).every(([id, v]) => !v || !FDEF[id] || vals(FDEF[id], e).includes(v)));

// ---- search and order
export function matchQuery(list, q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return list;
  const rank = e => { const n = e.name.toLowerCase(); return n === s ? 0 : n.startsWith(s) ? 1 : n.split(/\s+/).some(w => w.startsWith(s)) ? 2 : n.includes(s) ? 3 : s.length >= 3 && e.text && e.text.toLowerCase().includes(s) ? 4 : 9; };
  return list.map(e => [e, rank(e)]).filter(x => x[1] < 9).sort((a, b) => a[1] - b[1] || a[0].name.localeCompare(b[0].name)).map(x => x[0]);
}
export function sortEntries(list, cat, sort, desc) {
  const m = e => (cat === "all" || cat === "marks" ? e.lab : e.meta) || "";
  const by = {
    name: (a, b) => a.name.localeCompare(b.name),
    meta: (a, b) => (m(a)).localeCompare(m(b)) || a.name.localeCompare(b.name),
    src: (a, b) => (a.src || "~").localeCompare(b.src || "~") || a.name.localeCompare(b.name)
  };
  let fn = by[sort];
  if (!fn) fn = cat === "spell" ? (a, b) => (a.lv - b.lv) || a.name.localeCompare(b.name)
    : cat === "feature" ? (a, b) => (a.classes[0] || "").localeCompare(b.classes[0] || "") || (a.from || "").localeCompare(b.from || "") || (a.lv - b.lv) || a.name.localeCompare(b.name)
    : by.name;
  const r = list.slice().sort(fn);
  return desc ? r.reverse() : r;
}

// What one tab shows: its entries, then the query, filters, order.
export function view(entries, marks, { cat, q, f, sort, desc }) {
  const pool = cat === "all" ? entries : cat === "marks" ? marks.map(id => entries.find(e => e.id === id)).filter(Boolean) : entries.filter(e => e.cat === cat);
  const filters = filtersFor(cat, pool);
  const matched = matchQuery(pool, q);
  const shown = applyFilters(matched, f);
  const ordered = q && String(q).trim() && !sort ? shown : cat === "marks" && !sort ? shown : sortEntries(shown, cat, sort, desc);
  return { pool, filters, list: ordered };
}
export function counts(entries, marks, q) {
  const out = { all: 0, marks: 0 };
  for (const c of CATS) if (c[0] !== "all" && c[0] !== "marks") out[c[0]] = 0;
  const saved = new Set(marks);
  for (const e of matchQuery(entries, q)) { out.all++; out[e.cat]++; if (saved.has(e.id)) out.marks++; }
  return out;
}

// ---- bookmarks (this device)
export function loadMarks(store = globalThis.localStorage) {
  try { const a = JSON.parse(store.getItem(LS_MARKS) || "[]"); return Array.isArray(a) ? a.filter(x => typeof x === "string") : []; } catch (e) { return []; }
}
export function saveMarks(marks, store = globalThis.localStorage) { try { store.setItem(LS_MARKS, JSON.stringify(marks)); return true; } catch (e) { return false; } }
// Newest first.
export const toggleMark = (marks, id) => marks.includes(id) ? marks.filter(x => x !== id) : [id, ...marks];
