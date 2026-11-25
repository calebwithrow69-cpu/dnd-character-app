// Quick menu: saved list rules, and every tool points at a real action. Run: node tests/quick.test.mjs
import { readFileSync } from "fs";
const st = new Map();
globalThis.localStorage = { getItem: k => st.get(k) ?? null, setItem: (k, v) => st.set(k, String(v)), removeItem: k => st.delete(k) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, documentElement: { classList: { toggle() {}, add() {}, remove() {} }, style: {} }, body: {} };
globalThis.window = globalThis; globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.ResizeObserver = class { observe() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
Object.defineProperty(globalThis, "navigator", { value: { userAgent: "node", storage: {} }, configurable: true });
globalThis.indexedDB = null; globalThis.Audio = class {}; globalThis.Image = class {};
const root = new URL("../", import.meta.url).pathname;
const { TOOLS, quickIds, QUICK_DEFAULT, QUICK_MAX, hubCell } = await import(root + "js/views/tools.js");
let bad = 0;
const t = (name, ok) => { if (!ok) { bad++; console.log("FAIL", name); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
t("tool ids are unique", new Set(TOOLS.map(x => x[0])).size === TOOLS.length);
t("default list is valid", QUICK_DEFAULT.length <= QUICK_MAX && QUICK_DEFAULT.every(id => TOOLS.some(x => x[0] === id)));
t("no saved list gives the default", eq(quickIds({}), QUICK_DEFAULT) && eq(quickIds(null), QUICK_DEFAULT));
t("saved order is kept", eq(quickIds({ quick: ["hp", "dice", "death"] }), ["hp", "dice", "death"]));
t("unknown and repeated ids drop out", eq(quickIds({ quick: ["nope", "hp", "hp", "dice"] }), ["hp", "dice"]));
t("list is capped", quickIds({ quick: TOOLS.map(x => x[0]) }).length === QUICK_MAX);
t("an empty or junk list falls back", eq(quickIds({ quick: [] }), QUICK_DEFAULT) && eq(quickIds({ quick: "x" }), QUICK_DEFAULT) && eq(quickIds({ quick: ["zzz"] }), QUICK_DEFAULT));
const src = readFileSync(root + "js/app.js", "utf8"), acts = new Set([...src.matchAll(/^  (?:async )?([A-Za-z0-9_]+)\(/gm)].map(m => m[1]));
for (const [id, , , how] of TOOLS) t("action exists for " + id, how.modal ? true : acts.has(how.a));
for (const n of [1, 2, 3, 4, 5]) { const html = hubCell({ hubOpen: true, prefs: { quick: TOOLS.slice(0, n).map(x => x[0]) } }); t("menu renders " + n, (html.match(/class="hubopt"/g) || []).length === n); }
console.log(bad ? bad + " failed" : "quick: all checks passed");
process.exit(bad ? 1 : 0);
