// Class Choices: the step list the view draws must equal the one creation validates (a Rogue was stuck on Weapon mastery when they differed).
// Needs the unlocked library: CR_PASSWORD=<pw> node tools/crypt.mjs unlock, run, then delete data/library.json.
import { readFileSync } from "fs";
const st = new Map();
globalThis.localStorage = { getItem: k => st.get(k) ?? null, setItem: (k, v) => st.set(k, String(v)), removeItem: k => st.delete(k) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener(){}, documentElement: { classList: { toggle(){}, add(){}, remove(){} }, style: {} }, body: {} };
globalThis.window = globalThis; globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.ResizeObserver = class { observe(){} }; globalThis.matchMedia = () => ({ matches: false, addEventListener(){} });
Object.defineProperty(globalThis, "navigator", { value: { userAgent: "node", storage: {} }, configurable: true });
globalThis.indexedDB = null; globalThis.Audio = class {}; globalThis.Image = class {};
const root = new URL("../", import.meta.url).pathname;
const library = JSON.parse(readFileSync(root + "data/library.json", "utf8"));
const campaign = JSON.parse(readFileSync(root + "data/campaign.json", "utf8"));
const cr = await import(root + "js/creation.js");
const lu = await import(root + "js/views/levelup.js");
let bad = 0, n = 0;
for (const c of library.classes) {
  const d = cr.blankDraft(); const app = { library, campaign, info: new Set() };
  try { cr.pickClass(d, app, c.name); cr.randomClassChoices && 0; } catch (e) { console.log("pick", c.name, e.message); continue; }
  const cp = cr.choicePlan(d, app); if (!cp) continue;
  const a = { library, campaign, char: cp.tmp, lvl: cp.lvl, info: new Set() };
  const ids = lu.plan(a).steps.map(s => s.id).join(","), want = cp.steps.map(s => s.id).join(",");
  n++; if (ids !== want) { bad++; console.log("MISMATCH", c.name, ids, "vs", want); }
}
console.log(n, "classes,", bad, "mismatches"); process.exit(bad ? 1 : 0);
