// Emblems for the creation screens: one drawing per choice, plus the accent hue, motion and
// falling-particle kind that go with it. Class, species and background names map to a drawing;
// names with no drawing get a monogram badge (never a made-up symbol). No DOM reads in here.
// ASCII only.
import { esc } from "./ui.js";

const IC = {
  druid: '<path d="M32 5C45 9 53 20 51 34 48 47 40 55 32 59 24 55 16 47 13 34 11 20 19 9 32 5Z"/><path d="M32 59V22M32 37l10-8M32 46l-10-8M32 31l-8-8"/>',
  human: '<circle cx="32" cy="20" r="9"/><path d="M11 57C11 41 21 34 32 34s21 7 21 23Z"/><path d="M26 19h12" opacity=".5"/>',
  elf: '<path d="M8 38 26 18C37 9 50 11 56 15 55 29 48 45 33 51 21 54 12 47 8 38Z"/><path d="M20 33 46 22"/><path d="M45 8l1.6 4 4 1.6-4 1.6L45 19l-1.6-3.8-4-1.6 4-1.6Z"/>',
  dwarf: '<path d="M9 22h42l6 5c-6 2-10 3-13 6v6h5v9H15v-9h7v-6c-3-3-9-4-13-6Z"/><path d="M26 10l-3-5M34 8V3M42 10l3-5"/>',
  halfling: '<circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="16"/><path d="M32 16v32M16 32h32" opacity=".45"/><circle cx="40" cy="33" r="2.4" fill="currentColor"/>',
  gnome: '<path d="M14 52C21 42 25 22 41 6c1 17 5 31 11 46Z"/><path d="M9 52h48"/><circle cx="41" cy="6" r="3"/><circle cx="32" cy="40" r="5"/><path d="M32 33v-3M32 50v-5M25 40h-3M42 40h-3" opacity=".7"/>',
  dragonborn: '<path d="M32 4c8 13 22 19 17 37-3 12-11 19-17 19S18 53 15 41C12 31 20 27 22 18c5 5 8 3 10-14Z"/><path d="M32 30c5 7 9 9 6 17-2 5-5 7-6 7s-4-2-6-7c-3-8 2-11 6-17Z"/>',
  tiefling: '<path d="M20 30C8 25 7 11 15 5c-1 9 4 15 12 19M44 30c12-5 13-19 5-25 1 9-4 15-12 19"/><path d="M19 29c0 17 6 28 13 28s13-11 13-28Z"/><path d="M26 38h2M36 38h2M28 48c3 2 5 2 8 0"/>',
  orc: '<path d="M15 24C15 8 49 8 49 24v13c0 12-8 19-17 19S15 49 15 37Z"/><path d="M25 46l-3-12 7 10M39 46l3-12-7 10"/><path d="M20 22l9 4M44 22l-9 4"/>',
  goliath: '<path d="M3 56 22 22l8 12 11-20 21 42Z"/><path d="M35 23l6-9 6 10M17 32l5-10 4 7" opacity=".6"/><path d="M8 20h8M50 8h6" opacity=".5"/>',
  acolyte: '<path d="M25 27h14v29H25Z"/><path d="M32 6c5 7 7 12 0 18-7-6-5-11 0-18Z"/><path d="M12 12l5 5M52 12l-5 5M8 28h6M50 28h6"/><path d="M20 56h24"/>',
  criminal: '<circle cx="21" cy="21" r="12"/><circle cx="21" cy="21" r="4"/><path d="M30 30l24 24M45 45l6-6M38 38l6-6"/>',
  guide: '<circle cx="32" cy="32" r="26"/><path d="M32 9l7 23-7 23-7-23Z"/><path d="M32 9l7 23H25Z" fill="currentColor"/><path d="M32 4v4M32 56v4M4 32h4M56 32h4"/>',
  hermit: '<path d="M26 12h12M27 12V8h10v4"/><path d="M22 15h20v35H22Z"/><path d="M22 50h20l-3 7H25Z"/><path d="M32 24c5 6 5 11 0 17-5-6-5-11 0-17Z"/>',
  noble: '<path d="M9 47V21l13 13 10-21 10 21 13-13v26Z"/><path d="M9 54h46"/><circle cx="32" cy="38" r="3"/>',
  sage: '<path d="M32 15C24 9 14 9 7 11v41c7-2 17-2 25 4 8-6 18-6 25-4V11c-7-2-17-2-25 4Z"/><path d="M32 15v41"/><path d="M14 20h12M14 27h12M38 20h12M38 27h12" opacity=".55"/>',
  sailor: '<circle cx="32" cy="10" r="5"/><path d="M32 15v42M20 25h24M11 41c0 10 10 16 21 16s21-6 21-16M11 41l-5 5M53 41l5 5"/>',
  soldier: '<path d="M32 5l21 7v20c0 13-10 21-21 27C21 53 11 45 11 32V12Z"/><path d="M32 16v30M23 26h18"/>',
  magician: '<path d="M18 58 40 18"/><circle cx="43" cy="13" r="8"/><path d="M43 7v12M37 13h12" opacity=".6"/><path d="M12 12l2 4 4 2-4 2-2 4-2-4-4-2 4-2ZM52 40l1.6 3.4L57 45l-3.4 1.6L52 50l-1.6-3.4L47 45l3.4-1.6Z"/>',
  warden: '<path d="M13 42C13 20 21 8 32 8s19 12 19 34v10H13Z"/><path d="M24 30h16M32 30v22"/><path d="M13 42h38" opacity=".5"/>',
  // classes
  barbarian: '<path d="M32 8v50"/><path d="M32 14C20 10 12 16 12 28c10 0 16-4 20-8M32 14c12-4 20 2 20 14-10 0-16-4-20-8"/>',
  bard: '<ellipse cx="26" cy="42" rx="15" ry="13" transform="rotate(-30 26 42)"/><circle cx="26" cy="42" r="3.5"/><path d="M35 33 54 10M50 6l8 8"/>',
  cleric: '<circle cx="32" cy="32" r="10"/><path d="M32 6v10M32 48v10M6 32h10M48 32h10M14 14l7 7M43 43l7 7M50 14l-7 7M21 43l-7 7"/>',
  fighter: '<path d="M8 8 46 46M56 8 18 46M38 54l16-16M26 54 10 38"/>',
  monk: '<path d="M32 6a26 26 0 1 0 0 52 13 13 0 0 1 0-26 13 13 0 0 0 0-26Z"/><circle cx="32" cy="19" r="3"/><circle cx="32" cy="45" r="3"/>',
  paladin: '<path d="M32 5l21 7v20c0 13-10 21-21 27C21 53 11 45 11 32V12Z"/><path d="M32 18l3 9 9 3-9 3-3 9-3-9-9-3 9-3Z"/>',
  ranger: '<path d="M16 6C38 14 38 50 16 58"/><path d="M16 6v52M16 32h40M49 25l7 7-7 7"/>',
  rogue: '<path d="M32 4l7 32H25Z"/><path d="M19 36h26M32 36v14"/><circle cx="32" cy="55" r="3.5"/>',
  sorcerer: '<circle cx="32" cy="32" r="9"/><path d="M32 4v14M32 46v14M4 32h14M46 32h14M12 12l10 10M42 42l10 10M52 12 42 22M22 42 12 52"/>',
  warlock: '<path d="M32 5 59 55H5Z"/><path d="M17 42c9-11 21-11 30 0-9 10-21 10-30 0Z"/><circle cx="32" cy="42" r="4"/>',
  wizard: '<path d="M8 50h48"/><path d="M15 50C19 35 26 20 41 5c-2 14 2 31 9 45"/><path d="M29 34l1.7 3.3 3.3 1.7-3.3 1.7L29 44l-1.7-3.3L24 39l3.3-1.7Z"/>',
  // shared extras for species and backgrounds
  moon: '<path d="M44 6a26 26 0 1 0 14 33A21 21 0 0 1 44 6Z"/><path d="M50 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/>',
  drop: '<path d="M32 5C42 20 52 28 52 40a20 20 0 0 1-40 0C12 28 22 20 32 5Z"/><path d="M22 42a10 10 0 0 0 8 9" opacity=".6"/>',
  wind: '<path d="M6 22h32a8 8 0 1 0-8-8M6 34h42a8 8 0 1 1-8 8M6 46h22"/>',
  paw: '<ellipse cx="32" cy="42" rx="13" ry="11"/><ellipse cx="14" cy="28" rx="4.5" ry="6"/><ellipse cx="26" cy="16" rx="4.5" ry="6.5"/><ellipse cx="38" cy="16" rx="4.5" ry="6.5"/><ellipse cx="50" cy="28" rx="4.5" ry="6"/>',
  feather: '<path d="M52 6C26 8 12 24 12 44c14 0 36-8 40-38Z"/><path d="M12 56 40 22M26 38l-4-10M34 30l-2-10"/>',
  scales: '<path d="M6 24a10 10 0 0 1 20 0M26 24a10 10 0 0 1 20 0M16 38a10 10 0 0 1 20 0M36 38a10 10 0 0 1 20 0M6 52a10 10 0 0 1 20 0M26 52a10 10 0 0 1 20 0"/>',
  gem: '<path d="M18 10h28l12 16-26 32L6 26Z"/><path d="M6 26h52M24 26l8 32 8-32M24 26l-6-16M40 26l6-16"/>',
  eye: '<path d="M4 32C14 16 50 16 60 32 50 48 14 48 4 32Z"/><circle cx="32" cy="32" r="9"/><circle cx="32" cy="32" r="3" fill="currentColor"/>',
  mask: '<path d="M10 12c14-6 30-6 44 0 2 18-4 36-22 44C14 48 8 30 10 12Z"/><path d="M20 26c3-3 7-3 10 0M34 26c3-3 7-3 10 0M24 42c5 4 11 4 16 0"/>',
  dice: '<path d="M12 12h40v40H12Z"/><circle cx="22" cy="22" r="3" fill="currentColor"/><circle cx="42" cy="22" r="3" fill="currentColor"/><circle cx="32" cy="32" r="3" fill="currentColor"/><circle cx="22" cy="42" r="3" fill="currentColor"/><circle cx="42" cy="42" r="3" fill="currentColor"/>',
  coin: '<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="16"/><path d="M32 22v20M27 26c0-3 10-3 10 0s-10 4-10 8 10 3 10 0"/>',
  wheat: '<path d="M32 58V14"/><path d="M32 22c-8 0-10-6-10-12 7 0 10 4 10 12ZM32 22c8 0 10-6 10-12-7 0-10 4-10 12ZM32 36c-8 0-10-6-10-12 7 0 10 4 10 12ZM32 36c8 0 10-6 10-12-7 0-10 4-10 12ZM32 50c-8 0-10-6-10-12 7 0 10 4 10 12ZM32 50c8 0 10-6 10-12-7 0-10 4-10 12Z"/>',
  rune: '<path d="M32 6v52M32 14l14 12-14 10M32 36l-12 10"/><circle cx="32" cy="32" r="26" opacity=".35"/>',
  star: '<path d="M32 4l6 18 18 6-18 6-6 18-6-18-18-6 18-6Z"/>'
};

// name -> [icon, hue, motion, particles]
const CLASSES = {
  Barbarian: ["barbarian", 8, "shake", "embers"], Bard: ["bard", 300, "float", "motes"], Cleric: ["cleric", 48, "pulse", "motes"],
  Druid: ["druid", 125, "sway", "leaves"], Fighter: ["fighter", 20, "shake", "sparks"], Monk: ["monk", 190, "spin", "motes"],
  Paladin: ["paladin", 42, "pulse", "motes"], Ranger: ["ranger", 100, "sway", "leaves"], Rogue: ["rogue", 268, "shake", "ash"],
  Sorcerer: ["sorcerer", 340, "flick", "embers"], Warlock: ["warlock", 285, "twink", "stars"], Wizard: ["wizard", 215, "twink", "stars"]
};
const SPECIES = {
  Human: ["human", 38, "float", "motes"], Elf: ["elf", 160, "sway", "stars"], Dwarf: ["dwarf", 28, "hammer", "sparks"], Halfling: ["halfling", 88, "pulse", "motes"],
  Gnome: ["gnome", 318, "twink", "motes"], Dragonborn: ["dragonborn", 6, "flick", "embers"], Tiefling: ["tiefling", 300, "flick", "embers"], Orc: ["orc", 142, "pulse", "ash"],
  Goliath: ["goliath", 205, "rock", "snow"]
};
const BACKGROUNDS = {
  Acolyte: ["acolyte", 48, "flick", "motes"], Criminal: ["criminal", 268, "shake", "ash"], Guide: ["guide", 120, "spin", "leaves"], Hermit: ["hermit", 170, "flick", "motes"],
  Noble: ["noble", 290, "float", "stars"], Sage: ["sage", 215, "twink", "stars"], Sailor: ["sailor", 195, "swing", "bubbles"], Soldier: ["soldier", 12, "shake", "sparks"]
};
// Names the app has no hand-picked drawing for: match on the name, else show a monogram.
const SP_RULES = [
  [/aasimar|ardling|kalashtar/, "star", 52], [/elf|eladrin|altmer|bosmer|dunmer|dryad|satyr|firbolg|shadar|fey|sprite|pixie|tiradhel/, "elf", 160],
  [/shadar-kai|dhampir|vampire|dunmer/, "moon", 262], [/dragon|kobold/, "dragonborn", 6], [/lizard|argonian|yuan|naga|snake|medusa/, "scales", 135],
  [/orc|orsimer|goblin|bugbear|hobgoblin|troll|ogre/, "orc", 142], [/minotaur|tiefling|devil|demon/, "tiefling", 330],
  [/dwarf|duergar|deepborn/, "dwarf", 28], [/gnome/, "gnome", 318], [/halfling/, "halfling", 88], [/goliath|giant/, "goliath", 205],
  [/genasi \(fire\)|fire/, "dragonborn", 16], [/genasi \(water\)|water|locathah|merfolk|triton|sea/, "drop", 200], [/genasi \(air\)|air|aarakocra/, "wind", 190],
  [/genasi \(earth\)|earth/, "goliath", 30], [/gith|kalashtar|mind/, "eye", 275], [/khajiit|tabaxi|leonin|shifter|ratfolk|simian|lion|cat/, "paw", 32],
  [/kenku|raven|owl|bird/, "feather", 220], [/azurite|crystal|gem/, "gem", 190], [/human|breton|imperial|nord|redguard|reachmen|yuan|maormer/, "human", 38]
];
const BG_RULES = [
  [/acolyte|cultist|heretic|grave|pilgrim|mythalkeeper|tender/, "acolyte", 48], [/criminal|bounty|exterminator|executioner|spy|smuggler|prisoner|raider|freebooter/, "criminal", 268],
  [/guide|explorer|pioneer|wayfarer|rashemi|archaeolog|anthropolog|tomb|caretaker|hunter/, "guide", 120], [/hermit|amnesiac|dweller|refugee|beggar|begger/, "hermit", 170],
  [/noble|courtier|envoy|vassal|squire|chapter|knight/, "noble", 290], [/sage|scribe|scholar|apprentice|witness|experiment|feywild|shadowfell|genie|touched|expert/, "sage", 215],
  [/sailor|pirate|fisher|marine/, "sailor", 195], [/soldier|guard|mercenary|fist|pit fighter|folk hero|veteran/, "soldier", 12],
  [/entertainer|carouser|actor|performer|harper/, "bard", 300], [/charlatan/, "mask", 320], [/gambler/, "dice", 145], [/farmer|innkeeper/, "wheat", 70],
  [/merchant|artisan/, "coin", 42], [/cook|gourmet|physician/, "cleric", 150]
];

function hashHue(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return (h * 137) % 360; }
const MOS = ["float", "pulse", "twink", "sway"], AMBS = ["motes", "stars", "embers", "leaves"];

export function emblemFor(kind, name) {
  const table = kind === "class" ? CLASSES : kind === "species" ? SPECIES : BACKGROUNDS;
  if (table[name]) { const [icon, hue, mo, amb] = table[name]; return { icon, hue, mo, amb, known: true }; }
  const n = String(name || "").toLowerCase(), rules = kind === "species" ? SP_RULES : kind === "background" ? BG_RULES : [];
  const hit = rules.find(r => r[0].test(n));
  const h = hashHue(n);
  if (hit && IC[hit[1]]) return { icon: hit[1], hue: hit[2], mo: MOS[h % 4], amb: AMBS[(h >> 3) % 4], known: true };
  return { icon: null, hue: h, mo: "", amb: AMBS[h % 4], known: false };
}
export const ORDER_EMBLEM = { Magician: ["magician", 215, "twink", "stars"], Warden: ["warden", 25, "rock", "leaves"] };

// kind: "class" | "species" | "background". opts: { motion: true, cls: "extra classes" }
export function emblem(kind, name, opts = {}) {
  const e = emblemFor(kind, name), cls = "em" + (opts.motion && e.mo ? " mo-" + e.mo : "") + (opts.cls ? " " + opts.cls : "");
  if (!e.icon) return `<span class="${cls} mono" style="--eh:${e.hue}" aria-hidden="true"><b>${esc((name || "?").trim()[0] || "?")}</b></span>`;
  return `<span class="${cls}" style="--eh:${e.hue}" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${IC[e.icon]}</svg></span>`;
}
export function emblemIcon(key, hue, opts = {}) {
  return `<span class="em${opts.motion && opts.mo ? " mo-" + opts.mo : ""}" style="--eh:${hue}" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${IC[key] || IC.rune}</svg></span>`;
}
export const hasEmblemIcon = k => !!IC[k];
