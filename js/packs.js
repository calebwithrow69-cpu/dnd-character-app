// Pack contents: a pack in the bag can be opened to see, take out and put in items. ASCII only.
// The list starts from the pack's rules text ("... contains the following items: A, B, and 2 C.").
const PLURAL = { "Torches": "Torch", "Candles": "Candle", "Costumes": "Costume", "Ink Pens": "Ink Pen", "Map or Scroll Cases": "Map or Scroll Case" };

// -> [{ id, name, qty }] or null when the text lists no items.
export function parsePack(text) {
  const m = /following items?:\s*([^.]+)/i.exec(String(text || ""));
  if (!m) return null;
  const out = [];
  m[1].replace(/,?\s+and\s+/g, ",").split(",").map(s => s.trim()).filter(Boolean).forEach((part, i) => {
    const q = /^(\d+)\s+(.+)$/.exec(part);
    const qty = q ? +q[1] : 1;
    let name = (q ? q[2] : part).replace(/^(flasks?|days?|sheets?)\s+of\s+/i, "").trim();
    name = PLURAL[name] || name;
    out.push({ id: "p" + i, name: name.charAt(0).toUpperCase() + name.slice(1), qty });
  });
  return out.length ? out : null;
}

// Items that can go into a pack: plain gear. Worn, attuned, weapon, noted or custom-weight items stay out.
export function packable(it, worn) {
  return !!it && !worn && !it.weapon && !it.attune && !it.notes && !Array.isArray(it.contents) && typeof it.weight !== "number" && !/pack$/i.test(it.name);
}
export const packCount = it => (it.contents || []).reduce((n, x) => n + (x.qty || 0), 0);
