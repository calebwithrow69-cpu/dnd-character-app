// Merge the 2024 System Reference Document (SRD 5.2) into data/library.json.
// Only ADDS what the library doesn't have (spells, feats, magic items, gear,
// class levels 11-20). The 12 SRD subclasses get their feature lists rebuilt
// from the SRD (the old import had merged several features into one block).
//
// Usage: node tools/srd-import.mjs <path to 5e-database/src/2024/en>
//   (data from https://github.com/5e-bits/5e-database, MIT; content is
//    SRD 5.2 by Wizards of the Coast, CC-BY-4.0)
// Then lock: CR_PASSWORD=... node tools/crypt.mjs lock
import fs from "fs";
import path from "path";

const dir = process.argv[2];
if (!dir) { console.error("Give the folder with 5e-SRD-*.json"); process.exit(1); }
const read = f => JSON.parse(fs.readFileSync(path.join(dir, `5e-SRD-${f}.json`), "utf8"));
const LIB = new URL("../data/library.json", import.meta.url);
const L = JSON.parse(fs.readFileSync(LIB, "utf8"));
const SRC = "SRD 5.2";
export const CREDIT = "This work includes material from the System Reference Document 5.2 (\"SRD 5.2\") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

const key = s => String(s || "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9+']+/g, " ").trim();
// "Clothes, Fine" -> "fine clothes"
const flip = s => /, /.test(s) ? key(s.split(", ").reverse().join(" ")) : key(s);
const has = (list, name) => { const k = key(name), f = flip(name); return list.some(x => key(x.name) === k || key(x.name) === f || flip(x.name) === k); };
// SRD markdown-ish text -> the library's plain paragraphs ("Bold Lead. text")
const text = t => String(Array.isArray(t) ? t.join("\n") : t || "")
  .replace(/\*\*\*?([^*]+?)\*\*\*?/g, "$1").replace(/\r/g, "")
  .split(/\n\s*/).map(x => x.trim()).filter(Boolean).join("\n\n");

const report = {};
const count = (k, n = 1) => { report[k] = (report[k] || 0) + n; };

// ---- spells
for (const s of read("Spells")) {
  if (has(L.spells, s.name)) continue;
  const comp = (s.components || []).join(", ") + (s.material ? ` (${s.material})` : "");
  const dur = s.concentration ? `Concentration, ${s.duration}` : s.duration;
  let body = text(s.description);
  if (s.higher_level && s.higher_level.length) body += `\n\nUsing a Higher-Level Spell Slot. ${text(s.higher_level)}`;
  L.spells.push({ name: s.name, level: s.level, school: s.school?.name || "", classes: (s.classes || []).map(c => c.name),
    time: s.casting_time, range: s.range, comp, dur, conc: s.concentration ? 1 : 0, ritual: s.ritual ? 1 : 0, source: SRC, text: body });
  count("spells");
}

// ---- feats
const FEAT_TYPE = {
  "epic-boon": lv => `Epic Boon Feat (Prerequisite: Level ${lv || 19}+)`,
  "fighting-style": () => "Fighting Style Feat (Prerequisite: Fighting Style Feature)",
  origin: () => "Origin Feat", general: lv => `General Feat (Prerequisite: Level ${lv || 4}+)`
};
for (const f of read("Feats")) {
  if (has(L.feats, f.name) || has(L.feats, f.name.replace(/^Two Weapon/, "Two-Weapon"))) continue;
  const t = FEAT_TYPE[f.type] ? FEAT_TYPE[f.type](f.prerequisites?.minimum_level) : f.type;
  L.feats.push({ name: f.name, source: SRC, type: t, text: text(f.description) });
  count("feats");
}

// ---- magic items (skip "parent" entries that only exist to list variants)
for (const m of read("Magic-Items")) {
  if ((m.variants || []).length) continue;
  if (has(L.items, m.name)) continue;
  const lines = String(m.desc || "").split("\n");
  const head = lines[0].replace(/\s+$/, "");            // "Wondrous Item, Rare (Requires Attunement)"
  const rarity = m.rarity?.name || "";
  const type = /item|armor|weapon|potion|ring|rod|scroll|staff|wand/i.test(head) && head.length < 90
    ? head : [m.equipment_category?.name, rarity].filter(Boolean).join(", ") + (m.attunement ? " (requires attunement)" : "");
  L.items.push({ name: m.name, source: SRC, type,
    rarity, text: text(lines.slice(1).join("\n")), price: null, priceTxt: "", slots: "", magic: true });
  count("magic items");
}

// ---- adventuring gear the library lacks (no price: the DM sets the economy)
const gearCats = new Set(["Adventuring Gear", "Tools", "Ammunition", "Arcane Foci", "Druidic Foci", "Holy Symbols", "Equipment Packs", "Gaming Sets", "Musical Instruments", "Artisan's Tools", "Kits", "Other Tools"]);
for (const e of read("Equipment")) {
  const cat = e.equipment_category?.name || "";
  if (/weapon|armor/i.test(cat) && !/ammunition/i.test(cat)) continue;
  if (has(L.items, e.name) || has(L.weapons, e.name)) continue;
  const name = /, /.test(e.name) && !/^Spell Scroll/.test(e.name) ? e.name.split(", ").reverse().join(" ") : e.name;
  if (has(L.items, name)) continue;
  L.items.push({ name, source: SRC, type: "Mundane Item", text: text(e.description || e.desc || ""), price: null, priceTxt: "",
    srdCost: e.cost ? `${e.cost.quantity} ${e.cost.unit}` : "", slots: "" });
  count("gear");
}

// ---- class levels 11-20: features + table rows
const levels = read("Levels"), feats = read("Features");
const dash = n => (n ? String(n) : "—");
const slots = (sc, upto) => Array.from({ length: upto }, (_, i) => dash(sc?.[`spell_slots_level_${i + 1}`]));
const TAIL = {
  Barbarian: (cs) => [cs.rage_count, `+${cs.rage_damage_bonus}`, cs.weapon_mastery],
  Bard: (cs, sc) => [`1d${cs.bardic_inspiration_die}`, sc.cantrips_known, sc.prepared_spells, ...slots(sc, 9)],
  Cleric: (cs, sc) => [cs.channel_divinity_charges, sc.cantrips_known, sc.prepared_spells, ...slots(sc, 9)],
  Druid: (cs, sc) => [cs.wild_shape_uses, sc.cantrips_known, sc.prepared_spells, ...slots(sc, 9)],
  Fighter: (cs) => [cs.second_wind_uses, cs.weapon_mastery],
  Monk: (cs) => [`1d${cs.martial_arts_die}`, cs.focus_points, `+${cs.unarmored_movement_bonus}`, "ft."],
  Paladin: (cs, sc) => [cs.channel_divinity_charges, sc.prepared_spells, ...slots(sc, 5)],
  Ranger: (cs, sc) => [cs.favored_enemies, sc.prepared_spells, ...slots(sc, 5)],
  Rogue: (cs) => [`${cs.sneak_attack.dice_count}d${cs.sneak_attack.dice_value}`],
  Sorcerer: (cs, sc) => [cs.sorcery_points, sc.cantrips_known, sc.prepared_spells, ...slots(sc, 9)],
  Warlock: (cs, sc) => { const lv = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(i => sc[`spell_slots_level_${i}`]); return [cs.eldritch_invocations, sc.cantrips_known, sc.prepared_spells, sc[`spell_slots_level_${lv}`], lv]; },
  Wizard: (cs, sc) => [sc.cantrips_known, sc.prepared_spells, ...slots(sc, 9)]
};
for (const cls of L.classes) {
  const rows = cls.table.split("\n");
  for (let lv = 11; lv <= 20; lv++) {
    if (rows.some(r => parseInt(r, 10) === lv)) continue;
    const row = levels.find(l => l.class?.name === cls.name && l.level === lv && !l.subclass);
    if (!row || !TAIL[cls.name]) continue;
    // the level row names every feature, including repeats ("Ability Score Improvement" again)
    const listed = (row.features || []).filter(f => !/subclass-feature|-subclass$/.test(f.index) || /Subclass/i.test(f.name));
    for (const ref of listed) {
      if (cls.features.some(x => x.lv === lv && (key(x.name) === key(ref.name) || (/Subclass$/.test(ref.name) && x.name === "Subclass Feature")))) continue;
      const own = feats.find(f => f.index === ref.index && !f.subclass);
      const ownLv = own ? +String(own.level?.index || "").split("-").pop() : 0;
      const earlier = cls.features.find(x => key(x.name) === key(ref.name));
      const body = own && ownLv === lv ? text(own.description)
        : earlier ? `${earlier.text || ""}` : own ? text(own.description) : "";
      if (new RegExp(`^${cls.name} Subclass$`, "i").test(ref.name) && earlier) {
        cls.features.push({ lv, name: "Subclass Feature", src: SRC, text: `You gain a feature from your ${cls.name} Subclass.` });
      } else cls.features.push({ lv, name: ref.name, src: SRC, text: body });
      count("class features (11-20)");
    }
    const names = listed.map(f => new RegExp(`^${cls.name} Subclass$`).test(f.name) && lv > 3 ? "Subclass Feature" : f.name).join(", ") || "—";
    rows.push([lv, `+${row.prof_bonus}`, names, ...TAIL[cls.name](row.class_specific || {}, row.spellcasting || {})].join("    "));
    count("class table rows (11-20)");
  }
  cls.table = rows.join("\n");
  cls.features.sort((a, b) => a.lv - b.lv);
}

// ---- SRD subclasses: rebuild features from the SRD, keep the library's intro
for (const sub of L.subclasses) {
  const srd = feats.filter(f => f.subclass?.name === sub.name && f.class?.name === sub.cls);
  if (!srd.length) continue;
  const intro = sub.features.filter(f => f.intro);
  const keep = sub.features.filter(f => !f.intro && f.name && !srd.some(s => key(s.name) === key(f.name)));
  const lvOf = f => +String(f.level?.index || "").split("-").pop() || 0;
  sub.features = [...intro, ...srd.map(f => ({ lv: lvOf(f), name: f.name, src: SRC, text: text(f.description) })), ...keep].sort((a, b) => a.lv - b.lv || (a.intro ? -1 : 1));
  count("subclasses rebuilt");
}

L.credits = Array.from(new Set([...(L.credits || []), CREDIT]));
L.generatedFrom = `${L.generatedFrom}; merged SRD 5.2 ${new Date().toISOString().slice(0, 10)}`;
fs.writeFileSync(LIB, JSON.stringify(L));
console.log(report);
