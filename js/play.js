// Play Mode data: everything a character can do on a turn, from every source
// (features, attacks, spells, items) plus the standard actions every character
// has. Builds on combat.js so the costs, blocks and resources stay in one place.
// The standard-action wording below is a short summary, not rules text.
import { buildCombat, turnBlock } from "./combat.js";
import { itemCategory } from "./gear.js";
import { findByName } from "./data.js";
import { optionNames, optionGroup } from "./progression.js";

export const SOURCES = [["feature", "Features"], ["attack", "Attacks"], ["spell", "Spells"], ["item", "Items"], ["std", "Standard actions"]];
export const DEFAULT_SHOW = { feature: true, attack: true, spell: true, item: true, std: false };

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

export function playEntries(app, c, d) {
  const out = buildCombat(app, c, d).map(e => ({ ...e, type: e.type || "feature" }));
  const turn = app.turn;
  (c.inventory || []).forEach(it => {
    const cat = itemCategory(it);
    if (cat !== "potion" && cat !== "scroll") return;
    const cost = cat === "potion" ? "Bonus" : "Action", qty = it.qty || 0;
    let block = turnBlock(c, turn, cost, false);
    if (!block && qty <= 0) block = "None left.";
    out.push({ id: "i:" + it.id, name: it.name, cost, src: cat === "potion" ? "Potion" : "Scroll", type: "item", kind: "Ability", block,
      res: { cur: qty, max: null, label: "left" }, text: it.notes || (cat === "potion" ? "Drinking a potion takes a Bonus Action." : "Reading a scroll takes the action its spell needs."),
      act: { a: "useItem", id: it.id }, itemId: it.id });
  });
  STD.forEach(s => out.push({ id: "std:" + s.id, name: s.name, cost: s.cost, src: "Standard", type: "std", kind: "Ability", block: turnBlock(c, turn, s.cost, false), text: s.text, act: null }));
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
  const max = Math.max(20, c.level);
  return Array.from({ length: max }, (_, i) => ({ lv: i + 1, features: by[i + 1] || [] }));
}
