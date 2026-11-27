// Features list model: every class, subclass, species, background and feat ability of a character as one list.
// Pure (no DOM). The use type and "limited" reading come from the app's reading of the rules text.
import { findByName, findFeat } from "./data.js";
import { parseSpecies, classifyText } from "./species.js";
import { costOfText } from "./combat.js";
import { optionNames, optionGroup } from "./progression.js";

export const FT_TABS = [["all", "All"], ["class", "Class"], ["subclass", "Subclass"], ["species", "Species"], ["feat", "Feats"], ["saved", "Saved"]];
export const FT_USES = [["Passive", "Passive"], ["Action", "Action"], ["Bonus", "Bonus"], ["Reaction", "Reaction"], ["limited", "Limited use"]];
export const FT_GROUPS = [["source", "Source"], ["level", "Level"], ["none", "None"]];
export const FT_SORTS = [["level", "Level"], ["name", "Name"], ["uses", "Uses left"]];
export const ftDefault = () => ({ tab: "all", q: "", group: "source", sort: "level", only: {}, upcoming: false, sel: null });

function resFor(c, name) {
  const n = String(name).toLowerCase(), list = c.resources || [];
  let i = list.findIndex(r => String(r.name).toLowerCase() === n);
  if (i < 0) i = list.findIndex(r => { const m = String(r.name).toLowerCase(); return m.includes(n) || n.includes(m); });
  return i < 0 ? null : { i, cur: list[i].max - list[i].used, max: list[i].max };
}

export function featureEntries(app, c) {
  const L = app.library, out = [];
  const cls = findByName(L.classes, c.class), sub = c.subclass ? findByName(L.subclasses, c.subclass) : null;
  const hide = optionNames(cls), group = optionGroup(cls);
  const mk = (src, label, name, lv, text, extra = {}) => {
    const cl = text ? classifyText(text) : { kind: "passive", usage: "Always on" };
    const use = extra.use || (cl.kind === "active" ? costOfText(text) : "Passive");
    const up = lv > c.level, track = up ? null : resFor(c, name), usage = extra.usage || cl.usage;
    return { key: src + ":" + name, src, label, name, lv, text: text || "", use, usage, upcoming: up, track,
      limited: !!track || /\b(Rest|uses|Once)\b/.test(usage), isNew: c.level > 1 && lv === c.level && (src === "class" || src === "subclass"), ...extra };
  };
  ((cls && cls.features) || []).filter(f => !hide.has(f.name)).forEach(f => out.push(mk("class", c.class, f.name, f.lv, f.text, { kind: "classFeature", from: c.class })));
  if (group) (c.choices[group.key] || []).forEach(n => { const f = ((cls && cls.features) || []).find(x => x.name === n); out.push(mk("class", c.class, n, f ? f.lv : 1, f ? f.text : "", { kind: "classFeature", from: c.class, parent: group.label })); });
  ((sub && sub.features) || []).filter(f => !f.intro).forEach(f => out.push(mk("subclass", c.subclass, f.name, f.lv, f.text, { kind: "subclassFeature", from: c.subclass })));
  const sp = findByName(L.species, c.species);
  parseSpecies(sp).traits.forEach(t => out.push(mk("species", c.species, t.name, t.level || 1, t.body, { kind: "species", dn: c.species, use: t.kind === "active" ? costOfText(t.body) : "Passive", usage: t.usage })));
  const bg = findByName(L.backgrounds, c.background);
  if (c.background) out.push(mk("species", "Background", c.background, 1, bg ? bg.desc : "", { kind: "background", dn: c.background }));
  (c.feats || []).forEach((f, i) => { const e = findFeat(L.feats, f); out.push(mk("feat", "Feat", f, 0, e ? e.text : "", { kind: "feat", i })); });
  return out;
}

export function ftCounts(list, marks) {
  const n = { all: 0, class: 0, subclass: 0, species: 0, feat: 0, saved: 0 };
  list.filter(e => !e.upcoming).forEach(e => { n.all++; n[e.src]++; if (marks.includes(e.key)) n.saved++; });
  return n;
}

export function ftActive(st) { return Object.values(st.only || {}).filter(Boolean).length + (st.upcoming ? 1 : 0) + (st.group !== "source" ? 1 : 0) + (st.sort !== "level" ? 1 : 0); }

export function ftApply(list, st, marks) {
  const q = String(st.q || "").trim().toLowerCase(), only = Object.keys(st.only || {}).filter(k => st.only[k]);
  let r = list.filter(e => (st.upcoming || !e.upcoming)
    && (st.tab === "all" || (st.tab === "saved" ? marks.includes(e.key) : e.src === st.tab))
    && (!q || e.name.toLowerCase().includes(q) || e.label.toLowerCase().includes(q) || e.text.toLowerCase().includes(q))
    && (!only.length || only.some(k => k === "limited" ? e.limited : e.use === k)));
  const byName = (a, b) => a.name.localeCompare(b.name);
  r = r.slice().sort(st.sort === "name" ? byName
    : st.sort === "uses" ? (a, b) => (a.track ? a.track.cur : 999) - (b.track ? b.track.cur : 999) || byName(a, b)
    : (a, b) => a.lv - b.lv || byName(a, b));
  if (st.group === "none") return [["", r]];
  const key = e => st.group === "level" ? (e.upcoming ? "Not reached yet" : e.lv ? "Level " + e.lv : "Feats") : e.label;
  const order = [], by = {};
  r.forEach(e => { const k = key(e); if (!by[k]) { by[k] = []; order.push(k); } by[k].push(e); });
  if (st.group === "level") order.sort((a, b) => (a === "Feats") - (b === "Feats"));
  if (st.group === "source") { const rank = k => { const e = by[k][0]; return e.src === "class" ? 0 : e.src === "subclass" ? 1 : e.src === "species" ? (e.kind === "species" ? 2 : 3) : 4; }; order.sort((a, b) => rank(a) - rank(b)); }
  return order.map(k => [k, by[k]]);
}
