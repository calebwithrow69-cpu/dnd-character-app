// The shop inside character creation: gear the character is trained to use, paid for with the gold from the equipment options.
// All data and rules live in ../creation.js. ASCII only in this file.
import { esc, modalShell, searchBox } from "../ui.js";
import { fmtPrice } from "../equipment.js";
import { creationStock, trainingFor, trainingSummary, priceCp, startCp, walletLeftCp, cartRows } from "../creation.js";

const CATS = ["All", "Weapons", "Armor", "Tools", "Gear"];

export function renderCxShop(app) {
  const d = app.createDraft; if (!d) return "";
  const cat = app.cxShopCat || "All", t = trainingFor(app, d);
  return modalShell("Shop",
    `<p class="small"><b class="num" id="cxshop-left">${esc(fmtPrice(walletLeftCp(app, d) / 100) || "0 gp")}</b> left of <span class="num">${esc(fmtPrice(startCp(app, d) / 100) || "0 gp")}</span></p>
     <p class="sub2">Listed: gear ${esc(d.class)} is trained to use (${esc(trainingSummary(t))}). Adventuring gear needs no training, so all of it is listed.</p>
     ${searchBox("cxshop", app.cxShopQuery, "Search the shop")}
     <div class="seg" style="margin-top:10px" role="group" aria-label="Category">${CATS.map(k => `<button data-a="cxShopCat" data-cat="${k}" aria-pressed="${cat === k}">${k}</button>`).join("")}</div>
     <div class="results" id="results-cxshop">${renderCxShopResults(app)}</div>`,
    `<button class="btn pri" data-a="closeModal">Done</button>`);
}

export function renderCxShopResults(app) {
  const d = app.createDraft; if (!d) return "";
  const q = (app.cxShopQuery || "").trim().toLowerCase(), cat = app.cxShopCat || "All";
  const rows = creationStock(app, d).filter(r => (cat === "All" || r.group === cat) && (!q || r.name.toLowerCase().includes(q)));
  if (!rows.length) return `<p class="muted small" style="padding:12px 0">${q ? "Nothing matches." : "Nothing here for your training."}</p>`;
  const left = walletLeftCp(app, d), have = new Map(cartRows(app, d).map(x => [x.name, x.qty]));
  return rows.slice(0, 120).map(r => {
    const cp = priceCp(app, d, r), n = have.get(r.name) || 0;
    return `<div class="shopitem"><div class="rowline shoprow">
      <div class="nm"><span>${esc(r.name)}</span><span class="sub2">${esc([r.group, r.sub].filter(Boolean).join(" · ").slice(0, 80))}${n ? ` · in your list: ${n}` : ""}</span></div>
      ${n ? `<button class="btn sm" data-a="cxUnbuy" data-name="${esc(r.name)}" aria-label="Remove one ${esc(r.name)}">-</button>` : ""}
      <button class="btn sm ${cp <= left ? "pri" : ""}" data-a="cxBuy" data-name="${esc(r.name)}" ${cp > left ? "disabled" : ""} aria-label="Add ${esc(r.name)} for ${esc(fmtPrice(cp / 100))}">${esc(fmtPrice(cp / 100))}</button>
    </div></div>`;
  }).join("") + (rows.length > 120 ? `<p class="sub2">Showing 120 of ${rows.length}. Search to narrow it down.</p>` : "");
}
