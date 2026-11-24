// Update splash (pure): which changelog entries a device has not seen, and whether to open the splash. ASCII only.
export function cmpVer(a, b) {
  const x = String(a || "").split(".").map(n => parseInt(n, 10) || 0), y = String(b || "").split(".").map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length, 3); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
// Entries newer than `seen`, newest first, at most `cap`; `more` counts the ones left out.
export function entriesSince(changelog, seen, cap = 8) {
  const all = (changelog || []).filter(e => cmpVer(e.v, seen) > 0).sort((a, b) => cmpVer(b.v, a.v));
  return { list: all.slice(0, cap), more: Math.max(0, all.length - cap) };
}
// prev = the version this device last opened ("" on a new device). hasContent = rule changes are waiting.
export function splashPlan({ prev, version, enabled, automated, hasContent, changelog }) {
  const none = { show: false, list: [], more: 0 };
  if (automated || !enabled || !prev) return none;
  const changed = cmpVer(prev, version) < 0;
  if (!changed && !hasContent) return none;
  return { show: true, ...(changed ? entriesSince(changelog, prev) : { list: [], more: 0 }) };
}
