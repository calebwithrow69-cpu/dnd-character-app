// Shared rendering helpers.

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Rules text from the library: escape, then paragraphs on blank lines and
// line breaks on single newlines.
export function formatText(text) {
  const t = String(text || "").trim();
  if (!t) return `<p class="muted">No description in the rules data.</p>`;
  return t.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
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
