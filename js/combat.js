// The Combat tab's list: everything a character can do on a turn, with the
// cost (Action / Bonus Action / Reaction / always on) and whether it can be
// used right now. Nothing is reworded: the cost is the app's reading of the
// rules text (same reading the species picker uses), shown as such.
import { findByName, findFeat, enabledSpells, enabledFeats } from "./data.js";
import { weaponsOf } from "./gear.js";
import { optionNames, optionGroup } from "./progression.js";
import { parseSpecies, classifyText } from "./species.js";

export const COSTS = ["Action", "Bonus", "Reaction", "Passive"];
export const COST_LABEL = { Action: "Action", Bonus: "Bonus Action", Reaction: "Reaction", Passive: "Passive", Other: "Other" };
const DOWN = ["Incapacitated", "Stunned", "Paralyzed", "Unconscious", "Petrified"];

// Which kind of action a block of rules text uses: the earliest mention wins.
export function costOfText(text) {
  const t = String(text || "").replace(/’/g, "'");
  if (classifyText(t).kind !== "active") return "Passive";
  const hits = [["Bonus", /\bBonus Action\b/], ["Reaction", /\bReaction\b/], ["Action", /\b(?:Magic action|as an action|Use an action)\b/i]]
    .map(([k, re]) => [k, t.search(re)]).filter(h => h[1] >= 0).sort((a, b) => a[1] - b[1]);
  return hits.length ? hits[0][0] : "Other";
}
function costOfSpell(time) {
  const t = String(time || "");
  return /bonus/i.test(t) ? "Bonus" : /reaction/i.test(t) ? "Reaction" : /^\s*(?:1 )?action/i.test(t) ? "Action" : "Other";
}

const LEAD = /^([A-Z][\w'-]*(?: [A-Za-z][\w'-]*){0,4})\.\s+(?=\S)/;

export function turnBlock(c, turn, cost, isAttack) {
  if (!["Action", "Bonus", "Reaction"].includes(cost)) return "";
  if (c.hp.cur <= 0) return "You're at 0 HP, so you can't take actions or reactions.";
  const bad = (c.conditions || []).find(x => DOWN.includes(x));
  if (bad) return `You're ${bad.toLowerCase()}, so you can't take actions or reactions.`;
  const s = turn && turn.on ? turn.spent[cost] : null;
  if (s === true || (s === "attack" && !isAttack)) return `${COST_LABEL[cost]} already used this turn. Tap Next turn to reset.`;
  return "";
}

export function buildCombat(app, c, d) {
  const L = app.library, turn = app.turn;
  const out = [];
  const add = e => out.push({ res: null, block: "", ...e });
  const resFor = name => {
    const n = name.toLowerCase();
    const i = c.resources.findIndex(r => r.name.toLowerCase() === n || r.name.toLowerCase().includes(n) || n.includes(r.name.toLowerCase()));
    return i < 0 ? null : { i, cur: c.resources[i].max - c.resources[i].used, max: c.resources[i].max, reset: c.resources[i].reset };
  };

  // Attacks
  weaponsOf(c).forEach(it => {
    const w = it.weapon;
    const heavy = /heavy/i.test(w.props || "");
    let block = turnBlock(c, turn, "Action", true);
    if (!block && w.ammo && w.ammo.cur <= 0) block = `Out of ${w.ammo.name}.`;
    add({ id: "w:" + it.id, name: it.name, cost: "Action", src: "Attack", type: "attack", kind: "Ability", block,
      note: heavy && c.feats.includes("Great Weapon Master") && app.gwm ? "+PB" : "",
      act: { a: "attackRoll", id: it.id }, detail: { kind: "weapon", name: it.name }, weaponId: it.id,
      res: w.ammo ? { cur: w.ammo.cur, max: null, label: w.ammo.name } : null });
  });

  // Spells
  const info = d.spellInfo;
  const free = lv => !info || !info.slots.length ? true
    : info.slots.some(r => r.level >= lv && (c.spellcasting.slotsUsed[r.level - 1] || 0) < r.max);
  c.spellcasting.spells.forEach(s => {
    const ref = findByName(enabledSpells(L, app.campaign), s.name) || findByName(L.spells, s.name);
    if (!ref) return;
    const cost = costOfSpell(ref.time);
    let block = turnBlock(c, turn, cost, false);
    if (!block && ref.level > 0 && !s.prepared && !s.always) block = "Not prepared. Tick it in the Spells tab to prepare it.";
    if (!block && ref.level > 0 && info && !free(ref.level)) block = "No spell slots remaining.";
    if (!block && ref.level > 0 && !info) block = "Your class doesn't give you spell slots.";
    add({ id: "s:" + s.name, name: s.name, cost, src: ref.level ? "Spell " + ref.level : "Cantrip", type: "spell", level: ref.level || 0, kind: "Ability", block,
      act: { a: ref.level === 0 ? "castCantrip" : "openCast", name: s.name }, detail: { kind: "spell", name: s.name },
      conc: !!ref.conc, spell: true });
  });

  // Class and subclass features
  const cls = findByName(L.classes, c.class), sub = c.subclass ? findByName(L.subclasses, c.subclass) : null;
  const hide = optionNames(cls), group = optionGroup(cls);
  const chosen = new Set(group ? (c.choices[group.key] || []) : []);
  const feats = [
    ...((cls?.features) || []).filter(f => f.lv <= c.level && (!hide.has(f.name) || chosen.has(f.name))).map(f => ({ ...f, from: c.class, kind: "classFeature" })),
    ...((sub?.features) || []).filter(f => f.lv <= c.level && !f.intro).map(f => ({ ...f, from: c.subclass, kind: "subclassFeature" }))
  ];
  feats.forEach(f => {
    const cost = costOfText(f.text), res = resFor(f.name);
    let block = turnBlock(c, turn, cost, false);
    if (!block && res && res.cur <= 0) block = `No uses left. Back on a ${res.reset === "short" ? "short or long" : "long"} rest.`;
    add({ id: "f:" + f.from + ":" + f.name, name: f.name, cost, src: f.from + " " + f.lv, type: "feature", lv: f.lv, kind: cost === "Passive" ? "Trait" : "Ability",
      block, res, detail: { kind: f.kind, name: f.name, from: f.from }, resIdx: res ? res.i : null,
      act: res ? { a: "useRes", i: res.i } : null });
  });

  // Species traits
  const sp = findByName(L.species, c.species);
  parseSpecies(sp).traits.filter(t => t.level <= c.level).forEach(t => {
    const cost = t.kind === "active" ? costOfText(t.body) : "Passive", res = resFor(t.name);
    let block = turnBlock(c, turn, cost, false);
    if (!block && res && res.cur <= 0) block = `No uses left. Back on a ${res.reset === "short" ? "short or long" : "long"} rest.`;
    add({ id: "t:" + t.name, name: t.name, cost, src: c.species, type: "feature", kind: cost === "Passive" ? "Trait" : "Ability", block, res,
      text: t.body, act: res ? { a: "useRes", i: res.i } : null });
  });

  // Feats (each named paragraph is its own entry, like Hew in Great Weapon Master)
  [...new Set(c.feats || [])].forEach(name => {
    const f = findFeat(enabledFeats(L, app.campaign), name) || findFeat(L.feats, name);
    if (!f || !f.text) return;
    const paras = f.text.split(/\n{2,}/);
    let any = false;
    paras.forEach(p => {
      const m = LEAD.exec(p);
      if (!m || /^Ability Score Increase$/i.test(m[1])) return;
      any = true;
      const cost = costOfText(p), res = resFor(m[1]);
      let block = turnBlock(c, turn, cost, false);
      if (!block && res && res.cur <= 0) block = "No uses left.";
      add({ id: "ft:" + name + ":" + m[1], name: m[1], cost, src: name, type: "feature", kind: cost === "Passive" ? "Trait" : "Ability", block, res,
        text: p.slice(m[0].length), act: res ? { a: "useRes", i: res.i } : null });
    });
    if (!any) {
      const cost = costOfText(f.text);
      add({ id: "ft:" + name, name, cost, src: "Feat", type: "feature", kind: cost === "Passive" ? "Trait" : "Ability", block: turnBlock(c, turn, cost, false),
        detail: { kind: "feat", name } });
    }
  });
  return out;
}

export function sortCombat(list, how) {
  const rank = { Action: 0, Bonus: 1, Reaction: 2, Other: 3, Passive: 4 };
  const by = {
    avail: (a, b) => (!!a.block - !!b.block) || rank[a.cost] - rank[b.cost] || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
    source: (a, b) => a.src.localeCompare(b.src) || a.name.localeCompare(b.name)
  };
  return [...list].sort(by[how] || by.avail);
}
