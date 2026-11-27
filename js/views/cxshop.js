// The shop inside character creation: gear the character is trained to use, paid for with the gold from the equipment options.
// All data and rules live in ../creation.js, the look in shopkit.js. ASCII only in this file.
import { esc, modalShell, searchBox } from "../ui.js";
import { fmtPrice } from "../equipment.js";
import { creationStock, trainingFor, trainingSummary, priceCp, startCp, walletLeftCp, cartRows } from "../creation.js";
import { purseCard, shelfTabs, shelfCounts, shopDecorator, shopRow, shopList } from "./shopkit.js";

const gp = cp => (cp > 0 ? fmtPrice(cp / 100) : "0 gp");

export function renderCxShop(app) {
  const d = app.createDraft; if (!d) return "";
  const cat = app.cxShopCat || "All", t = trainingFor(app, d), dec = shopDecorator(app.library, app.campaign);
  const start = startCp(app, d), left = walletLeftCp(app, d), items = cartRows(app, d).reduce((n, x) => n + x.qty, 0);
  return modalShell("Shop",
    `<div class="shop-top">
      ${purseCard({ label: "Gold left", big: gp(left), id: "cxshop-left", cells: [{ k: "Start", v: gp(start) }, { k: "Items", v: items }], bar: start ? (start - left) / start * 100 : 0 })}
      ${searchBox("cxshop", app.cxShopQuery, "Search the shop")}
      ${shelfTabs("cxShopCat", shelfCounts(creationStock(app, d).map(dec)), cat, ["Magic", "Loadouts"])}
      <p class="sub2 shop-train">Trained: ${esc(trainingSummary(t))}</p>
    </div>
    <div class="results shop-list" id="results-cxshop">${renderCxShopResults(app)}</div>`,
    `<button class="btn pri" data-a="closeModal">Done</button>`, "shopm");
}

export function renderCxShopResults(app) {
  const d = app.createDraft; if (!d) return "";
  const q = (app.cxShopQuery || "").trim().toLowerCase(), cat = app.cxShopCat || "All", dec = shopDecorator(app.library, app.campaign);
  const rows = creationStock(app, d).map(dec).filter(r => q ? r.name.toLowerCase().includes(q) : cat === "All" || r.group === cat);
  const left = walletLeftCp(app, d), have = new Map(cartRows(app, d).map(x => [x.name, x.qty]));
  return shopList(rows, { cat, q, empty: q ? "Nothing matches." : "Nothing here for your training.", row: (r, cap) => {
    const cp = priceCp(app, d, r), n = have.get(r.name) || 0;
    return shopRow(r, { cap, listed: n > 0, status: n ? "\u00d7" + n : "",
      minus: n ? { action: "cxUnbuy", label: `Remove one ${r.name}` } : null,
      buy: { action: "cxBuy", ok: cp <= left, label: `Add ${r.name} for ${fmtPrice(cp / 100)}`, text: fmtPrice(cp / 100) } });
  } });
}
