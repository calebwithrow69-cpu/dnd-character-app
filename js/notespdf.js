// Notes as a PDF, made on the device (works offline). Markdown-aware layout with the standard PDF fonts, which
// cover Latin-1 only: other characters print as "?" and are counted so the app can say so. ASCII only.
import { parseMd } from "./markdown.js";
import { titleOf, noteLen } from "./notes.js";
import { dateStamp } from "./ui.js";

const W = 612, H = 792, M = 54, BOTTOM = 62, TOP = H - 56;
const GRAY = [0.45, 0.45, 0.45], INK = [0.1, 0.1, 0.1], AMBER = [0.62, 0.36, 0.08], RULE = [0.8, 0.8, 0.8], CODEBG = [0.94, 0.94, 0.92];

let lost = 0;
const clean = t => String(t == null ? "" : t)
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, "-").replace(/…/g, "...")
  .replace(/[·•]/g, "-").replace(/→/g, "->").replace(/×/g, "x").replace(/✓/g, "x").replace(/\t/g, "    ")
  .replace(/[^\x0a\x20-\x7e\xa0-\xff]/gu, () => { lost++; return "?"; });

// Split runs into words (keeping spaces) and wrap to maxW. Each line is a list of {s, font, size, color, st, link}.
function wrap(runs, F, size, maxW, base = {}) {
  const lines = [[]]; let x = 0;
  const fontOf = r => (r.code ? F.mono : r.b && r.i ? F.boldItalic : r.b || base.b ? F.bold : r.i || base.i ? F.italic : F.reg);
  for (const r of runs) {
    const font = fontOf(r), sz = r.code ? size * 0.92 : size, color = r.link ? AMBER : r.code ? INK : base.color || INK;
    for (const tok of clean(r.s).split(/(\s+)/)) {
      if (!tok) continue;
      if (/\n/.test(tok)) { lines.push([]); x = 0; continue; }
      let w = font.widthOfTextAtSize(tok, sz);
      if (/^\s+$/.test(tok)) { if (x === 0) continue; if (x + w > maxW) { lines.push([]); x = 0; continue; } }
      else if (x + w > maxW && x > 0) { lines.push([]); x = 0; }
      let rest = tok;
      while (!/^\s+$/.test(rest) && font.widthOfTextAtSize(rest, sz) > maxW) { // a word longer than a line
        let k = rest.length; while (k > 1 && font.widthOfTextAtSize(rest.slice(0, k), sz) > maxW - x) k--;
        const part = rest.slice(0, k); lines[lines.length - 1].push({ s: part, font, size: sz, color, st: r.st, link: r.link, w: font.widthOfTextAtSize(part, sz) });
        lines.push([]); x = 0; rest = rest.slice(k);
      }
      w = font.widthOfTextAtSize(rest, sz);
      lines[lines.length - 1].push({ s: rest, font, size: sz, color, st: r.st, link: r.link, w }); x += w;
    }
    if (r.link) { const t = ` (${clean(r.link)})`, w = F.reg.widthOfTextAtSize(t, size * 0.85); if (x + w <= maxW) { lines[lines.length - 1].push({ s: t, font: F.reg, size: size * 0.85, color: GRAY, w }); x += w; } }
  }
  return lines;
}

export async function buildNotesPdf(PDFLib, notes, opts = {}) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  lost = 0;
  const doc = await PDFDocument.create();
  const F = {
    reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique), boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique), mono: await doc.embedFont(StandardFonts.Courier)
  };
  const col = c => rgb(c[0], c[1], c[2]);
  let page = null, y = 0;
  const newPage = () => { page = doc.addPage([W, H]); y = TOP; };
  const need = h => { if (!page || y - h < BOTTOM) newPage(); };
  const drawLine = (line, x0, lead) => {
    let x = x0;
    for (const seg of line) {
      if (seg.s.trim() || seg.link) page.drawText(seg.s, { x, y: y - seg.size, size: seg.size, font: seg.font, color: col(seg.color) });
      if (seg.st && seg.s.trim()) page.drawLine({ start: { x, y: y - seg.size * 0.72 }, end: { x: x + seg.w, y: y - seg.size * 0.72 }, thickness: 0.7, color: col(seg.color) });
      x += seg.w;
    }
    y -= lead;
  };
  // Flow a paragraph-like block: wrap, then draw line by line so it can break across pages.
  const flow = (runs, { size = 11, lead = size * 1.4, indent = 0, base = {}, gap = 6, bar = false, bg = false } = {}) => {
    const lines = wrap(runs, F, size, W - 2 * M - indent, base);
    for (const ln of lines) {
      need(lead);
      if (bar) page.drawRectangle({ x: M + indent - 10, y: y - lead + 2, width: 2.5, height: lead, color: col(AMBER) });
      drawLine(ln, M + indent, lead);
    }
    y -= gap; return lines;
  };

  notes.forEach((n, idx) => {
    newPage();
    const title = clean(titleOf(n));
    const tl = wrap([{ s: title, b: true }], F, 20, W - 2 * M, { b: true });
    tl.forEach(l => drawLine(l, M, 25));
    const meta = [n.cat, "Edited " + new Date(n.updated).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), noteLen(n).toLocaleString() + " characters"].join("  -  ");
    need(18); page.drawText(clean(meta), { x: M, y: y - 9, size: 9, font: F.reg, color: col(GRAY) }); y -= 14;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: col(AMBER) }); y -= 14;

    for (const b of parseMd(n.body)) {
      if (b.t === "h") { y -= b.lvl === 1 ? 6 : 3; const s = [17, 14, 12][b.lvl - 1]; need(s * 2); flow(b.runs, { size: s, base: { b: true, color: b.lvl === 3 ? AMBER : INK }, gap: 4 }); }
      else if (b.t === "p") flow(b.runs, { gap: 8 });
      else if (b.t === "quote") flow(b.runs, { indent: 16, base: { i: true, color: GRAY }, bar: true, gap: 8 });
      else if (b.t === "hr") { need(14); y -= 4; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: col(RULE) }); y -= 10; }
      else if (b.t === "code") {
        const lines = clean(b.text).split("\n");
        for (const ln of lines.length ? lines : [""]) {
          const parts = wrap([{ s: ln || " ", code: true }], F, 10, W - 2 * M - 16);
          for (const p of parts) { need(13); page.drawRectangle({ x: M, y: y - 12, width: W - 2 * M, height: 13, color: col(CODEBG) }); drawLine(p, M + 8, 13); }
        }
        y -= 8;
      } else if (b.t === "li") {
        const ind = 20, lines = wrap(b.runs, F, 11, W - 2 * M - ind, b.done ? { color: GRAY } : {});
        lines.forEach((ln, k) => {
          need(15.4);
          if (k === 0) {
            if (b.task) {
              page.drawRectangle({ x: M + 2, y: y - 11, width: 9, height: 9, borderColor: col(INK), borderWidth: 0.8 });
              if (b.done) { page.drawLine({ start: { x: M + 3.5, y: y - 9.5 }, end: { x: M + 9.5, y: y - 3.5 }, thickness: 1.1, color: col(INK) }); page.drawLine({ start: { x: M + 3.5, y: y - 3.5 }, end: { x: M + 9.5, y: y - 9.5 }, thickness: 1.1, color: col(INK) }); }
            } else if (b.ord) page.drawText(b.ord + ".", { x: M + 2, y: y - 11, size: 11, font: F.reg, color: col(INK) });
            else page.drawCircle({ x: M + 6, y: y - 7, size: 1.9, color: col(INK) });
          }
          if (b.done) ln.forEach(sg => { sg.st = true; });
          drawLine(ln, M + ind, 15.4);
        });
        y -= 2;
      }
    }
  });

  const pages = doc.getPages(), label = clean(opts.label || "Notes");
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.5, color: col(RULE) });
    p.drawText(label, { x: M, y: 30, size: 8.5, font: F.reg, color: col(GRAY) });
    const t = `Page ${i + 1} of ${pages.length}`; p.drawText(t, { x: W - M - F.reg.widthOfTextAtSize(t, 8.5), y: 30, size: 8.5, font: F.reg, color: col(GRAY) });
  });
  doc.setTitle(label); doc.setCreator("The Sheet");
  return { bytes: await doc.save(), pages: pages.length, lost };
}

// ---- in the app (pdf-lib is loaded on demand, like the character sheet PDF)
let loading = null;
function loadLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!loading) loading = new Promise((ok, fail) => {
    const s = document.createElement("script"); s.src = "js/vendor/pdf-lib.min.js";
    s.onload = () => ok(window.PDFLib); s.onerror = () => { loading = null; fail(new Error("Couldn't load the PDF tool")); };
    document.head.appendChild(s);
  });
  return loading;
}
export const slug = t => String(t || "notes").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 48) || "notes";
export async function downloadNotesPdf(notes, name, label) {
  const PDFLib = await loadLib();
  const r = await buildNotesPdf(PDFLib, notes, { label });
  const url = URL.createObjectURL(new Blob([r.bytes], { type: "application/pdf" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${slug(name)}-${dateStamp()}.pdf` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return r;
}
