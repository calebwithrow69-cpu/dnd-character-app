// Gives every subclass a quiet personality: one tone (a hue, a sigil, a faint
// texture and a short flourish). The tone is the app's own reading of the
// subclass's rules text and class; a subclass entry can override it with
// `tone: "fire"` in the rules file (or the DM editor). ASCII only in this file.

const P = d => `<path pathLength="1" d="${d}"/>`, C = (x, y, r) => `<circle pathLength="1" cx="${x}" cy="${y}" r="${r}"/>`, L = (a, b, c, d) => `<line pathLength="1" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`;

export const TONES = {
  blood:    { word: "Blood",    h: 2,   tex: "hatch", fx: "ember",  sig: P("M26 14C34 36 38 62 32 90") + P("M46 10C56 34 60 64 54 92") + P("M66 14C74 36 78 62 72 88") + P("M14 22C22 44 26 66 20 88") },
  song:     { word: "Song",     h: 292, tex: "dots",  fx: "spark",  sig: P("M30 82C18 70 18 36 34 22") + P("M70 82C82 70 82 36 66 22") + P("M34 22C44 14 56 14 66 22") + L(40, 30, 40, 78) + L(50, 26, 50, 82) + L(60, 30, 60, 78) + P("M30 82H70") },
  radiant:  { word: "Radiant",  h: 44,  tex: "rays",  fx: "ray",    sig: C(50, 50, 16) + L(50, 8, 50, 24) + L(50, 76, 50, 92) + L(8, 50, 24, 50) + L(76, 50, 92, 50) + L(20, 20, 32, 32) + L(68, 68, 80, 80) + L(80, 20, 68, 32) + L(32, 68, 20, 80) + L(50, 42, 50, 58) + L(42, 50, 58, 50) },
  nature:   { word: "Nature",   h: 128, tex: "dots",  fx: "leaf",   sig: P("M20 82C16 44 40 18 82 18C84 60 62 84 20 82Z") + P("M20 82C34 62 50 46 70 32") + P("M40 66L40 50M52 56L52 42M30 74L26 62") },
  steel:    { word: "Steel",    h: 226, tex: "hatch", fx: "spark",  sig: P("M50 10L84 22V50C84 70 68 84 50 92C32 84 16 70 16 50V22Z") + P("M32 44L50 58L68 44") + P("M32 58L50 72L68 58") },
  ki:       { word: "Ki",       h: 350, tex: "waves", fx: "ripple", sig: P("M50 8A42 42 0 1 1 18 24") + C(50, 50, 5) + P("M50 28V38M50 62V72M28 50H38M62 50H72") },
  holy:     { word: "Holy",     h: 200, tex: "rays",  fx: "ray",    sig: C(50, 16, 10) + L(50, 26, 50, 90) + P("M36 44H64") + P("M26 90H74") + P("M30 56C22 50 18 40 20 32M70 56C78 50 82 40 80 32") },
  wild:     { word: "Wild",     h: 70,  tex: "dots",  fx: "leaf",   sig: C(50, 50, 28) + L(50, 10, 50, 36) + L(50, 64, 50, 90) + L(10, 50, 36, 50) + L(64, 50, 90, 50) + C(50, 50, 3) },
  shadow:   { word: "Shadow",   h: 172, tex: "hatch", fx: "smoke",  sig: C(32, 32, 16) + C(32, 32, 6) + P("M44 44L86 86") + P("M72 72L82 62M80 80L90 70") },
  fire:     { word: "Fire",     h: 24,  tex: "waves", fx: "ember",  sig: P("M8 56C26 28 74 28 92 56C74 84 26 84 8 56Z") + P("M50 36C42 46 42 66 50 76C58 66 58 46 50 36Z") + P("M50 8C44 16 56 20 50 28") },
  infernal: { word: "Infernal", h: 330, tex: "hatch", fx: "ember",  sig: P("M18 14C10 34 20 50 34 56") + P("M82 14C90 34 80 50 66 56") + P("M34 56L50 92L66 56Z") + P("M40 70L50 64L60 70") },
  arcane:   { word: "Arcane",   h: 252, tex: "dots",  fx: "spark",  sig: C(50, 50, 44) + P("M56 12L32 54H50L44 88L70 44H52Z") },
  storm:    { word: "Storm",    h: 206, tex: "rays",  fx: "spark",  sig: P("M30 60C16 60 14 40 30 38C32 22 62 20 66 38C84 36 86 60 70 60Z") + P("M54 60L42 80H56L48 94") },
  frost:    { word: "Frost",    h: 186, tex: "dots",  fx: "spark",  sig: L(50, 10, 50, 90) + L(15, 30, 85, 70) + L(15, 70, 85, 30) + P("M42 18L50 26L58 18") + P("M42 82L50 74L58 82") },
  grave:    { word: "Grave",    h: 150, tex: "hatch", fx: "smoke",  sig: P("M24 52C24 28 76 28 76 52C76 62 70 66 66 68V80H34V68C30 66 24 62 24 52Z") + C(38, 52, 6) + C(62, 52, 6) + L(46, 80, 46, 70) + L(54, 80, 54, 70) },
  mind:     { word: "Mind",     h: 270, tex: "waves", fx: "ripple", sig: C(50, 50, 44) + P("M50 50C50 44 56 44 56 50C56 60 42 60 42 50C42 38 62 38 62 50C62 68 34 68 34 50") },
  poison:   { word: "Venom",    h: 92,  tex: "waves", fx: "smoke",  sig: P("M50 10C50 10 22 44 22 62C22 78 34 90 50 90C66 90 78 78 78 62C78 44 50 10 50 10Z") + P("M38 64C38 72 44 78 52 78") }
};

const CLASS_TONE = { Barbarian: "blood", Bard: "song", Cleric: "radiant", Druid: "nature", Fighter: "steel", Monk: "ki", Paladin: "holy",
  Ranger: "wild", Rogue: "shadow", Sorcerer: "arcane", Warlock: "infernal", Wizard: "arcane" };

// [tone, pattern, weight per match]
const HINTS = [
  ["blood", /\b(frenzy|berserk\w*|bloodied|blood|crimson|reckless|savage|brutal|slaughter|wrath\w*)\b/g, 2],
  ["song", /\b(bardic inspiration|song|songs|music\w*|perform\w*|jest\w*|dance|harmony|lyric\w*)\b/g, 2],
  ["radiant", /\b(radiant|sunlight|dawn|daylight|solar|sun|light|life|healing|spellfire)\b/g, 2],
  ["holy", /\b(sacred|holy|celestial|angel\w*|divine sense|oath)\b/g, 2],
  ["nature", /\b(plants?|beasts?|natural|wild shape|forest|moon\w*|spores?|animals?|vines?|grove|druidic)\b/g, 2],
  ["wild", /\b(hunter\w*|prey|tracker|survival|favored enemy|stalk\w*)\b/g, 2],
  ["fire", /\b(fire|flames?|burn\w*|dragon\w*|ember\w*|inferno|scorch\w*)\b/g, 3],
  ["infernal", /\b(fiend\w*|infernal|devils?|demons?|hell\w*|abyss\w*)\b/g, 3],
  ["storm", /\b(lightning|thunder\w*|storms?|tempest|wind|gale)\b/g, 3],
  ["frost", /\b(cold|frost\w*|ice|winter|snow|freez\w*)\b/g, 3],
  ["grave", /\b(necrotic|undead|grave\w*|skeleton\w*|corpses?|reaper|zombies?|barrow|wrathful dead)\b/g, 3],
  ["shadow", /\b(shadows?|darkness|stealth|assassin\w*|invisible|umbral|night)\b/g, 2],
  ["mind", /\b(psychic|telepath\w*|thoughts?|dreams?|psionic|mental|aberrant)\b/g, 3],
  ["poison", /\b(poison\w*|venom\w*|acid\w*|toxic|plague)\b/g, 3],
  ["ki", /\b(ki|martial arts|unarmored movement|flurry of blows|stunning strike)\b/g, 1],
  ["arcane", /\b(arcane|spellbook|cantrips?|evocation|abjuration|illusion|conjuration|divination|enchantment|transmutation)\b/g, 1],
  ["steel", /\b(weapons?|armor|maneuvers?|fighting style|battle|shield)\b/g, 0.4]
];

// The subclass's own name settles it when it names a theme outright.
const NAME_TONE = [
  [/evoker/, "fire"], [/illusion|enchanter|diviner/, "mind"], [/transmuter/, "nature"], [/necromancer/, "grave"], [/abjurer/, "steel"],
  [/arcana|eldritch|arcane|abjur|divin|evok|illusion|enchant|transmut|philosoph|daemonolog|bladesing|war ?mage|clockwork|ancestral sorcery|wild magic/, "arcane"],
  [/forge|rune knight/, "fire"], [/nature|harvest|green|land|beast|spores|wild heart|world tree/, "nature"],
  [/trickery|nightwatch|shadow|assassin|phantom|twilight/, "shadow"], [/war domain|champion|battle master|cavalier|banneret|samurai|gladiator|bulwark|dungeoneer/, "steel"],
  [/knowledge|order|peace|purification|life|light|mercy/, "radiant"], [/open hand|kensei|cosmic|elements|tattoo|street|intoxication/, "ki"],
  [/dance|glamour|lore|eloquence|valor|creation/, "song"], [/draconic|wildfire/, "fire"], [/stars/, "arcane"], [/archfey|fey wanderer/, "wild"]
];
const cache = new WeakMap();
const count = (re, t) => (t.match(re) || []).length;
export function toneFor(sc, className) {
  const base = CLASS_TONE[className || (sc && sc.cls)] || "steel";
  if (!sc) return { id: base, ...TONES[base] };
  if (cache.has(sc)) return cache.get(sc);
  let id = sc.tone && TONES[sc.tone] ? sc.tone : null;
  if (!id) { const n = String(sc.name || "").toLowerCase(); const m = NAME_TONE.find(r => r[0].test(n)); if (m) id = m[1]; }
  if (!id) {
    // the name counts most, then feature names, then the body text (capped)
    const name = String(sc.name || "").toLowerCase();
    const fnames = (sc.features || []).map(f => f.name || "").join(" ").toLowerCase();
    const body = (sc.features || []).map(f => f.text || "").join(" ").toLowerCase();
    const score = {}; score[base] = 3;
    for (const [t, re, w] of HINTS) {
      const v = (count(re, name) * 6 + count(re, fnames) * 3 + Math.min(count(re, body), 3) * 0.7) * w / 2;
      if (v) score[t] = (score[t] || 0) + v;
    }
    id = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
    if (score[id] < 4) id = base;
  }
  const out = { id, ...TONES[id] };
  cache.set(sc, out);
  return out;
}

// One short flourish when a subclass is chosen: a ring, a pulse on the seal and a few particles.
export function flourish(root, fx, reduce) {
  if (reduce || !root) return;
  const pk = root.querySelector(".pick"), b = root.querySelector(".burst"), ring = root.querySelector(".ring"), seal = root.querySelector(".scpage .hero .seal") || root.querySelector(".hero .seal");
  if (!pk || !b || !pk.animate) return;
  const r = pk.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2, col = "hsl(var(--h) 70% 55%)";
  if (ring) { ring.style.left = cx + "px"; ring.style.top = cy + "px"; ring.animate([{ opacity: .9, transform: "scale(.4)" }, { opacity: 0, transform: "scale(3.2)" }], { duration: 650, easing: "ease-out" }); }
  if (seal) seal.animate([{ transform: "scale(1)" }, { transform: "scale(1.18) rotate(-6deg)" }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.3,1.6,.5,1)" });
  const n = fx === "ripple" ? 0 : fx === "ray" ? 10 : 14;
  for (let i = 0; i < n; i++) {
    const e = document.createElement("i"); let tx, ty, shape, dur = 550 + Math.random() * 250; const a = Math.random() * 6.28, d = 34 + Math.random() * 50;
    if (fx === "ember") { tx = Math.cos(a) * d * .8; ty = -30 - Math.random() * 60; shape = "width:5px;height:5px;border-radius:50%;box-shadow:0 0 6px " + col; }
    else if (fx === "spark") { tx = Math.cos(a) * d * 1.2; ty = Math.sin(a) * d * .7; shape = "width:2px;height:12px;transform:rotate(" + (a * 57) + "deg)"; }
    else if (fx === "leaf") { tx = (Math.random() - .5) * 110; ty = 20 + Math.random() * 50; shape = "width:9px;height:5px;border-radius:50%;transform:rotate(" + (Math.random() * 180) + "deg)"; }
    else if (fx === "smoke") { tx = (Math.random() - .5) * 90; ty = -20 - Math.random() * 40; shape = "width:22px;height:22px;border-radius:50%;filter:blur(7px);opacity:.5"; dur = 800; }
    else { tx = Math.cos(i / n * 6.28) * 60; ty = Math.sin(i / n * 6.28) * 38; shape = "width:2px;height:14px;transform:rotate(" + (i / n * 360) + "deg)"; }
    e.style.cssText = `left:${cx}px;top:${cy}px;background:${col};${shape}`; b.appendChild(e);
    e.animate([{ opacity: 1, translate: "0 0" }, { opacity: 0, translate: `${tx}px ${ty}px` }], { duration: dur, easing: "ease-out" }).onfinish = () => e.remove();
  }
}
