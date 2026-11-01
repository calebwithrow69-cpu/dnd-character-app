// Subclass spell lists ("Life Domain Spells", "Oath Spells", ...): a table of class level -> spells
// the subclass always has prepared. This reads those tables out of the rules text (nothing reworded)
// and keeps the matching spells on the character as always-prepared. No DOM in here.

// A table row: class level, then the spells (separated by | / : tab, or a run of spaces; "3rd level:" too).
const ROW = /^\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s+level)?\s*(?:\||\t|\/|:|\s{2,}|\s)\s*(.+?)\s*$/i;
const CELL = /\t|\s{2,}|\s*\|\s*/;
const norm = s => String(s || "").toLowerCase().replace(/[’`]/g, "'").replace(/\*/g, "").replace(/[^a-z0-9' \/]/g, " ").replace(/\s+/g, " ").trim();
function dist(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Find a spell in the rules by name: exact (case/punctuation blind), then within two typos.
export function findSpellName(L, raw) {
  const want = norm(raw); if (!want) return null;
  const list = L.spells || [];
  const hit = list.find(s => norm(s.name) === want);
  if (hit) return hit.name;
  let best = null, bd = 3;
  for (const s of list) { const d = dist(want, norm(s.name)); if (d < bd) { bd = d; best = s.name; } }
  return best && bd <= 2 && want.length >= 6 ? best : null;
}

// Find spell tables anywhere in a block of text. The book text was typed in by hand, so a table can sit
// inside any feature (often the subclass intro), under a title, a "Level N: X Spells" line or no title.
// A table starts at a line that has "Level" and "Spells" columns, or a "... Spells" title line, and runs
// over the rows below it while the levels keep climbing.
export function findSpellTables(text) {
  const lines = String(text || "").split("\n").flatMap(l => l.split(/\s+(?=\d{1,2}\s*\|\s)/));
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].trim();
    if (!h || h.length > 90 || /[.!?]$/.test(h)) continue;
    const colHead = /\blevel\b/i.test(h) && /\bspells?\b/i.test(h);
    const title = /^(?:Level \d+:\s*)?[A-Za-z' \-]+\bSpells\s*$/.test(h) && !/\blevel\b/i.test(h.replace(/^Level \d+:\s*/, ""));
    if (!colHead && !title) continue;
    let cols = [];
    let label = "";
    if (colHead) { for (let k = i - 1; k >= 0 && k >= i - 3; k--) { const pv = lines[k].trim(); if (!pv) continue; if (/^[A-Za-z' ]{4,40}$/.test(pv) && !/\b(spells?|level)\b/i.test(pv)) label = pv; break; } }
    if (colHead) cols = h.split(CELL).map(x => x.trim()).filter(Boolean).slice(1).filter(x => !/^(prepared )?spells?$/i.test(x));
    const rows = []; let last = 0, j = i + 1;
    for (; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      // a title followed by a header row with one column per option ("Cleric Level   Sowing   Growing   Reaping")
      if (!rows.length && !cols.length && /\blevel\b/i.test(lines[j]) && !ROW.test(lines[j])) { const c = lines[j].split(CELL).map(x => x.trim()).filter(Boolean).slice(1); if (c.length > 1) cols = c; continue; }
      const m = ROW.exec(lines[j]);
      if (!m) { if (!rows.length && /\blevel\b|\bspells?\b/i.test(lines[j]) && lines[j].trim().length < 60) continue; break; }
      const lv = Number(m[1]);
      if (lv <= last || lv > 20) break;
      last = lv; rows.push({ lv, cells: m[2].split(CELL).map(x => x.trim()).filter(Boolean) });
    }
    if (rows.length) { tables.push({ cols, rows, label }); i = j - 1; }
  }
  return tables;
}

const resolve = (L, cell, g) => { for (const part of cell.split(",")) { const raw = part.trim(); if (!raw) continue; const name = findSpellName(L, raw); if (name) { if (!g.spells.includes(name)) g.spells.push(name); } else g.missing.push(raw); } };

// Everything a subclass's tables say: `grants` = [{lv, spells, missing}] for plain tables (always prepared),
// `choices` = [{name, rows:[{lv, spells, missing}]}] for tables with one column per option (Harvest Domain's
// Sowing/Growing/Reaping, Circle of the Land's terrains): the player picks a column.
export function subclassSpellTables(sc, L) {
  const grants = new Map(), choices = new Map();
  for (const f of sc?.features || []) {
    const tables = findSpellTables(f.text);
    const named = tables.filter(t => t.label).length >= 2; // several titled tables ("Arid Land", "Polar Land"): pick one
    for (const t of tables) {
      const multi = t.cols.length > 1 && t.rows.some(r => r.cells.length >= t.cols.length);
      if (named && t.label) {
        const rows = choices.get(t.label) || []; choices.set(t.label, rows);
        for (const r of t.rows) { const g = { lv: r.lv, spells: [], missing: [] }; r.cells.forEach(c => resolve(L, c, g)); rows.push(g); }
      } else if (!multi) {
        for (const r of t.rows) { const g = grants.get(r.lv) || { lv: r.lv, spells: [], missing: [] }; grants.set(r.lv, g); r.cells.forEach(c => resolve(L, c, g)); }
      } else {
        t.cols.forEach((name, ci) => {
          const rows = choices.get(name) || []; choices.set(name, rows);
          for (const r of t.rows) { const g = { lv: r.lv, spells: [], missing: [] }; if (r.cells[ci]) resolve(L, r.cells[ci], g); if (g.spells.length || g.missing.length) rows.push(g); }
        });
      }
    }
  }
  return { grants: [...grants.values()].sort((a, b) => a.lv - b.lv), choices: [...choices].map(([name, rows]) => ({ name, rows })) };
}
export const subclassSpellGrants = (sc, L) => subclassSpellTables(sc, L).grants;

export const pickKey = sub => `${sub} spell list`;
export const subSource = sc => `${sc} spells`;

// Make the character's always-prepared list match its subclass and class level. Returns the names added.
export function syncSubclassSpells(c, L) {
  if (!c?.subclass || !c.spellcasting) return [];
  const sc = (L.subclasses || []).find(s => s.name === c.subclass && s.cls === c.class);
  const src = subSource(c.subclass);
  const tables = subclassSpellTables(sc, L);
  // A table with options (Circle of the Land's terrains, Harvest Domain's aspects): the pick is kept in c.choices.
  const pick = tables.choices.find(o => o.name === (c.choices || {})[pickKey(c.subclass)]);
  const rows = [...tables.grants, ...(pick ? pick.rows : [])];
  const want = new Set(rows.filter(g => g.lv <= (c.level || 1)).flatMap(g => g.spells));
  const list = c.spellcasting.spells || (c.spellcasting.spells = []);
  // Drop grants from a subclass the character no longer has, or that are no longer earned.
  for (let i = list.length - 1; i >= 0; i--) {
    const sp = list[i];
    if (!sp.fromSubclass || (sp.source === src && want.has(sp.name))) continue;
    if (sp.picked) { sp.always = false; delete sp.fromSubclass; delete sp.picked; delete sp.source; } // the player had chosen it already
    else list.splice(i, 1);
  }
  const added = [];
  for (const name of want) {
    const have = list.find(s => s.name === name);
    if (have) { if (!have.always) { have.always = true; have.prepared = true; have.source = src; have.fromSubclass = true; have.picked = true; } continue; }
    list.push({ name, prepared: true, always: true, source: src, fromSubclass: true }); added.push(name);
  }
  return added;
}
