// Spell icon: a Roman numeral for the level (a ring for cantrips), coloured and lettered by school.
import { esc } from "../ui.js";
import { NUMERAL, schoolKey } from "../spellinfo.js";

export function spellIcon(sp, extra = "") {
  const lv = sp && sp.level ? sp.level : 0;
  return `<span class="spi sch-${schoolKey(sp && sp.school)} ${lv ? "" : "cant"} ${extra}" title="${esc((sp && sp.school) || "")}${lv ? " · level " + lv : " · cantrip"}" aria-hidden="true">${lv ? NUMERAL[lv] : ""}</span>`;
}
