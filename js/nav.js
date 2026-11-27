// Navigation history (pure). Places form a hierarchy: Main menu > Characters > a character > its pages.
// The app records every move between tracked places; Back returns to the previous one and names it.
// A place is {screen, tab, id, sub}: tab = sheet page (stats, notes, rules, shop, settings), id = character,
// sub = the sheet tab inside Character (gear, spells, ...). Only screen + tab + id make two places different.
// ASCII only.

export const TRACKED = ["home", "roster", "rules", "notes", "sheet", "graveyard"];
export const MAIN_SUB = ["", "sheet", "play"];
const PAGE_LABEL = { stats: "Character", notes: "Notes", rules: "Rules", shop: "Shop", settings: "Settings" };
const SCREEN_LABEL = { home: "Main menu", roster: "Characters", rules: "Rules", notes: "Notes", graveyard: "Graveyard" };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export const keyOf = l => l.screen + "|" + l.tab + "|" + l.id;

// Where the app is now, or null on screens that are flows with their own Back (create, level up, DM table).
export function here(A) {
  if (!TRACKED.includes(A.screen)) return null;
  const sheet = A.screen === "sheet" && A.char;
  return {
    screen: A.screen,
    tab: sheet ? A.sheetTab || "stats" : "",
    id: sheet ? A.char.id : "",
    sub: sheet && (A.sheetTab || "stats") === "stats" ? A.classicSub || "" : ""
  };
}

export function blank() { return { stack: [], last: null }; }

// One render's worth of history. `back` = this move came from the Back action (the stack was already popped).
export function step(nav, now, back) {
  if (!now) return nav;
  if (!nav.last) return { stack: [], last: now };
  if (keyOf(nav.last) === keyOf(now)) return { stack: nav.stack, last: now };
  if (back) return { stack: nav.stack, last: now };
  if (now.screen === "home") return { stack: [], last: now };
  let stack = nav.stack.slice();
  const i = stack.map(keyOf).lastIndexOf(keyOf(now));
  if (i >= 0) stack = stack.slice(0, i); // came back to a place already behind us: drop what was above it
  else stack.push(nav.last);
  return { stack: stack.slice(-20), last: now };
}

export const top = nav => nav.stack[nav.stack.length - 1] || null;

export function subLabel(sub) { return !sub || MAIN_SUB.includes(sub) ? "" : cap(sub === "stats" ? "Stats" : sub); }

// Short name of a place, for the Back button.
export function label(l) {
  if (!l) return "Main menu";
  if (l.screen !== "sheet") return SCREEN_LABEL[l.screen] || "Back";
  if (l.tab === "stats") return subLabel(l.sub) || "Character";
  return PAGE_LABEL[l.tab] || "Back";
}

// The path to the current sheet place: ["Gandork", "Gear", "Shop"]. The last item is the page title.
export function sheetPath(name, l) {
  if (!l || l.screen !== "sheet") return [name];
  if (l.tab === "shop") return [name, "Gear", "Shop"];
  if (l.tab !== "stats") return [name, PAGE_LABEL[l.tab] || ""].filter(Boolean);
  const s = subLabel(l.sub);
  return s ? [name, s] : [name];
}
