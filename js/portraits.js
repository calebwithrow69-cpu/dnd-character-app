// Species portraits the player uploads. They live in this browser's IndexedDB
// (not in localStorage, which characters share), are shrunk before saving, and
// travel inside backups. Nothing is uploaded anywhere.
// ASCII only in this file.

const DB = "cr-portraits", STORE = "p";
const cache = new Map();
let ready = null, broken = false;

function open() {
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error("no indexedDB"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export function loadPortraits() {
  if (ready) return ready;
  ready = (async () => {
    try {
      const db = await open();
      await new Promise(done => {
        const tx = db.transaction(STORE, "readonly");
        const q = tx.objectStore(STORE).openCursor();
        q.onsuccess = () => { const c = q.result; if (c) { cache.set(c.key, c.value); c.continue(); } };
        tx.oncomplete = done; tx.onerror = done; tx.onabort = done;
      });
      db.close();
    } catch (e) { broken = true; }
  })();
  return ready;
}

export const portraitFor = (name) => cache.get(name) || "";
export const portraitsBroken = () => broken;
export const allPortraits = () => Object.fromEntries(cache);

async function write(fn) {
  try {
    const db = await open();
    await new Promise((done, fail) => {
      const tx = db.transaction(STORE, "readwrite");
      fn(tx.objectStore(STORE));
      tx.oncomplete = done; tx.onerror = () => fail(tx.error); tx.onabort = () => fail(tx.error);
    });
    db.close();
    return true;
  } catch (e) { broken = true; return false; }
}

// Crop to 3:4 and shrink so a portrait is ~40-80 KB.
export function shrink(file, w = 480, h = 640) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d");
      const sc = Math.max(w / img.width, h / img.height);
      const dw = img.width * sc, dh = img.height * sc;
      g.fillStyle = "#14100F"; g.fillRect(0, 0, w, h);
      g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That file isn't an image the browser can open.")); };
    img.src = url;
  });
}

// Returns true if it was also saved for next time, false if it only lasts this visit.
export async function savePortrait(name, file) {
  const data = await shrink(file);
  cache.set(name, data);
  return write(s => s.put(data, name));
}
export async function removePortrait(name) {
  cache.delete(name);
  return write(s => s.delete(name));
}
export async function importPortraits(obj) {
  const entries = Object.entries(obj || {}).filter(([k, v]) => k && typeof v === "string" && v.startsWith("data:image/"));
  entries.forEach(([k, v]) => cache.set(k, v));
  if (entries.length) await write(s => entries.forEach(([k, v]) => s.put(v, k)));
  return entries.length;
}
