// Storage risk wording/levels and the recently-deleted list. Pure Node.
import { deviceInfo, assess, backupAge } from "../js/storagerisk.js";
import { trashAdd, trashList, trashTake, daysLeft } from "../js/trash.js";
let pass = 0, fail = 0;
const t = (name, f) => { try { f(); pass++; } catch (e) { fail++; console.log("FAIL " + name + ": " + e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || "") + " got " + JSON.stringify(a) + " want " + JSON.stringify(b)); };

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1",
  ipadOS: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36"
};
const lvl = (ua, extra = {}, st = {}, touch = 0) => assess(deviceInfo({ ua, maxTouchPoints: touch, ...extra }), st);

t("iPhone Safari tab is high risk and names the 7-day rule", () => { const r = lvl(UA.iphoneSafari); eq(r.level, "high"); if (!/7 days/.test(r.headline)) throw new Error(r.headline); if (!r.steps.some(s => /Add to Home Screen/.test(s))) throw new Error("no install step"); eq(r.label, "High risk"); });
t("iPhone Chrome is on Safari's engine: high, mentions it", () => { const r = lvl(UA.iphoneChrome); eq(r.level, "high"); if (!r.why.some(w => /Safari's engine/.test(w))) throw new Error("no engine note"); });
t("iPadOS (Mac UA + touch) is an iPad, not a Mac", () => { const d = deviceInfo({ ua: UA.ipadOS, maxTouchPoints: 5 }); eq(d.device, "iPad"); eq(d.ios, true); eq(deviceInfo({ ua: UA.macSafari, maxTouchPoints: 0 }).device, "Mac"); });
t("Mac Safari tab is high and does not tell you to Add to Home Screen", () => { const r = lvl(UA.macSafari); eq(r.level, "high"); if (r.steps.some(s => /Home Screen/.test(s))) throw new Error("wrong step for Mac"); });
t("iPhone installed: medium until persistent, then low", () => { eq(lvl(UA.iphoneSafari, { standalone: true }).level, "medium"); eq(lvl(UA.iphoneSafari, { standalone: true }, { persisted: true }).level, "low"); });
t("Chrome desktop tab: medium, low when persisted", () => { eq(lvl(UA.winChrome).level, "medium"); eq(lvl(UA.winChrome, {}, { persisted: true }).level, "low"); eq(lvl(UA.macChrome).level, "medium"); });
t("Edge reads as Edge, Chrome as Chrome, Samsung as Samsung", () => { eq(deviceInfo({ ua: UA.winEdge }).browser, "Edge"); eq(deviceInfo({ ua: UA.winChrome }).browser, "Chrome"); eq(deviceInfo({ ua: UA.samsung }).browser, "Samsung Internet"); });
t("Android phone vs tablet", () => { eq(deviceInfo({ ua: UA.androidChrome }).device, "Android phone"); eq(deviceInfo({ ua: UA.androidTablet }).device, "Android tablet"); });
t("Firefox asks to allow permanent storage until persisted", () => { const a = lvl(UA.winFirefox); eq(a.level, "medium"); if (!a.steps.some(s => /Allow/.test(s))) throw new Error("no Allow step"); eq(lvl(UA.winFirefox, {}, { persisted: true }).level, "low"); });
t("Installed Android Chrome is low", () => { eq(lvl(UA.androidChrome, { standalone: true }).level, "low"); });
t("Blocked storage is high whatever the browser", () => { for (const ua of Object.values(UA)) eq(lvl(ua, { memory: true }).level, "high", ua.slice(0, 30)); });
t("every case lists the erasers and ends with a usable step list", () => { for (const ua of Object.values(UA)) { const r = lvl(ua); if (r.erase.length < 5 || r.steps.length < 2 || !r.headline || !r.line || !r.short) throw new Error("thin: " + ua.slice(0, 40)); } });
t("no overpromising words in any case", () => { for (const ua of Object.values(UA)) for (const p of [false, true]) for (const sa of [false, true]) { const r = lvl(ua, { standalone: sa }, { persisted: p }); const all = [r.headline, r.short, ...r.why, ...r.steps].join(" "); if (/(?<!not )\bsafe\b|guarantee|never lose|can't lose/i.test(all)) throw new Error("promise: " + all.slice(0, 80)); } });
t("backupAge", () => { const n = 1e12; eq(backupAge(0, n), "never"); eq(backupAge(n - 1000, n), "today"); eq(backupAge(n - 864e5 * 1.2, n), "yesterday"); eq(backupAge(n - 864e5 * 9, n), "9 days ago"); });

const mem = (cap = Infinity) => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { if (String(v).length > cap) throw new Error("quota"); m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };
const ch = (id, name = id) => ({ id, name, level: 3 });
t("trash add, list newest first, take returns and removes", () => { const ls = mem(), n = 1e12; trashAdd(ch("a"), ls, n); trashAdd(ch("b"), ls, n + 10); eq(trashList(ls, n + 20).map(e => e.char.id).join(), "b,a"); eq(trashTake("a", ls, n + 20).id, "a"); eq(trashList(ls, n + 20).length, 1); eq(trashTake("zzz", ls, n), null); });
t("trash expires after 30 days", () => { const ls = mem(), n = 1e12; trashAdd(ch("a"), ls, n); eq(trashList(ls, n + 29 * 864e5).length, 1); eq(trashList(ls, n + 31 * 864e5).length, 0); eq(daysLeft({ at: n }, n + 10 * 864e5), 20); });
t("trash keeps at most 8, newest", () => { const ls = mem(), n = 1e12; for (let i = 0; i < 12; i++) trashAdd(ch("c" + i), ls, n + i); const l = trashList(ls, n + 100); eq(l.length, 8); eq(l[0].char.id, "c11"); });
t("deleting the same character twice keeps one entry", () => { const ls = mem(), n = 1e12; trashAdd(ch("a"), ls, n); trashAdd(ch("a"), ls, n + 5); eq(trashList(ls, n + 6).length, 1); });
t("quota pressure drops the oldest instead of losing the new one", () => { const ls = mem(900), n = 1e12, big = id => ({ id, name: "x".repeat(300), level: 1 }); trashAdd(big("a"), ls, n); trashAdd(big("b"), ls, n + 1); trashAdd(big("c"), ls, n + 2); const l = trashList(ls, n + 3); if (!l.length || l[0].char.id !== "c") throw new Error(JSON.stringify(l.map(e => e.char.id))); });
t("garbage in trash storage is ignored", () => { for (const bad of ["{", "null", '"x"', "[1,2]", '[{"at":"x","char":{}}]', '[{"at":1,"char":null}]']) { const ls = mem(); ls.setItem("dnd-trash-v1", bad); eq(trashList(ls, 5).length, 0, bad); eq(trashAdd(ch("a"), ls, 5), true, bad); } });
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
