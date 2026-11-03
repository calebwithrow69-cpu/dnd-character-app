// UI copy guard: no visible string in the app code may read like chatbot or tutorial text.
//   node tests/copy.test.mjs        (rules and definition: CLAUDE.md "UI copy"; tool: tools/copy-lint.mjs)
import { strings, check } from "../tools/copy-lint.mjs";
const all = strings(), bad = all.map(s => ({ ...s, hits: check(s) })).filter(s => s.hits.length);
bad.forEach(s => console.log(`FAIL ${s.f}:${s.line} [${s.hits.join(",")}] ${s.t.slice(0, 120)}`));
console.log(`${all.length - bad.length}/${all.length} strings clean`);
process.exit(bad.length ? 1 : 0);
