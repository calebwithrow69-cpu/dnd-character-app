// Storage risk: what device this is, how fragile saved characters are here, and what to do about it.
// Pure (no DOM): pass the environment in, so tests can try any phone. Wording is content, not UI chrome:
// not scanned by copy-lint. Facts: WebKit deletes all script-writable storage of a Safari tab after 7 days of
// Safari use without visiting the site, Home Screen web apps are exempt; Chromium rarely clears on its own but
// users do; Firefox asks before storing permanently. ASCII only.

export function deviceInfo(env = {}) {
  const ua = env.ua != null ? env.ua : (typeof navigator !== "undefined" ? navigator.userAgent || "" : "");
  const touch = env.maxTouchPoints != null ? env.maxTouchPoints : (typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0);
  const standalone = !!env.standalone;
  const iPadOS = /Macintosh/.test(ua) && touch > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOS;
  const android = /Android/.test(ua);
  const cros = /CrOS/.test(ua);
  const mac = /Macintosh/.test(ua) && !ios;
  const win = /Windows/.test(ua);
  const device = /iPhone|iPod/.test(ua) ? "iPhone" : /iPad/.test(ua) || iPadOS ? "iPad"
    : android ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet") : cros ? "Chromebook" : mac ? "Mac" : win ? "Windows PC" : /Linux/.test(ua) ? "Linux PC" : "this device";
  const browser = /EdgiOS|Edg\//.test(ua) ? "Edge" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /OPR\/|OPiOS|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "your browser";
  const webkit = ios || (mac && browser === "Safari"); // every iPhone browser runs on Safari's engine
  const inApp = /FBAN|FBAV|Instagram|Messenger|Line\/|Snapchat|; wv\)/.test(ua);
  return { device, browser, ios, android, mac, win, webkit, standalone, inApp, memory: !!env.memory, canPrompt: !!env.canPrompt, fs: !!env.fs };
}

export const ERASERS = [
  "Clearing browsing data or site data",
  "Deleting the app from the Home Screen, or uninstalling the app or browser",
  "Private or incognito windows: everything is erased when they close",
  "A new phone, computer or browser: characters do not follow you",
  "Low device storage: browsers may clear site data when space runs out",
  "Deleting a character: it stays in Recently deleted for 30 days"
];

const LABEL = { high: "High risk", medium: "Medium risk", low: "Lower risk" };

export function assess(info, state = {}) {
  const persisted = !!state.persisted, d = info;
  const where = d.standalone ? "installed app" : "browser tab";
  const line = `${d.device} · ${d.browser} · ${where}`;
  const out = { info: d, level: "medium", label: "", line, headline: "", why: [], steps: [], short: "", erase: ERASERS.slice(), persisted };

  if (d.memory) {
    Object.assign(out, { level: "high", headline: "This browser is blocking storage.",
      short: "Storage blocked. Nothing is saved.",
      why: ["Characters made now disappear when this tab closes. There is no copy anywhere else."],
      steps: ["Leave private browsing, or allow site data for this site, then reload.", "Until then, export a backup before closing."] });
  } else if (d.webkit && !d.standalone) {
    const mac = d.mac;
    Object.assign(out, { level: "high", headline: "Safari can erase your characters after 7 days.",
      short: "Safari erases unused sites after 7 days.",
      why: [
        "Safari deletes a site's saved data after seven days of Safari use without opening that site. The Sheet keeps characters in exactly that storage.",
        d.ios && d.browser !== "Safari" ? `${d.browser} on ${d.device} runs on Safari's engine, so the same limit can apply.` : "There is no server copy. An erased character is gone for good."
      ].filter(Boolean),
      steps: mac
        ? ["Use Chrome, Edge or Firefox for The Sheet, or export a backup after every session.", "Keep backup files outside this browser: iCloud Drive, a USB stick, or email to yourself."]
        : ["Tap Share, then Add to Home Screen, and open The Sheet from that icon. Home Screen apps are exempt from the 7-day rule.", "Export a backup after any session where something changed.", "Save the backup somewhere that is not this " + d.device + ": Files, iCloud Drive or email."] });
  } else if (d.webkit && d.standalone) {
    Object.assign(out, { level: persisted ? "low" : "medium", headline: "Installed on the Home Screen: lower risk, not safe.",
      short: "Installed. Still erased if the app is deleted.",
      why: ["Home Screen apps are exempt from Safari's 7-day deletion rule.", "Deleting the app, clearing website data, or a full phone can still erase every character."],
      steps: ["Export a backup now, then again after big changes.", "Save backups outside this " + d.device + ": Files, iCloud Drive or email."] });
  } else if (d.browser === "Firefox") {
    Object.assign(out, { level: persisted ? "low" : "medium", headline: persisted ? "Firefox is keeping your data. Back up anyway." : "Firefox has not agreed to keep your data.",
      short: persisted ? "Firefox keeps data. Back up anyway." : "Firefox may clear data when space is short.",
      why: [persisted ? "Permanent storage is on for this site. Clearing site data still erases it." : "Firefox asks before storing data permanently. Until you allow it, the browser may clear it under pressure."],
      steps: [persisted ? "Export a backup now, then after big changes." : "Choose Allow when Firefox asks to store data permanently.", "Keep backup files outside this browser."] });
  } else {
    const canInstall = !d.standalone;
    Object.assign(out, { level: persisted || d.standalone ? "low" : "medium", headline: persisted || d.standalone ? "Your browser is keeping your data. Back up anyway." : "Your browser has not promised to keep your data.",
      short: persisted || d.standalone ? "Kept by the browser. Back up anyway." : "The browser may clear data under pressure.",
      why: [d.browser === "Chrome" || d.browser === "Edge" ? "Chrome rarely clears data by itself. Most losses are people clearing browsing data, or uninstalling." : "Browsers can clear unprotected site data when storage runs low.", "There is no server copy. A lost character cannot be recovered."],
      steps: [canInstall ? (d.canPrompt ? "Install the app from the button below: installed apps are protected better." : "Install the app from the browser menu: installed apps are protected better.") : "Export a backup now, then after big changes.", "Keep backup files outside this " + d.device + "."] });
  }
  out.label = LABEL[out.level];
  return out;
}

// Days since the last backup, as text for the Settings row.
export function backupAge(ts, now = Date.now()) {
  if (!ts) return "never";
  const d = Math.floor((now - ts) / 864e5);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago";
}

export const COPY = {
  title: "Your characters live on this device",
  lede: "The Sheet has no accounts and no server. Every character is saved inside this browser, on this device, and nowhere else. Nobody can recover one that is lost, including the DM.",
  erase: "What erases them",
  steps: "What to do",
  close: "A backup file is the only copy that survives all of this. Make one after every session where something changed."
};

// Reads this browser (call only in a page). `app` supplies the persisted flag.
export function storageEnv() {
  return { ua: navigator.userAgent || "", maxTouchPoints: navigator.maxTouchPoints || 0, standalone: !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true, memory: !!window.__memStore, canPrompt: !!window.__installPrompt, fs: "showSaveFilePicker" in window };
}
export const storageReport = app => assess(deviceInfo(storageEnv()), { persisted: !!(app && app.persisted) });
