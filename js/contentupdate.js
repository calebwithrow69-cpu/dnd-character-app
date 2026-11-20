// Content update popup data: the record in library.update, grouped for the screen, with a word diff for
// before/after text and the per-device "seen" marker. Pure (no DOM); the screen is js/views/contentupdate.js.

export const LS_SEEN = "dnd-update-seen";
export const STATUS = [["new", "New"], ["changed", "Changed"], ["removed", "Removed"]];
export const EFFECT = { buff: "Buff", nerf: "Nerf", mixed: "Mixed", neutral: "Neutral" };

export const hasUpdate = u => !!(u && u.id && Array.isArray(u.items) && u.items.length);
export function groupItems(u) {
  const g = { new: [], changed: [], removed: [] };
  for (const [i, it] of ((u && u.items) || []).entries()) if (g[it.status]) g[it.status].push({ ...it, key: String(i) });
  return g;
}

// Word-level diff. Returns the two sides as runs [{s, mark}] where mark is "" (same), "del" (only before) or "ins" (only after).
export function wordDiff(a, b) {
  const tok = s => String(s == null ? "" : s).split(/(\s+)/).filter(x => x !== "");
  const A = tok(a), B = tok(b), n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const before = [], after = [], push = (arr, s, mark) => { const l = arr[arr.length - 1]; if (l && l.mark === mark) l.s += s; else arr.push({ s, mark }); };
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { push(before, A[i], ""); push(after, B[j], ""); i++; j++; }
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) { push(after, B[j], "ins"); j++; }
    else { push(before, A[i], "del"); i++; }
  }
  // whitespace alone is never worth a highlight
  for (const side of [before, after]) for (const r of side) if (r.mark && !r.s.trim()) r.mark = "";
  return { before, after };
}

// Long text: only the lines that changed, with the changed words marked; runs of identical lines collapse to one "skip" run.
export function changeView(a, b) {
  const A = String(a == null ? "" : a).split("\n"), B = String(b == null ? "" : b).split("\n"), n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const segs = []; let i = 0, j = 0;
  const cur = () => { const l = segs[segs.length - 1]; if (l && l.t === "chg") return l; const x = { t: "chg", del: [], ins: [] }; segs.push(x); return x; };
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { const l = segs[segs.length - 1]; if (l && l.t === "same") l.k++; else segs.push({ t: "same", k: 1 }); i++; j++; }
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) cur().ins.push(B[j++]);
    else cur().del.push(A[i++]);
  }
  const before = [], after = [], sep = arr => { if (arr.length) arr.push({ s: "\n", mark: "" }); };
  for (const sg of segs) {
    if (sg.t === "same") { for (const arr of [before, after]) { sep(arr); arr.push({ s: "\u2026", mark: "skip" }); } continue; }
    const d = wordDiff(sg.del.join("\n"), sg.ins.join("\n"));
    sep(before); before.push(...d.before); sep(after); after.push(...d.after);
  }
  return { before, after };
}

// How one changed field reads: text fields diff by word, lists and numbers print plainly.
export const isLong = v => typeof v === "string" && (v.length > 60 || v.includes("\n"));
export const show = v => v == null || v === "" ? "None" : Array.isArray(v) ? (v.length ? v.join(", ") : "None") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);

// ---- seen (this device)
export const seenId = (store = globalThis.localStorage) => { try { return store.getItem(LS_SEEN) || ""; } catch (e) { return ""; } };
export const markSeen = (id, store = globalThis.localStorage) => { try { store.setItem(LS_SEEN, id); } catch (e) { } };
// Show on launch when there is an update this device has not seen. A device with no characters yet is new:
// it starts at the current update instead of reading changes to rules it never used.
export function shouldShow(u, { seen, hasCharacters, automated }) {
  if (!hasUpdate(u) || seen === u.id || automated) return false;
  return hasCharacters || !!seen;
}
