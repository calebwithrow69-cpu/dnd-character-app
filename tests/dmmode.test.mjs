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
console.log(`dmmode: ${n} checks passed`);
