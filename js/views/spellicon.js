// Spell emblem: a regular polygon with (level + 2) sides, point up (a ring for cantrips), the Roman numeral inside, coloured and lettered by school.
import { esc } from "../ui.js";
import { NUMERAL, schoolKey } from "../spellinfo.js";

const pts = {};
export function emblemPoints(level) {
  if (pts[level]) return pts[level];
  const n = level + 2, out = [];
  for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + 2 * Math.PI * k / n; out.push((50 + 44 * Math.cos(a)).toFixed(1) + "," + (50 + 44 * Math.sin(a)).toFixed(1)); }
  return (pts[level] = out.join(" "));
}
export function emblemSvg(level) {
  const lv = level || 0;
  if (!lv) return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="em-o" cx="50" cy="50" r="42" stroke-dasharray="6 5"/><circle class="em-c" cx="50" cy="50" r="9"/></svg>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon class="em-o" points="${emblemPoints(lv)}"/><polygon class="em-i" points="${emblemPoints(lv)}" transform="translate(50 50) scale(.78) translate(-50 -50)"/></svg>`;
}
export function spellIcon(sp, extra = "") {
  const lv = sp && sp.level ? sp.level : 0;
  return `<span class="spi sch-${schoolKey(sp && sp.school)} ${lv ? "" : "cant"} ${extra}" title="${esc((sp && sp.school) || "")}${lv ? " · level " + lv : " · cantrip"}" aria-hidden="true">${emblemSvg(lv)}${lv ? `<b>${NUMERAL[lv]}</b>` : ""}</span>`;
}
// A neutral emblem for slot levels (no school).
export function levelEmblem(level, extra = "") { return spellIcon({ level, school: "" }, "plain " + extra); }
