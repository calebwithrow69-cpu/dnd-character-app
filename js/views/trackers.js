// The Trackers panel (limited-use counters: Rage, Channel Divinity, Wild Shape...), shared by both sheets.
import { esc } from "../ui.js";
import { rationsHave } from "../rest.js";

export const resetLine = r => r.reset === "short" ? "Back on a short or long rest" : r.shortRegain ? `Short rest: +${r.shortRegain}. Long rest: all` : "Back on a long rest";

export function trackersPanel(c) {
  return `<div class="panel"><div class="panel-head"><h2>Trackers</h2><button class="btn sm" data-a="openResource">Add</button></div>
      <div class="panel-body flush">
        ${c.resources.length ? c.resources.map((r, i) => `<div class="rowline">
          <button class="nm linkbtn" style="text-decoration:none;flex-direction:column;align-items:flex-start;gap:0" data-a="openResource" data-i="${i}">
            <span>${esc(r.name)}</span><span class="sub2">${resetLine(r)}${r.note ? " · " + esc(r.note) : ""}</span></button>
          ${r.max <= 8
            ? `<span class="pips">${Array.from({ length: r.max }, (_, k) => `<button class="pip ${k < r.max - r.used ? "" : "used"}" data-a="toggleResource" data-i="${i}" data-k="${k}" aria-label="${esc(r.name)} ${k + 1}"><i></i></button>`).join("")}</span>`
            : `<span class="stepper"><button data-a="resStep" data-i="${i}" data-n="1" aria-label="Use one">−</button><b>${r.max - r.used}</b><button data-a="resStep" data-i="${i}" data-n="-1" aria-label="Regain one">+</button></span>`}
        </div>`).join("") : ""}
        <div class="rowline"><span class="nm" style="flex-direction:column;align-items:flex-start;gap:0"><span>Rations</span><span class="sub2">Counted from your pack. A long rest uses ${Number.isFinite(c.restRations) ? c.restRations : 1}.</span></span>
          <span class="stepper"><button data-a="rationStep" data-n="-1" aria-label="Eat one ration">\u2212</button><b>${rationsHave(c)}</b><button data-a="rationStep" data-n="1" aria-label="Add one ration">+</button></span></div>
      </div></div>`;
}
