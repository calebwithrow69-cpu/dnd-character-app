// Draws a spell's area on a 5-foot grid, square or hex. Pure: returns SVG text. Units in the drawing are feet.
const R3 = Math.sqrt(3);

function region(a) {
  const s = a.shape;
  if (s === "sphere" || s === "cylinder") return { ext: [-a.r - 10, a.r + 10, -a.r - 10, a.r + 10], off: [2.5, 2.5], inside: (x, y) => Math.hypot(x, y) <= a.r + 0.001, origin: "point" };
  if (s === "emanation") return { ext: [-a.r - 10, a.r + 10, -a.r - 10, a.r + 10], off: [0, 0], inside: (x, y) => { const dx = Math.max(Math.abs(x) - 2.5, 0), dy = Math.max(Math.abs(y) - 2.5, 0); return Math.hypot(dx, dy) <= a.r + 0.001 && !(Math.abs(x) < 2.5 && Math.abs(y) < 2.5); }, origin: "self" };
  if (s === "cube") return { ext: [-10, a.size + 10, -a.size / 2 - 10, a.size / 2 + 10], off: [2.5, (a.size / 5) % 2 ? 0 : 2.5], inside: (x, y) => x > 0 && x < a.size && Math.abs(y) < a.size / 2, origin: "edge" };
  if (s === "cone") return { ext: [-10, a.size + 10, -a.size / 2 - 10, a.size / 2 + 10], off: [2.5, 0], inside: (x, y) => x > 0 && x <= a.size && Math.abs(y) <= x / 2 + 0.001, origin: "point" };
  return { ext: [-10, a.len + 10, -Math.max(a.wid, 5) / 2 - 15, Math.max(a.wid, 5) / 2 + 15], off: [2.5, (a.wid / 5) % 2 ? 0 : 2.5], inside: (x, y) => x > 0 && x <= a.len && Math.abs(y) <= a.wid / 2, origin: "edge" };
}

const mod = (v, m) => ((v % m) + m) % m;
// Cell centres inside the drawing box. Square: shifted so the shape's origin sits where it should. Hex: pointy-top, 5 ft between neighbouring centres.
export function gridCells(box, mode, off = [2.5, 2.5]) {
  const [x0, x1, y0, y1] = box, out = [];
  if (mode === "hex") {
    const rowH = 5 * R3 / 2;
    for (let r = Math.floor(y0 / rowH) - 1; r <= Math.ceil(y1 / rowH) + 1; r++) {
      const o = Math.abs(r) % 2 ? 2.5 : 0;
      for (let q = Math.floor((x0 - o) / 5) - 1; q <= Math.ceil((x1 - o) / 5) + 1; q++) out.push([q * 5 + o, r * rowH]);
    }
  } else {
    const sx = x0 - mod(x0 - off[0], 5), sy = y0 - mod(y0 - off[1], 5);
    for (let y = sy; y < y1 + 2.5; y += 5) for (let x = sx; x < x1 + 2.5; x += 5) out.push([x, y]);
  }
  return out.filter(([x, y]) => x >= x0 - 2.5 && x <= x1 + 2.5 && y >= y0 - 2.5 && y <= y1 + 2.5);
}

// A cell counts when at least half of it lies inside the shape (sampled).
function covered(g, c, mode) {
  let hit = 0, tot = 0;
  const pts = mode === "hex" ? [[0, 0], ...Array.from({ length: 6 }, (_, k) => [1.7 * Math.cos(k * Math.PI / 3), 1.7 * Math.sin(k * Math.PI / 3)])]
    : (() => { const o = []; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) o.push([(i - 2) , (j - 2)]); return o; })();
  for (const [dx, dy] of pts) { tot++; if (g.inside(c[0] + dx, c[1] + dy)) hit++; }
  return hit / tot >= 0.5;
}

export function areaStats(a, mode) {
  const g = region(a), n = gridCells(g.ext, mode, g.off).filter(c => covered(g, c, mode)).length;
  return { cells: n, feet: n * 25 };
}

export function areaSvg(a, mode = "square") {
  const g = region(a), cells = gridCells(g.ext, mode, g.off);
  const [x0, x1, y0, y1] = g.ext, pad = 2;
  const hex = c => { const Rr = 5 / R3; return Array.from({ length: 6 }, (_, k) => { const t = Math.PI / 180 * (60 * k - 30); return `${(c[0] + Rr * Math.cos(t)).toFixed(2)},${(c[1] + Rr * Math.sin(t)).toFixed(2)}`; }).join(" "); };
  const sq = c => `${c[0] - 2.5},${c[1] - 2.5} ${c[0] + 2.5},${c[1] - 2.5} ${c[0] + 2.5},${c[1] + 2.5} ${c[0] - 2.5},${c[1] + 2.5}`;
  const poly = cells.map(c => `<polygon class="${covered(g, c, mode) ? "in" : ""}" points="${mode === "hex" ? hex(c) : sq(c)}"/>`).join("");
  const mark = g.origin === "self" ? `<rect class="me" x="-2.5" y="-2.5" width="5" height="5" rx="1"/>`
    : g.origin === "edge" ? `<circle class="me" cx="0" cy="0" r="1.6"/><rect class="me" x="-5" y="-2.5" width="5" height="5" rx="1"/>`
    : `<circle class="me" cx="0" cy="0" r="1.9"/>`;
  const w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  return `<svg class="areasvg" viewBox="${x0 - pad} ${y0 - pad} ${w} ${h}" role="img" aria-label="${esc(describeArea(a))} on a ${mode} grid"><g class="cells">${poly}</g>${mark}</svg>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function describeArea(a) {
  if (a.shape === "sphere") return `${a.r}-foot-radius Sphere`;
  if (a.shape === "cylinder") return `${a.r}-foot-radius, ${a.h}-foot-high Cylinder`;
  if (a.shape === "cube") return `${a.size}-foot Cube`;
  if (a.shape === "cone") return `${a.size}-foot Cone`;
  if (a.shape === "emanation") return `${a.r}-foot Emanation`;
  return `${a.len}-foot-long, ${a.wid}-foot-wide Line`;
}
export const originNote = a => ({ sphere: "Centered on a point you choose", cylinder: "Centered on a point you choose", emanation: "Spreads from your space", cube: "One face starts at the edge shown", cone: "Starts at the point shown", line: "Starts at the edge shown" }[a.shape] || "");
