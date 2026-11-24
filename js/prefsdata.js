// Settings data: which preference keys belong to which Settings section, and the
// export/import of a settings file. Pure, no DOM. ASCII only.
export const SECTION_KEYS = {
  appearance: ["theme", "accent", "size", "font", "corners", "density"],
  feel: ["sfx", "vol", "haptics"],
  sheet: ["startTab", "width", "showxp", "showquick"],
  play: ["wake", "vignette", "rollfx", "cxfx", "keys", "turns", "concprompt"],
  access: ["motion", "contrast", "bigtap"],
  data: ["backupDays"],
  experimental: ["experimental"],
  about: ["updateSplash"]
};

const CHOICES = {
  theme: ["auto", "dark", "light"], accent: ["oxblood", "teal", "violet", "gold", "blue", "green", "silver"],
  size: ["small", "normal", "large", "xl"], font: ["tome", "plain"], corners: ["sharp", "soft", "round"],
  density: ["compact", "normal", "roomy"], sfx: ["on", "off"], haptics: ["on", "off"], startTab: ["stats", "rules"],
  width: ["standard", "wide"], rollfx: ["full", "crits", "off"], motion: ["auto", "reduced"], contrast: ["normal", "high"],
  backupDays: ["0", "7", "14", "30"], sheetStyle: ["classic", "advanced"]
};
const BOOLS = ["wake", "vignette", "cxfx", "keys", "turns", "concprompt", "bigtap", "showxp", "showquick", "experimental", "updateSplash"];

export const SETTINGS_KEYS = [...Object.values(SECTION_KEYS).flat(), "sheetStyle"];

export function exportSettings(prefs) {
  const out = {};
  SETTINGS_KEYS.forEach(k => { if (prefs && prefs[k] !== undefined) out[k] = prefs[k]; });
  return { kind: "settings", v: 1, prefs: out };
}

// Takes parsed JSON, returns only known keys with valid values. Throws on a file that is not a settings file.
export function cleanSettings(obj) {
  if (!obj || obj.kind !== "settings" || typeof obj.prefs !== "object" || !obj.prefs) throw new Error("Not a settings file");
  const out = {};
  for (const k of SETTINGS_KEYS) {
    const v = obj.prefs[k];
    if (v === undefined) continue;
    if (k === "vol") { const n = Number(v); if (Number.isFinite(n)) out.vol = Math.max(0, Math.min(100, Math.round(n))); }
    else if (BOOLS.includes(k)) { if (typeof v === "boolean") out[k] = v; }
    else if (CHOICES[k] && CHOICES[k].includes(String(v))) out[k] = String(v);
  }
  return out;
}

export function resetKeys(prefs, section) {
  (SECTION_KEYS[section] || []).forEach(k => { delete prefs[k]; });
  return prefs;
}
