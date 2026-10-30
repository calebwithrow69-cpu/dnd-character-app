// Classic sheet, Gear tab: a plain list of what you carry (weight, quantity), an "Equipped" summary
// on top, coins below, and the selected item's details off to the side on a wide screen. No paper doll;
// that is the Advanced sheet's tool. Equipping still uses the same body slots underneath. ASCII only.
import { esc, ICONS, formatText } from "../ui.js";
import { findByName, allItems, allWeapons } from "../data.js";
import { SLOTS, itemById, fitsOk, slotOf, slotsOf, wearKind, attunedCount, itemCategory } from "../gear.js";
import { unitWeight, fmtLb } from "../weights.js";
import { fmtMod, weaponNumbers } from "../rules.js";
import { coinsPanel, weightBar, sortedInventory, SORTS, CAT_GLYPH, acBody } from "./sheet.js";

const slotLabel = k => (SLOTS.find(s => s.key === k) || { label: k }).label;
const where = (c, id) => slotsOf(c, id).map(slotLabel).join(" + ");

function equippedStrip(app, c, d) {
  const eq = SLOTS.map(s => [s, itemById(c, c.equipment && c.equipment[s.key])]).filter(x => x[1]);
  const seen = new Set(), chips = eq.filter(([, it]) => (seen.has(it.id) ? false : seen.add(it.id)))
    .map(([, it]) => `<button class="cg-chip ${app.gearSel === it.id ? "on" : ""}" data-a="gearSel" data-id="${esc(it.id)}"><span>${esc(where(c, it.id))}</span><b>${esc(it.name)}</b></button>`).join("");
  return `<div class="panel cg-equipped"><div class="panel-head"><h2>Equipped</h2><span class="sub2">AC ${d.ac} · ${attunedCount(c)}/3 attuned</span></div>
    <div class="panel-body">${chips ? `<div class="cg-chips">${chips}</div>` : `<p class="muted small">Nothing equipped.</p>`}</div></div>`;
}

function listPanel(app, c) {
  const items = sortedInventory(app, c);
  const rows = items.map(it => {
    const k = slotOf(c, it.id), cat = itemCategory(it), u = unitWeight(it), q = it.qty == null ? 1 : it.qty;
    return `<button class="bl-row cg-row ${k ? "equipped" : ""} ${app.gearSel === it.id ? "selected" : ""} ${it.qty ? "" : "empty"} cat-${cat}" data-a="gearSel" data-id="${esc(it.id)}">
      <span class="bag-ic">${ICONS[CAT_GLYPH[cat] || "flask"]}</span>
      <span class="bl-nm"><b>${esc(it.name)}</b>${k ? `<span class="tag amber">Equipped</span>` : ""}${it.attuned ? `<span class="tag blue">Attuned</span>` : ""}</span>
      <span class="q">${q !== 1 ? "×" + q : ""}</span>
      <span class="w">${u == null ? "–" : fmtLb(u * q)}${u != null && q !== 1 ? `<small>${fmtLb(u)} each</small>` : ""}</span>
    </button>`;
  }).join("");
  return `<div class="panel cg-list"><div class="panel-head"><h2>Items <span class="sub2">${c.inventory.length}</span></h2>
    <span class="btnrow"><select class="f sortsel" data-a="bagSort" aria-label="Sort items">${SORTS.map(([v, l]) => `<option value="${v}" ${(app.bagSort || "type") === v ? "selected" : ""}>Sort: ${l}</option>`).join("")}</select>
      <button class="btn sm" data-a="openShop">Shop</button><button class="btn sm" data-a="openPicker" data-picker="items">Add</button></span></div>
    <div class="panel-body">${items.length ? `<div class="bag-list cg-rows"><div class="bl-head" aria-hidden="true"><span></span><span>Item</span><span class="q">Qty</span><span class="w">Weight</span></div>${rows}</div>${weightBar(c)}` : `<p class="muted small" style="padding:12px 0">You are not carrying anything yet.</p>`}</div></div>`;
}

function detailPanel(app, c) {
  const it = app.gearSel ? itemById(c, app.gearSel) : null;
  if (!it) return `<aside class="panel cg-detail"><div class="panel-body"><p class="muted small">Select an item to read about it and use it here.</p></div></aside>`;
  const kind = wearKind(it), k = slotOf(c, it.id), cat = itemCategory(it), u = unitWeight(it), q = it.qty == null ? 1 : it.qty;
  const ref = findByName(allItems(app.library, app.campaign), it.name) || findByName(allWeapons(app.library, app.campaign), it.name);
  const fitSlot = SLOTS.map(s => s.key).find(s => !c.equipment[s] && fitsOk(it, s, c)) || SLOTS.map(s => s.key).find(s => fitsOk(it, s, c));
  const consumable = /potion|elixir|scroll|oil|ammunition|arrow|bolt|bullet|ration|food|dust|bead/i.test(it.name + " " + (it.type || ""));
  const w = it.weapon, n = w ? weaponNumbers(w, c) : null;
  const btn = (a, label, cls = "") => `<button class="btn sm ${cls}" data-a="${a}" data-id="${esc(it.id)}">${label}</button>`;
  return `<aside class="panel cg-detail"><div class="panel-head"><h2>${esc(it.name)}</h2>${k ? `<span class="tag amber">${esc(where(c, it.id))}</span>` : ""}</div>
    <div class="panel-body stack">
      <div class="cvals three"><div class="cval"><span>Type</span><b>${esc(cat)}</b></div><div class="cval"><span>Weight</span><b>${u == null ? "–" : fmtLb(u * q)}</b></div><div class="cval"><span>Quantity</span><b>${q}</b></div></div>
      ${w ? `<p class="small"><b>${fmtMod(n.toHit)}</b> to hit · <b>${esc(n.dice)}${n.dmgMod ? (n.dmgMod > 0 ? "+" : "") + n.dmgMod : ""}</b> ${esc(w.dtype || "")}${w.props ? ` · ${esc(w.props)}` : ""}</p>` : ""}
      ${ref && ref.text ? `<div class="cg-text">${formatText(ref.text)}</div>` : (it.notes ? "" : `<p class="muted small">No description on file.</p>`)}
      ${it.notes ? `<p class="small"><b>Notes.</b> ${esc(it.notes)}</p>` : ""}
      <div class="btnrow">
        ${k ? btn("unequip", "Take off") : kind && fitSlot ? `<button class="btn sm pri" data-a="equipHere" data-id="${esc(it.id)}" data-slot="${esc(fitSlot)}">Equip</button>` : ""}
        ${it.attune ? btn("ctxAttune", it.attuned ? "End attunement" : "Attune") : ""}
        ${consumable ? btn("useItem", "Use one") : ""}
        ${w ? `<button class="btn sm pri" data-a="attackRoll" data-id="${esc(it.id)}">Attack</button>` : ""}
        ${btn("openItemEdit", "Edit details")}${btn("removeItem", "Drop", "danger")}
      </div></div></aside>`;
}

export function classicGear(app, c, d) {
  return `<div class="cgear">
    ${equippedStrip(app, c, d)}
    <div class="cg-cols">${listPanel(app, c)}${detailPanel(app, c)}</div>
    ${coinsPanel(c)}
    <details class="panel cg-ac"><summary class="panel-head"><h2>Armor class ${d.ac}</h2></summary><div class="panel-body stack">${acBody(c, d)}</div></details>
  </div>`;
}
