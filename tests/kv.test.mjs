import { openKv, memoryBackend, safariAtRisk } from "../js/kv.js";
import * as N from "../js/notes.js";
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log("  ok  " + n); } catch (e) { failed++; console.log("FAIL  " + n + " - " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };
const ls = (seed = {}) => { const m = new Map(Object.entries(seed)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, _m: m }; };
const ledger = (n, t) => JSON.stringify({ v: 1, notes: Array.from({ length: n }, (_, i) => ({ id: "n" + i, title: "t", body: "b", cat: "General", pin: false, created: t, updated: t + i })), cats: ["General"], migrated: [], badges: {} });

await test("existing notes in localStorage move to IndexedDB, verified, with a backup copy", async () => {
  const L = ledger(3, 1000), l = ls({ [N.KEY]: L, "dnd-characters-v1": "{\"a\":1}" }), b = memoryBackend();
  const kv = await openKv([N.KEY], l, b);
  assert(kv.getItem(N.KEY) === L && N.load(kv).notes.length === 3, "same notes after migration");
  assert(b._m.get(N.KEY) === L && b._m.get(N.KEY + "#backup") === L, "copy and backup in IndexedDB");
  assert(l.getItem(N.KEY) === null, "legacy key removed only after the check");
  assert(l.getItem("dnd-characters-v1") === "{\"a\":1}", "characters are never touched");
  assert(kv.status.migrated.length === 1 && !kv.status.failed, "status");
});
await test("a failed or unverifiable copy leaves localStorage as it was", async () => {
  const L = ledger(2, 5), l = ls({ [N.KEY]: L });
  const bad = memoryBackend(); bad.put = async () => { throw new Error("quota"); };
  const kv = await openKv([N.KEY], l, bad); assert(kv.status.failed && l.getItem(N.KEY) === L && kv.getItem(N.KEY) === L, "kept in localStorage");
  const lying = memoryBackend(); lying.get = async () => "other";
  const l2 = ls({ [N.KEY]: L }); const kv2 = await openKv([N.KEY], l2, lying); assert(kv2.status.failed && l2.getItem(N.KEY) === L, "readback mismatch keeps the legacy copy");
  kv.setItem(N.KEY, "x"); assert(l.getItem(N.KEY) === "x", "writes keep going to localStorage for that key");
});
await test("no IndexedDB at all: plain localStorage", async () => {
  const l = ls({ [N.KEY]: ledger(1, 1) }), kv = await openKv([N.KEY], l, null);
  assert(kv.status.mode === "local" && N.load(kv).notes.length === 1, "reads"); kv.setItem(N.KEY, "y"); assert(l.getItem(N.KEY) === "y", "writes");
});
await test("writes go to the cache at once and to IndexedDB after flush; a leftover legacy copy is reconciled", async () => {
  const b = memoryBackend(), l = ls(), kv = await openKv([N.KEY], l, b);
  assert(kv.getItem(N.KEY) === null, "empty at first"); kv.setItem(N.KEY, "a"); assert(kv.getItem(N.KEY) === "a", "sync read"); await kv.flush(); assert(b._m.get(N.KEY) === "a", "persisted");
  const old = ledger(2, 10), fresh = ledger(1, 99), l2 = ls({ [N.KEY]: old }), b2 = memoryBackend({ [N.KEY]: fresh });
  const kv2 = await openKv([N.KEY], l2, b2, { pick: N.newer }); assert(kv2.getItem(N.KEY) === fresh && b2._m.get(N.KEY + "#older") === old && l2.getItem(N.KEY) === null, "newer copy wins, the other is kept");
  const kv3 = await openKv([N.KEY], ls(), b2, { pick: N.newer }); assert(kv3.getItem(N.KEY) === fresh && !kv3.status.migrated.length, "second launch has nothing to migrate");
});
await test("a write failure falls back to localStorage and reports", async () => {
  const b = memoryBackend(), l = ls(); let err = 0; const kv = await openKv([N.KEY], l, b, { onError: () => { err++; } });
  b.put = async () => { throw new Error("full"); }; kv.setItem(N.KEY, "z"); await kv.flush(); await new Promise(r => setTimeout(r));
  assert(err === 1 && l.getItem(N.KEY) === "z" && kv.status.failed, "fallback");
});
await test("notes survive a full save-load cycle through the cache", async () => {
  const kv = await openKv([N.KEY], ls(), memoryBackend()), d = N.load(kv); const n = N.addNote(d, "General"); N.edit(n, { title: "Hello", body: "World" }); assert(N.save(d, kv), "save");
  assert(N.load(kv).notes[0].title === "Hello", "reload");
});
await test("Safari without the install is flagged; installed and other browsers are not", () => {
  const ios = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", maxTouchPoints: 5 };
  const mac = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", maxTouchPoints: 0 };
  const chrome = { userAgent: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36", maxTouchPoints: 0 };
  assert(safariAtRisk(ios, false) && safariAtRisk(mac, false) && !safariAtRisk(ios, true) && !safariAtRisk(chrome, false), "cases");
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
