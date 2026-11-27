// Pack contents panel, shared by the Gear detail pane and the pack window. ASCII only.
import { esc } from "../ui.js";
import { parsePack, packable, packCount } from "../packs.js";
import { unitWeight, fmtLb } from "../weights.js";
import { itemById, slotOf } from "../gear.js";
import { findByName, allItems } from "../data.js";

// The contents to show: saved ones, or the list from the rules text (saved on first change). null = not a pack.
export function contentsOf(app, it) {
  if (Array.isArray(it.contents)) return it.contents;
  const ref = findByName(allItems(app.library, app.campaign), it.name);
  return ref ? parsePack(ref.text) : null;
}
export const isPack = (app, it) => !!contentsOf(app, it);

const wtOf = x => { const u = unitWeight({ name: x.name }); return u == null ? "\u2013" : fmtLb(u * x.qty); };

export function packBody(app, c, it) {
  const list = contentsOf(app, it) || [];
  const total = list.reduce((t, x) => t + (unitWeight({ name: x.name }) ?? 0) * x.qty, 0);
  const rows = list.map(x => `<div class="pk-row"><span class="pk-nm"><b>${esc(x.name)}</b>${x.qty > 1 ? ` <i>\u00d7${x.qty}</i>` : ""}</span><span class="w">${wtOf(x)}</span>
    <span class="btnrow">${x.qty > 1 ? `<button class="btn sm" data-a="packTake" data-id="${esc(it.id)}" data-cid="${esc(x.id)}" data-n="1">Take 1</button>` : ""}<button class="btn sm" data-a="packTake" data-id="${esc(it.id)}" data-cid="${esc(x.id)}" data-n="all">Take out</button></span></div>`).join("");
  return `<div class="pk"><div class="pk-head"><span>${list.length} items \u00b7 ${packCount({ contents: list })} pieces</span><span>${fmtLb(total)}</span></div>
    ${rows || `<p class="muted small">The pack is empty.</p>`}
    <div class="btnrow pk-act">${list.length ? `<button class="btn sm" data-a="packTakeAll" data-id="${esc(it.id)}">Take all out</button>` : ""}<button class="btn sm pri" data-a="packAdd" data-id="${esc(it.id)}">Put in pack</button></div></div>`;
}

export function packAddBody(app, c, it) {
  const opts = c.inventory.filter(x => x.id !== it.id && packable(x, slotOf(c, x.id)));
  return `<p class="lab">From your bag</p><div class="optlist" style="margin-top:4px">${opts.map(x => `<button class="optcard" data-a="packPut" data-id="${esc(it.id)}" data-item="${esc(x.id)}"><span class="grow"><b>${esc(x.name)}</b><span>${(x.qty || 1) > 1 ? "\u00d7" + x.qty : "1"}</span></span></button>`).join("") || `<p class="muted small">No bag items fit.</p>`}</div>`;
}
