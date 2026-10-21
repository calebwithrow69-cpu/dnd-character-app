import { esc, topbar, empty, platform } from "../ui.js";
import { listCharacters } from "../store.js";

function installHelp(app) {
  const p = platform();
  if (p.standalone || app.installDismissed) return "";
  let steps;
  if (p.inApp) {
    steps = `<p>You opened this inside another app (like Facebook or Messenger), which can't install it.</p>
      <ol><li>Tap the <b>⋯</b> or <b>share</b> menu in this screen.</li>
      <li>Choose <b>Open in ${p.ios ? "Safari" : "Chrome"}</b>.</li><li>Follow the steps there.</li></ol>`;
  } else if (p.ios) {
    steps = `<ol><li>Tap the <b>Share</b> button (the square with an arrow, at the bottom of Safari).</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Close Safari and open Character Runner from the new icon. Make your character there.</li></ol>`;
  } else if (p.android) {
    steps = `<ol><li>Tap the <b>⋮</b> menu at the top right of Chrome.</li>
      <li>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</li>
      <li>Open Character Runner from the new icon.</li></ol>`;
  } else {
    steps = `<ol><li>In Chrome or Edge, click the install icon at the right end of the address bar.</li>
      <li>Or open the browser menu and choose <b>Install Character Runner</b>.</li></ol>`;
  }
  return `<div class="callout"><h3>Put this on your home screen</h3>${steps}
    <p class="small muted" style="margin-top:8px">After that it works with no internet. Your characters stay on this device only.</p>
    <button class="btn sm" style="margin-top:10px" data-a="dismissInstall">Got it</button></div>`;
}

export function renderRoster(app) {
  const chars = listCharacters();
  const seedAvailable = app.seedGandork && !chars.some(c => c.id === app.seedGandork.id);

  const list = chars.length
    ? `<div class="panel">${chars.map(c => `
        <button class="rosteritem" data-a="openChar" data-id="${esc(c.id)}">
          <div class="av">${esc((c.name || "?").trim()[0] || "?")}</div>
          <div class="grow"><div class="ttl">${esc(c.name || "Unnamed")}</div>
            <div class="sub">Level ${esc(c.level || 1)} ${esc(c.species || "")} ${esc(c.class || "")}</div></div>
          <span class="muted" aria-hidden="true">›</span>
        </button>`).join("")}</div>`
    : empty("No characters yet", "Make your first character. It takes about two minutes.");

  return `
    ${topbar("Your characters", app.campaign?.name || "", { actions: [{ a: "openSettings", icon: "settings", label: "Settings" }] })}
    <main class="wrap page">
      ${app.needsNewPassword ? `<div class="callout"><h3>New rules are waiting</h3><p class="small">Your DM changed the group password. Enter the new one to get the latest rules — your characters are safe either way.</p><button class="btn sm pri" style="margin-top:10px" data-a="enterNewPassword">Enter password</button></div>` : ""}
      ${installHelp(app)}
      ${list}
      <div class="stack" style="margin-top:14px">
        <button class="btn pri block" data-a="newChar">New character</button>
        <button class="btn block" data-a="importPrompt">Restore from a backup file</button>
        ${seedAvailable ? `<button class="btn ghost block" data-a="importGandork">Add the sample character (Gandork)</button>` : ""}
      </div>
    </main>`;
}

export function renderUnlock(app) {
  return `<main class="wrap page" style="max-width:460px">
    <div style="text-align:center;margin:56px 0 18px">
      <img src="icons/icon-192.png" alt="" width="72" height="72" style="border-radius:16px">
      <h1 style="font-size:1.4rem;margin-top:14px">Character Runner</h1>
      <p class="muted" style="margin-top:6px">Your DM locked the rules. Type the group password once — this device will remember it.</p>
    </div>
    <form class="panel" data-form="unlock"><div class="panel-body stack">
      <div class="field"><label for="f-pass">Group password</label>
        <input class="f" id="f-pass" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" required></div>
      ${app.unlockError ? `<p class="small" style="color:var(--red)">${esc(app.unlockError)}</p>` : ""}
      <button class="btn pri block" type="submit" ${app.unlocking ? "disabled" : ""}>${app.unlocking ? "Unlocking…" : "Unlock"}</button>
      <p class="sub2">Don't know it? Ask your DM.</p>
    </div></form>
  </main>`;
}
