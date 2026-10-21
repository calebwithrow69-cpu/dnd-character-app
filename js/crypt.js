// Password lock for the rules data. AES-256-GCM, key from the group
// password via PBKDF2-SHA256 (600,000 rounds). Works in browsers and in
// Node 20+ (both expose the same Web Crypto API), so the same code both
// locks the file before it's published and unlocks it on each device.

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
export const ITERATIONS = 600000;

export function toB64(bytes) {
  let s = "";
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(str) {
  const s = atob(str), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Raw key bytes (b64) so a device can remember the key instead of the password.
export async function deriveKey(password, saltB64, iterations = ITERATIONS) {
  const base = await subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations }, base, 256);
  return toB64(bits);
}
async function aesKey(rawB64, usage) {
  return subtle().importKey("raw", fromB64(rawB64), "AES-GCM", false, [usage]);
}

export async function encryptJSON(obj, password, { saltB64 } = {}) {
  const salt = saltB64 || toB64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const raw = await deriveKey(password, salt);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, await aesKey(raw, "encrypt"), enc.encode(JSON.stringify(obj)));
  return { locked: "character-runner", v: 1, kdf: "PBKDF2-SHA256", iterations: ITERATIONS, salt, iv: toB64(iv), data: toB64(ct) };
}

// Throws if the key is wrong (AES-GCM checks integrity).
export async function decryptWithKey(file, rawKeyB64) {
  const pt = await subtle().decrypt({ name: "AES-GCM", iv: fromB64(file.iv) }, await aesKey(rawKeyB64, "decrypt"), fromB64(file.data));
  return JSON.parse(dec.decode(pt));
}
export async function decryptWithPassword(file, password) {
  const raw = await deriveKey(password, file.salt, file.iterations || ITERATIONS);
  return { data: await decryptWithKey(file, raw), key: raw };
}
export const isLockedFile = f => !!(f && f.locked === "character-runner" && f.data && f.iv && f.salt);
