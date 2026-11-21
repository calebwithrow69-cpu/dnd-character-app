// Key-value storage for data that can grow without a fixed ceiling (the notes ledger).
// localStorage holds about 5M characters for the whole site and a full quota would break character saves,
// so these keys live in IndexedDB. A cache keeps reads and writes synchronous for the rest of the app.
// Characters stay in localStorage (store.js). IndexedDB is wiped by Safari's 7-day rule just like localStorage;
// protection against that is the Home Screen install, persist(), and backups.

const DB = "dnd-kv-v1", TABLE = "kv";

export function idbBackend(name = DB) {
  if (typeof indexedDB === "undefined") return null;
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((ok, no) => {
    try {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TABLE)) r.result.createObjectStore(TABLE); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error || new Error("indexedDB blocked"));
      r.onblocked = () => no(new Error("indexedDB blocked"));
    } catch (e) { no(e); }
  }));
  const run = (mode, f) => open().then(db => new Promise((ok, no) => {
    const tx = db.transaction(TABLE, mode), req = f(tx.objectStore(TABLE));
    tx.oncomplete = () => ok(req && req.result); tx.onerror = tx.onabort = () => no(tx.error || new Error("indexedDB write failed"));
  }));
  return { get: k => run("readonly", s => s.get(k)).then(v => (v === undefined ? null : v)), put: (k, v) => run("readwrite", s => s.put(v, k)), del: k => run("readwrite", s => s.delete(k)) };
}

// Same interface in memory, for tests.
export function memoryBackend(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { get: async k => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); }, _m: m };
}

// Opens the cache for `keys`. For each key a value left in localStorage by an older version is copied into the
// backend, read back and compared, kept as `<key>#backup`, and only then removed from localStorage. A mismatch
// or error leaves localStorage untouched and that key keeps writing there. Nothing is ever dropped on a failure.
// pick(a, b) chooses between two differing copies (the other is kept as `<key>#older`).
export async function openKv(keys, ls, backend, { pick = (legacy) => legacy, onError = () => { } } = {}) {
  const cache = new Map(), local = new Set(), pending = new Set();
  const status = { mode: backend ? "indexeddb" : "local", migrated: [], failed: false };
  for (const k of keys) {
    const legacy = (() => { try { return ls.getItem(k); } catch (e) { return null; } })();
    if (!backend) { cache.set(k, legacy); local.add(k); continue; }
    try {
      const stored = await backend.get(k);
      let value = stored;
      if (legacy != null) {
        value = stored == null ? legacy : stored === legacy ? stored : pick(legacy, stored);
        if (stored != null && stored !== legacy) await backend.put(k + "#older", value === legacy ? stored : legacy);
        if (stored !== value) await backend.put(k, value);
        if (stored == null) await backend.put(k + "#backup", legacy);
        if ((await backend.get(k)) !== value) throw new Error("verify failed");
        try { ls.removeItem(k); } catch (e) { /* the copy in IndexedDB is verified; a leftover is picked up next launch */ }
        status.migrated.push(k);
      }
      cache.set(k, value);
    } catch (e) { cache.set(k, legacy); local.add(k); status.failed = true; }
  }
  const fail = (k, v, e) => { status.failed = true; local.add(k); try { ls.setItem(k, v); } catch (x) { /* quota */ } onError(e); };
  return {
    status,
    getItem: k => (cache.has(k) ? cache.get(k) : null),
    setItem(k, v) {
      v = String(v); cache.set(k, v);
      if (local.has(k) || !backend) { ls.setItem(k, v); return; }
      const p = backend.put(k, v).catch(e => fail(k, v, e)).finally(() => pending.delete(p)); pending.add(p);
    },
    removeItem(k) { cache.delete(k); try { ls.removeItem(k); } catch (e) { } if (backend) { const p = backend.del(k).catch(() => { }).finally(() => pending.delete(p)); pending.add(p); } },
    flush: () => Promise.all([...pending])
  };
}

// What the browser reports for this site (all storage, not just notes). null when unsupported.
export async function estimate() {
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e && e.quota) return { est: true, used: e.usage || 0, quota: e.quota, pct: Math.min(100, (e.usage || 0) / e.quota * 100) }; } } catch (e) { }
  return null;
}

// Safari without the Home Screen install: its 7-day rule erases site storage.
export function safariAtRisk(nav = globalThis.navigator, standalone) {
  const ua = (nav && nav.userAgent) || "", ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  const safari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android/.test(ua);
  const installed = standalone != null ? standalone : !!(nav && nav.standalone);
  return (safari || ios) && !installed;
}
