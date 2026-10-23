// DM editor data layer: PIN check, the local patch, per-kind templates,
// and applyPatch (also used by tools/apply-dm.mjs). ASCII-only on purpose.
// A patch is { kind: { add: [entry], edit: { originalKey: entry }, remove: [key] } }.
// The key is the entry name (subclasses: "Class|Name").

const LS = "dnd-dm-v1";
const PIN_HASH = "7ce6f95c9c45bcae1b3c7b047f70ab5dc9cf23c61127b753a8f077c63af6cd3f";
export const NEW_SRC = "Homebrew";

export async function checkPin(pin) {
  const b = new TextEncoder().encode("cr-dm-v1:" + String(pin).trim());
  const h = await crypto.subtle.digest("SHA-256", b);
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, "0")).join("") === PIN_HASH;
}

export const emptyPatch = () => ({});
export function loadPatch() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
export function savePatch(p) { try { localStorage.setItem(LS, JSON.stringify(p)); return true; } catch (e) { return false; } }
export const patchCount = p => Object.values(p || {}).reduce((n, k) => n + (k.add || []).length + Object.keys(k.edit || {}).length + (k.remove || []).length, 0);

const ABIL = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
const SKILLS = ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"];
const SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];

// t: text | num | area | code | csv | bool | select | list
export const SCHEMA = {
  species: { label: "Species", one: "species", enabled: true, fields: [
    { k: "name", label: "Name", t: "text" },
    { k: "source", label: "Source", t: "text" },
    { k: "desc", label: "Short description", t: "area", rows: 3 },
    { k: "traits", label: "Facts and traits", t: "area", rows: 16, hint: "One paragraph per trait: 'Trait Name. What it does.' Start with the fact lines (Creature Type, Size, Speed). Choices like 'Choose one: ...' are picked up automatically." }] },
  classes: { label: "Classes", one: "class", enabled: true, fields: [
    { k: "name", label: "Name", t: "text" }, { k: "source", label: "Source", t: "text" },
    { k: "hd", label: "Hit die (number of sides)", t: "num" },
    { k: "primary", label: "Primary ability", t: "text" },
    { k: "saves", label: "Saving throws (comma separated)", t: "csv" },
    { k: "skillN", label: "Number of skills to pick", t: "num" },
    { k: "skillFrom", label: "Skill choices (comma separated)", t: "csv", hint: SKILLS.join(", ") },
    { k: "armorProf", label: "Armor training", t: "text" }, { k: "weaponProf", label: "Weapon proficiency", t: "text" }, { k: "toolProf", label: "Tool proficiency", t: "text" },
    { k: "equipment", label: "Starting equipment", t: "area", rows: 3 },
    { k: "desc", label: "Description", t: "area", rows: 4 },
    { k: "core", label: "Core traits text", t: "area", rows: 6 },
    { k: "table", label: "Class table (monospace, columns separated by spaces)", t: "code", rows: 12, hint: "First line is the header: Level, Proficiency Bonus (or Prof), Features, then your own columns. One row per level." },
    { k: "features", label: "Features", t: "list", cols: [{ k: "lv", label: "Level", t: "num" }, { k: "name", label: "Name", t: "text" }, { k: "src", label: "Source", t: "text" }, { k: "text", label: "Text", t: "area", rows: 5 }] }] },
  subclasses: { label: "Subclasses", one: "subclass", fields: [
    { k: "cls", label: "Class", t: "select", from: "classes" },
    { k: "name", label: "Name", t: "text" }, { k: "source", label: "Source", t: "text" },
    { k: "features", label: "Features", t: "list", cols: [{ k: "lv", label: "Level", t: "num" }, { k: "name", label: "Name", t: "text" }, { k: "src", label: "Source", t: "text" }, { k: "text", label: "Text", t: "area", rows: 5 }] }] },
  backgrounds: { label: "Backgrounds", one: "background", enabled: true, fields: [
    { k: "name", label: "Name", t: "text" },
    { k: "abilities", label: "Ability scores (3, comma separated)", t: "csv", hint: ABIL.join(", ") },
    { k: "feat", label: "Origin feat (exact name)", t: "text" },
    { k: "skills", label: "Skill proficiencies (2, comma separated)", t: "csv" },
    { k: "tool", label: "Tool proficiency", t: "text" },
    { k: "effect", label: "Rules block", t: "area", rows: 6, hint: "Ability Scores: ... / Feat: ... / Skill Proficiencies: ... / Tool Proficiency: ... / Equipment: ..." },
    { k: "desc", label: "Flavor text", t: "area", rows: 4 }] },
  feats: { label: "Feats", one: "feat", enabled: true, fields: [
    { k: "name", label: "Name", t: "text" }, { k: "source", label: "Source", t: "text" },
    { k: "type", label: "Type line", t: "text", hint: "Origin Feat | General Feat (Prerequisite: Level 4+) | Fighting Style Feat | Epic Boon Feat (Prerequisite: Level 19+)" },
    { k: "text", label: "Rules text", t: "area", rows: 12, hint: "Benefits as 'Name. text' paragraphs. 'Ability Score Increase.' is read for the +1 choice." }] },
  spells: { label: "Spells", one: "spell", enabled: true, fields: [
    { k: "name", label: "Name", t: "text" }, { k: "level", label: "Level (0 = cantrip)", t: "num" },
    { k: "school", label: "School", t: "select", opts: SCHOOLS },
    { k: "time", label: "Casting time", t: "text" }, { k: "range", label: "Range", t: "text" },
    { k: "comp", label: "Components", t: "text", hint: "V, S, M (what the material is)" }, { k: "dur", label: "Duration", t: "text" },
    { k: "conc", label: "Concentration", t: "bool" }, { k: "ritual", label: "Ritual", t: "bool" },
    { k: "classes", label: "Classes (comma separated)", t: "csv" }, { k: "source", label: "Source", t: "text" },
    { k: "text", label: "Rules text", t: "area", rows: 10, hint: "First line: 'Evocation Cantrip' or '3rd-level Evocation'. Then the description. Add 'Using a Higher-Level Spell Slot.' or 'Cantrip Upgrade.' paragraphs if needed." }] },
  weapons: { label: "Weapons", one: "weapon", fields: [
    { k: "name", label: "Name", t: "text" }, { k: "cat", label: "Category", t: "select", opts: ["Simple", "Martial"] },
    { k: "kind", label: "Melee or ranged", t: "select", opts: ["Melee", "Ranged"] },
    { k: "dice", label: "Damage dice", t: "text", hint: "1d8" }, { k: "dtype", label: "Damage type", t: "text" },
    { k: "mastery", label: "Mastery property", t: "text" }, { k: "props", label: "Properties", t: "text", hint: "Light, Finesse, Thrown (Range 20/60)" }] },
  items: { label: "Items", one: "item", fields: [
    { k: "name", label: "Name", t: "text" }, { k: "type", label: "Type", t: "text", hint: "Mundane Item | Potion, Common | Wondrous Item | Ring | Weapon (Longsword) | Armor (Plate Armor)" },
    { k: "price", label: "Price in copper (100 = 1 gp)", t: "num" }, { k: "priceTxt", label: "Price as shown", t: "text" },
    { k: "base", label: "Base price in copper", t: "num" }, { k: "slots", label: "Inventory slots", t: "text" },
    { k: "source", label: "Source", t: "text" }, { k: "text", label: "Description", t: "area", rows: 8 }] },
  rules: { label: "Rules glossary", one: "rule", fields: [
    { k: "name", label: "Term", t: "text" }, { k: "text", label: "Text", t: "area", rows: 8 }] }
};
export const KIND_ORDER = ["species", "classes", "subclasses", "backgrounds", "feats", "spells", "weapons", "items", "rules"];

const TEMPLATES = {
  species: () => ({ name: "", source: NEW_SRC, desc: "", traits: "Creature Type: Humanoid\n\nSize: Medium (about 5-7 feet tall)\n\nSpeed: 30 feet\n\nFirst Trait. Describe what it does, how often it can be used, and any save DC.\n\nSecond Trait. Describe it here." }),
  classes: () => ({ name: "", source: NEW_SRC, hd: 8, primary: "", saves: [], skillN: 2, skillFrom: [], armorProf: "", weaponProf: "Simple weapons", toolProf: "", equipment: "Choose A or B: (A) ..., (B) 100 GP", desc: "", core: "Primary Ability: \n\nHit Point Die:\nD8 per level\n\nSaving Throw Proficiencies: ", table: "Level  Proficiency Bonus  Features\n1      +2                 \n2      +2                 \n3      +2                 ", features: [{ lv: 1, name: "", src: NEW_SRC, text: "" }] }),
  subclasses: () => ({ cls: "", name: "", source: NEW_SRC, features: [{ lv: 3, name: "", src: NEW_SRC, text: "" }] }),
  backgrounds: () => ({ name: "", abilities: [], feat: "", skills: [], tool: "", effect: "Ability Scores: \n\nFeat: \n\nSkill Proficiencies: \n\nTool Proficiency: \n\nEquipment: ", desc: "" }),
  feats: () => ({ name: "", source: NEW_SRC, type: "General Feat (Prerequisite: Level 4+)", text: "" }),
  spells: () => ({ name: "", level: 1, school: "Evocation", time: "Action", range: "60 feet", comp: "V, S", dur: "Instantaneous", conc: 0, ritual: 0, classes: [], source: NEW_SRC, text: "1st-level Evocation\n" }),
  weapons: () => ({ name: "", cat: "Martial", kind: "Melee", dice: "1d8", dtype: "Slashing", mastery: "", props: "" }),
  items: () => ({ name: "", type: "Wondrous Item", price: 0, priceTxt: "", base: 0, slots: "1", source: NEW_SRC, text: "" }),
  rules: () => ({ name: "", text: "" })
};
export const template = kind => TEMPLATES[kind]();
export const keyOf = (kind, e) => kind === "subclasses" ? (e.cls || "") + "|" + (e.name || "") : (e.name || "");
export const labelOf = (kind, e) => kind === "subclasses" ? `${e.name} (${e.cls})` : e.name;

// Check an entry before saving. Returns a message or "".
export function validate(kind, e, lib, patch, origKey) {
  if (!String(e.name || "").trim()) return "Give it a name.";
  if (kind === "subclasses" && !e.cls) return "Pick the class this subclass belongs to.";
  const k = keyOf(kind, e);
  if (k !== origKey) {
    const p = (patch && patch[kind]) || {};
    const taken = (lib[kind] || []).some(x => keyOf(kind, x) === k && !(p.remove || []).includes(k)) || (p.add || []).some(x => keyOf(kind, x) === k);
    if (taken) return "There is already an entry with that name.";
  }
  if (kind === "spells" && !/\S/.test(e.text || "")) return "Spells need rules text.";
  return "";
}

// Pure: returns { library, campaign } with the patch folded in.
export function applyPatch(lib, camp, patch) {
  if (!patch || !patchCount(patch)) return { library: lib, campaign: camp };
  const L = { ...lib }, C = JSON.parse(JSON.stringify(camp || {}));
  for (const kind of Object.keys(patch)) {
    const p = patch[kind]; if (!SCHEMA[kind]) continue;
    const gone = new Set(p.remove || []), ed = p.edit || {};
    const en = SCHEMA[kind].enabled && C.enabled && C.enabled[kind];
    let out = (lib[kind] || []).filter(x => !gone.has(keyOf(kind, x))).map(x => {
      const k = keyOf(kind, x), n = ed[k];
      if (n && en && n.name !== x.name) { const i = en.indexOf(x.name); if (i >= 0) en[i] = n.name; }
      return n || x;
    });
    const have = new Set(out.map(x => keyOf(kind, x)));
    for (const a of p.add || []) { if (!have.has(keyOf(kind, a))) { out.push(a); if (en && !en.includes(a.name)) en.push(a.name); } }
    L[kind] = out;
  }
  return { library: L, campaign: C };
}
