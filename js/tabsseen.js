// Which sheet sections this device has opened. A section never opened shows a small dot on its tab.
// Per device, in its own key; a blocked or full storage just means no dots. ASCII only.
const KEY = "dnd-seen-tabs-v1";
export const DOT_TABS = ["notes", "rules", "shop"];
function read() { try { const o = JSON.parse(localStorage.getItem(KEY) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
export function tabIsNew(id) { return DOT_TABS.includes(id) && !read()[id]; }
export function markTabSeen(id) {
  if (!DOT_TABS.includes(id) || read()[id]) return;
  try { const o = read(); o[id] = 1; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { }
}
