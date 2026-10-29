// Play Mode data: everything a character can do on a turn, from every source
// (features, attacks, spells, items) plus the standard actions every character
// has. Builds on combat.js so the costs, blocks and resources stay in one place.
// The standard-action wording below is a short summary, not rules text.
import { buildCombat, turnBlock } from "./combat.js";
import { itemCategory, weaponsOf, itemById } from "./gear.js";
import { findByName, findFeat } from "./data.js";
import { optionNames, optionGroup, tableCounts } from "./progression.js";
import { weaponNumbers, fmtMod, slotRows } from "./rules.js";
import { analyzeSpell, castDice } from "./spells.js";
import { ensureLuck, starryOn, pbOf } from "./riders.js";

export const SOURCES = [["feature", "Class features"], ["feat", "Feats"], ["attack", "Attacks"], ["spell", "Spells"], ["item", "Items"], ["std", "Standard actions"]];
export const DEFAULT_SHOW = { feature: true, feat: true, attack: true, spell: true, item: true, std: false };

export function playShow(app) {
  const s = (app.prefs && app.prefs.playShow) || {};
  const out = {};
  SOURCES.forEach(([k]) => { out[k] = s[k] == null ? DEFAULT_SHOW[k] : !!s[k]; });
  return out;
}

const STD = [
  { id: "dodge", name: "Dodge", cost: "Action", text: "Until the start of your next turn, attack rolls against you have Disadvantage if you can see the attacker, and you have Advantage on Dexterity saving throws. Lost if you are Incapacitated or your Speed is 0." },
  { id: "dash", name: "Dash", cost: "Action", text: "Gain extra movement for the turn equal to your Speed (after modifiers)." },
  { id: "disengage", name: "Disengage", cost: "Action", text: "Your movement does not provoke Opportunity Attacks for the rest of the turn." },
  { id: "help", name: "Help", cost: "Action", text: "Help another creature with an ability check or an attack roll against a creature within 5 feet of you. The first d20 Test they make gets Advantage." },
  { id: "hide", name: "Hide", cost: "Action", text: "Make a Dexterity (Stealth) check, DC 15, while out of sight. On a success you are Invisible until found or you stop being hidden." },
  { id: "influence", name: "Influence", cost: "Action", text: "Make a Charisma (Deception, Intimidation, Performance or Persuasion) or Wisdom (Animal Handling) check to sway a creature. The DM sets the DC." },
  { id: "ready", name: "Ready", cost: "Action", text: "Choose a trigger and an action. When the trigger happens before your next turn, you can use your Reaction to take that action. Readying a spell requires concentration." },
  { id: "search", name: "Search", cost: "Action", text: "Make a Wisdom check (Insight, Medicine, Perception or Survival) to find something." },
  { id: "study", name: "Study", cost: "Action", text: "Make an Intelligence check (Arcana, History, Investigation, Nature or Religion) to recall or work out information." },
  { id: "utilize", name: "Utilize", cost: "Action", text: "Use a non-magical object that needs an action, such as a lever, a tool or a mechanism." },
  { id: "grapple", name: "Grapple", cost: "Action", text: "Unarmed Strike option. The target makes a Strength or Dexterity save against DC 8 + your Strength modifier + Proficiency Bonus, or becomes Grappled." },
  { id: "shove", name: "Shove", cost: "Action", text: "Unarmed Strike option. The target makes a Strength or Dexterity save against DC 8 + your Strength modifier + Proficiency Bonus, or you push it 5 feet or knock it Prone." },
  { id: "offhand", name: "Light weapon extra attack", cost: "Bonus", text: "After you take the Attack action with a Light weapon, make one extra attack with a different Light weapon as a Bonus Action. You do not add your ability modifier to its damage unless it is negative." },
  { id: "oa", name: "Opportunity Attack", cost: "Reaction", text: "When a creature you can see leaves your reach without Disengaging, use your Reaction to make one melee attack against it." },
  { id: "interact", name: "Interact with an object", cost: "Other", text: "Once per turn you can interact with one object or feature as part of another action or your movement, such as opening a door or drawing a weapon." }
];

const POTION = /^potion of (greater |superior |supreme )?healing/i;
const POTION_ROLL = { "": "2d4+2", greater: "4d4+4", superior: "8d4+8", supreme: "10d4+20" };
export function healingFormula(name) {
  const m = POTION.exec(String(name || "").trim());
  return m ? POTION_ROLL[(m[1] || "").trim().toLowerCase()] : null;
}

// The weapon in your hand: the one you chose with Swap weapon, else the main-hand
// weapon, else the first one in the bag. Only that weapon can be attacked with here.
export function wieldedId(c) {
  const ws = weaponsOf(c);
  if (c.wielded && ws.some(w => w.id === c.wielded)) return c.wielded;
  const main = c.equipment && c.equipment.main;
  if (main && ws.some(w => w.id === main)) return main;
  return ws.length ? ws[0].id : "";
}

// First sentence of a rules text, for the line under a name.
export function gist(text, max = 118) {
  const t = String(text || "").replace(/\*\*|__|#+ /g, "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = /^(.{30,}?[.!?])(\s|$)/.exec(t);
  const one = m ? m[1] : t;
  return one.length > max ? one.slice(0, max - 1).replace(/\s+\S*$/, "") + "\u2026" : one;
}

function weaponRange(w) {
  const p = String((w && w.props) || "");
  const r = /Range\s*\(?\s*(\d+)\s*\/\s*(\d+)/i.exec(p) || /Thrown\s*\(\s*(\d+)\s*\/\s*(\d+)/i.exec(p);
  if (r) return `Range ${r[1]}/${r[2]} ft`;
  if (w && w.kind === "Ranged") return "Ranged";
  return /\breach\b/i.test(p) ? "Reach 10 ft" : "Reach 5 ft";
}

function subOf(app, c, d, e) {
  if (e.type === "attack" && e.weaponId) {
    const it = itemById(c, e.weaponId), w = it && it.weapon;
    if (!w) return "";
    const n = weaponNumbers(w, c);
    return `${fmtMod(n.toHit)} to hit \u00b7 ${n.dice}${n.dmgMod ? (n.dmgMod > 0 ? "+" : "") + n.dmgMod : ""} ${String(w.dtype || "").toLowerCase()} \u00b7 ${weaponRange(w)}`.replace(/\s+\u00b7/g, " \u00b7");
  }
  if (e.type === "spell") {
    const ref = findByName(app.library.spells, e.name), si = d.spellInfo;
    if (!ref) return "";
    const a = analyzeSpell(ref), bits = [];
    if (si && a.attack) bits.push(`${fmtMod(si.attackBonus)} ${a.attack.toLowerCase()}`);
    if (si && a.save) bits.push(`${a.save.slice(0, 3)} save DC ${si.dc}`);
    const fx = a.damage || a.heal;
    if (fx) {
      const dice = castDice(fx.dice, a, { charLevel: c.level, slotLevel: ref.level, spellLevel: ref.level });
      const mod = (fx.flat || 0) + (fx.addMod && si ? si.mod : 0);
      bits.push(a.heal ? `Heals ${dice}${mod ? "+" + mod : ""}` : `${dice}${mod ? "+" + mod : ""} ${String(fx.type || "").toLowerCase()}`.trim());
    }
    if (!bits.length) return gist(ref.text, 90);
    if (ref.range) bits.push(String(ref.range).replace(/ feet?/i, " ft"));
    return bits.join(" \u00b7 ");
  }
  if (e.type === "item") { const f = healingFormula(e.name); return f ? `Heals ${f}` : gist(e.text); }
  if (e.type === "std") return gist(e.text);
  if (e.sub) return e.sub;
  if (e.text) return gist(e.text);
  if (e.detail && e.detail.kind) {
    const L = app.library;
    if (e.detail.kind === "feat") { const f = findFeat(L.feats, e.detail.name); return f ? gist(f.text) : ""; }
  }
  return "";
}

const USABLE_ITEM = it => { const cat = itemCategory(it); return cat === "potion" || cat === "scroll" || /\bwand\b/i.test(it.name || ""); };

export function playEntries(app, c, d) {
  ensureLuck(c);
  const turn = app.turn, wid = wieldedId(c), out = [];
  const raw = buildCombat(app, c, d);
  const featKids = new Map();
  const luckI = (c.resources || []).findIndex(r => r.name === "Luck Points");
  raw.forEach(e0 => {
    const e = { ...e0, type: e0.type || "feature" };
    if (e.type === "attack" && e.weaponId && e.weaponId !== wid) return;
    if (/^ft:/.test(e.id)) {
      const fname = e.src === "Feat" ? e.name : e.src;
      if (e.src !== "Feat" && luckI >= 0 && fname === "Lucky" && /^(Luck Points|Advantage|Disadvantage)$/.test(e.name)) {
        const r = c.resources[luckI];
        e.res = { i: luckI, cur: r.max - r.used, max: r.max, reset: "long" }; e.act = { a: "useRes", i: luckI };
        e.cost = e.name === "Luck Points" ? "Other" : e.cost === "Passive" ? "Other" : e.cost;
        e.block = r.max - r.used <= 0 ? "No Luck Points left. They come back on a long rest." : "";
      }
      if (!featKids.has(fname)) featKids.set(fname, []);
      if (e.src !== "Feat") { e.sub = subOf(app, c, d, e); featKids.get(fname).push(e); }
      return;
    }
    e.sub = subOf(app, c, d, e);
    out.push(e);
  });
  const L = app.library;
  featKids.forEach((kids, name) => {
    const f = findFeat(L.feats, name);
    out.push({ id: "feat:" + name, name, cost: "Feat", src: "Feat", type: "feat", kind: "Trait", block: "", kids,
      sub: kids.length ? `${kids.length} abilit${kids.length === 1 ? "y" : "ies"}` : gist(f && f.text),
      detail: { kind: "feat", name }, text: f ? f.text : "" });
  });
  // Swap weapon and the Starry Form arrow
  const ws = weaponsOf(c);
  if (ws.length) {
    const cur = ws.find(w => w.id === wid);
    out.push({ id: "x:swap", name: "Swap weapon", cost: "Bonus", src: "Attack", type: "attack", kind: "Ability",
      block: turnBlock(c, turn, "Bonus", false) || (ws.length < 2 ? "No other weapon in your bag." : ""),
      act: { a: "openSwap" }, sub: `In hand: ${cur ? cur.name : "nothing"}`,
      text: "Draw a different weapon from your bag as a Bonus Action. You can only attack with the weapon in your hand." });
  }
  const si = d.spellInfo;
  if (si && starryOn(c)) {
    const dice = c.level >= 10 ? "2d8" : "1d8";
    out.push({ id: "x:archer", name: "Luminous Arrow", cost: "Bonus", src: "Starry Form", type: "attack", kind: "Ability",
      block: turnBlock(c, turn, "Bonus", false), act: { a: "starryArrow" },
      sub: `${fmtMod(si.attackBonus)} ranged spell attack \u00b7 ${dice}${si.mod ? "+" + si.mod : ""} radiant \u00b7 60 ft`,
      text: "Archer constellation: make a ranged spell attack. On a hit it deals radiant damage." });
  }
  (c.inventory || []).forEach(it => {
    if (!USABLE_ITEM(it)) return;
    const cat = itemCategory(it), qty = it.qty || 0;
    if (qty <= 0) return;
    const cost = cat === "potion" ? "Bonus" : "Action";
    out.push({ id: "i:" + it.id, name: it.name, cost, src: cat === "potion" ? "Potion" : cat === "scroll" ? "Scroll" : "Wand", type: "item", kind: "Ability",
      block: turnBlock(c, turn, cost, false), res: { cur: qty, max: null, label: "left" },
      text: it.notes || (cat === "potion" ? "Drinking a potion takes a Bonus Action." : "Uses the action its spell needs."), act: { a: "useItem", id: it.id }, itemId: it.id,
      sub: healingFormula(it.name) ? `Heals ${healingFormula(it.name)}` : gist(it.notes) });
  });
  STD.forEach(s => out.push({ id: "std:" + s.id, name: s.name, cost: s.cost, src: "Standard", type: "std", kind: "Ability", block: turnBlock(c, turn, s.cost, false), text: s.text, act: null, sub: gist(s.text) }));
  return out;
}

// Features gained at each level, from the class and subclass tables.
export function levelTrack(app, c) {
  const L = app.library;
  const cls = findByName(L.classes, c.class), sub = c.subclass ? findByName(L.subclasses, c.subclass) : null;
  const hide = optionNames(cls), group = optionGroup(cls);
  void group;
  const rows = [];
  ((cls && cls.features) || []).filter(f => !hide.has(f.name)).forEach(f => rows.push({ lv: f.lv, name: f.name, kind: "classFeature", from: c.class }));
  ((sub && sub.features) || []).filter(f => !f.intro).forEach(f => rows.push({ lv: f.lv, name: f.name, kind: "subclassFeature", from: c.subclass }));
  const by = {};
  rows.forEach(r => { (by[r.lv] = by[r.lv] || []).push(r); });
  const max = Math.max(20, c.level), ord = n => ["", "1st", "2nd", "3rd"][n] || n + "th";
  let prev = { pb: 0, cantrips: 0, prepared: 0, top: 0 };
  return Array.from({ length: max }, (_, i) => {
    const lv = i + 1, pb = pbOf(lv), tc = tableCounts(cls, lv) || {};
    const slots = slotRows(c.class, lv), top = slots.length ? Math.max(...slots.map(r => r.level)) : 0;
    const cantrips = tc.cantrips || 0, prepared = tc.prepared || 0;
    const pbUp = prev.pb && pb > prev.pb, newSlot = top > prev.top ? top : 0;
    const spellUp = (cantrips > prev.cantrips && prev.cantrips > 0) || (prepared > prev.prepared && prev.prepared > 0) || !!newSlot;
    const extra = [`Proficiency bonus +${pb}${pbUp ? " (up)" : ""}`];
    if (cantrips) extra.push(`Cantrips known ${cantrips}${prev.cantrips && cantrips > prev.cantrips ? " (+" + (cantrips - prev.cantrips) + ")" : ""}`);
    if (prepared) extra.push(`Prepared spells ${prepared}${prev.prepared && prepared > prev.prepared ? " (+" + (prepared - prev.prepared) + ")" : ""}`);
    if (newSlot) extra.push(`New: ${ord(newSlot)}-level spell slots`);
    if (slots.length) extra.push("Slots " + slots.map(r => `${ord(r.level)} \u00d7${r.max}`).join(", "));
    prev = { pb, cantrips, prepared, top };
    return { lv, features: by[lv] || [], pb, pbUp: !!pbUp, spellUp, extra };
  });
}
