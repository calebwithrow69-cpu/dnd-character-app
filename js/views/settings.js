// Settings and changelog screens. Plain markup; actions live in app.js.
// ASCII only in this file.
import { esc, modalShell } from "../ui.js";
import { installCard } from "../install.js";
import { VERSION, STAGE, TESTERS, CHANGELOG } from "../changelog.js";

const HAS_VIBRATE = typeof navigator !== "undefined" && "vibrate" in navigator;
const HAS_WAKE = typeof navigator !== "undefined" && "wakeLock" in navigator;

function sw(k, label, hint, on, extra = {}) {
  const dis = extra.disabled;
  return `<div class="setrow" data-s="${esc((label + " " + (hint || "") + " " + (extra.kw || "")).toLowerCase())}">
    <div class="setinfo"><div class="setlabel">${esc(label)}</div>${hint ? `<div class="sethint">${esc(hint)}</div>` : ""}</div>
    <button class="switch" role="switch" aria-checked="${on ? "true" : "false"}" aria-label="${esc(label)}" data-a="togglePref" data-k="${k}" ${dis ? "disabled" : ""}><i></i></button>
  </div>`;
}

function choice(k, label, hint, options, cur, extra = {}) {
  return `<div class="setrow col" data-s="${esc((label + " " + (hint || "") + " " + (extra.kw || "")).toLowerCase())}">
    <div class="setinfo"><div class="setlabel">${esc(label)}</div>${hint ? `<div class="sethint">${esc(hint)}</div>` : ""}</div>
    <div class="seg">${options.map(([v, l]) => `<button data-a="setPrefV" data-k="${k}" data-v="${v}" aria-pressed="${cur === v}">${esc(l)}</button>`).join("")}</div>
  </div>`;
}

function section(id, title, body, open) {
  return `<details class="setsec" data-sec="${id}" ${open ? "open" : ""}><summary><span>${esc(title)}</span></summary><div class="setbody">${body}</div></details>`;
}

function daysAgo(ts) {
  if (!ts) return "never";
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago";
}

export function renderSettingsModal(app) {
  const p = app.prefs || {};
  const L = app.library;
  const theme = p.theme || "auto", size = p.size || "normal";
  const sfxOn = (p.sfx || "on") === "on";
  const vol = p.vol == null ? 70 : p.vol;
  const op = id => (app.setOpen ? app.setOpen.has(id) : id === "appearance" || id === "feel");

  const appearance =
    choice("theme", "Theme", "Auto follows your device.", [["auto", "Auto"], ["dark", "Dark Tome"], ["light", "Parchment"]], theme, { kw: "dark light mode" }) +
    choice("size", "Text size", "", [["normal", "Normal"], ["large", "Large"], ["xl", "Extra large"]], size, { kw: "font zoom" }) +
    choice("font", "Text style", "Plain is easier to read for some people.", [["tome", "Tome serif"], ["plain", "Plain sans"]], p.font || "tome", { kw: "font dyslexia readable" });

  const feel =
    sw("sfx", "Button sounds", "Soft taps, page turns and dice clatter.", sfxOn, { kw: "sound audio" }) +
    `<div class="setrow col" data-s="volume loud quiet sound">
      <div class="setinfo"><div class="setlabel">Volume</div><div class="sethint">${vol}%</div></div>
      <div class="volrow"><input type="range" min="0" max="100" step="5" value="${vol}" data-pref-range="vol" aria-label="Sound volume" ${sfxOn ? "" : "disabled"}>
      <button class="btn sm" data-a="testSound" ${sfxOn ? "" : "disabled"}>Test</button></div>
    </div>` +
    sw("haptics", "Vibration on tap", HAS_VIBRATE ? "A tiny buzz on supported phones." : "Not supported on this device (iPhones do not allow it).", p.haptics !== "off" && HAS_VIBRATE, { disabled: !HAS_VIBRATE, kw: "buzz haptic" });

  const play =
    sw("wake", "Keep screen awake", HAS_WAKE ? "Stops your phone sleeping while the app is open at the table." : "Not supported on this browser.", !!p.wake && HAS_WAKE, { disabled: !HAS_WAKE, kw: "sleep screen on" }) +
    sw("vignette", "Red edge glow at low HP", "The screen edges pulse red when you are nearly down.", p.vignette !== false, { kw: "vignette danger" }) +
    choice("sheetStyle", "Character sheet", "Classic follows the printed 2024 sheet on one page. Advanced adds Play Mode, loadouts and tabs. Changing it asks you to confirm.", [["classic", "Classic"], ["advanced", "Advanced"]], p.sheetStyle || "classic", { kw: "sheet layout classic advanced beginner" }) +
    choice("startTab", "Open characters on", "Which tab shows first.", [["stats", "Character"], ["rules", "Rules"]], p.startTab || "stats", { kw: "default start tab" }) +
    choice("rollfx", "Roll animation", "The full-screen dice roll. Crits only skips the tumble but keeps the natural 1 and 20 effects. Off keeps the screen but drops the motion.", [["full", "Full"], ["crits", "Crits only"], ["off", "Off"]], p.rollfx || "full", { kw: "dice animation effects natural 20 natural 1 reduce motion" }) +
    sw("cxfx", "Character creation effects", "Falling leaves, sparks, stars and colour changes behind the creation screens, and the seal when you finish. Turn off for a plain screen.", p.cxfx !== false, { kw: "creation effects particles animation reduce motion" }) +
    sw("keys", "Keyboard shortcuts", "Play Mode on a laptop: / search, J and K move, Enter uses, N next turn, 1 2 3 mark Action, Bonus Action and Reaction. Also shows the shortcut bar.", p.keys !== false, { kw: "keyboard keys hotkeys shortcuts buttons controls" });

  const access =
    choice("motion", "Animations", "Auto follows your device's reduce-motion setting.", [["auto", "Auto"], ["reduced", "Reduced"]], p.motion || "auto", { kw: "motion reduce animation" }) +
    sw("contrast", "High contrast", "Brighter text and stronger borders.", p.contrast === "high", { kw: "contrast" }) +
    sw("bigtap", "Bigger buttons", "Larger tap targets for thumbs.", !!p.bigtap, { kw: "tap target large" });

  const data =
    `<div class="setrow col" data-s="backup export save characters restore import">
      <div class="setinfo"><div class="setlabel">Backups</div><div class="sethint">Characters live only on this device. Last backup: ${esc(daysAgo(p.lastBackup))}.</div></div>
      <button class="btn block" data-a="exportAll">Save a backup of all characters</button>
      <button class="btn block" data-a="importPrompt">Restore from a backup file</button>
      <div class="sethint">${app.persisted ? "This browser has agreed to keep your data." : "Tip: installing the app to your home screen keeps your data safest."}</div>
    </div>` +
    `<div class="setrow col" data-s="update rules data refresh check">
      <div class="setinfo"><div class="setlabel">Rules data</div><div class="sethint">App updates install themselves: at launch, or with an Update now bar. ${L ? esc((app.campaign && app.campaign.name) || "Campaign") + ": " + L.classes.length + " classes, " + L.species.length + " species, " + L.spells.length + " spells, " + L.items.length + " items." : ""}</div></div>
      <button class="btn block" data-a="checkUpdates">Check for updates now</button>
    </div>` +
    `<div class="setrow col" data-s="install home screen shortcut phone qr">
      <div class="setinfo"><div class="setlabel">Open with one tap</div></div>
      ${installCard(app, { inSettings: true })}
    </div>`;

  const danger =
    `<div class="setrow col" data-s="reset defaults settings">
      <div class="setinfo"><div class="setlabel">Reset settings</div><div class="sethint">Puts every setting above back to its default. Characters are not touched.</div></div>
      <button class="btn block danger" data-a="resetPrefs">Reset settings to defaults</button>
    </div>` +
    `<div class="setrow col" data-s="clear cache offline fix troubleshoot reload">
      <div class="setinfo"><div class="setlabel">Fix a broken install</div><div class="sethint">Clears the offline copy of the app and reloads. Characters stay, but you will enter the group password again.</div></div>
      <button class="btn block danger" data-a="clearOffline">Clear offline copy and reload</button>
    </div>`;

  const about =
    `<div class="setrow col" data-s="version changelog whats new about testers">
      <div class="setinfo"><div class="setlabel">Character Runner ${esc(VERSION)} <span class="tag amber">${esc(STAGE)}</span></div><div class="sethint">Tester build: ${esc(TESTERS)}.</div></div>
      <button class="btn block" data-a="openChangelog">What's new (changelog)</button>
    </div>` +
    (L && L.credits ? `<div class="setrow col" data-s="credits license srd">${L.credits.map(t => `<div class="sethint">${esc(t)}</div>`).join("")}</div>` : "");

  const body = `<div class="stack">
    <div class="search"><input class="f" type="search" placeholder="Search settings" aria-label="Search settings" data-set-search="1" autocomplete="off"></div>
    <div id="set-empty" class="sethint hide">No settings match that.</div>
    ${section("appearance", "Appearance", appearance, op("appearance"))}
    ${section("feel", "Sound and feel", feel, op("feel"))}
    ${section("play", "Play", play, op("play"))}
    ${section("access", "Accessibility", access, op("access"))}
    ${section("data", "Data and backups", data, op("data"))}
    ${section("about", "About and what's new", about, op("about"))}
    ${section("danger", "Reset and repair", danger, op("danger"))}
  </div>`;
  return modalShell("Settings", body, `<button class="btn pri" data-a="closeModal">Done</button>`);
}

export function renderChangelogModal() {
  const body = CHANGELOG.map(r => `<div class="clog">
    <div class="clog-head"><h3>${esc(r.v)}</h3><span class="tag amber">${esc(r.stage)}</span><span class="sub2">${esc(r.date)}</span></div>
    <p class="small muted">${esc(r.blurb)}</p>
    ${r.groups.map(g => `<div class="clog-group"><div class="clog-title">${esc(g.title)}</div><ul>${g.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}
  </div>`).join("");
  return modalShell("What's new", body, `<button class="btn" data-a="openSettings">Back to settings</button><button class="btn pri" data-a="closeModal">Done</button>`);
}
