// Per-character shop state: cart, saved-for-later and named wish lists. Pure. ASCII only.
export const MAX_LISTS = 8;
export const SORTS = [["rel", "Relevance"], ["name", "Name"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["weight-asc", "Weight: light first"], ["weight-desc", "Weight: heavy first"]];
const txt = (v, n) => String(v == null ? "" : v).slice(0, n);
const qty = v => Math.max(1, Math.min(99, Math.round(Number(v)) || 1));
const lines = a => (Array.isArray(a) ? a : []).filter(x => x && typeof x.name === "string" && x.name).slice(0, 100).map(x => ({ name: txt(x.name, 80), qty: qty(x.qty) }));
const sortKey = v => SORTS.some(s => s[0] === v) ? v : "rel";

export function cleanShop(sh) {
  const s = sh && typeof sh === "object" ? sh : {};
  let lists = (Array.isArray(s.lists) ? s.lists : []).filter(l => l && typeof l.name === "string").slice(0, MAX_LISTS)
    .map((l, i) => ({ id: txt(l.id, 20) || "wl" + i, name: txt(l.name, 24).trim() || "List " + (i + 1), items: [...new Set((Array.isArray(l.items) ? l.items : []).filter(n => typeof n === "string" && n).map(n => txt(n, 80)))].slice(0, 200), sort: sortKey(l.sort) }));
  if (!lists.length) lists = [{ id: "wl", name: "Wishlist", items: [], sort: "rel" }];
  const seen = new Set(); lists = lists.map(l => { let id = l.id; while (seen.has(id)) id += "x"; seen.add(id); return { ...l, id }; });
  return { cart: lines(s.cart), later: lines(s.later), lists };
}
export const shopOf = c => (c.shop = cleanShop(c.shop));

export const cartQty = (c, n) => (shopOf(c).cart.find(x => x.name === n) || {}).qty || 0;
export const cartCount = c => shopOf(c).cart.reduce((t, x) => t + x.qty, 0);
export function cartAdd(c, name, n = 1) { const s = shopOf(c), x = s.cart.find(y => y.name === name); if (x) x.qty = qty(x.qty + n); else s.cart.push({ name, qty: qty(n) }); }
export function cartSet(c, name, n) { const s = shopOf(c); if (n <= 0) s.cart = s.cart.filter(x => x.name !== name); else { const x = s.cart.find(y => y.name === name); if (x) x.qty = qty(n); } }
export const cartRemove = (c, name) => cartSet(c, name, 0);
export const cartClear = c => { shopOf(c).cart = []; };
export function cartLater(c, name) { const s = shopOf(c), x = s.cart.find(y => y.name === name); if (!x) return; s.cart = s.cart.filter(y => y !== x); const l = s.later.find(y => y.name === name); if (l) l.qty = qty(l.qty + x.qty); else s.later.push({ ...x }); }
export function laterBack(c, name) { const s = shopOf(c), x = s.later.find(y => y.name === name); if (!x) return; s.later = s.later.filter(y => y !== x); cartAdd(c, name, x.qty); }
export const laterRemove = (c, name) => { const s = shopOf(c); s.later = s.later.filter(x => x.name !== name); };

export function listCreate(c, name) { const s = shopOf(c); if (s.lists.length >= MAX_LISTS) return null; const id = "wl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4); s.lists.push({ id, name: txt(name, 24).trim() || "List " + (s.lists.length + 1), items: [], sort: "rel" }); return id; }
export function listRename(c, id, name) { const l = shopOf(c).lists.find(x => x.id === id); if (l && txt(name, 24).trim()) l.name = txt(name, 24).trim(); }
export function listDelete(c, id) { const s = shopOf(c); if (s.lists.length <= 1) { const l = s.lists[0]; if (l) l.items = []; return; } s.lists = s.lists.filter(x => x.id !== id); }
export const listsWith = (c, name) => shopOf(c).lists.filter(l => l.items.includes(name));
export const listHas = (c, name) => listsWith(c, name).length > 0;
export function listToggle(c, name, id) { const l = shopOf(c).lists.find(x => x.id === id); if (!l) return false; const i = l.items.indexOf(name); if (i >= 0) { l.items.splice(i, 1); return false; } if (l.items.length < 200) l.items.push(name); return true; }
export function listSort(c, id, key) { const l = shopOf(c).lists.find(x => x.id === id); if (l) l.sort = sortKey(key); }

// Order rows. ctx: { price(row) -> gp, weight(row) -> lb or null }. "rel" keeps the incoming order.
export function sortRows(rows, key, ctx) {
  const k = sortKey(key); if (k === "rel") return rows;
  const out = rows.slice(), by = f => (a, b) => f(a) - f(b) || a.name.localeCompare(b.name);
  if (k === "name") return out.sort((a, b) => a.name.localeCompare(b.name));
  const W = r => { const w = ctx.weight(r); return w == null ? Infinity : w; };
  if (k === "price-asc") return out.sort(by(ctx.price));
  if (k === "price-desc") return out.sort((a, b) => ctx.price(b) - ctx.price(a) || a.name.localeCompare(b.name));
  if (k === "weight-asc") return out.sort(by(W));
  return out.sort((a, b) => { const x = ctx.weight(a), y = ctx.weight(b); return (y == null ? -1 : y) - (x == null ? -1 : x) || a.name.localeCompare(b.name); });
}

// What the cart comes to. rowOf(name) -> shop row or null. ctx: { price, weight, attune(row) }.
export function cartSummary(c, rowOf, ctx, haveCp) {
  const out = [], gone = [];
  for (const x of shopOf(c).cart) {
    const row = rowOf(x.name); if (!row) { gone.push(x.name); continue; }
    const unit = Math.round(ctx.price(row) * 100), w = ctx.weight(row);
    out.push({ name: x.name, qty: x.qty, row, unitCp: unit, lineCp: unit * x.qty, weight: w == null ? null : w * x.qty, attune: !!ctx.attune(row) });
  }
  const totalCp = out.reduce((t, l) => t + l.lineCp, 0), weight = out.reduce((t, l) => t + (l.weight || 0), 0);
  return { lines: out, gone, totalCp, weight, unknown: out.filter(l => l.weight == null).length, attune: out.filter(l => l.attune).reduce((t, l) => t + l.qty, 0), shortCp: Math.max(0, totalCp - haveCp), leftCp: haveCp - totalCp };
}
