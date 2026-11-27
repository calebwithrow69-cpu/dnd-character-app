// Edit layout: pick a preset, then reorder and show or hide blocks on the Sheet page.
import { esc, ICONS } from "../ui.js";
import { layoutOf, PRESETS, BLOCKS } from "../sheetlayout.js";

export function layoutModal(app) {
  const lay = layoutOf(app.prefs), by = Object.fromEntries(BLOCKS.map(b => [b.id, b]));
  const body = `<div class="stack">
    <div class="field"><label>Preset</label><div class="sl-presets">${PRESETS.map(p =>
      `<button class="optcard" data-a="slPreset" data-v="${p.id}" aria-pressed="${lay.preset === p.id && !lay.custom}"><span class="grow"><b>${esc(p.label)}</b><span>${esc(p.about)}</span></span></button>`).join("")}</div></div>
    <div class="field"><label>Blocks${lay.custom ? " · custom" : ""}</label><div class="sl-list">${lay.blocks.map((x, i) => {
      const b = by[x.id];
      return `<div class="sl-row ${x.on ? "" : "off"}"><span class="sl-nm"><b>${esc(b.label)}</b><span>${esc(b.about)}</span></span>
        <button class="iconbtn" data-a="slMove" data-id="${x.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Move ${esc(b.label)} up">${ICONS.up || "▲"}</button>
        <button class="iconbtn" data-a="slMove" data-id="${x.id}" data-dir="1" ${i === lay.blocks.length - 1 ? "disabled" : ""} aria-label="Move ${esc(b.label)} down">${ICONS.down || "▼"}</button>
        <button class="chipbtn" data-a="slToggle" data-id="${x.id}" aria-pressed="${x.on}">${x.on ? "Shown" : "Hidden"}</button></div>`;
    }).join("")}</div></div></div>`;
  return { title: "Sheet layout", body, foot: `<button class="btn" data-a="slReset">Reset</button><button class="btn pri" data-a="closeModal">Done</button>` };
}
