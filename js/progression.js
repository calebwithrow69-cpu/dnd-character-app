// Class progression: what a class gains at each level, read from the
// class tables and feature lists in library.json (levels 1–10 from the
// sourcebook import, 11–20 from SRD 5.2). If a table row is missing, the
// 2024 ability-score levels below are used and spell counts are left open.

import { parseList, slotRows, SKILLS } from "./rules.js";

// Which trailing columns of each class table hold the counts we need,
// counted from the right-hand end of a row.
const TABLE_TAIL = {
  Bard: { len: 12, cantrips: 11, prepared: 10 },
  Cleric: { len: 12, cantrips: 11, prepared: 10 },
  Druid: { len: 12, cantrips: 11, prepared: 10 },
  Sorcerer: { len: 12, cantrips: 11, prepared: 10 },
  Wizard: { len: 11, cantrips: 11, prepared: 10 },
  Warlock: { len: 5, invocations: 5, cantrips: 4, prepared: 3 },
  Paladin: { len: 7, prepared: 6 },
  Ranger: { len: 7, prepared: 6 },
  Barbarian: { len: 3, mastery: 1 },
  Fighter: { len: 2, mastery: 1 }
};
const FIXED_MASTERY = { Paladin: 2, Ranger: 2, Rogue: 2 };

const num = v => (v == null || v === "—" || v === "-" ? 0 : (parseInt(String(v).replace(/[^\d]/g, ""), 10) || 0));

export function tableCounts(cls, level) {
  if (!cls || !cls.table) return null;
  const spec = TABLE_TAIL[cls.name];
  const row = cls.table.split("\n").slice(1).find(l => parseInt(l, 10) === level);
  const out = {};
  if (FIXED_MASTERY[cls.name] != null) out.mastery = FIXED_MASTERY[cls.name];
  if (!row) return Object.keys(out).length ? out : null;
  if (!spec) return out;
  const t = row.trim().split(/\s+/);
  if (t.length < spec.len + 2) return out;
  ["cantrips", "prepared", "invocations", "mastery"].forEach(k => { if (spec[k]) out[k] = num(t[t.length - spec[k]]); });
  return out;
}
export const hasTableRow = (cls, level) => !!cls?.table?.split("\n").slice(1).some(l => parseInt(l, 10) === level);

// Option lists stored as features right after a "marker" feature.
const OPTION_GROUPS = {
  Warlock: { key: "invocations", marker: "Eldritch Invocation Options", label: "Eldritch Invocations" },
  Sorcerer: { key: "metamagic", marker: "Metamagic Options", label: "Metamagic" }
};
export function optionGroup(cls) {
  const g = cls && OPTION_GROUPS[cls.name];
  if (!g) return null;
  const feats = cls.features || [];
  const i = feats.findIndex(f => f.name === g.marker);
  if (i < 0) return null;
  const lv = feats[i].lv;
  const options = [];
  for (let j = i + 1; j < feats.length && feats[j].lv === lv; j++) options.push(feats[j]);
  return { ...g, options, markerLv: lv };
}
export function optionNames(cls) {
  const g = optionGroup(cls);
  return new Set(g ? [g.marker, ...g.options.map(o => o.name)] : []);
}

// "Prerequisite: Level 5+ Warlock, Pact of the Blade"
export function optionPrereq(opt) {
  const m = /Prerequisites?:\s*([^\n]*)/i.exec(opt.text || "");
  if (!m) return { level: 0, needs: [], text: "" };
  const text = m[1].replace(/\.$/, "");
  const lv = /Level (\d+)\+/i.exec(text);
  const needs = text.split(/,\s*/).filter(p => !/Level \d+\+/i.test(p) && !/cantrip/i.test(p)).map(s => s.trim()).filter(Boolean);
  return { level: lv ? +lv[1] : 0, needs, text };
}

const METAMAGIC_AT = { 2: 2, 10: 2, 17: 2 };

const ASI_EXTRA = { Fighter: [14], Rogue: [] };
export function isAsiLevel(cls, level) {
  if (!cls) return false;
  if (hasTableRow(cls, level))
    return (cls.features || []).some(f => f.lv === level && /^(Ability Score Improvement|Epic Boon)$/i.test(f.name));
  return [12, 16, 19].includes(level) || (ASI_EXTRA[cls.name] || []).includes(level);
}

// Features gained exactly at `level` (minus option-list entries).
export function newFeatures(L, cls, subclassName, level) {
  const hide = optionNames(cls);
  const sub = subclassName ? L.subclasses.find(s => s.name === subclassName && s.cls === cls?.name) : null;
  return [
    ...(cls?.features || []).filter(f => f.lv === level && !hide.has(f.name)).map(f => ({ ...f, from: cls.name, kind: "classFeature" })),
    ...(sub?.features || []).filter(f => f.lv === level && !f.intro).map(f => ({ ...f, from: sub.name, kind: "subclassFeature" }))
  ];
}

function expertiseCount(cls, level) {
  const f = (cls?.features || []).find(x => x.lv === level && /^Expertise$/i.test(x.name));
  if (!f) return 0;
  return /\bone of your\b|\bone skill\b/i.test(f.text || "") && !/\btwo\b/i.test(f.text || "") ? 1 : 2;
}
// "Divine Order" / "Primal Order": one feature, a few named options written as "Name. Text" paragraphs.
const ORDER_RE = /^(Divine Order|Primal Order)$/i;
export function parseOrderOptions(text) {
  return String(text || "").split(/\n\s*\n/).map(p => /^([A-Z][A-Za-z' ]{2,24})\.\s+([\s\S]+)$/.exec(p.trim())).filter(Boolean).map(m => ({ name: m[1], text: m[2].trim() }));
}
const hasFeature = (cls, level, re) => (cls?.features || []).some(f => f.lv === level && re.test(f.name));

// The ordered decisions for going to `next` (fromCreation = first-level
// choices right after making a character, so no HP roll).
export function levelUpPlan(L, c, next, draft = {}, { fromCreation = false } = {}) {
  const cls = L.classes.find(x => x.name === c.class);
  const steps = [];
  if (!fromCreation) steps.push({ id: "gains", label: "New this level" }, { id: "hp", label: "Hit points" });
  const subs = L.subclasses.filter(s => s.cls === c.class);
  if (next >= 3 && !c.subclass && subs.length) steps.push({ id: "subclass", label: "Subclass" });
  if (isAsiLevel(cls, next)) steps.push({ id: "asi", label: next === 19 ? "Epic boon" : "Ability or feat" });
  if (hasFeature(cls, next, /^Fighting Style$/i)) steps.push({ id: "style", label: "Fighting style" });
  const orderFeat = (cls?.features || []).find(f => f.lv === next && ORDER_RE.test(f.name));
  if (orderFeat) { const options = parseOrderOptions(orderFeat.text); if (options.length) steps.push({ id: "order", label: orderFeat.name, feature: orderFeat.name, options }); }
  const langFeat = (cls?.features || []).find(f => f.lv === next && /one other language of your choice/i.test(f.text || ""));
  if (langFeat) steps.push({ id: "language", label: "Language", feature: langFeat.name });
  const ex = expertiseCount(cls, next);
  if (ex) steps.push({ id: "expertise", label: "Expertise", n: ex });

  const now = fromCreation ? {} : (tableCounts(cls, c.level) || {});
  const then = tableCounts(cls, next) || {};
  const open = !hasTableRow(cls, next);
  const diff = k => Math.max(0, (then[k] || 0) - (now[k] || 0));
  if (diff("mastery")) steps.push({ id: "mastery", label: "Weapon mastery", n: diff("mastery") });

  const g = optionGroup(cls);
  if (g) {
    const n = g.key === "invocations" ? diff("invocations") : (METAMAGIC_AT[next] || 0);
    if (n) steps.push({ id: "options", label: g.label, n, group: g });
  }
  const slotMax = Math.max(0, ...slotRows(c.class, next).map(r => r.level));
  const extraCantrip = draft.order === "Magician" || draft.order === "Thaumaturge" ? 1 : 0; // the order's extra cantrip
  if (diff("cantrips") || (open && slotMax && cls && TABLE_TAIL[cls.name]?.cantrips)) steps.push({ id: "cantrips", label: "Cantrips", n: open ? null : diff("cantrips") + extraCantrip });
  if (slotMax && (diff("prepared") || open)) steps.push({ id: "spells", label: "Spells", n: open ? null : diff("prepared"), maxLevel: slotMax });
  steps.push({ id: "review", label: "Review" });
  return { steps, cls, next, open, features: newFeatures(L, cls, c.subclass || draft.subclass, next) };
}

// Feat prerequisites ("General Feat (Prerequisites: Level 4+, Charisma 13+)").
const ABIL = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
export function featEligible(feat, c, level) {
  const t = feat.type || "";
  const m = /Prerequisites?:\s*([^)]*)/i.exec(t);
  if (!m) return { ok: true };
  const req = m[1];
  const lv = /Level (\d+)\+/i.exec(req);
  if (lv && level < +lv[1]) return { ok: false, why: `Needs level ${lv[1]}` };
  const ab = [...req.matchAll(/((?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:\s+or\s+(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))*)\s+(\d+)\+/gi)];
  for (const a of ab) {
    const keys = a[1].split(/\s+or\s+/i).map(x => ABIL[x.toLowerCase()]);
    if (!keys.some(k => (c.abilities[k] || 0) >= +a[2])) return { ok: false, why: `Needs ${a[1]} ${a[2]}` };
  }
  if (/Spellcasting or Pact Magic/i.test(req) && !slotRows(c.class, level).length) return { ok: false, why: "Needs spellcasting" };
  if (/Fighting Style Feature/i.test(req) && !(c.feats || []).some(f => /fighting style/i.test(f)) && !["Fighter", "Paladin", "Ranger"].includes(c.class)) return { ok: false, why: "Needs Fighting Style" };
  return { ok: true, note: req };
}

export function spellsFor(L, C, c, { cantrips, maxLevel, all = false }) {
  const known = new Set((c.spellcasting?.spells || []).map(s => s.name));
  const list = [...L.spells, ...((C && C.homebrew && C.homebrew.spells) || [])];
  const allow = C?.enabled?.spells ? new Set(C.enabled.spells) : null;
  return list.filter(s => (allow ? allow.has(s.name) : true)
    && !known.has(s.name)
    && (cantrips ? s.level === 0 : s.level > 0 && s.level <= maxLevel)
    && (all || !parseList(s.classes).length || parseList(s.classes).includes(c.class)))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

// Is one level-up step answered? (shared by the level-up screen and character creation)
export const expertiseOptions = c => SKILLS.filter(s => (c.skillProf || []).includes(s.id) && !(c.skillExpertise || []).includes(s.id));
export function stepValidFor(c, d, step) {
  switch (step.id) {
    case "hp": return d.hpMode === "avg" || !!d.rolled;
    case "subclass": return !!d.subclass;
    case "asi":
      if (!d.feat) return false;
      if (d.feat !== "Ability Score Improvement") return !d.featNeedsAb || !!d.featAb;
      return d.asiSplit === "2" ? !!d.a2 && c.abilities[d.a2] < 20 : !!d.a1a && !!d.a1b && d.a1a !== d.a1b;
    case "style": return !!d.style;
    case "order": return !!d.order;
    case "language": return !!d.language;
    case "expertise": return d.expertise.length === Math.min(step.n, expertiseOptions(c).length);
    case "mastery": return d.mastery.length === step.n;
    case "options": return d.options.length === step.n;
    case "cantrips": return step.n == null || d.cantrips.length >= step.n; // must learn them all (the Randomize button fills them)
    default: return true; // spells: picking fewer is allowed
  }
}
