import assert from "node:assert/strict";
import * as dm from "../js/dmmode.js";
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FAIL", name); throw e; } };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

t("budget table: 20 levels, every row rises, spot values from the 2024 DMG", () => {
  assert.equal(dm.BUDGET.length, 21);
  for (let L = 1; L <= 20; L++) { const [lo, mo, hi] = dm.BUDGET[L]; assert.ok(lo < mo && mo < hi, "tier order " + L); if (L > 1) dm.BUDGET[L].forEach((v, i) => assert.ok(v >= dm.BUDGET[L - 1][i], "level order " + L)); }
  assert.deepEqual(dm.BUDGET[1], [50, 75, 100]); assert.deepEqual(dm.BUDGET[5], [500, 750, 1100]); assert.deepEqual(dm.BUDGET[10], [1600, 2300, 3100]); assert.deepEqual(dm.BUDGET[20], [6400, 13200, 22000]);
});
t("party budget sums per character and rates the lowest tier it fits", () => {
  assert.equal(dm.partyBudget([5, 5, 5, 5], "moderate"), 3000);
  assert.equal(dm.partyBudget([1, 3, 4], "low"), 50 + 150 + 250);
  assert.equal(dm.rate([5, 5, 5, 5], 2000).tier, "low"); assert.equal(dm.rate([5, 5, 5, 5], 2001).tier, "moderate");
  assert.equal(dm.rate([5, 5, 5, 5], 4400).tier, "high"); assert.equal(dm.rate([5, 5, 5, 5], 4401).tier, "over");
  assert.equal(dm.partyBudget([], "low"), 0); assert.equal(dm.partyBudget([99], "low"), 6400, "level is clamped");
});
t("CR to XP", () => { assert.equal(dm.crXp("1/4"), 50); assert.equal(dm.crXp("4"), 1100); assert.equal(dm.crXp("30"), 155000); assert.equal(dm.crXp("nope"), null); });

const char = { id: "abc", name: "Gandork", class: "Druid", subclass: "Moon", species: "Human", languages: "Common, Druidic", conditions: ["Prone"], exhaustion: 1, concentration: "Entangle", hp: { max: 30, cur: 12, temp: 3 }, dead: false };
const der = { level: 5, ac: 16, speed: 30, initiative: 2, passivePerception: 15, saves: { str: 0, dex: 2, con: 3, int: 4, wis: 6, cha: -1 }, skills: [{ id: "insight", bonus: 4 }, { id: "investigation", bonus: 1 }], spellInfo: { dc: 14 } };
t("card from a character, code round trip, sanitizing", () => {
  const c = dm.makeCard(char, der, 1000);
  assert.equal(c.name, "Gandork"); assert.equal(c.pi, 14); assert.equal(c.pinv, 11); assert.equal(c.dc, 14); assert.deepEqual(c.conds, ["Prone"]); assert.equal(c.conc, "Entangle"); assert.equal(c.cur, 12);
  const back = dm.decodeCard(dm.encodeCard(c)); assert.deepEqual(back, c);
  assert.equal(dm.decodeCard("CRP1.@@@"), null); assert.equal(dm.decodeCard("hello"), null); assert.equal(dm.decodeCard(null), null);
  const wild = dm.sanitizeCard({ name: "X<script>", hp: "9e9", cur: 99999, ac: -4, level: 50, saves: { str: "x" }, conds: "no", id: 7 });
  assert.equal(wild.hp, 9999); assert.equal(wild.cur, 9999); assert.equal(wild.ac, 0); assert.equal(wild.level, 20); assert.equal(wild.saves.str, 0); assert.deepEqual(wild.conds, []);
  assert.equal(dm.sanitizeCard({}), null); assert.equal(dm.sanitizeCard("x"), null);
});
t("reading pasted codes and files counts the bad ones", () => {
  const c = dm.makeCard(char, der), code = dm.encodeCard(c);
  let r = dm.readCards(code + "\n  junk \n" + code); assert.equal(r.cards.length, 2); assert.equal(r.bad, 1);
  r = dm.readCards(JSON.stringify(dm.cardFile(c))); assert.equal(r.cards.length, 1); assert.equal(r.bad, 0);
  r = dm.readCards("{not json"); assert.equal(r.cards.length, 0); assert.equal(r.bad, 1);
  r = dm.readCards(""); assert.equal(r.cards.length, 0);
});

const mk = (name, hp, bonus = 0, kind = "mon") => dm.makeRow({ name, hp, bonus, kind });
t("initiative sorts high first, then bonus, then order added; rolls only blanks", () => {
  const cb = dm.newCombat(); cb.rows = [mk("A", 5, 1), mk("B", 5, 3), mk("C", 5, 3)];
  dm.rollInit(cb, { rng: seq(0.5, 0.5, 0.5) }); // 11 + bonus
  assert.deepEqual(cb.rows.map(r => r.name), ["B", "C", "A"]);
  const keep = cb.rows[0].init; dm.rollInit(cb, { rng: () => 0.99 }); assert.equal(cb.rows.find(r => r.name === "B").init, keep, "already rolled stays");
  dm.rollInit(cb, { all: true, rng: () => 0 }); assert.equal(cb.rows.find(r => r.name === "A").init, 2);
  cb.rows.push(mk("D", 5)); dm.sortRows(cb); assert.equal(cb.rows[cb.rows.length - 1].name, "D", "no initiative sorts last");
});
t("temp HP soaks first; floor at 0; monsters drop out, heroes stay in", () => {
  const m = mk("Orc", 15), p = mk("Hero", 20, 0, "pc"); m.temp = 5;
  dm.damage(m, 8); assert.equal(m.temp, 0); assert.equal(m.cur, 12); assert.equal(m.out, false);
  dm.damage(m, 99); assert.equal(m.cur, 0); assert.equal(m.out, true);
  dm.heal(m, 4); assert.equal(m.cur, 4); assert.equal(m.out, false); dm.heal(m, 99); assert.equal(m.cur, 15);
  dm.damage(p, 99); assert.equal(p.cur, 0); assert.equal(p.out, false, "a hero at 0 is down, not removed");
  dm.setTemp(m, 4); dm.setTemp(m, 2); assert.equal(m.temp, 4, "temp HP does not stack");
  dm.damage(m, -5); assert.equal(m.cur, 15, "negative damage is nothing");
});
t("concentration DC: half the damage, min 10, max 30", () => {
  const r = mk("Mage", 40); r.conc = true;
  assert.equal(dm.damage(r, 4).dc, 10); assert.equal(dm.damage(r, 26).dc, 13); assert.equal(dm.damage(mk("x", 99), 5), null);
  const big = mk("Big", 999); big.conc = true; assert.equal(dm.damage(big, 900).dc, 30);
});
t("turns: first Next starts, rounds advance, out rows are skipped, conditions tick on their own turn", () => {
  const cb = dm.newCombat(); cb.rows = [mk("A", 5), mk("B", 5), mk("C", 5)]; cb.rows.forEach((r, i) => { r.init = 20 - i; });
  cb.rows[1].conds = [{ n: "Stunned", r: 1 }, { n: "Prone", r: null }];
  dm.nextTurn(cb); assert.equal(cb.started, true); assert.equal(cb.turn, 0); assert.equal(cb.round, 1);
  dm.nextTurn(cb); assert.equal(cb.turn, 1);
  dm.nextTurn(cb); assert.equal(cb.turn, 2); assert.deepEqual(cb.rows[1].conds, [{ n: "Prone", r: null }], "Stunned ended with B's turn");
  cb.rows[0].out = true; dm.nextTurn(cb); assert.equal(cb.turn, 1); assert.equal(cb.round, 2, "wrapped and skipped the dead A");
  cb.rows.forEach(r => { r.out = true; }); const before = JSON.stringify(cb); dm.nextTurn(cb); assert.equal(JSON.stringify(cb), before, "nobody left to take a turn");
});
t("removing a row keeps the turn on the same creature", () => {
  const cb = dm.newCombat(); cb.rows = [mk("A", 5), mk("B", 5), mk("C", 5)]; cb.started = true; cb.turn = 2;
  dm.removeRow(cb, cb.rows[0].id); assert.equal(cb.rows[cb.turn].name, "C");
  dm.removeRow(cb, cb.rows[cb.turn].id); assert.equal(cb.turn, 0);
});
t("creature book and encounter into combat", () => {
  const d = dm.blank();
  d.creatures = [dm.sanitizeCreature({ name: "Goblin", cr: "1/4", hp: 7, ac: 15, init: 2 }), dm.sanitizeCreature({ name: "Ogre", cr: "2", xp: "", hp: 59, ac: 11 })];
  assert.equal(d.creatures[0].xp, 50); assert.equal(d.creatures[1].xp, 450); assert.equal(dm.sanitizeCreature({ name: "" }), null); assert.equal(dm.sanitizeCreature({ name: "Odd", cr: "99", xp: 12 }).cr, "");
  d.enc.picks = [{ cid: d.creatures[0].id, qty: 3 }, { cid: d.creatures[1].id, qty: 1 }];
  assert.equal(dm.encounterXp(d), 150 + 450);
  dm.addEncounterToCombat(d); assert.deepEqual(d.combat.rows.map(r => r.name), ["Goblin 1", "Goblin 2", "Goblin 3", "Ogre"]); assert.equal(d.combat.rows[0].bonus, 2);
  const card = dm.makeCard(char, der); d.party[card.id] = card; assert.deepEqual(dm.encounterLevels(d), [5]);
  d.enc.skip = [card.id]; assert.deepEqual(dm.encounterLevels(d), [], "a left-out hero does not count");
  delete d.party[card.id]; d.enc.n = 3; d.enc.lv = 7; assert.deepEqual(dm.encounterLevels(d), [7, 7, 7], "no party: n characters of level lv");
  const row = dm.rowFromCard(card); assert.equal(row.kind, "pc"); assert.equal(row.cur, 12); assert.equal(row.conc, true); assert.deepEqual(row.conds, [{ n: "Prone", r: null }]);
});
t("numbering continues across adds and renames a lone one", () => {
  const cb = dm.newCombat(), g = { name: "Goblin", hp: 7, ac: 15, init: 0 }, o = { name: "Ogre", hp: 59, ac: 11, init: 0 };
  const names = () => cb.rows.map(r => r.name);
  dm.addCreatures(cb, g, 3); assert.deepEqual(names(), ["Goblin 1", "Goblin 2", "Goblin 3"]);
  dm.addCreatures(cb, g, 2); assert.deepEqual(names().slice(3), ["Goblin 4", "Goblin 5"]);
  dm.addCreatures(cb, o, 1); assert.equal(names()[5], "Ogre");
  dm.addCreatures(cb, o, 1); assert.deepEqual(names().slice(5), ["Ogre 1", "Ogre 2"]);
  cb.rows.push(dm.makeRow({ name: "Goblin Chief", hp: 20 })); dm.addCreatures(cb, g, 1); assert.equal(names().pop(), "Goblin 6", "a different creature that starts with the name is not counted");
});
t("record: survives junk, drops dangling picks, merges a restore without touching the live fight", () => {
  assert.deepEqual(dm.clean(null), dm.blank()); assert.deepEqual(dm.clean("x"), dm.blank());
  const d = dm.blank(); const c = dm.sanitizeCreature({ name: "Rat", cr: "0", hp: 1 }); d.creatures = [c]; d.enc.picks = [{ cid: c.id, qty: 500 }, { cid: "gone", qty: 1 }];
  d.combat = dm.newCombat(); d.combat.rows = [mk("A", 5)]; d.combat.turn = 9;
  const back = dm.clean(JSON.parse(JSON.stringify(d))); assert.equal(back.enc.picks.length, 1); assert.equal(back.enc.picks[0].qty, 99); assert.equal(back.combat.turn, 0);
  const store = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = v; } };
  assert.equal(dm.save(d, store), true); assert.deepEqual(dm.load(store).creatures, d.creatures); assert.deepEqual(dm.load({ getItem() { throw new Error("x"); } }), dm.blank());
  const live = dm.blank(); live.combat = dm.newCombat(); const old = dm.makeCard(char, der, 1), newer = dm.makeCard({ ...char, name: "Gandork2" }, der, 2); live.party[old.id] = newer;
  dm.mergeImport(live, { party: { [old.id]: old }, creatures: [c, c] }); assert.equal(live.party[old.id].name, "Gandork2", "older card does not replace a newer one");
  assert.equal(live.creatures.length, 1); assert.ok(live.combat, "live combat kept");
});

const mons = [
  { id: "rat", name: "Giant Rat", type: "beast", cr: "1/8", xp: 25, hp: 7, ac: 12, abil: [7, 15, 11, 2, 10, 4] },
  { id: "ogre", name: "Ogre", type: "giant", cr: "2", xp: 450, hp: 59, ac: 11, abil: [19, 8, 16, 5, 7, 7] },
  { id: "wolf", name: "Wolf", type: "beast", cr: "1/4", xp: 50, hp: 11, ac: 13, abil: [12, 15, 12, 3, 12, 6] },
  { id: "lich", name: "Lich", type: "undead", cr: "21", xp: 33000, hp: 315, ac: 20, abil: [11, 16, 16, 21, 14, 16] }
];
t("monster to creature: id, XP, initiative from Dex, back-link", () => {
  const c = dm.monsterCreature(mons[0]); assert.equal(c.id, "m:rat"); assert.equal(c.xp, 25); assert.equal(c.init, 2); assert.equal(c.mid, "rat"); assert.equal(c.cr, "1/8");
  assert.equal(dm.monsterCreature(mons[1]).init, -1); assert.equal(dm.abilMod(10), 0); assert.equal(dm.abilMod(9), -1); assert.equal(dm.abilMod(20), 5);
});
t("bestiary search: name or type, CR bands, sorted by CR then name", () => {
  assert.deepEqual(dm.searchMonsters(mons).map(m => m.id), ["rat", "wolf", "ogre", "lich"]);
  assert.deepEqual(dm.searchMonsters(mons, { q: "BEAST" }).map(m => m.id), ["rat", "wolf"]);
  assert.deepEqual(dm.searchMonsters(mons, { cr: "low" }).map(m => m.id), ["rat", "wolf"]);
  assert.deepEqual(dm.searchMonsters(mons, { cr: "mid" }).map(m => m.id), ["ogre"]);
  assert.deepEqual(dm.searchMonsters(mons, { cr: "top" }).map(m => m.id), ["lich"]);
  assert.deepEqual(dm.searchMonsters(mons, { type: "giant", q: "og" }).map(m => m.id), ["ogre"]); assert.deepEqual(dm.searchMonsters(mons, { q: "zzz" }), []);
  assert.deepEqual(dm.monsterTypes(mons), ["beast", "giant", "undead"]);
});
t("a library monster in the encounter needs no book entry and survives a reload", () => {
  const d = dm.blank(); const c = dm.monsterCreature(mons[2]);
  dm.addPick(d, c); dm.addPick(d, c); dm.addPick(d, dm.monsterCreature(mons[1]));
  assert.deepEqual(d.enc.picks.map(p => p.qty), [2, 1]); assert.equal(dm.encounterXp(d), 100 + 450);
  const back = dm.clean(JSON.parse(JSON.stringify(d))); assert.equal(back.enc.picks.length, 2); assert.equal(dm.encounterXp(back), 550);
  assert.equal(dm.clean({ enc: { picks: [{ cid: "ghost", qty: 2 }] } }).enc.picks.length, 0, "no copy and no book entry: dropped");
  dm.addEncounterToCombat(back); assert.deepEqual(back.combat.rows.map(r => r.name), ["Wolf 1", "Wolf 2", "Ogre"]); assert.equal(back.combat.rows[0].xp, 50); assert.equal(back.combat.rows[0].mid, "wolf");
  const book = dm.sanitizeCreature({ id: "m:wolf", name: "Wolf", cr: "1/4", xp: 99, hp: 11, ac: 13 }); back.creatures.push(book); assert.equal(dm.encounterXp(back), 99 * 2 + 450, "a book edit wins over the copy");
});
t("rewards: defeated XP counts monsters only; even split keeps the remainder", () => {
  const cb = dm.newCombat(); cb.rows = [dm.rowFromCreature(dm.monsterCreature(mons[2]), 1), dm.rowFromCreature(dm.monsterCreature(mons[1]), 0), mk("Hero", 10, 0, "pc")];
  assert.equal(dm.defeatedXp(cb), 0); cb.rows[0].out = true; cb.rows[2].out = true; assert.equal(dm.defeatedXp(cb), 50); assert.equal(dm.defeatedCount(cb), 1);
  assert.equal(dm.defeatedXp(null), 0);
  assert.deepEqual(dm.splitEven(1000, 3), { each: 333, left: 1 }); assert.deepEqual(dm.splitEven(5, 0), { each: 5, left: 0 }); assert.deepEqual(dm.splitEven(-9, 2), { each: 0, left: 0 });
});
t("rewards: recipients and level thresholds", () => {
  const d = dm.blank(); assert.deepEqual(dm.recipients(d), { cards: [], n: 4 });
  const a = dm.makeCard({ ...char, id: "a", xp: 6400 }, der), b = dm.makeCard({ ...char, id: "b", name: "Bee", dead: true }, der), c2 = dm.makeCard({ ...char, id: "c", name: "Cee" }, der);
  d.party = { a, b, c: c2 }; assert.deepEqual(dm.recipients(d).cards.map(x => x.id), ["a", "c"], "the dead share nothing"); d.rw.skip = ["c"]; assert.equal(dm.recipients(d).n, 1);
  assert.equal(a.xp, 6400); const T = [0, 300, 900, 2700, 6500, 14000];
  assert.equal(dm.levelFor(6400, T), 4); assert.equal(dm.levelFor(6500, T), 5); assert.equal(dm.levelFor(0, T), 1); assert.equal(dm.levelFor(99999, T), 6);
  const back = dm.clean(JSON.parse(JSON.stringify({ ...d, rw: { gp: "250", xp: -5, skip: ["c", 7] } }))); assert.equal(back.rw.gp, 250); assert.equal(back.rw.xp, 0);
});
// With the unlocked rules file present, the real bestiary has to fit what this module expects.
import { existsSync, readFileSync } from "node:fs";
const libUrl = new URL("../data/library.json", import.meta.url);
if (existsSync(libUrl)) t("real SRD monsters import cleanly", () => {
  const L = JSON.parse(readFileSync(libUrl, "utf8")), M = L.monsters || [];
  assert.ok(M.length >= 300, "monsters " + M.length);
  const ids = new Set(M.map(m => m.id)); assert.equal(ids.size, M.length, "unique ids");
  M.forEach(m => { assert.ok(m.name && m.hp > 0 && m.ac > 0 && m.abil.length === 6, m.name); assert.ok(dm.crXp(m.cr) !== null, "cr " + m.cr); assert.ok(dm.sanitizeCreature(dm.monsterCreature(m)), m.name); });
  // Stat block XP wins over the CR table. Known differences: CR 0 creatures list 10 XP ("0 or 10"), and the 2024 Archmage prints 8,000 at CR 12.
  const odd = M.filter(m => m.xp !== dm.crXp(m.cr) && !(m.cr === "0" && m.xp === 10) && m.id !== "archmage").map(m => m.name + " " + m.cr + " " + m.xp);
  assert.deepEqual(odd, [], "XP matches the CR table apart from the known cases");
  assert.equal(M.find(m => m.id === "goblin-warrior").xp, 50); assert.ok(dm.searchMonsters(M, { q: "dragon" }).length > 5);
});
console.log(`dmmode: ${n} checks passed`);
