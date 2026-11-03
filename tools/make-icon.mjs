// Draws the app icon (icons/icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png).
//   node tools/make-icon.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
const pol = (c, r, a0 = -90, n = 6) => Array.from({ length: n }, (_, i) => { const a = (a0 + i * 360 / n) * Math.PI / 180; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });

// d20 face-on: outer hexagon, inner triangle, joined
const C = [256, 196], R = 112, hex = pol(C, R), tri = pol(C, R * 0.5, -90, 3);
const facets = [
  [hex[0], hex[1], tri[0]], [hex[1], hex[2], tri[1]], [hex[2], hex[3], tri[1]], [hex[3], hex[4], tri[2]], [hex[4], hex[5], tri[2]], [hex[5], hex[0], tri[0]],
  [hex[1], tri[1], tri[0]], [hex[3], tri[2], tri[1]], [hex[5], tri[0], tri[2]], [tri[0], tri[1], tri[2]]];
const shade = ["#ffd86b", "#f2a33d", "#c9771e", "#a85d14", "#d98a26", "#ffc650", "#fff0a8", "#e8952c", "#ffe48a", "#fff6c9"];

const rays = Array.from({ length: 28 }, (_, i) => { const a = i * 360 / 28 * Math.PI / 180, b = (i + 0.5) * 360 / 28 * Math.PI / 180; return `<polygon points="256,236 ${P(256 + 420 * Math.cos(a), 236 + 420 * Math.sin(a))} ${P(256 + 420 * Math.cos(b), 236 + 420 * Math.sin(b))}" fill="#ffcf5a" opacity="${i % 2 ? 0.1 : 0.2}"/>`; }).join("");
const spark = (x, y, s, o = 1) => `<path d="M${x},${y - s} Q${x + s * 0.16},${y - s * 0.16} ${x + s},${y} Q${x + s * 0.16},${y + s * 0.16} ${x},${y + s} Q${x - s * 0.16},${y + s * 0.16} ${x - s},${y} Q${x - s * 0.16},${y - s * 0.16} ${x},${y - s}Z" fill="#fff7d1" opacity="${o}"/>`;
const bolt = (x, y, k, rot) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})"><path d="M0,-30 L-12,2 L-2,2 L-10,30 L14,-6 L3,-6 L10,-30Z" fill="#fff3a6" stroke="#ff9d1c" stroke-width="3" stroke-linejoin="round"/></g>`;
const ability = (x, y) => `<rect x="${x}" y="${y}" width="44" height="40" rx="7" fill="#f4e4bd" stroke="#7a1f2b" stroke-width="3.5"/><rect x="${x + 11}" y="${y + 9}" width="22" height="7" rx="3" fill="#7a1f2b"/><rect x="${x + 8}" y="${y + 22}" width="28" height="9" rx="4.5" fill="#c9a96a"/>`;

export const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
  <radialGradient id="bg" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#8a1c2c"/><stop offset=".55" stop-color="#3b0b14"/><stop offset="1" stop-color="#12050a"/></radialGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2a0" stop-opacity=".95"/><stop offset=".45" stop-color="#ffb83d" stop-opacity=".45"/><stop offset="1" stop-color="#ff8a00" stop-opacity="0"/></radialGradient>
  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4d2"/><stop offset="1" stop-color="#e2c488"/></linearGradient>
  <radialGradient id="seal" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ff6b57"/><stop offset=".5" stop-color="#b3182b"/><stop offset="1" stop-color="#5e0714"/></radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#e9a62f"/><stop offset="1" stop-color="#8a5a12"/></linearGradient>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity=".55"/></filter>
</defs>
<rect width="512" height="512" fill="url(#bg)"/>
${rays}
<circle cx="256" cy="236" r="250" fill="url(#glow)" opacity=".55"/>
<g filter="url(#sh)" transform="rotate(-7 256 330)">
  <path d="M138,206 H340 L378,244 V434 Q378,446 366,446 H150 Q138,446 138,434Z" fill="url(#paper)" stroke="#5a1220" stroke-width="7" stroke-linejoin="round"/>
  <path d="M340,206 V244 H378Z" fill="#c9a263" stroke="#5a1220" stroke-width="6" stroke-linejoin="round"/>
  <rect x="152" y="296" width="206" height="22" rx="6" fill="#7a1f2b"/>
  ${[0, 1, 2].map(i => ability(158 + i * 62, 330)).join("")}
  <rect x="158" y="384" width="140" height="8" rx="4" fill="#b8975a"/><rect x="158" y="402" width="104" height="8" rx="4" fill="#b8975a"/>
  <circle cx="338" cy="404" r="30" fill="url(#seal)" stroke="#4a0510" stroke-width="4"/><circle cx="338" cy="404" r="21" fill="none" stroke="#ff9a85" stroke-width="2.5" opacity=".7"/>
  <path d="M338,388 l5,11 12,1 -9,8 3,12 -11,-6 -11,6 3,-12 -9,-8 12,-1z" fill="#ffd9a0"/>
</g>
${bolt(122, 150, 1.25, -28)}${bolt(392, 146, 1.25, 28)}${bolt(96, 250, 0.9, -62)}${bolt(418, 252, 0.9, 62)}
<circle cx="256" cy="196" r="150" fill="url(#glow)"/>
<g filter="url(#sh)">${facets.map((f, i) => `<polygon points="${f.map(p => P(...p)).join(" ")}" fill="${shade[i]}" stroke="#6b3d08" stroke-width="3.5" stroke-linejoin="round"/>`).join("")}
<polygon points="${hex.map(p => P(...p)).join(" ")}" fill="none" stroke="url(#gold)" stroke-width="9" stroke-linejoin="round"/></g>
<text x="256" y="${C[1] + 20}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="900" font-size="58" fill="#3b0b14" stroke="#fff3b0" stroke-width="1.5">20</text>
${spark(92, 104, 30)}${spark(430, 96, 36)}${spark(54, 330, 22, .9)}${spark(462, 330, 26, .9)}${spark(256, 40, 26)}${spark(150, 470, 20, .8)}${spark(380, 478, 22, .8)}
${[[70, 200], [446, 200], [40, 420], [478, 410], [200, 62], [316, 60], [110, 40], [410, 36]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${3 + i % 3}" fill="#ffe27a" opacity=".85"/>`).join("")}
<rect x="10" y="10" width="492" height="492" rx="78" fill="none" stroke="url(#gold)" stroke-width="9"/>
<rect x="24" y="24" width="464" height="464" rx="66" fill="none" stroke="#ffd36b" stroke-opacity=".45" stroke-width="2.5"/>
${[[26, 26], [486, 26], [26, 486], [486, 486]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="url(#gold)" stroke="#6b3d08" stroke-width="2.5"/>`).join("")}
</svg>`;

if (process.argv[1].endsWith("make-icon.mjs")) {
  fs.writeFileSync("icons/icon.svg", svg);
  const { chromium } = createRequire(import.meta.url)("playwright");
  const b = await chromium.launch();
  const draw = async (size, file, scale = 1) => {
    const page = await b.newPage({ viewport: { width: size, height: size } });
    // maskable: shrink the artwork into the safe zone on a full-bleed background
    const inner = scale === 1 ? svg : svg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#12050a"/><g transform="translate(${256 - 256 * scale} ${256 - 256 * scale}) scale(${scale})">`).replace(/<\/svg>$/, "</g></svg>");
    await page.setContent(`<html><body style="margin:0;background:transparent">${inner.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
  };
  await draw(512, "icons/icon-512.png"); await draw(192, "icons/icon-192.png"); await draw(512, "icons/icon-maskable-512.png", 0.78);
  await b.close();
  console.log("icons written");
}
