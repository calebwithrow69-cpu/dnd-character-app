// The shop page (a tab in the sheet frame, like Rules): stock, prices and the buy action. The look is in shopkit.js. ASCII only in this file.
import { esc, ICONS, searchBox, formatText } from "../ui.js";
import { searchRows } from "../shopsearch.js";
import { SORTS, shopOf, cartQty, cartCount, cartSummary, listsWith, sortRows } from "../shopdata.js";
import { encTierFor } from "../encumbrance.js";
import { attunedCount } from "../gear.js";
import { ARMOR } from "../gear.js";
import { allItems, allWeapons } from "../data.js";
import { shopStock, walletCp, fmtPrice } from "../equipment.js";
import { trainingFromChar, trainingSummary, isTrained } from "../creation.js";
import { kitRows } from "../kits.js";
import { unitWeight, fmtLb, carried } from "../weights.js";
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
  const stock = shopStock(L, C, allWeapons(L, C), allItems(L, C), Object.keys(ARMOR).filter(a => a !== "Clothing"));
  return stock.filter(r => app.shopTrained === false || isTrained(app, t, r)).map(dec).concat(kitRows(stock, r => shopPrice(c, r)).map(dec));
}
// Weight of one row (a kit sums its parts), or null when the rules have none.
export function rowWeight(r) {
  if (r.kit) return r.parts.reduce((t, p) => t + (unitWeight({ name: p.name }) ?? 0) * p.qty, 0);
  return unitWeight({ name: r.name });
}
export function needsAttune(app, r) {
  if (r.kit) return r.parts.some(p => needsAttune(app, p.row));
  const it = allItems(app.library, app.campaign).find(x => x.name === r.name);
  return !!it && (/requires attunement/i.test(it.text || "") || /requires attunement/i.test(it.type || ""));
}
export function shopCtx(app) {
  const c = app.char;
  return { price: r => r.kit ? r.gp : shopPrice(c, r), weight: rowWeight, attune: r => needsAttune(app, r) };
}
export function shopRowMap(app) { return new Map(shopRows(app).map(r => [r.name, r])); }

const FILTERS = [["aff", "Affordable"], ["wish", "Wishlist"], ["light", "Light"], ["cart", "In cart"]];
function filtered(app, rows) {
  const c = app.char, f = app.shopFilt || {}, have = walletCp(c.coins), ctx = shopCtx(app);
  const ok = r => {
    if (f.aff && Math.round(ctx.price(r) * 100) > have) return false;
    if (f.wish && listsWith(c, r.name).length === 0) return false;
    if (f.light && (ctx.weight(r) == null || ctx.weight(r) > 5)) return false;
    if (f.cart && cartQty(c, r.name) === 0) return false;
    return true;
  };
  return rows.filter(ok);
}
function rowItem(app, r, cap, owned) {
  const c = app.char, ctx = shopCtx(app), price = ctx.price(r), n = owned.get(r.name) || 0, inCart = cartQty(c, r.name);
  const status = [n ? "Own " + n : "", inCart ? "In cart " + inCart : ""].filter(Boolean).join(" \u00b7 ");
  return shopRow(r, { cap: [status, cap].filter(Boolean).join(" \u00b7 "), mainAttrs: `data-a="shopOpenItem" data-name="${esc(r.name)}"`,
    heart: { on: listsWith(c, r.name).length > 0, label: listsWith(c, r.name).length ? `Remove ${r.name} from a list` : `Save ${r.name} to a list` },
    buy: { action: "shopAdd", ok: true, icon: ICONS.cart, label: `Add ${r.name} to cart, ${fmtPrice(price)}`, text: fmtPrice(price) } });
}
export function renderShopResults(app) {
  const c = app.char, q = (app.shopQuery || "").trim(), cat = app.shopCat || "All", sort = app.shopSort || "rel", ctx = shopCtx(app);
  let rows = shopRows(app);
  rows = q ? searchRows(rows, q) : cat === "All" ? rows : rows.filter(r => r.group === cat);
  rows = sortRows(filtered(app, rows), sort, ctx);
  const owned = new Map();
  for (const i of c.inventory) owned.set(i.name, (owned.get(i.name) || 0) + (i.qty || 0));
  return shopList(rows, { cat, q, flat: sort !== "rel", sticky: false, empty: q ? `No match for "${q}"` : "Nothing matches.", row: (r, cap) => rowItem(app, r, cap, owned) });
}

function kitDetail(r) {
  const wt = r.parts.reduce((t, p) => t + (unitWeight({ name: p.name }) ?? 0) * p.qty, 0);
  return `<div class="kitd"><ul class="kitlist">${r.parts.map(p => `<li><span>${esc(p.name)}${p.qty > 1 ? ` \u00d7${p.qty}` : ""}</span><b>${fmtPrice(p.row.gp * p.qty)}</b></li>`).join("")}</ul><p class="sub2">About ${esc(fmtLb(wt))}</p></div>`;
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
function cartBar(app, c, sum) {
  const n = cartCount(c); if (!n) return "";
  return `<div class="cartbar" role="region" aria-label="Cart"><span class="cb-n">${ICONS.cart}<b>${n}</b></span>
    <span class="cb-t"><b>${fmtPrice(sum.totalCp / 100)}</b><small class="${sum.shortCp ? "neg" : ""}">${sum.shortCp ? "Short " + fmtPrice(sum.shortCp / 100) : "Left " + fmtPrice(sum.leftCp / 100)}</small></span>
    <button class="btn sm pri" data-a="shopView" data-v="cart">Checkout</button></div>`;
}
function sumOf(app) { const c = app.char, map = shopRowMap(app); return cartSummary(c, nm => map.get(nm), shopCtx(app), walletCp(c.coins)); }

function cartView(app, c, sum) {
  const s = shopOf(c), map = shopRowMap(app), ctx = shopCtx(app);
  const w = carried(c), after = encTierFor(c, w.total + sum.weight), before = encTierFor(c, w.total), att = attunedCount(c);
  const line = l => `<div class="cartline"><span class="cl-n"><b>${esc(l.name)}</b><small>${fmtPrice(l.unitCp / 100)} each${l.weight != null ? " \u00b7 " + fmtLb(l.weight) : ""}${l.attune ? " \u00b7 Attunement" : ""}</small></span>
    <span class="qstep"><button class="iconbtn" data-a="shopCartQty" data-name="${esc(l.name)}" data-n="-1" aria-label="One fewer ${esc(l.name)}">${ICONS.minus}</button><b>${l.qty}</b><button class="iconbtn" data-a="shopCartQty" data-name="${esc(l.name)}" data-n="1" aria-label="One more ${esc(l.name)}">${ICONS.plus}</button></span>
    <b class="cl-t">${fmtPrice(l.lineCp / 100)}</b>
    <span class="cl-a"><button class="btn sm ghost" data-a="shopCartLater" data-name="${esc(l.name)}">Save for later</button><button class="btn sm ghost" data-a="shopCartRemove" data-name="${esc(l.name)}">Remove</button></span></div>`;
  const later = s.later.map(x => `<div class="cartline later"><span class="cl-n"><b>${esc(x.name)}</b><small>${x.qty > 1 ? "\u00d7" + x.qty + " \u00b7 " : ""}${map.get(x.name) ? fmtPrice(ctx.price(map.get(x.name)) * x.qty) : "Not sold now"}</small></span>
    <span class="cl-a"><button class="btn sm" data-a="shopLaterBack" data-name="${esc(x.name)}">Move to cart</button><button class="btn sm ghost" data-a="shopLaterRemove" data-name="${esc(x.name)}">Remove</button></span></div>`).join("");
  const warn = [];
  if (sum.gone.length) warn.push(`Not sold now: ${esc(sum.gone.join(", "))}`);
  if (sum.attune) warn.push(`${sum.attune} attunement item${sum.attune === 1 ? "" : "s"}. Attuned now ${att}/3${att + sum.attune > 3 ? ", more than 3 needs a swap" : ""}`);
  if (after.i > before.i) warn.push(`Weight takes you to ${esc(after.label)}${c.encumbrance ? "" : " (penalties off)"}`);
  return `<div class="cartview">
    <h3 class="cv-h">Cart <span class="sub2">${cartCount(c)}</span></h3>
    ${sum.lines.length ? sum.lines.map(line).join("") : `<div class="shop-empty">${ICONS.cart}<span>Cart is empty</span></div>`}
    ${sum.lines.length ? `<div class="cartsum">
      <div><span>Subtotal</span><b>${fmtPrice(sum.totalCp / 100)}</b></div>
      <div><span>Purse</span><b>${fmtPrice(walletCp(c.coins) / 100)}</b></div>
      <div class="${sum.shortCp ? "neg" : "pos"}"><span>${sum.shortCp ? "Short by" : "After checkout"}</span><b>${fmtPrice((sum.shortCp ? sum.shortCp : sum.leftCp) / 100)}</b></div>
      <div><span>Weight</span><b>${sum.weight ? "+" + fmtLb(sum.weight) : "\u2013"}${sum.unknown ? "*" : ""}</b></div>
      <div><span>Carrying</span><b>${fmtLb(w.total + sum.weight)} of ${w.capacity} lb</b></div>
      ${warn.length ? `<ul class="cs-warn">${warn.map(x => `<li>${x}</li>`).join("")}</ul>` : ""}
      ${sum.unknown ? `<p class="sub2">* ${sum.unknown} line${sum.unknown === 1 ? "" : "s"} with no listed weight.</p>` : ""}
      <button class="btn pri cs-go" data-a="shopCheckout" ${sum.shortCp ? "disabled" : ""}>${ICONS.coin}<span>Check out \u00b7 ${fmtPrice(sum.totalCp / 100)}</span></button></div>` : ""}
    ${s.later.length ? `<h3 class="cv-h">Saved for later <span class="sub2">${s.later.length}</span></h3>${later}` : ""}</div>`;
}

function listsView(app, c) {
  const s = shopOf(c), cur = s.lists.find(l => l.id === app.shopList) || s.lists[0], map = shopRowMap(app), ctx = shopCtx(app);
  let rows = cur.items.map(n => map.get(n)).filter(Boolean);
  rows = sortRows(rows, cur.sort, ctx);
  const gone = cur.items.filter(n => !map.has(n));
  const owned = new Map(); for (const i of c.inventory) owned.set(i.name, (owned.get(i.name) || 0) + (i.qty || 0));
  const total = rows.reduce((t, r) => t + Math.round(ctx.price(r) * 100), 0);
  return `<div class="listsview"><div class="lv-tabs" role="group" aria-label="Lists">${s.lists.map(l => `<button class="chipbtn" data-a="shopListPick" data-id="${esc(l.id)}" aria-pressed="${l.id === cur.id}">${esc(l.name)} <em>${l.items.length}</em></button>`).join("")}${s.lists.length < 8 ? `<button class="chipbtn" data-a="shopListNameOpen" data-mode="new">${ICONS.plus}<span>New list</span></button>` : ""}</div>
    <div class="lv-bar"><select class="f sortsel" data-a="shopListSort" aria-label="Sort list">${SORTS.slice(1).concat([["rel", "Added order"]]).map(([v, l]) => `<option value="${v}" ${cur.sort === v ? "selected" : ""}>Sort: ${l}</option>`).join("")}</select>
      <span class="btnrow"><button class="btn sm" data-a="shopListToCart" ${rows.length ? "" : "disabled"}>Add all to cart</button><button class="btn sm ghost" data-a="shopListNameOpen" data-mode="rename" data-id="${esc(cur.id)}">Rename</button><button class="btn sm ghost danger" data-a="askRemove" data-do="shopListDelete" data-what="list" data-name="${esc(cur.name)}" data-id="${esc(cur.id)}">Delete</button></span></div>
    ${rows.length ? `<p class="sub2">${rows.length} item${rows.length === 1 ? "" : "s"} \u00b7 ${fmtPrice(total / 100)} in all</p>` + rows.map(r => rowItem(app, r, "", owned)).join("") : `<div class="shop-empty">${ICONS.heart}<span>List is empty</span></div>`}
    ${gone.length ? `<p class="sub2">Not sold now: ${esc(gone.join(", "))}</p>` : ""}</div>`;
}

export function renderShopPage(app) {
  const c = app.char, cat = app.shopCat || "All", trained = app.shopTrained !== false, view = app.shopView || "browse";
  const discount = (c.feats || []).some(f => /^Crafter\b/.test(f));
  const cells = ["pp", "gp", "ep", "sp", "cp"].map(k => ({ k, v: +c.coins?.[k] || 0 }));
  const sum = sumOf(app), sort = app.shopSort || "rel", f = app.shopFilt || {};
  const nList = shopOf(c).lists.reduce((t, l) => t + l.items.length, 0);
  const views = [["browse", "Browse", "", ICONS.search], ["cart", "Cart", cartCount(c) || "", ICONS.cart], ["lists", "Lists", nList || "", ICONS.list]];
  const nAct = (sort !== "rel" ? 1 : 0) + FILTERS.filter(([k]) => f[k]).length + (trained ? 0 : 1);
  const browse = `<div class="shop-find">${searchBox("shop", app.shopQuery, "Search the shop")}
          <button class="btn shop-sortbtn" data-a="shopFilterOpen" aria-label="Sort and filter${nAct ? `, ${nAct} on` : ""}">${ICONS.sort}${nAct ? `<em>${nAct}</em>` : ""}</button></div>
        ${shelfTabs("shopCat", shelfCounts(shopRows(app)), cat, [], lootTab(app))}`;
  return `<div class="shop-page"><div class="shop-col">
      ${purseCard({ label: "Purse", big: walletCp(c.coins) > 0 ? fmtPrice(walletCp(c.coins) / 100) : "0 gp", cells, tag: discount ? `<span class="tag">Crafter -20%</span>` : "" })}
      <div class="shop-ctl"><div class="seg shop-views" role="group" aria-label="Shop view">${views.map(([k, l, n, ic]) => `<button data-a="shopView" data-v="${k}" aria-pressed="${view === k}">${ic}<span>${l}</span>${n ? `<em>${n}</em>` : ""}</button>`).join("")}</div>
        ${view === "browse" ? browse : ""}
      </div></div>
    <section class="shop-main" id="results-shop" aria-label="${view === "browse" ? "Stock" : view === "cart" ? "Cart" : "Lists"}">${view === "browse" ? renderShopResults(app) : view === "cart" ? cartView(app, c, sum) : listsView(app, c)}</section>
    ${view === "cart" ? "" : cartBar(app, c, sum)}</div>`;
}

// ---- modals: item page, list picker, list name
export function shopItemModal(app, c, m) {
  const r = shopRowMap(app).get(m.name);
  if (!r) return { title: m.name || "Item", body: `<p>Not sold now.</p>`, foot: `<button class="btn" data-a="closeModal">Close</button>` };
  const ctx = shopCtx(app), price = ctx.price(r), w = ctx.weight(r), have = walletCp(c.coins), cost = Math.round(price * 100), att = needsAttune(app, r), n = c.inventory.filter(i => i.name === r.name).reduce((t, i) => t + (i.qty || 0), 0);
  const cur = carried(c), before = encTierFor(c, cur.total), after = encTierFor(c, cur.total + (w || 0));
  const crafter = (c.feats || []).some(f => /^Crafter\b/.test(f)) && !r.magic && !r.kit;
  const on = listsWith(c, r.name).length > 0, inCart = cartQty(c, r.name);
  const facts = `<dl class="kv"><dt>Price</dt><dd>${fmtPrice(price)}${crafter ? " (Crafter -20%)" : ""}</dd><dt>Weight</dt><dd>${w == null ? "Not listed" : fmtLb(w)}</dd><dt>Shelf</dt><dd>${esc(r.kit ? "Loadout" : r.aisle || r.group)}</dd>
    ${n ? `<dt>You own</dt><dd>${n}</dd>` : ""}${inCart ? `<dt>In cart</dt><dd>${inCart}</dd>` : ""}
    ${att ? `<dt>Attunement</dt><dd>Required. Attuned now ${attunedCount(c)}/3${attunedCount(c) >= 3 ? ". All slots are used" : ""}</dd>` : ""}
    <dt>Carrying</dt><dd>${fmtLb(cur.total)}${w ? " \u2192 " + fmtLb(cur.total + w) : ""} of ${cur.capacity} lb${after.i > before.i ? ` \u00b7 <b class="neg">${esc(after.label)}</b>` : ""}</dd></dl>`;
  const body = `${r.sub && !r.kit ? `<p class="sub2">${esc(r.sub)}</p>` : r.kit ? `<p class="sub2">${esc(r.sub)}</p>` : ""}${facts}<div class="shopd">${r.kit ? kitDetail(r) : shopDetail(app, r)}</div>`;
  return { title: r.name, body, foot: `<button class="iconbtn heart ${on ? "on" : ""}" data-a="shopHeart" data-name="${esc(r.name)}" aria-pressed="${on}" aria-label="${on ? "Remove from a list" : "Save to a list"}">${ICONS.heart}</button>
    <button class="btn" data-a="shopAdd" data-name="${esc(r.name)}">${ICONS.cart}<span>Add to cart</span></button>
    <button class="btn pri" data-a="${r.kit ? "buyKit" : "buyItem"}" data-name="${esc(r.name)}" ${cost > have ? "disabled" : ""}><span>Buy now \u00b7 ${fmtPrice(price)}</span></button>` };
}
export function shopListsModal(app, c, m) {
  const s = shopOf(c);
  return { title: "Save to list", body: `<div class="stack">${s.lists.map(l => `<button class="optcard" data-a="shopListToggle" data-id="${esc(l.id)}" data-name="${esc(m.name)}" aria-pressed="${l.items.includes(m.name)}"><span class="grow"><b>${esc(l.name)}</b><span>${l.items.length} item${l.items.length === 1 ? "" : "s"}</span></span>${l.items.includes(m.name) ? ICONS.check : ""}</button>`).join("")}
    ${s.lists.length < 8 ? `<button class="btn" data-a="shopListNameOpen" data-mode="new" data-item="${esc(m.name)}">${ICONS.plus}<span>New list</span></button>` : ""}</div>`, foot: `<button class="btn pri" data-a="closeModal">Done</button>` };
}
export function shopListNameModal(app, c, m) {
  const cur = m.mode === "rename" ? (shopOf(c).lists.find(l => l.id === m.id) || {}).name || "" : "";
  return { title: m.mode === "rename" ? "Rename list" : "New list", body: `<div class="field"><label for="f-slname">Name</label><input id="f-slname" class="f" maxlength="24" value="${esc(cur)}" placeholder="Boss fight" autocomplete="off"></div>`,
    foot: `<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="shopListNameSave">Save</button>` };
}

export function shopFilterModal(app, c) {
  const sort = app.shopSort || "rel", f = app.shopFilt || {}, trained = app.shopTrained !== false;
  const body = `<div class="stack">
    <div class="field"><label for="shop-sort">Sort</label><select id="shop-sort" class="f sortsel" data-a="shopSort">${SORTS.map(([v, l]) => `<option value="${v}" ${sort === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="field"><label>Show only</label><div class="shop-filters">${FILTERS.map(([k, l]) => `<button class="chipbtn" data-a="shopFilt" data-k="${k}" aria-pressed="${!!f[k]}">${l}</button>`).join("")}</div></div>
    <button class="optcard" data-a="shopTrained" data-v="${trained ? 0 : 1}" aria-pressed="${trained}"><span class="grow"><b>Proficient</b><span>${esc(trainingSummary(trainingFromChar(c)))}</span></span>${trained ? ICONS.check : ""}</button></div>`;
  return { title: "Sort and filter", body, foot: `<button class="btn" data-a="shopFilterReset">Reset</button><button class="btn pri" data-a="closeModal">Done</button>` };
}
