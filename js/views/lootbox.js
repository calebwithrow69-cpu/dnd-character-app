// Loot boxes (experimental): the shop shelf, the item pool, and the open overlay (reel, fanfare, inspect).
// The overlay lives in #loot-root, outside #app, so a re-render never interrupts it. ASCII only.
import { esc, ICONS, formatText } from "../ui.js";
import { ARMOR } from "../gear.js";
import { allItems, allWeapons } from "../data.js";
import { shopStock, walletCp, fmtPrice } from "../equipment.js";
import { purseCard, shelfTabs, shelfCounts, shopDecorator } from "./shopkit.js";
import { shopRows, shopDetail, lootTab } from "./shop.js";
import { BOXES, RARITIES, RARITY_LABEL, boxByName, effectiveOdds, oddsText, classify, buildPools, buildReel, openBox } from "../lootbox.js";
import { sfx, buzz } from "../sfx.js";

// ---- the pool: everything the shop stocks, plus library magic items the shop does not price ----
export function lootPools(app) {
  const L = app.library, C = app.campaign, key = [L, C];
  if (app._lootPools && app._lootPools.key[0] === L && app._lootPools.key[1] === C) return app._lootPools.pools;
  const items = allItems(L, C), ref = new Map(items.map(i => [i.name, i]));
  const allow = C && C.enabled && C.enabled.items ? new Set(C.enabled.items) : null;
  const dec = shopDecorator(L, C);
  const stock = shopStock(L, C, allWeapons(L, C), items, Object.keys(ARMOR).filter(a => a !== "Clothing"));
  const seen = new Set(stock.map(r => r.name));
  const rows = stock.map(r => { const it = ref.get(r.name); return { ...dec(r), rarity: classify(r, it && r.magic ? (it.rarity || it.type) : "") }; });
  for (const it of items) {
    if (seen.has(it.name) || (allow && !allow.has(it.name))) continue;
    const rt = String(it.rarity || "");
    if (!/uncommon|rare|legendary/i.test(rt) || /artifact/i.test(rt)) continue;
    const r = { name: it.name, gp: it.price || 0, cat: "Magic & potions", sub: it.type || "", magic: true };
    rows.push({ ...dec(r), rarity: classify(r, rt) });
  }
  const pools = buildPools(rows);
  app._lootPools = { key, pools };
  return pools;
}

const ownedBoxes = c => (c.inventory || []).filter(i => boxByName(i.name) && i.qty > 0);
export const boxCount = (c, box) => (c.inventory || []).filter(i => i.name === box.name).reduce((a, i) => a + (i.qty || 0), 0);

export function oddsList(box) {
  const o = effectiveOdds(box);
  return `<ul class="lb-odds" aria-label="Odds">${[...RARITIES].reverse().map(r => `<li class="r-${r}"><i></i><span>${RARITY_LABEL[r]}</span><b class="num">${oddsText(o[r])}</b></li>`).join("")}</ul>`;
}

export function renderLootPage(app) {
  const c = app.char, have = walletCp(c.coins);
  const cells = ["pp", "gp", "ep", "sp", "cp"].map(k => ({ k, v: +c.coins?.[k] || 0 }));
  const owned = ownedBoxes(c);
  const cards = BOXES.map(b => `<article class="lb-card" data-box="${b.id}">
      <header><h3>${esc(b.name)}</h3><span class="lb-price num">${fmtPrice(b.gp)}</span></header>
      ${oddsList(b)}
      <button class="btn pri block" data-a="buyBox" data-box="${b.id}" ${b.gp * 100 <= have ? "" : "disabled"} aria-label="Buy ${esc(b.name)} for ${fmtPrice(b.gp)}">Buy</button>
    </article>`).join("");
  const bag = owned.length ? `<section class="lb-bag"><h3>In your bag</h3>${owned.map(i => { const b = boxByName(i.name); return `<div class="lb-own"><span>${esc(i.name)}</span><b class="num">x${i.qty}</b><button class="btn sm" data-a="askOpenBox" data-box="${b.id}">Open</button></div>`; }).join("")}</section>` : "";
  return `<div class="shop-page"><div class="shop-col">
      ${purseCard({ label: "Purse", big: have > 0 ? fmtPrice(have / 100) : "0 gp", cells })}
      <div class="shop-ctl">${shelfTabs("shopCat", shelfCounts(shopRows(app)), "", [], lootTab(app, true))}</div></div>
    <section class="shop-main lb-main" aria-label="Loot boxes">${bag}<div class="lb-grid">${cards}</div></section></div>`;
}

// ---- the open overlay ----
let root = null, raf = 0, fxRaf = 0, esc_ = null;
export function lootBusy() { return !!root; }
export function closeLoot() {
  if (raf) cancelAnimationFrame(raf); if (fxRaf) cancelAnimationFrame(fxRaf); raf = fxRaf = 0;
  if (esc_) { document.removeEventListener("keydown", esc_); esc_ = null; }
  if (root) { root.remove(); root = null; }
}
const calmMotion = app => (app.prefs && app.prefs.motion === "reduced") || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
const COLOR = { common: "#9aa0aa", uncommon: "#58b3a0", rare: "#7fa8d9", epic: "#b57be6", legendary: "#e8b94a" };
const cell = r => `<div class="loot-cell r-${r.rarity}"><span class="lc-ico">${ICONS[r.item && r.item.icon] || ICONS.gear || ""}</span><span class="lc-name">${esc(r.item ? r.item.name : "?")}</span></div>`;

function burst(canvas, rarity, calm) {
  const n = rarity === "legendary" ? 220 : rarity === "epic" ? 90 : 0;
  if (!n || calm || !canvas.getContext) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext("2d"); g.scale(dpr, dpr);
  const cx = w / 2, cy = h * 0.42, col = COLOR[rarity], life = rarity === "legendary" ? 3200 : 1800;
  const ps = Array.from({ length: n }, () => { const a = Math.random() * Math.PI * 2, s = (rarity === "legendary" ? 2 + Math.random() * 9 : 1.5 + Math.random() * 5); return { x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, r: 1.5 + Math.random() * 3, c: Math.random() < 0.3 ? "#fff6d6" : col }; });
  const t0 = performance.now();
  (function frame(now) {
    const t = now - t0; g.clearRect(0, 0, w, h);
    if (t > life) { fxRaf = 0; return; }
    const a = 1 - t / life;
    if (rarity === "legendary" && t < 500) { g.fillStyle = `rgba(255,240,190,${0.5 * (1 - t / 500)})`; g.fillRect(0, 0, w, h); }
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.vx *= 0.992; g.globalAlpha = Math.max(0, a); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill(); }
    g.globalAlpha = 1; fxRaf = requestAnimationFrame(frame);
  })(t0);
}

// box: a BOXES entry. res: {rarity, item}. left: boxes of this kind still in the bag.
export function showLoot(app, box, res, left) {
  closeLoot();
  const calm = calmMotion(app), pools = lootPools(app), reel = buildReel(box, pools, res);
  root = document.createElement("div"); root.id = "loot-root"; root.className = "loot-back";
  root.innerHTML = `<div class="loot-panel" role="dialog" aria-modal="true" aria-label="Opening ${esc(box.name)}">
      <h2 class="loot-title">${esc(box.name)}</h2>
      <div class="loot-reel"><div class="loot-track">${reel.strip.map(cell).join("")}</div><i class="loot-mark"></i></div>
      <div class="loot-result" hidden></div>
      <div class="loot-foot"><button class="btn ghost" data-loot="skip">Skip</button></div>
    </div><canvas class="loot-fx" aria-hidden="true"></canvas>`;
  document.body.appendChild(root);
  const view = root.querySelector(".loot-reel"), track = root.querySelector(".loot-track"), cells = track.children;
  const w = cells[1].offsetLeft - cells[0].offsetLeft, vw = view.clientWidth;
  const target = reel.stop * w + cells[0].offsetWidth / 2 - vw / 2 + (Math.random() - 0.5) * cells[0].offsetWidth * 0.7;
  let landed = false, lastTick = 0, lastIdx = -1;
  const place = x => { track.style.transform = `translate3d(${-x}px,0,0)`; };

  function land() {
    if (landed) return; landed = true; if (raf) cancelAnimationFrame(raf); raf = 0;
    place(target);
    cells[reel.stop].classList.add("win");
    root.classList.add("landed", "r-" + res.rarity);
    root.querySelector(".loot-title").textContent = RARITY_LABEL[res.rarity];
    root.querySelector(".loot-foot").hidden = true;
    sfx("loot" + res.rarity);
    buzz(res.rarity === "legendary" ? [30, 40, 30, 40, 90] : res.rarity === "epic" ? [20, 30, 40] : res.rarity === "common" ? 8 : 14);
    burst(root.querySelector(".loot-fx"), res.rarity, calm);
    if (!calm && res.rarity === "legendary") root.querySelector(".loot-panel").classList.add("shake");
    const it = res.item || { name: "Nothing" };
    const out = root.querySelector(".loot-result"); out.hidden = false;
    out.innerHTML = `<div class="lr-name">${esc(it.name)}</div><div class="lr-sub">${esc(RARITY_LABEL[res.rarity])}${it.gp ? " · " + fmtPrice(it.gp) : ""}</div>
      <div class="lr-detail" hidden>${shopDetail(app, it)}</div>
      <div class="lr-btns"><button class="btn" data-loot="inspect" aria-expanded="false">Inspect</button>${left > 0 ? `<button class="btn" data-loot="again">Open another (${left})</button>` : ""}<button class="btn pri" data-loot="done">Done</button></div>`;
    const b = out.querySelector('[data-loot="done"]'); if (b) b.focus({ preventScroll: true });
  }
  root.addEventListener("click", e => {
    const a = e.target.closest("[data-loot]"); if (!a) return;
    const k = a.dataset.loot;
    if (k === "skip") land();
    else if (k === "done") closeLoot();
    else if (k === "again") { closeLoot(); window.CR && window.CR.ACTIONS.askOpenBox({ dataset: { box: box.id } }); }
    else if (k === "inspect") { const d = root.querySelector(".lr-detail"); d.hidden = !d.hidden; a.setAttribute("aria-expanded", String(!d.hidden)); }
  });
  esc_ = e => { if (e.key === "Escape") { if (landed) closeLoot(); else land(); } };
  document.addEventListener("keydown", esc_);

  if (calm) { place(target); setTimeout(land, 250); return; }
  const dur = 4800, t0 = performance.now();
  (function frame(now) {
    const p = Math.min(1, (now - t0) / dur), x = target * (1 - Math.pow(1 - p, 4));
    place(x);
    const idx = Math.floor((x + vw / 2) / w);
    if (idx !== lastIdx) { lastIdx = idx; if (now - lastTick > 70) { lastTick = now; sfx("rtick"); } }
    if (p < 1) raf = requestAnimationFrame(frame); else land();
  })(t0);
}

// Rolls and pays out. Called after the confirmation: the box is used up and the item is in the bag before the animation starts.
export function rollLoot(app, box) { return openBox(box, lootPools(app)); }
