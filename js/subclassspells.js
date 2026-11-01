// Subclass spell lists ("Life Domain Spells", "Oath Spells", ...): a table of class level -> spells
// the subclass always has prepared. This reads those tables out of the rules text (nothing reworded)
// and keeps the matching spells on the character as always-prepared. No DOM in here.

const ROW = /^\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s+level)?\s*(?:\||\t|\/|:)\s*(.+?)\s*$/i;
const NAME_RE = /spells$|expanded spell|spell list$/i;

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

// [{lv, spells:[names], missing:[raw names not found]}] for one subclass, or [] when it has no
// plain level table (Harvest Domain's per-aspect columns are left to the player).
export function subclassSpellGrants(sc, L) {
  const out = new Map();
  for (const f of sc?.features || []) {
    if (f.intro || !NAME_RE.test(f.name || "")) continue;
    let last = 0;
    // A row that ran into the next one ("Fear, Fly 7 | Arcane Eye") is split back into two rows.
    const lines = String(f.text || "").split("\n").flatMap(l => l.split(/\s+(?=\d{1,2}\s*\|\s)/));
    for (const line of lines) {
      const m = ROW.exec(line); if (!m) continue;
      const lv = Number(m[1]);
      if (lv <= last || lv > 20) break; // the table ends where the levels stop climbing (a d6 table can follow)
      last = lv;
      const g = out.get(lv) || { lv, spells: [], missing: [] }; out.set(lv, g);
      for (const part of m[2].split(",")) {
        const raw = part.trim(); if (!raw) continue;
        const name = findSpellName(L, raw);
        if (name) { if (!g.spells.includes(name)) g.spells.push(name); } else g.missing.push(raw);
      }
    }
  }
  return [...out.values()].sort((a, b) => a.lv - b.lv);
}

export const subSource = sc => `${sc} spells`;

// Make the character's always-prepared list match its subclass and class level. Returns the names added.
export function syncSubclassSpells(c, L) {
  if (!c?.subclass || !c.spellcasting) return [];
  const sc = (L.subclasses || []).find(s => s.name === c.subclass && s.cls === c.class);
  const src = subSource(c.subclass);
  const want = new Set(subclassSpellGrants(sc, L).filter(g => g.lv <= (c.level || 1)).flatMap(g => g.spells));
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
