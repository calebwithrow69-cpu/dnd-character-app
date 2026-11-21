// Small markdown renderer for notes. Pure (no DOM). Everything is HTML-escaped first, then formatted,
// so a note can never inject markup. Supports: # ## ### headings, **bold**, *italic*, ~~strike~~, `code`,
// fenced code, > quotes, - lists, 1. lists, - [ ] / - [x] checklists, --- rules, [text](https://link).
// ASCII only.
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escHtml = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ESC[c]);

function inline(escaped) {
  return escaped.split("`").map((seg, i) => {
    if (i % 2 === 1) return `<code>${seg}</code>`;
    return seg
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
      .replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
  }).join("");
}
// An unmatched backtick must not eat the rest of the line: only pair up backticks that have a partner.
function inlineSafe(line) {
  const n = (line.match(/`/g) || []).length;
  if (n % 2 === 0) return inline(escHtml(line));
  const k = line.lastIndexOf("`");
  return inline(escHtml(line.slice(0, k))) + escHtml(line.slice(k));
}

export function renderMd(src) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0, para = [], list = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inlineSafe).join("<br>")}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const open = tag => { if (list !== tag) { flushPara(); flushList(); out.push(`<${tag}>`); list = tag; } };
  while (i < lines.length) {
    const ln = lines[i];
    if (/^```/.test(ln)) {
      flushPara(); flushList();
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      out.push(`<pre><code>${escHtml(buf.join("\n"))}</code></pre>`); i++; continue;
    }
    let m;
    if (!ln.trim()) { flushPara(); flushList(); i++; continue; }
    if ((m = /^(#{1,3})\s+(.*)$/.exec(ln))) { flushPara(); flushList(); out.push(`<h${m[1].length + 2}>${inlineSafe(m[2])}</h${m[1].length + 2}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(ln)) { flushPara(); flushList(); out.push("<hr>"); i++; continue; }
    if ((m = /^>\s?(.*)$/.exec(ln))) { flushPara(); flushList(); out.push(`<blockquote>${inlineSafe(m[1])}</blockquote>`); i++; continue; }
    if ((m = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(ln))) {
      open("ul"); const on = m[1] !== " ";
      out.push(`<li class="md-task${on ? " done" : ""}"><input type="checkbox" data-a="nbCheck" data-line="${i}" ${on ? "checked" : ""} aria-label="${escHtml(m[2])}"><span>${inlineSafe(m[2])}</span></li>`); i++; continue;
    }
    if ((m = /^\s*[-*]\s+(.*)$/.exec(ln))) { open("ul"); out.push(`<li>${inlineSafe(m[1])}</li>`); i++; continue; }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(ln))) { open("ol"); out.push(`<li>${inlineSafe(m[1])}</li>`); i++; continue; }
    flushList(); para.push(ln); i++;
  }
  flushPara(); flushList();
  return out.join("");
}

// Flip the checkbox on one source line (used by preview checkboxes).
export function toggleTask(src, lineNo) {
  const lines = String(src || "").split("\n");
  const m = /^(\s*[-*]\s+\[)([ xX])(\]\s.*)$/.exec(lines[lineNo] || "");
  if (!m) return src;
  lines[lineNo] = m[1] + (m[2] === " " ? "x" : " ") + m[3];
  return lines.join("\n");
}

// Toolbar formatting on a text range. Returns {text, start, end} for the caller to put back.
export function applyFormat(text, start, end, kind) {
  const sel = text.slice(start, end);
  const wrap = (a, b, ph) => { const s = sel || ph; return { text: text.slice(0, start) + a + s + b + text.slice(end), start: start + a.length, end: start + a.length + s.length }; };
  const ls = text.lastIndexOf("\n", start - 1) + 1;
  const prefix = p => {
    const le = (() => { const k = text.indexOf("\n", end); return k < 0 ? text.length : k; })();
    const block = text.slice(ls, le).split("\n").map(l => (l.startsWith(p) ? l.slice(p.length) : p + l)).join("\n");
    return { text: text.slice(0, ls) + block + text.slice(le), start: ls, end: ls + block.length };
  };
  switch (kind) {
    case "bold": return wrap("**", "**", "bold");
    case "italic": return wrap("*", "*", "italic");
    case "code": return wrap("`", "`", "code");
    case "link": return wrap("[", "](https://)", "text");
    case "h": return prefix("## ");
    case "ul": return prefix("- ");
    case "check": return prefix("- [ ] ");
    case "quote": return prefix("> ");
    default: return { text, start, end };
  }
}

// ---- Structure for non-HTML outputs (the notes PDF). Same syntax as renderMd, returned as data.
// Inline runs: {s, b, i, st, code, link}. Blocks: h {lvl,runs} | p {runs} | li {ord,task,done,runs} | quote {runs} | code {text} | hr.
export function inlineRuns(src) {
  const out = []; let b = false, it = false, st = false, buf = "", i = 0;
  const flush = () => { if (buf) { out.push({ s: buf, b, i: it, st }); buf = ""; } };
  const closes = (tok, from) => src.indexOf(tok, from) > 0;
  const word = c => /\w/.test(c || "");
  while (i < src.length) {
    const ch = src[i], prev = src[i - 1], next = src[i + 1];
    if (ch === "`") { const j = src.indexOf("`", i + 1); if (j > i) { flush(); out.push({ s: src.slice(i + 1, j), code: true }); i = j + 1; continue; } }
    if (ch === "[") {
      const m = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/.exec(src.slice(i));
      if (m) { flush(); out.push({ s: m[1], b, i: it, st, link: m[2] }); i += m[0].length; continue; }
    }
    if (src.startsWith("**", i) && (b || closes("**", i + 2))) { flush(); b = !b; i += 2; continue; }
    if (src.startsWith("~~", i) && (st || closes("~~", i + 2))) { flush(); st = !st; i += 2; continue; }
    if (ch === "*" && next !== "*" && prev !== "*" && ((!it && next && !/\s/.test(next) && closes("*", i + 1)) || (it && prev && !/\s/.test(prev)))) { flush(); it = !it; i++; continue; }
    if (ch === "_" && ((!it && !word(prev) && next && !/\s/.test(next) && closes("_", i + 1)) || (it && !word(next) && prev && !/\s/.test(prev)))) { flush(); it = !it; i++; continue; }
    buf += ch; i++;
  }
  flush(); return out;
}

export function parseMd(src) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n"), out = [];
  let i = 0, para = [];
  const flush = () => { if (para.length) { out.push({ t: "p", runs: inlineRuns(para.join("\n")) }); para = []; } };
  while (i < lines.length) {
    const ln = lines[i]; let m;
    if (/^```/.test(ln)) { flush(); const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); out.push({ t: "code", text: buf.join("\n") }); i++; continue; }
    if (!ln.trim()) { flush(); i++; continue; }
    if ((m = /^(#{1,3})\s+(.*)$/.exec(ln))) { flush(); out.push({ t: "h", lvl: m[1].length, runs: inlineRuns(m[2]) }); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(ln)) { flush(); out.push({ t: "hr" }); i++; continue; }
    if ((m = /^>\s?(.*)$/.exec(ln))) { flush(); out.push({ t: "quote", runs: inlineRuns(m[1]) }); i++; continue; }
    if ((m = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(ln))) { flush(); out.push({ t: "li", task: true, done: m[1] !== " ", runs: inlineRuns(m[2]) }); i++; continue; }
    if ((m = /^\s*[-*]\s+(.*)$/.exec(ln))) { flush(); out.push({ t: "li", runs: inlineRuns(m[1]) }); i++; continue; }
    if ((m = /^\s*(\d+)[.)]\s+(.*)$/.exec(ln))) { flush(); out.push({ t: "li", ord: +m[1], runs: inlineRuns(m[2]) }); i++; continue; }
    para.push(ln); i++;
  }
  flush(); return out;
}
