// "Put it on my home screen / desktop": one button wherever the browser
// allows it, a downloadable desktop shortcut where it doesn't (Opera, Firefox,
// Safari on Mac), and plain steps on iPhone, where Apple allows nothing else.
import { esc, platform } from "./ui.js";

export function appUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, "");
}

export function installInfo() {
  const p = platform();
  const ua = navigator.userAgent || "";
  const browser = /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "your browser";
  const mac = /Macintosh/.test(ua) && !p.ios;
  return { ...p, browser, mac, canPrompt: !!window.__installPrompt };
}

export async function promptInstall() {
  const e = window.__installPrompt;
  if (!e) return null;
  e.prompt();
  const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
  window.__installPrompt = null;
  return choice.outcome === "accepted";
}

// A double-clickable shortcut file that opens the app in the default browser.
export function downloadShortcut() {
  const url = appUrl();
  const { mac } = installInfo();
  let name, body, type;
  if (mac) {
    name = "Character Runner.webloc"; type = "application/x-apple-plist";
    body = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>URL</key><string>${url}</string></dict></plist>\n`;
  } else {
    name = "Character Runner.url"; type = "application/octet-stream";
    body = `[InternetShortcut]\r\nURL=${url}\r\n`;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return name;
}

// The card. compact = roster (dismissable); otherwise the Settings version.
export function installCard(app, { inSettings = false } = {}) {
  const i = installInfo();
  if (i.standalone) return inSettings ? `<p class="small">Installed. Open it from its icon any time — it works with no internet.</p>` : "";
  if (!inSettings && app.installDismissed) return "";
  const after = `<p class="small muted" style="margin-top:8px">Then it's one tap to open, and it works with no internet. Your characters stay on this device only.</p>`;
  let body;
  if (i.inApp) {
    body = `<p>You opened this inside another app (like Facebook or Messenger), which can't install it.</p>
      <ol><li>Tap the <b>⋯</b> or <b>share</b> menu in this screen.</li>
      <li>Choose <b>Open in ${i.ios ? "Safari" : "Chrome"}</b>, then come back to this box.</li></ol>`;
  } else if (i.canPrompt) {
    body = `<p>Add Character Runner to your ${i.desktop ? "desktop and Start menu" : "home screen"} like a normal app.</p>
      <div class="btnrow"><button class="btn pri" data-a="installApp">Install Character Runner</button></div>`;
  } else if (i.ios) {
    body = `<p>iPhones only allow this by hand — it takes 10 seconds:</p>
      <ol><li>Tap the <b>Share</b> button (square with an arrow${/CriOS/.test(navigator.userAgent) ? ", top right" : ", bottom of Safari"}).</li>
      <li>Scroll down, tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Open Character Runner from the new icon from now on.</li></ol>`;
  } else if (i.android) {
    body = `<ol><li>Tap the <b>⋮</b> menu at the top right of ${esc(i.browser)}.</li>
      <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li></ol>`;
  } else {
    const why = i.browser === "Opera" || i.browser === "Firefox" ? `${i.browser} can't install web apps, so here's the next best thing.`
      : i.browser === "Safari" ? "Or in Safari use File → Add to Dock." : "If your browser shows an install icon in the address bar, that works too.";
    body = `<p>Get a desktop icon that opens Character Runner with a double-click. ${esc(why)}</p>
      <div class="btnrow"><button class="btn pri" data-a="downloadShortcut">Download desktop shortcut</button></div>
      <p class="small muted" style="margin-top:6px">Move the downloaded file to your Desktop. It opens in your normal browser.</p>`;
  }
  if (inSettings) return body + after;
  return `<div class="callout installcard"><h3>Make it one tap to open</h3>${body}${after}
    <button class="btn sm ghost" style="margin-top:8px" data-a="dismissInstall">Not now</button></div>`;
}
