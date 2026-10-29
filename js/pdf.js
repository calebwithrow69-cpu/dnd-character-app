// Character sheet PDF, made on the device from the character (works offline).
// buildTemplateSheetPdf writes onto the official 2024 sheet (artwork stored in the locked rules file as library.sheetTemplate);
// buildSheetPdf is the plain fillable layout used only if that artwork is not in the rules data.
// pdf-lib is loaded on demand from js/vendor. ASCII only in this file.
import { profsString, deriveCharacter, weaponNumbers, SKILLS, ABILITIES, ABILITY_LABEL, fmtMod, slotRows, CASTER_TYPE } from "./rules.js";
import { parseSpecies } from "./species.js";
import { optionGroup, optionNames } from "./progression.js";

const PAGE_W = 612, PAGE_H = 792, M = 28;

// Standard PDF fonts only cover Latin-1: swap fancy punctuation, drop anything else.
const clean = t => String(t == null ? "" : t)
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, "-").replace(/…/g, "...")
  .replace(/[·•]/g, "-").replace(/→/g, "->").replace(/×/g, "x").replace(/✓/g, "x")
  .replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, "?");

// Largest font size (<= max) at which the text should fit a box
function fitSize(text, w, h, max = 9, min = 5.5) {
  const len = Math.max(1, clean(text).length);
  for (let s = max; s >= min; s -= 0.5) {
    const cols = Math.floor((w - 6) / (s * 0.5)), rows = Math.floor((h - 4) / (s * 1.2));
    if (cols * rows >= len * 1.12) return s;
  }
  return min;
}

export async function buildSheetPdf(PDFLib, char, library, campaign) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle(`${clean(char.name)} - character sheet`);
  doc.setCreator("Character Runner");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const form = doc.getForm();
  const ink = rgb(0.13, 0.1, 0.08), line = rgb(0.45, 0.38, 0.3), tint = rgb(0.96, 0.93, 0.87);
  const d = deriveCharacter(char);
  const cls = (library.classes || []).find(c => c.name === char.class);
  const sp = (library.species || []).find(s => s.name === char.species);
  let n = 0;
  const uid = base => base + "_" + (++n);

  const pages = [doc.addPage([PAGE_W, PAGE_H])];
  let page = pages[0];
  const Y = top => PAGE_H - top;                       // top-down helper
  const label = (text, x, top, size = 6.5, f = bold) => page.drawText(clean(text).toUpperCase(), { x, y: Y(top) - size, size, font: f, color: line });
  const frame = (x, top, w, h, fill) => page.drawRectangle({ x, y: Y(top) - h, width: w, height: h, borderColor: line, borderWidth: 0.8, color: fill || undefined });

  // a text field with a small caption underneath (or above for tall boxes)
  function field(name, x, top, w, h, value, o = {}) {
    const tf = form.createTextField(uid(name));
    const text = clean(value);
    if (o.multiline) tf.enableMultiline();
    tf.setText(text);
    if (o.align === "center") tf.setAlignment(PDFLib.TextAlignment.Center);
    tf.addToPage(page, { x, y: Y(top) - h, width: w, height: h, font, borderColor: line, borderWidth: o.noBorder ? 0 : 0.6, backgroundColor: o.fill === false ? undefined : tint, textColor: ink });
    tf.setFontSize(o.size || (o.multiline ? fitSize(text, w, h) : Math.min(11, Math.max(6, h - 6))));
    tf.updateAppearances(font);
    return tf;
  }
  function check(name, x, top, on, size = 8) {
    const cb = form.createCheckBox(uid(name));
    cb.addToPage(page, { x, y: Y(top) - size, width: size, height: size, borderColor: line, borderWidth: 0.7, backgroundColor: tint });
    if (on) cb.check();
  }
  // captioned field: caption sits above the box
  function cap(caption, name, x, top, w, h, value, o) { label(caption, x, top - 8); return field(name, x, top, w, h, value, o); }
  const signed = v => fmtMod(v).replace("−", "-");

  // ---------------- page 1: identity
  page.drawText("CHARACTER SHEET", { x: M, y: Y(M) - 10, size: 10, font: bold, color: ink });
  page.drawText("Fillable: every box can be edited in your PDF reader", { x: M + 100, y: Y(M) - 9, size: 7, font, color: line });
  let top = 52;
  cap("Character name", "name", M, top, 190, 20, char.name, { size: 12 });
  cap("Class", "class", M + 195, top, 105, 20, char.class);
  cap("Subclass", "subclass", M + 305, top, 125, 20, char.subclass || "None yet");
  cap("Level", "level", M + 435, top, 40, 20, String(char.level), { align: "center" });
  cap("XP", "xp", M + 480, top, 76, 20, String(char.xp != null ? char.xp : 0), { align: "center" });
  top = 92;
  cap("Species", "species", M, top, 130, 20, char.species);
  cap("Background", "background", M + 135, top, 130, 20, char.background);
  cap("Alignment", "alignment", M + 270, top, 120, 20, char.alignment || "Unaligned");
  cap("Size", "size", M + 395, top, 60, 20, char.size || "Medium");
  cap("Languages", "languages", M + 460, top, 96, 20, char.languages || "Common", { size: 7 });

  // ---------------- left column: abilities, saves, skills
  let y = 132;
  const LX = M, LW = 196;
  for (const a of ABILITIES) {
    frame(LX, y, LW, 28, null);
    page.drawText(clean(ABILITY_LABEL[a]).toUpperCase(), { x: LX + 6, y: Y(y) - 16, size: 9, font: bold, color: ink });
    field("score_" + a, LX + 100, y + 3, 40, 22, String(char.abilities[a]), { size: 14, align: "center" });
    field("mod_" + a, LX + 148, y + 4, 40, 20, signed(d.mods[a]), { size: 12, align: "center" });
    y += 30;
    // saving throw row
    const rows = [{ t: "Saving throw", on: (char.saveProf || []).includes(a), v: d.saves[a], k: "save_" + a }]
      .concat(SKILLS.filter(s => s.ability === a).map(s => { const sk = d.skills.find(x => x.id === s.id); return { t: s.label + (sk.expert ? " (expertise)" : ""), on: sk.proficient, v: sk.bonus, k: "skill_" + s.id }; }));
    for (const r of rows) {
      check("p_" + r.k, LX + 6, y + 2, r.on, 7);
      page.drawText(clean(r.t), { x: LX + 18, y: Y(y) - 8, size: 7.5, font: r.k.startsWith("save_") ? bold : font, color: ink });
      field(r.k, LX + 150, y, 38, 11, signed(r.v), { size: 8, align: "center" });
      y += 12;
    }
    y += 5;
  }

  // ---------------- middle column: combat
  const MX = M + LW + 12, MW = 150;
  let my = 132;
  const trio = (items, yy) => items.forEach((it, i) => cap(it[0], it[1], MX + i * 52, yy + 8, 46, 28, it[2], { size: it[3] || 14, align: "center" }));
  trio([["Armor class", "ac", String(d.ac)], ["Initiative", "init", signed(d.initiative)], ["Speed", "speed", String(char.speed) + " ft"]], my);
  my += 46;
  trio([["Prof. bonus", "prof", "+" + d.prof], ["Passive perc.", "pp", String(d.passivePerception)], ["Size", "size2", char.size || "Medium", 8]], my);
  my += 46;
  label("Heroic inspiration", MX, my); check("inspiration", MX + 92, my - 1, !!char.inspiration, 9);
  my += 16;
  trio([["HP max", "hpmax", String(char.hp.max)], ["HP current", "hpcur", String(char.hp.cur)], ["Temp HP", "hptemp", String(char.hp.temp || 0)]], my);
  my += 46;
  cap("Hit dice (spent / total)", "hd", MX, my + 8, 100, 20, `${char.hitDice.spent || 0} / ${char.hitDice.total}d${char.hitDice.die}`, { align: "center" });
  my += 36;
  label("Death saves", MX, my);
  page.drawText("Successes", { x: MX, y: Y(my) - 20, size: 7, font, color: ink });
  page.drawText("Failures", { x: MX, y: Y(my) - 34, size: 7, font, color: ink });
  for (let i = 0; i < 3; i++) {
    check("ds_s" + i, MX + 50 + i * 14, my + 12, (char.deathSaves.success || 0) > i, 9);
    check("ds_f" + i, MX + 50 + i * 14, my + 26, (char.deathSaves.fail || 0) > i, 9);
  }
  my += 46;
  const feats = (char.feats || []).join(", ") || "None";
  cap("Feats", "feats", MX, my + 8, MW, 80, feats, { multiline: true });
  my += 96;
  cap("Armor, weapon and tool training", "profs", MX, my + 8, MW, 624 - my - 8, profsString(char) || "None", { multiline: true });

  // ---------------- right column: weapons and spellcasting summary
  const RX = MX + MW + 12, RW = PAGE_W - M - RX;
  let ry = 132;
  label("Weapons and damage", RX, ry);
  ry += 9;
  const weps = (char.inventory || []).filter(i => i.weapon).slice(0, 7);
  const cols = [[0, 74, "Name"], [74, 30, "Atk"], [104, RW - 104, "Damage"]];
  cols.forEach(([ox, w, t]) => label(t, RX + ox + 2, ry, 5.5));
  ry += 8;
  for (let i = 0; i < 7; i++) {
    const it = weps[i];
    let atk = "", dmg = "";
    if (it) { const wn = weaponNumbers(it.weapon, char); atk = signed(wn.toHit); dmg = `${wn.dice}${wn.dmgMod ? (wn.dmgMod > 0 ? "+" : "") + wn.dmgMod : ""} ${it.weapon.dtype || ""}`.trim(); }
    field("w_name" + i, RX, ry, 74, 16, it ? it.name : "", { size: 7 });
    field("w_atk" + i, RX + 74, ry, 30, 16, atk, { size: 8, align: "center" });
    field("w_dmg" + i, RX + 104, ry, RW - 104, 16, dmg, { size: 7 });
    ry += 17;
  }
  ry += 8;
  const caster = d.spellInfo;
  label("Spellcasting", RX, ry); ry += 9;
  cap("Ability", "sp_ab", RX, ry + 8, 56, 18, caster ? ABILITY_LABEL[caster.ability] : "None", { size: 8, align: "center" });
  cap("Save DC", "sp_dc", RX + 60, ry + 8, 36, 18, caster ? String(caster.dc) : "-", { size: 10, align: "center" });
  cap("Attack", "sp_atk", RX + 100, ry + 8, 36, 18, caster ? signed(caster.attackBonus) : "-", { size: 10, align: "center" });
  ry += 36;
  const slots = caster ? caster.slots : [];
  label("Spell slots (total / used)", RX, ry); ry += 9;
  for (let lv = 1; lv <= 9; lv++) {
    const row = slots.find(r => r.level === lv);
    const col = (lv - 1) % 3, rowi = Math.floor((lv - 1) / 3);
    const x0 = RX + col * Math.floor(RW / 3), y0 = ry + rowi * 30;
    label("Level " + lv, x0, y0, 5.5);
    field("slots_" + lv, x0, y0 + 8, Math.floor(RW / 3) - 4, 16, row ? `${row.max} / ${(char.spellcasting.slotsUsed || [])[lv] || 0}` : "-", { size: 8, align: "center" });
  }
  ry += 96;
  const known = (char.spellcasting.spells || []);
  const lvOf = nm => { const s = (library.spells || []).find(x => x.name === nm); return s ? s.level : 1; };
  const cantrips = known.filter(s => lvOf(s.name) === 0).map(s => s.name);
  const spells = known.filter(s => lvOf(s.name) > 0).map(s => `${s.name} (${lvOf(s.name)})${s.always ? " *" : ""}`);
  cap("Cantrips", "cantrips", RX, ry + 8, RW, 40, cantrips.join(", ") || "None", { multiline: true });
  ry += 56;
  cap("Prepared spells (* always prepared)", "spells", RX, ry + 8, RW, 624 - ry - 8, spells.join(", ") || "None", { multiline: true });

  // ---------------- bottom of page 1: features and traits
  const feat = (list, lvl) => list.filter(f => (f.lv || f.level || 1) <= lvl).map(f => f.name);
  const grp = cls ? optionGroup(cls) : null;
  const optSet = cls ? optionNames(cls) : new Set();
  const classFeatures = feat(cls ? cls.features || [] : [], char.level).filter(nm => !optSet.has(nm));
  const chosenOpts = grp ? ((char.choices || {})[grp.key] || []) : [];
  if (chosenOpts.length) classFeatures.push(`${grp.label}: ${chosenOpts.join(", ")}`);
  const sub = (library.subclasses || []).find(s => s.cls === char.class && s.name === char.subclass);
  const subFeatures = sub ? (sub.features || []).filter(f => !f.intro && (f.lv || 1) <= char.level).map(f => f.name) : [];
  const traits = sp ? parseSpecies(sp).traits.filter(t => t.level <= char.level).map(t => t.name) : [];
  const bottomTop = 640, bh = PAGE_H - M - bottomTop;
  const half = (PAGE_W - 2 * M - 8) / 2;
  cap("Class features", "class_features", M, bottomTop + 8, half, bh - 8, [...classFeatures, ...subFeatures.map(x => x + " (subclass)")].join(", ") || "None", { multiline: true });
  cap("Species traits", "species_traits", M + half + 8, bottomTop + 8, half, bh - 8, traits.join(", ") || "None", { multiline: true });

  // ---------------- page 2
  page = doc.addPage([PAGE_W, PAGE_H]); pages.push(page);
  page.drawText(clean(char.name) + " - page 2", { x: M, y: Y(M) - 10, size: 10, font: bold, color: ink });
  const colW = 270, rx2 = M + colW + 16, rw2 = PAGE_W - M - rx2;
  const inv = (char.inventory || []).map(i => `${i.qty > 1 ? i.qty + " x " : ""}${i.name}${i.notes ? " (" + i.notes + ")" : ""}`);
  cap("Equipment", "equipment", M, 52, colW, 330, inv.join("\n") || "None", { multiline: true });
  const c = char.coins || {};
  label("Coins", M, 396);
  ["cp", "sp", "ep", "gp", "pp"].forEach((k, i) => cap(k.toUpperCase(), "coin_" + k, M + i * 54, 414, 50, 20, String(c[k] || 0), { align: "center", size: 10 }));
  cap("Class notes", "class_notes", M, 456, colW, 140, char.classFeatureNotes || "None", { multiline: true });
  cap("Notes", "notes", M, 618, colW, 146, char.notes || "None", { multiline: true });
  cap("Appearance", "appearance", rx2, 52, rw2, 150, char.appearance || "Not described", { multiline: true });
  cap("Backstory and personality", "backstory", rx2, 222, rw2, 300, char.backstory || "Not written", { multiline: true });
  cap("Alignment", "alignment2", rx2, 542, 120, 20, char.alignment || "Unaligned");
  cap("Languages", "languages2", rx2 + 126, 542, rw2 - 126, 20, char.languages || "Common", { size: 8 });
  cap("Background", "background2", rx2, 586, 120, 20, char.background);
  cap("Species / size", "species2", rx2 + 126, 586, rw2 - 126, 20, `${char.species}, ${char.size || "Medium"}`, { size: 8 });
  cap("Features gained (level log)", "levellog", rx2, 630, rw2, 134, (char.levelLog || []).map(e => `Level ${e.level}: ${e.summary}`).join("\n") || "Level 1: character created", { multiline: true });

  return await doc.save();
}


// ---------------------------------------------------------------------------
// The official 2024 sheet: the artwork (kept inside the locked rules file) is the
// page background, and the character is written into its boxes.
// Coordinates below are pixels on a 921 x 1183 picture of each page.
const K = 603 / 921;
export async function buildTemplateSheetPdf(PDFLib, char, library) {
  const { PDFDocument, StandardFonts, rgb, TextAlignment } = PDFLib;
  const tpl = library.sheetTemplate;
  const doc = await PDFDocument.create();
  doc.setTitle(`${clean(char.name)} - character sheet`); doc.setCreator("Character Runner");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.1, 0.08, 0.06);
  const d = deriveCharacter(char);
  const cls = (library.classes || []).find(c => c.name === char.class);
  const sp = (library.species || []).find(x => x.name === char.species);
  const signed = v => fmtMod(v).replace("−", "-");
  let n = 0, page;
  const newPage = async src => {
    page = doc.addPage([tpl.w, tpl.h]);
    const b64 = src.split(",")[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    page.drawImage(await doc.embedJpg(bytes), { x: 0, y: 0, width: tpl.w, height: tpl.h });
  };
  // text written into a box between two corners (picture pixels); shrinks to fit
  const wrap = (text, size, w) => {
    const out = [];
    for (const para of text.split("\n")) {
      let cur = "";
      for (const word of para.split(/\s+/)) {
        const t = cur ? cur + " " + word : word;
        if (cur && font.widthOfTextAtSize(t, size) > w) { out.push(cur); cur = word; } else cur = t;
      }
      out.push(cur);
    }
    return out;
  };
  const box = (name, x1, y1, x2, y2, value, o = {}) => {
    const text = clean(value); if (!text) return;
    const w = (x2 - x1) * K - 4, h = (y2 - y1) * K, X = x1 * K + 2, top = tpl.h - y1 * K;
    if (o.multi) {
      let size = o.size || 8.5, lines = wrap(text, size, w);
      while (size > 5 && lines.length * size * 1.15 > h) { size -= 0.5; lines = wrap(text, size, w); }
      lines.forEach((l, i) => { const yy = top - size - i * size * 1.15; if (yy > top - h - 2) page.drawText(l, { x: X, y: yy, size, font, color: ink }); });
      return;
    }
    let size = o.size || Math.min(12, Math.max(6, h * 0.78));
    while (size > 5 && font.widthOfTextAtSize(text, size) > w) size -= 0.5;
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: o.align === "c" ? X + (w - tw) / 2 : X, y: tpl.h - y2 * K + (h - size * 0.72) / 2, size, font, color: ink });
  };
  const line = (name, x1, ytop, x2, value, o = {}) => box(name, x1, ytop - 20, x2, ytop, value, o); // value sits on a line
  const diamond = (cx, cy, filled) => { // the sheet's diamond check boxes
    const r = 6 * K, x = cx * K, y = tpl.h - cy * K;
    page.drawSvgPath(`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`, { x, y, color: rgb(0.1, 0.08, 0.06), opacity: filled ? 0.9 : 0, borderOpacity: 0 });
  };
  const dot = (cx, cy) => page.drawCircle({ x: cx * K, y: tpl.h - cy * K, size: 3.4, color: rgb(0.1, 0.08, 0.06) });

  // ---------------- page 1
  await newPage(tpl.pages[0]);
  line("name", 40, 46, 375, char.name, { size: 13 });
  line("background", 40, 79, 216, char.background); line("class", 229, 79, 390, char.class);
  line("species", 40, 111, 216, char.species); line("subclass", 229, 111, 390, char.subclass || "");
  line("level", 400, 72, 442, String(char.level), { align: "c", size: 11 }); line("xp", 395, 104, 450, String(char.xp || 0), { align: "c", size: 10 });
  box("ac", 490, 44, 546, 98, String(d.ac), { align: "c", size: 24 });
  if (char.ac && char.ac.shield) diamond(518, 116, true);
  box("hp_cur", 580, 56, 655, 108, String(char.hp.cur), { align: "c", size: 24 });
  line("hp_temp", 670, 76, 736, char.hp.temp ? String(char.hp.temp) : "", { align: "c", size: 11 }); line("hp_max", 670, 108, 736, String(char.hp.max), { align: "c", size: 11 });
  line("hd_spent", 752, 76, 810, String(char.hitDice.spent || 0), { align: "c", size: 11, keep: true }); line("hd_max", 752, 108, 810, `${char.hitDice.total} d${char.hitDice.die}`, { align: "c", size: 10 });
  for (let i = 0; i < 3; i++) { diamond(834 + i * 16, 68, (char.deathSaves.success || 0) > i); diamond(834 + i * 16, 101, (char.deathSaves.fail || 0) > i); }

  box("prof", 62, 205, 116, 262, signed(d.prof), { align: "c", size: 24 });
  box("inspiration", 70, 888, 106, 922, char.inspiration ? "X" : "", { align: "c", size: 16 });
  const tiles = [["init", 346, signed(d.initiative)], ["speed", 484, `${char.speed} ft`], ["size", 633, char.size || "Medium"], ["pp", 773, String(d.passivePerception)]];
  const tw = [117, 130, 128, 128];
  tiles.forEach(([k, x, v], i) => box(k, x, 198, x + tw[i], 232, v, { align: "c", size: 15 }));

  const H = { str: 300, dex: 480, con: 704, int: 183, wis: 448, cha: 714 };
  const RIGHT = new Set(["int", "wis", "cha"]);
  for (const a of ABILITIES) {
    const r = RIGHT.has(a), h = H[a], mx = r ? 228 : 67, sx = r ? 280 : 117, cx = r ? 195 : 33, vx1 = r ? 202 : 41, vx2 = r ? 232 : 69;
    box("mod_" + a, mx - 26, h + 18, mx + 26, h + 62, signed(d.mods[a]), { align: "c", size: 20 });
    box("score_" + a, sx - 16, h + 36, sx + 16, h + 60, String(char.abilities[a]), { align: "c", size: 11 });
    const sy = h + 105;
    if ((char.saveProf || []).includes(a)) dot(cx, sy);
    box("save_" + a, vx1, sy - 10, vx2, sy + 6, signed(d.saves[a]), { align: "c", size: 9 });
    SKILLS.filter(s => s.ability === a).forEach((s, i) => {
      const sk = d.skills.find(x => x.id === s.id), yy = h + 134 + i * 21.5;
      if (sk.proficient || sk.expert) dot(cx, yy);
      box("sk_" + s.id, vx1, yy - 10, vx2, yy + 6, signed(sk.bonus), { align: "c", size: 9 });
    });
  }

  const weps = (char.inventory || []).filter(i => i.weapon).slice(0, 6), rowY = [325, 355, 384, 414, 443, 473];
  weps.forEach((it, i) => {
    const wn = weaponNumbers(it.weapon, char), y = rowY[i];
    const props = [it.weapon.mastery, it.weapon.props].filter(Boolean).join(", ");
    line("w_name" + i, 348, y, 508, it.name, { size: 9 }); line("w_atk" + i, 514, y, 580, signed(wn.toHit), { align: "c", size: 9 });
    line("w_dmg" + i, 587, y, 700, `${wn.dice}${wn.dmgMod ? (wn.dmgMod > 0 ? "+" : "") + wn.dmgMod : ""} ${it.weapon.dtype || ""}`.trim(), { size: 8 });
    line("w_note" + i, 706, y, 893, props, { size: 7 });
  });

  const grp = cls ? optionGroup(cls) : null, optSet = cls ? optionNames(cls) : new Set();
  const classF = (cls ? cls.features || [] : []).filter(f => (f.lv || 1) <= char.level && !optSet.has(f.name)).map(f => `${f.name} (${f.lv || 1})`);
  const chosenOpts = grp ? ((char.choices || {})[grp.key] || []) : [];
  if (chosenOpts.length) classF.push(`${grp.label}: ${chosenOpts.join(", ")}`);
  const sub = (library.subclasses || []).find(x => x.cls === char.class && x.name === char.subclass);
  const subF = sub ? (sub.features || []).filter(f => !f.intro && f.name && (f.lv || 1) <= char.level).map(f => `${f.name} (${f.lv})`) : [];
  box("class_f", 350, 542, 616, 846, classF.join("\n"), { multi: true });
  box("sub_f", 628, 542, 895, 846, (sub ? char.subclass + "\n" : "") + subF.join("\n"), { multi: true });
  const traits = sp ? parseSpecies(sp).traits.filter(t => t.level <= char.level).map(t => t.name) : [];
  box("species_t", 350, 906, 596, 1158, traits.join("\n"), { multi: true });
  box("feats", 632, 906, 893, 1158, (char.feats || []).join("\n"), { multi: true });
  const profs = profsString(char);
  [["light", 96], ["medium", 147], ["heavy", 208], ["shield", 273]].forEach(([w, x]) => diamond(x, 990, ((char.profs || {}).armor || []).includes(w)));
  box("profs", 26, 1024, 316, 1100, profs, { multi: true, size: 8 });

  // ---------------- page 2
  await newPage(tpl.pages[1]);
  const si = d.spellInfo;
  if (si) {
    line("sp_ab", 40, 47, 205, ABILITY_LABEL[si.ability], { size: 10 });
    box("sp_mod", 24, 70, 72, 108, signed(si.mod), { align: "c", size: 16 });
    box("sp_dc", 24, 112, 72, 150, String(si.dc), { align: "c", size: 16 });
    box("sp_atk", 24, 154, 72, 192, signed(si.attackBonus), { align: "c", size: 16 });
    const cols = [[287, 311], [421, 442], [542, 560]], ys = [139, 160, 181], dia = [4, 3, 3, 3, 3, 2, 2, 1, 1];
    for (let lv = 1; lv <= 9; lv++) {
      const row = si.slots.find(r => r.level === lv), c = cols[Math.floor((lv - 1) / 3)], y = ys[(lv - 1) % 3];
      line("slot_t" + lv, c[0] - 12, y + 3, c[0] + 12, row ? String(row.max) : "", { align: "c", size: 8 });
      const used = (char.spellcasting.slotsUsed || [])[lv - 1] || 0;
      for (let i = 0; i < dia[lv - 1]; i++) if (row && i < row.max) diamond(c[1] + 8 + i * 13.5, y - 1, i < used);
    }
  }
  const known = char.spellcasting.spells || [];
  const info = nm => (library.spells || []).find(x => x.name === nm);
  const list = known.map(s => ({ s, r: info(s.name) })).filter(x => x.r).sort((a, b) => a.r.level - b.r.level || a.r.name.localeCompare(b.r.name)).slice(0, 30);
  list.forEach(({ s, r }, i) => {
    const y = 283 + i * 29.65;
    box("sl_lv" + i, 28, y - 14, 58, y + 4, r.level ? String(r.level) : "C", { align: "c", size: 9 });
    box("sl_nm" + i, 66, y - 14, 228, y + 4, r.name + (s.always ? " *" : ""), { size: 9 });
    box("sl_ti" + i, 236, y - 14, 282, y + 4, String(r.time || "").split(/,| or /)[0].replace(/^1 /, "").replace(/bonus action/i, "Bonus").replace(/^action/i, "Action").replace(/^reaction/i, "Reaction"), { size: 6.5 });
    box("sl_rg" + i, 288, y - 14, 352, y + 4, r.range || "", { size: 7 });
    diamond(372, y, !!r.conc); diamond(406, y, !!r.ritual); diamond(440, y, /\bM\b/.test(r.comp || ""));
    box("sl_nt" + i, 466, y - 14, 598, y + 4, r.dur && r.dur !== "Instantaneous" ? r.dur.replace("Concentration, up to ", "Conc. ") : "", { size: 6.5 });
  });

  box("appearance", 630, 50, 895, 160, char.appearance || "", { multi: true });
  box("backstory", 630, 210, 895, 418, char.backstory || "", { multi: true });
  line("alignment", 630, 462, 893, char.alignment || "", { size: 9 });
  box("languages", 630, 522, 895, 574, char.languages || "", { multi: true, size: 8 });
  const inv = (char.inventory || []).map(i => `${i.qty > 1 ? i.qty + " x " : ""}${i.name}`);
  box("equipment", 630, 628, 895, 894, inv.join("\n"), { multi: true, size: 8 });
  const c = char.coins || {};
  ["cp", "sp", "ep", "gp", "pp"].forEach((k, i) => box("coin_" + k, 631 + i * 54.4, 1078, 676 + i * 54.4, 1102, String(c[k] || 0), { align: "c", size: 11, keep: true }));
  return await doc.save();
}

// ---- in the app: load pdf-lib once, build, download
let loading = null;
function loadLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!loading) loading = new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "js/vendor/pdf-lib.min.js";
    s.onload = () => ok(window.PDFLib);
    s.onerror = () => { loading = null; fail(new Error("Couldn't load the PDF tool")); };
    document.head.appendChild(s);
  });
  return loading;
}
export async function downloadSheetPdf(app, char) {
  const PDFLib = await loadLib();
  const bytes = app.library.sheetTemplate ? await buildTemplateSheetPdf(PDFLib, char, app.library) : await buildSheetPdf(PDFLib, char, app.library, app.campaign);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = (char.name || "character").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") + "-sheet.pdf";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
