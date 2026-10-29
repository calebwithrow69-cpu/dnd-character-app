// The Graveyard: characters who have died, one tombstone each. Tap a stone to look at the sheet,
// or bring the character back. ASCII only.
import { esc, topbar, empty } from "../ui.js";
import { listCharacters } from "../store.js";

export function deadChars() { return listCharacters().filter(c => c && c.dead); }

export function renderGraveyard(app) {
  const dead = deadChars().sort((a, b) => String(b.dead.at || "").localeCompare(String(a.dead.at || "")));
  const stones = dead.map(c => `
    <div class="tomb">
      <button class="stone" data-a="openChar" data-id="${esc(c.id)}" aria-label="${esc(c.name)}, level ${esc(c.level || 1)}. Open the sheet.">
        <span class="rip" aria-hidden="true">R.I.P.</span>
        <b class="nm">${esc(c.name || "Unnamed")}</b>
        <span class="lv">Level ${esc(c.level || 1)} ${esc(c.species || "")}</span>
        <span class="cl">${esc(c.class || "")}${c.subclass ? ` · ${esc(c.subclass)}` : ""}</span>
        <span class="why">${c.dead.cause ? esc(c.dead.cause) : "Cause unknown"}</span>
        ${c.dead.at ? `<span class="dt">${esc(c.dead.at)}</span>` : ""}
      </button>
      <button class="btn sm" data-a="reviveAsk" data-id="${esc(c.id)}" data-name="${esc(c.name)}">Revive</button>
    </div>`).join("");
  return `
    ${topbar("Graveyard", dead.length ? `${dead.length} fallen` : "", { back: "goRoster" })}
    <main class="wrap page graveyard">
      ${dead.length ? `<div class="tombs">${stones}</div>` : empty("Nobody has died yet", "When a character dies, mark them as dead from Edit character, or fail a third death save. They rest here, and you can bring them back.")}
    </main>`;
}
