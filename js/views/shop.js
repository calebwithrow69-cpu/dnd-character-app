// The shop page (a tab in the sheet frame, like Rules): stock, prices and the buy action. The look is in shopkit.js. ASCII only in this file.
import { esc, ICONS, searchBox, formatText } from "../ui.js";
import { ARMOR } from "../gear.js";
import { allItems, allWeapons } from "../data.js";
import { shopStock, walletCp, fmtPrice } from "../equipment.js";
import { trainingFromChar, trainingSummary, isTrained } from "../creation.js";
import { purseCard, shelfTabs, shelfCounts, shopDecorator, shopRow, shopList } from "./shopkit.js";

export function shopPrice(c, row) {
  const crafter = (c.feats || []).some(f => /^Crafter\b/.test(f));
  return crafter && !row.magic ? Math.round(row.gp * 80) / 100 : row.gp;
}
export function fmtWallet(coins) {
  const parts = ["pp", "gp", "ep", "sp", "cp"].filter(k => +coins?.[k]).map(k => `${coins[k]} ${k}`);
  return parts.length ? parts.join(", ") : "no money";
}
export function shopRows(app) {
  const L = app.library, C = app.campaign, c = app.char, t = trainingFromChar(c), dec = shopDecorator(L, C);
  return shopStock(L, C, allWeapons(L, C), allItems(L, C), Object.keys(ARMOR).filter(a => a !== "Clothing"))
    .filter(r => app.shopTrained === false || isTrained(app, t, r)).map(dec);
}
export function renderShopResults(app) {
  const c = app.char, q = (app.shopQuery || "").trim().toLowerCase(), cat = app.shopCat || "All";
  const rows = shopRows(app).filter(r => q ? r.name.toLowerCase().includes(q) : cat === "All" || r.group === cat);
  const have = walletCp(c.coins), owned = new Map();
  for (const i of c.inventory) owned.set(i.name, (owned.get(i.name) || 0) + (i.qty || 0));
  return shopList(rows, { cat, q, sticky: false, row: (r, cap) => {
    const price = shopPrice(c, r), cost = Math.round(price * 100), n = owned.get(r.name) || 0, key = "shop:" + r.name, open = app.info.has(key);
    return shopRow(r, { cap, open, status: n ? "Own " + n : "", mainAttrs: `data-a="toggleInfo" data-key="${esc(key)}" aria-expanded="${open}"`,
      detail: open ? shopDetail(app, r) : "", buy: { action: "buyItem", ok: cost <= have, label: `Buy ${r.name} for ${fmtPrice(price)}`, text: fmtPrice(price) } });
  } });
}

export function shopDetail(app, r) {
  const L = app.library, C = app.campaign;
  if (r.cat === "Armor") {
    if (r.name === "Shield") return `<p>+2 to AC while you hold it in your off hand.</p>`;
    const a = ARMOR[r.name];
    return `<dl class="kv"><dt>Type</dt><dd>${esc(a.cat)} armor</dd><dt>AC</dt><dd>${a.base}${a.dexCap == null ? " + Dex modifier" : a.dexCap ? ` + Dex modifier (max ${a.dexCap})` : ""}</dd>
      ${a.str ? `<dt>Strength</dt><dd>${a.str}+ or your Speed drops by 10 feet</dd>` : ""}${a.stealth ? `<dt>Stealth</dt><dd>Disadvantage</dd>` : ""}</dl>`;
  }
  if (r.cat === "Weapons") {
    const w = allWeapons(L, C).find(x => x.name === r.name) || {};
    return `<dl class="kv"><dt>Damage</dt><dd>${esc(w.dice || "")} ${esc(w.dtype || "")}</dd><dt>Type</dt><dd>${esc([w.cat, w.kind].filter(Boolean).join(" "))}</dd>
      ${w.props ? `<dt>Properties</dt><dd>${esc(w.props)}</dd>` : ""}${w.mastery ? `<dt>Mastery</dt><dd><button class="term" data-term="mastery:${esc(w.mastery)}">${esc(w.mastery)}</button></dd>` : ""}</dl>`;
  }
  const it = allItems(L, C).find(x => x.name === r.name);
  return formatText(it?.text || "");
}

export function lootTab(app, active = false) {
  return app.prefs && app.prefs.experimental ? `<button data-a="shopCat" data-cat="loot" aria-pressed="${active}">${ICONS.star}<span>Loot boxes</span></button>` : "";
}
export function renderShopPage(app) {
  const c = app.char, cat = app.shopCat || "All", trained = app.shopTrained !== false;
  const discount = (c.feats || []).some(f => /^Crafter\b/.test(f));
  const cells = ["pp", "gp", "ep", "sp", "cp"].map(k => ({ k, v: +c.coins?.[k] || 0 }));
  return `<div class="shop-page"><div class="shop-col">
      ${purseCard({ label: "Purse", big: walletCp(c.coins) > 0 ? fmtPrice(walletCp(c.coins) / 100) : "0 gp", cells, tag: discount ? `<span class="tag">Crafter -20%</span>` : "" })}
      <div class="shop-ctl">
        <div class="shop-find">${searchBox("shop", app.shopQuery, "Search the shop")}
          <button class="shop-toggle" data-a="shopTrained" data-v="${trained ? 0 : 1}" aria-pressed="${trained}">${ICONS.check}<span>Trained</span></button></div>
        ${shelfTabs("shopCat", shelfCounts(shopRows(app)), cat, [], lootTab(app))}
        ${trained ? `<p class="sub2 shop-train">Trained: ${esc(trainingSummary(trainingFromChar(c)))}</p>` : ""}
        <p class="sub2 shop-note">Prices: DM rules file, else Player's Handbook</p>
      </div></div>
    <section class="shop-main" id="results-shop" aria-label="Stock">${renderShopResults(app)}</section></div>`;
}
