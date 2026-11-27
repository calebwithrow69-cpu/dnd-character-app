// Shop search with typo tolerance. Pure. ASCII only.
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
function dist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// Score of one query word against one name word: 0 prefix, 1 inside, 2-4 near miss, null no match.
function wordScore(q, w) {
  if (w.startsWith(q)) return 0;
  if (q.length >= 3 && w.includes(q)) return 1;
  if (q.length < 3) return null;
  const max = q.length >= 7 ? 2 : 1;
  const d = Math.min(dist(q, w, max), dist(q, w.slice(0, q.length), max), dist(q, w.slice(0, q.length + 1), max));
  return d <= max ? 2 + d : null;
}
// Lower is better; null when a query word matches nothing in the name.
export function searchScore(name, query) {
  const qs = norm(query).split(" ").filter(Boolean);
  if (!qs.length) return 0;
  const ws = norm(name).split(" ").filter(Boolean);
  let total = 0;
  for (const q of qs) {
    let best = null;
    for (const w of ws) { const s = wordScore(q, w); if (s != null && (best == null || s < best)) best = s; }
    if (best == null) return null;
    total += best;
  }
  return total;
}
export function searchRows(rows, query) {
  if (!norm(query)) return rows;
  return rows.map(r => ({ r, s: searchScore(r.name, query) })).filter(x => x.s != null)
    .sort((a, b) => a.s - b.s || a.r.name.localeCompare(b.r.name)).map(x => x.r);
}
