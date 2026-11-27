// Physical traits (age, height, weight, eyes, hair, skin): plain short text, kept on the character as c.phys.
export const PHYS = [
  ["age", "Age", "e.g. 27"], ["height", "Height", "e.g. 5 ft 9 in"], ["weight", "Weight", "e.g. 160 lb"],
  ["eyes", "Eyes", "e.g. Green"], ["hair", "Hair", "e.g. Black"], ["skin", "Skin", "e.g. Tan"]
];
export const PHYS_KEYS = PHYS.map(p => p[0]);
export function physOf(src) {
  const o = {};
  PHYS_KEYS.forEach(k => { const v = src && typeof src[k] === "string" ? src[k].replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40) : ""; o[k] = v; });
  return o;
}
export const physFilled = p => PHYS_KEYS.some(k => p && p[k]);
