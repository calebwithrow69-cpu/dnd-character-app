// Shared rendering helpers.

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---- Glossary: rules terms that get highlighted in any rules text.
// Filled by the app from the book glossary + data/terms.json.
let GLOSSARY = new Map();      // lowercased name -> {name, text}
let TERM_RE = null;
const SKIP_TERMS = new Set(["adventure", "campaign", "ally", "attitude", "alignment", "action", "magic", "help", "ready", "speed", "hit points", "save", "push", "slow", "vex", "nick", "sap", "graze", "cleave", "topple", "dash", "hide", "dodge", "darkness"]);
export function setGlossary(entries) {
  GLOSSARY = new Map();
  for (const e of entries) {
    if (!e || !e.name || !e.text) continue;
    for (const n of [e.name, ...(e.aliases || [])]) if (!GLOSSARY.has(n.toLowerCase())) GLOSSARY.set(n.toLowerCase(), { name: e.name, text: e.text });
  }
  // Only capitalized, whole-word matches (2024 rules capitalize defined terms), longest first.
  const names = [...GLOSSARY.keys()].filter(k => !SKIP_TERMS.has(k)).sort((a, b) => b.length - a.length);
  const pat = names.map(k => [...GLOSSARY.values()].find(v => v.name.toLowerCase() === k)?.name || k)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const aliasPat = [...GLOSSARY.entries()].filter(([k, v]) => k !== v.name.toLowerCase() && !SKIP_TERMS.has(k)).map(([k]) => k.replace(/\b\w/g, c => c.toUpperCase()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const all = [...new Set([...pat, ...aliasPat])].sort((a, b) => b.length - a.length);
  TERM_RE = all.length ? new RegExp(`\\b(${all.join("|")})(s|es)?\\b`, "g") : null;
}
export function glossaryEntry(name) { return GLOSSARY.get(String(name || "").toLowerCase()) || null; }

function linkTerms(escaped, seen) {
  if (!TERM_RE) return escaped;
  return escaped.replace(TERM_RE, (m, base) => {
    const e = GLOSSARY.get(base.toLowerCase());
    if (!e || seen.has(e.name)) return m;
    seen.add(e.name);
    return `<button type="button" class="term" data-term="${esc(e.name)}">${m}</button>`;
  });
}

// Rules text: paragraphs on blank lines, bold lead-ins ("Darkvision. You…"
// or "Speed: 30 feet"), and the first mention of each glossary term turned
// into a tap/hover definition.
export function formatText(text, { terms = true } = {}) {
  const t = String(text || "").trim();
  if (!t) return `<p class="muted">No description in the rules data.</p>`;
  const seen = new Set();
  return t.split(/\n{2,}/).map(p => {
    let lead = "", body = p;
    // Title Case lead-ins only ("Hop Up.", "Creature Type:"), never an ordinary sentence.
    const m = /^([A-Z][\w'’()-]*(?: (?:[A-Z0-9][\w'’()-]*|of|the|and|or|to|in|a|an|with|for|on|at)){0,6})([.:])\s+(?=\S)/.exec(p);
    if (m) { lead = m[1] + m[2]; body = p.slice(m[0].length); }
    const fmt = x => { const e = esc(x).replace(/\n/g, "<br>"); return terms ? linkTerms(e, seen) : e; };
    return `<p>${lead ? `<b class="lead">${esc(lead)}</b> ` : ""}${fmt(body)}</p>`;
  }).join("");
}

// ---- Condition icons (simple line glyphs, drawn for this app)
const CI = {
  Blinded: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 4l16 16"/>',
  Charmed: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  Deafened: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  Frightened: '<path d="M12 3a7 7 0 00-7 7v10l2.3-1.6L9.7 20 12 18.4 14.3 20l2.4-1.6L19 20V10a7 7 0 00-7-7z"/><circle cx="9.5" cy="10" r="1" class="fill"/><circle cx="14.5" cy="10" r="1" class="fill"/>',
  Grappled: '<path d="M7 11V6a1.5 1.5 0 013 0v4M10 10V5a1.5 1.5 0 013 0v5M13 10V6a1.5 1.5 0 013 0v6M16 12V9a1.5 1.5 0 013 0v4a7 7 0 01-7 7h-1a6 6 0 01-5-3l-2-3.5a1.5 1.5 0 012.6-1.5L7 13"/>',
  Incapacitated: '<path d="M12 12a2 2 0 012 2 4 4 0 01-4 4 6 6 0 01-6-6 8 8 0 018-8 10 10 0 0110 10"/>',
  Invisible: '<circle cx="12" cy="6" r="3" stroke-dasharray="2.5 2"/><path d="M5 21v-3a7 7 0 0114 0v3" stroke-dasharray="2.5 2"/>',
  Paralyzed: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  Petrified: '<path d="M7 4h10l4 6-4 10H7L3 10z"/><path d="M3 10h18M9 4l3 6 3-6M12 10v10"/>',
  Poisoned: '<path d="M12 3s6 6.6 6 11a6 6 0 01-12 0c0-4.4 6-11 6-11z"/><path d="M10 14h.01M14 14h.01M10 17.5h4"/>',
  Prone: '<circle cx="5" cy="15" r="2"/><path d="M8 16h10l3-3M8 16l4 4"/><path d="M3 21h18"/>',
  Restrained: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  Stunned: '<path d="M12 3l1.6 3.4L17 7l-2.5 2.4.6 3.6L12 11.4 8.9 13l.6-3.6L7 7l3.4-.6z"/><path d="M5 18h14M8 21h8"/>',
  Unconscious: '<path d="M4 6h6l-6 7h6M13 12h5l-5 6h5"/>',
  Exhaustion: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 10v4M5 10v4"/>'
};
export function conditionIcon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="cicon">${CI[name] || '<circle cx="12" cy="12" r="8"/>'}</svg>`;
}

// One row in a picker: the choose button plus an (i) that expands what it does.
export function infoRow({ key, action, data = {}, title, sub = "", pressed = false, disabled = false, open = false, detail = "", badge = "" }) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ");
  return `<div class="inforow ${open ? "open" : ""}">
    <div class="inforow-top">
      <button class="optcard" data-a="${action}" ${attrs} aria-pressed="${pressed}" ${disabled ? "disabled" : ""}>
        <span class="grow"><b>${esc(title)}</b>${sub ? `<span>${sub}</span>` : ""}</span>${badge}
      </button>
      <button class="infobtn" data-a="toggleInfo" data-key="${esc(key)}" aria-expanded="${open}" aria-label="What ${esc(title)} does">${open ? ICONS.close : ICONS.info}</button>
    </div>
    ${open ? `<div class="about">${detail}</div>` : ""}
  </div>`;
}

let toastTimer = null;
export function toast(msg, opts = {}) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.innerHTML = "";
  el.append(document.createTextNode(msg));
  if (opts.action) {
    const b = document.createElement("button");
    b.className = "toast-act"; b.textContent = opts.action;
    b.onclick = () => { el.classList.remove("show"); opts.onAction && opts.onAction(); };
    el.append(b);
  }
  el.classList.toggle("has-act", !!opts.action);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), opts.action ? 5500 : 2600);
}

const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
export const ICONS = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  dice: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" class="fill"/><circle cx="16" cy="16" r="1.3" class="fill"/><circle cx="12" cy="12" r="1.3" class="fill"/>'),
  stats: svg('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  spell: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>'),
  gear: svg('<path d="M6 7h12l-1 13H7L6 7zM9 7V5a3 3 0 016 0v2"/>'),
  book: svg('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z"/><path d="M4 19a2 2 0 012-2h13"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>')
};

// Top bar. `actions` = [{a, icon, label}] buttons on the right.
export function topbar(title, sub, { back, actions = [] } = {}) {
  return `<header class="topbar"><div class="wrap row">
    ${back ? `<button class="iconbtn" data-a="${back}" aria-label="Back">${ICONS.back}</button>` : ""}
    <div class="grow"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
    ${actions.map(x => `<button class="iconbtn" data-a="${x.a}" aria-label="${esc(x.label)}">${ICONS[x.icon]}</button>`).join("")}
  </div></header>`;
}

export function empty(title, body) {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
}

export function modalShell(title, body, footer = "") {
  return `<div class="modal-back" data-a="closeModalBackdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2>
        <button class="iconbtn" data-a="closeModal" aria-label="Close">${ICONS.close}</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
    </div></div>`;
}

export function searchBox(query, value, placeholder) {
  return `<div class="search">${ICONS.search}<input class="f" type="search" data-query="${query}" value="${esc(value || "")}" placeholder="${esc(placeholder)}" autocomplete="off"></div>`;
}

export function platform() {
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const inApp = /FBAN|FBAV|Instagram|Messenger|Line\/|Snapchat|wv\)/.test(ua);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  return { ios, android, inApp, standalone, desktop: !ios && !android };
}
