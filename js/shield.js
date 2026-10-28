// The armor class shield. The higher your AC, the sturdier it is drawn:
// plain cloth (10 or less) -> leather -> wood -> steel -> banded steel -> mithral -> radiant.
// Drawn from SVG so it stays sharp at any size and follows the theme only through its text colour.

export const ARMOR_TIERS = [
  { max: 10, key: "cloth", name: "plain cloth" },
  { max: 12, key: "leather", name: "leather" },
  { max: 14, key: "wood", name: "wood" },
  { max: 17, key: "steel", name: "steel" },
  { max: 19, key: "banded", name: "banded steel" },
  { max: 22, key: "mithral", name: "mithral" },
  { max: Infinity, key: "radiant", name: "radiant gold" }
];
export const armorTier = ac => ARMOR_TIERS.find(t => ac <= t.max);

const OUT = "M40 3l33 9v26c0 28-15 43-33 51C22 81 7 66 7 38V12z";
const INN = "M40 10l27 7.5V38c0 23-12 36-27 43C25 74 13 61 13 38V17.5z";
let uid = 0;

const grad = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`;
const rivets = (pts, c) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="${c}"/>`).join("");

export function shieldSvg(ac) {
  const t = armorTier(ac).key, n = ++uid, f = `shf${n}`, r = `shr${n}`, cp = `shc${n}`;
  const clip = `<clipPath id="${cp}"><path d="${INN}"/></clipPath>`;
  let defs = clip, body = "";
  if (t === "cloth") {
    defs += grad(f, [[0, "#F2E8CF"], [1, "#DCCBA3"]]);
    body = `<path d="${OUT}" fill="url(#${f})" stroke="#7A6648" stroke-width="2" stroke-linejoin="round"/>
      <path d="${INN}" fill="none" stroke="#9C8760" stroke-width="1" stroke-dasharray="2 3"/>`;
  } else if (t === "leather") {
    defs += grad(f, [[0, "#9A6A3F"], [1, "#5E3A1E"]]);
    body = `<path d="${OUT}" fill="url(#${f})" stroke="#3B2412" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="${INN}" fill="none" stroke="#D2A66F" stroke-width="1.2" stroke-dasharray="3 2.4"/>
      <g clip-path="url(#${cp})" stroke="#4A2E17" stroke-opacity=".45" fill="none"><path d="M16 30c8 4 12-2 20 2s14 0 28-3M14 52c10 4 14-2 24 2s16 0 26-4"/></g>`;
  } else if (t === "wood") {
    defs += grad(f, [[0, "#B07B45"], [1, "#7A4E27"]], 1, 0);
    body = `<path d="${OUT}" fill="#3E2713" stroke="#2A1809" stroke-width="2.4" stroke-linejoin="round"/>
      <g clip-path="url(#${cp})"><rect x="10" y="8" width="60" height="80" fill="url(#${f})"/>
        ${[22, 36, 50, 64].map((x, i) => `<path d="M${x} 8V88" stroke="#3E2713" stroke-width="1.3"/><path d="M${x - 9} 20c3 6 3 12 0 18M${x - 5} 52c-3 5-3 10 0 15" stroke="#5B3A1D" stroke-opacity=".5" fill="none"/>`).join("")}</g>
      <path d="${INN}" fill="none" stroke="#D9AE72" stroke-opacity=".5" stroke-width="1"/>${rivets([[40, 16], [20, 34], [60, 34], [40, 74]], "#2A1809")}`;
  } else if (t === "steel") {
    defs += grad(f, [[0, "#E4EAEE"], [.5, "#A5B0B9"], [1, "#6D7882"]], 1, 1) + grad(r, [[0, "#F4F7F9"], [1, "#6B7680"]]);
    body = `<path d="${OUT}" fill="url(#${r})" stroke="#38424B" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="${INN}" fill="url(#${f})" stroke="#4B5660" stroke-width="1"/>
      <g clip-path="url(#${cp})"><path d="M40 10V82" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/><path d="M13 20L40 10 67 20V30L40 22 13 30z" fill="#fff" fill-opacity=".18"/></g>${rivets([[40, 15], [19, 30], [61, 30], [27, 62], [53, 62]], "#4B5660")}
      <g clip-path="url(#${cp})"><path class="shine" d="M14 8l10 0 -18 84 -10 0z" fill="#fff" opacity="0"/></g>`;
  } else if (t === "banded") {
    defs += grad(f, [[0, "#D5DDE3"], [.5, "#8F9BA6"], [1, "#59636D"]], 1, 1) + grad(r, [[0, "#F1D58C"], [1, "#9B7421"]]);
    body = `<path d="${OUT}" fill="url(#${r})" stroke="#5B4310" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="${INN}" fill="url(#${f})" stroke="#3B444D" stroke-width="1"/>
      <g clip-path="url(#${cp})"><path d="M10 38H70" stroke="#2F373F" stroke-width="5"/><path d="M10 38H70" stroke="#F1D58C" stroke-width="1.2"/><path d="M40 8V86" stroke="#2F373F" stroke-width="5"/><path d="M40 8V86" stroke="#F1D58C" stroke-width="1.2"/></g>
      <circle cx="40" cy="45" r="18" fill="#262D34" stroke="url(#${r})" stroke-width="2.4"/>${rivets([[40, 16], [18, 22], [62, 22], [26, 62], [54, 62], [40, 76]], "#F1D58C")}
      <g clip-path="url(#${cp})"><path class="shine" d="M14 8l10 0 -18 84 -10 0z" fill="#fff" opacity="0"/></g>`;
  } else if (t === "mithral") {
    defs += grad(f, [[0, "#F3FAFF"], [.45, "#B9D6EA"], [1, "#6F9CC0"]], 1, 1) + grad(r, [[0, "#FFE9A6"], [1, "#B0842A"]]);
    body = `<path d="${OUT}" fill="url(#${r})" stroke="#6E5113" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="${INN}" fill="url(#${f})" stroke="#4C7396" stroke-width="1"/>
      <g clip-path="url(#${cp})" stroke="#fff" stroke-opacity=".7" fill="none"><path d="M40 10V82M13 38H67M20 20L60 70M60 20L20 70"/></g>
      <path transform="translate(40 21) scale(.55) translate(-40 -36)" d="M40 24l3.4 8.6 9.2.6-7.1 5.9 2.3 9-7.8-5-7.8 5 2.3-9-7.1-5.9 9.2-.6z" fill="url(#${r})" stroke="#6E5113" stroke-width="1.4"/>
      <g clip-path="url(#${cp})"><path class="shine" d="M14 8l10 0 -18 84 -10 0z" fill="#fff" opacity="0"/></g>`;
  } else {
    defs += grad(f, [[0, "#FFF2B8"], [.5, "#F0C649"], [1, "#B27F17"]], 1, 1) + grad(r, [[0, "#FFFBE6"], [1, "#D9A32E"]]);
    body = `<path d="${OUT}" fill="url(#${r})" stroke="#7C5710" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="${INN}" fill="url(#${f})" stroke="#A67516" stroke-width="1"/>
      <g clip-path="url(#${cp})" stroke="#FFFBE6" stroke-opacity=".8" fill="none"><path d="M40 10V82M13 38H67"/><circle cx="40" cy="38" r="20"/><circle cx="40" cy="38" r="12"/></g>
      <path d="M40 4l2 5-2 3-2-3zM40 80l2 5-2 3-2-3z" fill="#FFFBE6"/>
      <g clip-path="url(#${cp})"><path class="shine" d="M14 8l10 0 -18 84 -10 0z" fill="#fff" opacity="0"/></g>`;
  }
  return `<svg class="shieldsvg tier-${t}" viewBox="0 0 80 92" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
}
