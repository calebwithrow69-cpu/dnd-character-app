// Choices a species, background or feat asks you to make ("one skill of your
// choice", "Choose a lineage from the table", "an Origin feat of your choice"),
// read out of the rules text, plus applying the answers to a character.
//
// A choice: { id, label, from, kind, n, options:[{ v, label, sub, detail, term }], text?:true }
//   kind: size | skill | tool | skilltool | ability | spell | feat | option | text
// Answers live in a plain object { [id]: value | [values] }.
// Rules text is inconsistent (especially homebrew), so entries can carry a
// `choiceFix` in the rules file to correct what's read: see applyFix().

import { SKILLS, ABILITY_LABEL, ABILITY_BY_LABEL, parseList, skillIdByLabel } from "./rules.js";

export const TOOLS = {
  artisan: ["Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools", "Cartographer's Tools",
    "Cobbler's Tools", "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools", "Mason's Tools",
    "Painter's Supplies", "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools"],
  gaming: ["Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set"],
  instrument: ["Bagpipes", "Drum", "Dulcimer", "Flute", "Horn", "Lute", "Lyre", "Pan Flute", "Shawm", "Viol"],
  other: ["Disguise Kit", "Forgery Kit", "Herbalism Kit", "Navigator's Tools", "Poisoner's Kit", "Thieves' Tools"]
};
export const ALL_TOOLS = [...TOOLS.artisan, ...TOOLS.other, ...TOOLS.gaming, ...TOOLS.instrument];

const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
const ABIL = "Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma";
const norm = s => String(s || "").replace(/[’‘]/g, "'").trim();
const splitOr = s => norm(s).replace(/\.$/, "").split(/\s*,\s*(?:or\s+)?|\s+or\s+/).map(x => x.trim()).filter(Boolean);
const titleCase = s => s.replace(/(^|[\s(-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

const skillOpts = (labels) => (labels || SKILLS.map(s => s.label)).map(l => skillIdByLabel(l)).filter(Boolean)
  .map(id => { const s = SKILLS.find(x => x.id === id); return { v: id, label: s.label, sub: ABILITY_LABEL[s.ability] }; });
const toolOpts = (list) => list.map(t => ({ v: t, label: t }));
const abilOpts = (labels) => labels.map(l => ABILITY_BY_LABEL[titleCase(l)]).filter(Boolean).map(a => ({ v: a, label: ABILITY_LABEL[a] }));

function toolListFor(phrase) {
  const p = norm(phrase).toLowerCase();
  if (/musical instrument/.test(p)) return TOOLS.instrument;
  if (/gaming set/.test(p)) return TOOLS.gaming;
  if (/artisan/.test(p)) return TOOLS.artisan;
  return null;
}

// ---- option tables ("Choose a lineage from the Elven Lineages table")
const TABLE_ROW = /\S {2,}\S/;
const COLON_ROW = /^([A-Z][\w'’ ()-]{0,40}?):\s+(.+)$/;
const LEAD_ROW = /^([A-Z][\w'’ -]{0,40}?(?: \([^)]{1,30}\))?)\.\s+(.+)$/;

function readOptionLines(allLines, start, loose) {
  // blank lines between rows don't matter; keep original indexes for marking
  const idx = [], lines = [];
  allLines.forEach((l, k) => { if (k >= start && l) { idx.push(k); lines.push(l); } });
  const r = readRows(lines, loose);
  return { options: r.options, end: r.end < idx.length ? idx[r.end] : allLines.length };
}
function readRows(lines, loose) {
  let i = 0;
  // skip a title line ("Elven Lineages", "Draconic Ancestors") with no sentence punctuation
  while (i < lines.length && !/[.:]/.test(lines[i].replace(/\.\s*$/, "")) && !TABLE_ROW.test(lines[i]) && lines[i].length < 60) i++;
  const first = lines[i] || "";
  const out = [];
  const isHeader = l => TABLE_ROW.test(l) && l.split(/\s{2,}/).every(c => c.length < 40 && !/\.\s/.test(c));
  if (isHeader(first)) {
    let header = first.split(/\s{2,}/);
    i++;
    for (; i < lines.length && TABLE_ROW.test(lines[i]); i++) {
      const cols = lines[i].split(/\s{2,}/);
      out.push({ v: norm(cols[0]), detail: cols.slice(1).map((c, k) => header[k + 1] ? `${header[k + 1].trim()}: ${c}` : c).join("\n") });
    }
    return { options: out, end: i };
  }
  const fmt = COLON_ROW.test(first) ? COLON_ROW : LEAD_ROW.test(first) ? LEAD_ROW : null;
  if (!fmt) return { options: out, end: i };
  const paren = fmt === LEAD_ROW && /\(/.test(LEAD_ROW.exec(first)[1]);
  const lastWord = (LEAD_ROW.exec(first) || COLON_ROW.exec(first))[1].split(" ").pop();
  for (; i < lines.length; i++) {
    const m = fmt.exec(lines[i]);
    if (!m) break;
    const name = m[1];
    // period lead-ins look like ordinary traits, so require a family resemblance
    if (fmt === LEAD_ROW && out.length && !loose) {
      if (paren && !/\(/.test(name)) break;
      if (!paren && name.split(" ").pop() !== lastWord) break;
    }
    out.push({ v: norm(name.replace(/\s*\(.*\)$/, "")), label: norm(name), detail: m[2] });
  }
  return { options: out, end: i };
}

// ---- the reader
// text: rules text; ctx: { id prefix, from label }; L: library; C: campaign
export function readChoices(text, ctx, L, C) {
  const lines = String(text || "").split(/\n/).map(l => l.replace(/\s+$/, ""));
  const defs = [];
  const optionLines = new Set();
  let n = 0;
  const add = (d) => {
    const id = `${ctx.id}:${d.key || n++}`;
    if (!defs.some(x => x.id === id)) defs.push({ id, from: ctx.from, n: 1, ...d });
  };

  lines.forEach((raw, li) => {
    if (optionLines.has(li)) return;
    const line = norm(raw);
    if (!line) return;
    const lead = (/^([^.:]{2,60})[.:]\s/.exec(line) || [])[1] || ctx.from;

    // Size
    if (/^Size\b/i.test(line) && /\bMedium\b/.test(line) && /\bSmall\b/.test(line) && /chos|choose|\bor\b/i.test(line)) {
      add({ key: "size", label: "Size", kind: "size", options: [{ v: "Medium", label: "Medium" }, { v: "Small", label: "Small" }] });
      return;
    }
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z(])/);
    for (const s of sentences) {
      let m;
      // Options from a list or table ("Choose a lineage from the Elven Lineages table")
      if (/(?:^|[.;:—]\s*)Choose (?:a|an|one|that|the kind|your)\b/.test(s) && !/creature|ally|target|each time|every time|option below|options below|shape|until you finish|level \d spell/i.test(s)) {
        const inl = /[:;]\s*([^.:;]+?,[^.:;]*\bor\b[^.:;]+?|[A-Z][^.:;,]{0,30} or [A-Z][^.:;]{0,30}?)\.?$/.exec(s);
        const inlineList = inl ? splitOr(inl[1]) : [];
        let options;
        if (inlineList.length >= 2 && inlineList.every(x => x.length <= 30)) {
          options = inlineList.map(v => {
            const at = lines.findIndex((l, k) => k > li && new RegExp(`^${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[.:]`, "i").test(norm(l)));
            if (at > -1) optionLines.add(at);
            return { v: titleCase(v), label: titleCase(v), detail: at > -1 ? norm(lines[at]).replace(/^[^.:]+[.:]\s*/, "") : "" };
          });
        } else {
          let k = li + 1;
          const tbl = /from the ([\w'’ ]+?) table/i.exec(s);
          if (tbl) {
            const name = norm(tbl[1]).toLowerCase();
            const at = lines.findIndex((l, x) => x > li && norm(l).toLowerCase().startsWith(name));
            if (at > -1) k = at;
          }
          while (k < lines.length && !norm(lines[k])) k++;
          const r = readOptionLines(lines.map(norm), k, ctx.loose);
          options = r.options;
          for (let x = k; x < r.end; x++) optionLines.add(x);
        }
        if (options.length >= 2) add({ key: `opt-${slug(lead)}`, label: lead, trait: lead, kind: "option", options });
        else add({ key: `opt-${slug(lead)}`, label: lead, trait: lead, kind: "text", placeholder: "Write your choice", hint: s });
      }
      // Ability for a trait's spells ("Intelligence, Wisdom, or Charisma is your spellcasting ability ... (choose ...)")
      if ((m = new RegExp(`((?:${ABIL})(?:,? (?:or )?(?:${ABIL}))+)[^.]*?\\(choose`, "i").exec(s))) {
        add({ key: "ability-" + slug(lead), label: /spellcasting/i.test(s) ? "Spellcasting ability" : "Ability", trait: lead, kind: "ability", options: abilOpts(splitOr(m[1])) });
        continue;
      }
      if (/Long Rest|each time|every time|whenever/i.test(s)) continue;
      if (/\bOrigin feat of your choice/i.test(s)) {
        add({ key: "feat", label: "Origin feat", trait: lead, kind: "feat", featType: "Origin" });
        continue;
      }
      if ((m = /(?:know|learn) (one|two|three|a|an) cantrips? of your choice from the ([\w ,]+?) spell lists?/i.exec(s))) {
        const lists = splitOr(m[2]).map(titleCase);
        const key = `cantrip${n++}`;
        if (lists.length > 1) add({ key: key + "-list", label: "Spell list", trait: lead, kind: "option", options: lists.map(x => ({ v: x, label: x })) });
        add({ key, label: NUM[m[1].toLowerCase()] > 1 ? "Cantrips" : "Cantrip", trait: lead, kind: "spell", level: 0, n: NUM[m[1].toLowerCase()],
          list: lists.length > 1 ? null : lists[0], listFrom: lists.length > 1 ? `${ctx.id}:${key}-list` : null });
        continue;
      }
      if ((m = /Choose a level (\d) spell from the (?:(same) list|([\w]+) spell list)/i.exec(s))) {
        const prev = [...defs].reverse().find(d => d.kind === "spell");
        add({ label: `Level ${m[1]} spell`, trait: lead, kind: "spell", level: +m[1], list: (m[3] && titleCase(m[3])) || prev?.list || null, listFrom: m[2] ? prev?.listFrom || null : null });
        continue;
      }
      if (/any combination of (\w+) skills or tools of your choice/i.test(s)) {
        add({ label: "Skills or tools", trait: lead, kind: "skilltool", n: NUM[/combination of (\w+)/i.exec(s)[1].toLowerCase()] || 3 });
        continue;
      }
      if (/\bone skill or (?:with )?one tool of your choice/i.test(s)) { add({ label: "Skill or tool", trait: lead, kind: "skilltool" }); continue; }
      if ((m = /proficiency (?:in|with) (one|two|three) of the following skills(?: of your choice)?: ([^.]+)/i.exec(s))) {
        add({ label: NUM[m[1].toLowerCase()] > 1 ? "Skills" : "Skill", trait: lead, kind: "skill", n: NUM[m[1].toLowerCase()], options: skillOpts(splitOr(m[2])) });
        continue;
      }
      if ((m = /proficiency in the ((?:[A-Z][\w ]+?, )+(?:or )?[A-Z][\w ]+?) skill\b/.exec(s))) {
        add({ label: "Skill", trait: lead, kind: "skill", options: skillOpts(splitOr(m[1])) });
        continue;
      }
      if ((m = /proficiency (?:in|with) (one|two|three|a) skills? of your choice/i.exec(s))) {
        add({ label: NUM[m[1].toLowerCase()] > 1 ? "Skills" : "Skill", trait: lead, kind: "skill", n: NUM[m[1].toLowerCase()], options: skillOpts() });
        continue;
      }
      if ((m = /proficiency with (a|an|one|two|three)(?: different)? (Musical Instruments?|Artisan's Tools|Gaming Sets?)[^.]*?of your choice/i.exec(s))) {
        add({ label: titleCase(m[2]), trait: lead, kind: "tool", n: NUM[m[1].toLowerCase()], options: toolOpts(toolListFor(m[2])) });
        continue;
      }
      if ((m = /learn (one|two) (?:[\w ]+ )?languages? of your choice/i.exec(s))) {
        add({ label: "Language", trait: lead, kind: "text", n: 1, placeholder: "Which language?" });
        continue;
      }
    }
  });
  return { defs, optionLines };
}
const slug = s => norm(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Spells a piece of text simply gives you ("You know the Thaumaturgy cantrip").
export function grantedSpells(text, L) {
  const names = new Set((L.spells || []).map(s => s.name.toLowerCase()));
  const out = [];
  const re = /(?:know|learn) the ([A-Z][\w' ]+?)(?:,? and (?:the )?([A-Z][\w' ]+?))? (?:cantrips?|spells?)\b/g;
  let m;
  while ((m = re.exec(norm(text)))) [m[1], m[2]].filter(Boolean).forEach(n => { if (names.has(n.toLowerCase())) out.push(L.spells.find(s => s.name.toLowerCase() === n.toLowerCase()).name); });
  return out;
}

// Corrections stored with an entry: { drop:[labels], options:{ label: [{v,detail}] }, add:[defs] }
function applyFix(defs, fix, ctx) {
  if (!fix) return defs;
  let out = defs.filter(d => !(fix.drop || []).includes(d.label));
  for (const [label, opts] of Object.entries(fix.options || {})) {
    const d = out.find(x => x.label === label);
    const def = { id: `${ctx.id}:opt-${slug(label)}`, from: ctx.from, label, trait: label, kind: "option", n: 1, options: opts.map(o => typeof o === "string" ? { v: o, label: o } : { label: o.v, ...o }) };
    if (d) Object.assign(d, { ...def, id: d.id }); else out.push(def);
  }
  (fix.add || []).forEach((d, i) => out.push({ id: `${ctx.id}:fix${i}`, from: ctx.from, n: 1, ...d }));
  // { when: { label, v } } -> { when: { id, v } }
  out.forEach(d => {
    if (d.when && d.when.label) { const dep = out.find(x => x.label === d.when.label); d.when = dep ? { id: dep.id, v: d.when.v } : null; }
    if (d.listFrom && !d.listFrom.includes(":")) { const dep = out.find(x => x.label === d.listFrom); d.listFrom = dep ? dep.id : null; }
  });
  return out;
}

// ---- per source
export function speciesChoices(sp, L, C) {
  if (!sp) return [];
  const ctx = { id: "sp", from: sp.name };
  return applyFix(readChoices(sp.traits, ctx, L, C).defs, sp.choiceFix, ctx);
}

export function backgroundFeatNames(bg) {
  const line = /Feat:\s*([^\n]+)/.exec(bg?.effect || "");
  const raw = norm(line ? line[1] : bg?.feat || "");
  if (!raw) return [];
  return raw.split(/\s+or\s+/).map(s => s.trim());
}
const effectField = (bg, re) => norm((re.exec(bg?.effect || "") || [])[1] || "");
export function backgroundToolChoice(bg) {
  const t = norm(bg?.tool) || effectField(bg, /Tool Proficienc(?:y|ies):\s*([^\n]+)/);
  if (/musical instrument/i.test(t) && /artisan/i.test(t)) return { options: toolOpts([...TOOLS.instrument, ...TOOLS.artisan]) };
  if (!t) return null;
  const list = toolListFor(t);
  if (list && /choose|one (?:kind|type)/i.test(t)) return { options: toolOpts(list) };
  if (/\sor\s/.test(t)) return { options: toolOpts(splitOr(t)) };
  return { fixed: t };
}

export function featChoices(featName, L, C, prefix) {
  const base = norm(featName).replace(/\s*\(.*\)$/, "");
  const listFixed = (/\(([^)]+)\)/.exec(featName) || [])[1];
  const feat = [...(L.feats || []), ...(C?.homebrew?.feats || [])].find(f => f.name === base);
  if (!feat) return [];
  const ctx = { id: prefix, from: base, loose: true };
  let defs = readChoices(feat.text, ctx, L, C).defs;
  // "Magic Initiate (Cleric)" fixes the list
  if (listFixed) {
    const listDef = defs.find(d => d.label === "Spell list");
    if (listDef) {
      defs = defs.filter(d => d !== listDef);
      defs.forEach(d => { if (d.listFrom === listDef.id) { d.list = listFixed; d.listFrom = null; } });
    }
  }
  return applyFix(defs, feat.choiceFix, ctx);
}

// All choices for the draft, in order, including ones that depend on answers
// (the chosen Origin feat's own choices). `taken` = skills already granted.
export function draftChoices(app, d, scope) {
  const L = app.library, C = app.campaign;
  const picks = d.picks || {};
  const out = [];
  const pushFeat = (featName, prefix) => featChoices(featName, L, C, prefix).filter(x => whenOk(x, picks)).forEach(x => out.push({ ...x, from: featName }));
  if (scope === "species") {
    const sp = L.species.find(s => s.name === d.species);
    for (const def of speciesChoices(sp, L, C)) {
      if (!whenOk(def, picks)) continue;
      out.push(def);
      if (def.kind === "feat" && picks[def.id]) pushFeat(picks[def.id], `${def.id}>`);
    }
  } else {
    const bg = L.backgrounds.find(b => b.name === d.background);
    if (!bg) return out;
    const tool = backgroundToolChoice(bg);
    if (tool?.options) out.push({ id: "bg:tool", from: bg.name, label: "Tool proficiency", kind: "tool", n: 1, options: tool.options });
    const feats = backgroundFeatNames(bg);
    if (feats.length > 1) out.push({ id: "bg:feat", from: bg.name, label: "Feat", kind: "feat", n: 1, options: feats.map(f => ({ v: f, label: f, term: "feat:" + f.replace(/\s*\(.*$/, "") })) });
    const feat = feats.length > 1 ? picks["bg:feat"] : feats[0];
    if (feat) pushFeat(feat, "bg:feat>");
    // Duplicate proficiency: the 2024 rules let you pick a replacement
    const dup = bgSkillIds(bg).filter(id => speciesSkillPicks(app, d).includes(id));
    dup.forEach((id, i) => out.push({ id: `bg:dup${i}`, from: bg.name, label: `Replacement for ${SKILLS.find(s => s.id === id).label}`,
      hint: "Your species already gives you this skill, so pick a different one.", kind: "skill", n: 1,
      options: skillOpts().filter(o => !bgSkillIds(bg).includes(o.v) && !speciesSkillPicks(app, d).includes(o.v)) }));
  }
  return out;
}

export const whenOk = (def, picks) => !def.when || [].concat(picks?.[def.when.id] || []).includes(def.when.v);
export const bgSkillIds = bg => {
  const own = parseList(bg?.skills).map(skillIdByLabel).filter(Boolean);
  if (own.length) return own;
  return splitOr(effectField(bg, /Skill Proficienc(?:y|ies):\s*([^\n]+)/).replace(/\band\b/g, ",")).map(skillIdByLabel).filter(Boolean);
};
export const bgAbilityIds = bg => {
  const own = parseList(bg?.abilities).map(l => ABILITY_BY_LABEL[l]).filter(Boolean);
  if (own.length) return own;
  return splitOr(effectField(bg, /Ability Scores:\s*([^\n]+)/)).map(l => ABILITY_BY_LABEL[titleCase(l)]).filter(Boolean);
};
export function speciesSkillPicks(app, d) {
  return draftChoices(app, d, "species").filter(x => x.kind === "skill" || x.kind === "skilltool")
    .flatMap(x => [].concat(d.picks?.[x.id] || [])).filter(v => SKILLS.some(s => s.id === v));
}

// Options for spell/feat choices are computed from the library.
export function optionsFor(def, app, d, char) {
  if (def.options) return def.options;
  const L = app.library, C = app.campaign;
  if (def.kind === "feat") {
    const allow = C?.enabled?.feats ? new Set([...C.enabled.feats, ...(C.homebrew?.feats || []).map(f => f.name)]) : null;
    return [...L.feats, ...(C?.homebrew?.feats || [])]
      .filter(f => (!def.featType || /^Origin/i.test(f.type || "")) && (!allow || allow.has(f.name)))
      .map(f => ({ v: f.name, label: f.name, sub: f.type, term: "feat:" + f.name }));
  }
  if (def.kind === "spell") {
    const list = def.list || (def.listFrom ? (d.picks || {})[def.listFrom] : null);
    if (!list) return [];
    const allow = C?.enabled?.spells ? new Set(C.enabled.spells) : null;
    return [...L.spells, ...(C?.homebrew?.spells || [])]
      .filter(s => s.level === def.level && parseList(s.classes).includes(list) && (!allow || allow.has(s.name)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => ({ v: s.name, label: s.name, sub: [s.school, s.time].filter(Boolean).join(" · "), term: "spell:" + s.name }));
  }
  if (def.kind === "skilltool") return [...skillOpts(), ...toolOpts(ALL_TOOLS).map(o => ({ ...o, sub: "Tool" }))];
  return [];
}

export function isAnswered(def, picks) {
  const v = picks?.[def.id];
  if (def.kind === "text") return !!String(v || "").trim();
  const arr = [].concat(v || []).filter(Boolean);
  return arr.length >= def.n;
}

// Fill anything unanswered at random (for "Pick for me").
export function randomize(defs, app, d) {
  d.picks = d.picks || {};
  for (const def of defs) {
    if (isAnswered(def, d.picks) || def.kind === "text") continue;
    const opts = optionsFor(def, app, d).map(o => o.v).filter(v => !Object.values(d.picks).flat().includes(v) || def.kind === "ability");
    const chosen = [];
    while (chosen.length < def.n && opts.length) chosen.push(opts.splice(Math.floor(Math.random() * opts.length), 1)[0]);
    d.picks[def.id] = def.n > 1 ? chosen : chosen[0];
  }
}

// Apply answers to a new character.
export function applyChoices(char, defs, picks, L, extraText = []) {
  const add = (list, v) => { if (v && !list.includes(v)) list.push(v); };
  const tools = [];
  const notes = [];
  char.choices = char.choices || {};
  const spells = char.spellcasting.spells;
  const giveSpell = (name, source) => { if (name && !spells.some(s => s.name === name)) spells.push({ name, prepared: true, always: true, source }); };
  for (const def of defs) {
    const vals = [].concat(picks?.[def.id] || []).filter(Boolean);
    if (!vals.length) continue;
    const label = `${def.from}: ${def.label}`;
    switch (def.kind) {
      case "size": char.size = vals[0]; break;
      case "skill": vals.forEach(v => add(char.skillProf, v)); break;
      case "tool": vals.forEach(v => add(tools, v)); break;
      case "skilltool": vals.forEach(v => SKILLS.some(s => s.id === v) ? add(char.skillProf, v) : add(tools, v)); break;
      case "feat": vals.forEach(v => add(char.feats, v)); break;
      case "spell": vals.forEach(v => giveSpell(v, def.from)); break;
      case "ability": char.choices[label] = vals; notes.push(`${label}: ${vals.map(a => ABILITY_LABEL[a]).join(", ")}`); break;
      case "text": notes.push(`${label}: ${vals[0]}`); if (def.label === "Language") char.languages = [char.languages, vals[0]].filter(Boolean).join(", "); break;
      case "option": {
        char.choices[label] = vals;
        notes.push(`${label}: ${vals.join(", ")}`);
        for (const v of vals) {
          const opt = (def.options || []).find(o => o.v === v);
          grantedSpells(opt?.detail || "", L).forEach(s => giveSpell(s, `${def.from} (${v})`));
          const lv1 = /(?:^|\n)Level 1:\s*([^\n]+)/.exec(opt?.detail || "");
          const sp1 = lv1 && (L.spells || []).find(x => x.name.toLowerCase() === norm(lv1[1]).toLowerCase());
          if (sp1) giveSpell(sp1.name, `${def.from} (${v})`);
        }
        break;
      }
    }
  }
  extraText.forEach(([text, source]) => grantedSpells(text, L).forEach(s => giveSpell(s, source)));
  if (tools.length) char.profsText = [char.profsText, `Tools: ${tools.join(", ")}`].filter(Boolean).join(". ");
  if (notes.length) char.classFeatureNotes = [char.classFeatureNotes, ...notes].filter(Boolean).join("\n");
  return char;
}

// Species trait text with the option tables removed (for granted spells that aren't optional)
export function speciesBaseText(sp, L, C) {
  if (!sp) return "";
  const { optionLines } = readChoices(sp.traits, { id: "sp", from: sp.name }, L, C);
  const fixed = Object.values(sp.choiceFix?.options || {}).flat().map(o => norm(o.detail || ""))
    .concat((sp.choiceFix?.add || []).flatMap(d => (d.options || []).map(o => norm(o.detail || "")))).join("\n");
  return String(sp.traits).split(/\n/).filter((l, i) => !optionLines.has(i) && !(norm(l) && fixed.includes(norm(l)))).join("\n");
}
