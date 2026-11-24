// DM mode actions. Built with the app's helpers so app.js only merges them in. ASCII only.
import * as dm from "./dmmode.js";
import { loadPortraits } from "./portraits.js";
import { dmUiDefault, setConfirm, monsterIndex, rewardPlan } from "./views/dmmode.js";
import { deriveCharacter } from "./rules.js";
import { dateStamp } from "./ui.js";

export function dmModeActions({ APP, render, toast, openModal, closeModal, shareOrDownload }) {
  const S = () => APP.dmm;
  const persist = () => { if (!dm.save(S().d)) toast("Storage full. Export a backup"); };
  const redraw = () => { persist(); render(); };
  const ask = key => { const s = S(); if (s.ui.confirm === key) { s.ui.confirm = ""; setConfirm(""); return true; } s.ui.confirm = key; setConfirm(key); render(); setTimeout(() => { if (S() && S().ui.confirm === key) { S().ui.confirm = ""; setConfirm(""); if (APP.dmm) render(); } }, 3500); return false; };
  const val = id => (document.getElementById(id) || {}).value;
  const n = (id, d = 0) => { const v = parseInt(val(id), 10); return Number.isFinite(v) ? v : d; };
  const combat = () => { const s = S(); if (!s.d.combat) s.d.combat = dm.newCombat(); return s.d.combat; };
  const row = () => { const cb = S().d.combat, id = APP.modal && APP.modal.id; return cb && cb.rows.find(r => r.id === id); };
  const refreshRow = () => { persist(); render(); };
  // A creature by id: "m:<id>" is a library monster, anything else is in the book.
  const creatureFor = id => {
    id = String(id || "");
    if (id.startsWith("m:")) { const m = monsterIndex(APP).get(id.slice(2)); return m ? dm.monsterCreature(m) : null; }
    return S().d.creatures.find(x => x.id === id) || null;
  };

  function importText(text) {
    const { cards, bad } = dm.readCards(text);
    cards.forEach(c => { const mine = S().d.party[c.id]; if (!mine || mine.at <= c.at) S().d.party[c.id] = c; });
    S().ui.msg = cards.length ? `Imported ${cards.length} ${cards.length === 1 ? "character" : "characters"}${bad ? `, ${bad} unreadable` : ""}` : bad ? "No readable code" : "Nothing to import";
    redraw();
  }

  function addPickById(id) {
    const c = creatureFor(id); if (!c) return;
    dm.addPick(S().d, c); persist(); render(); toast(c.name + " added");
  }
  function monId() { const m = APP.modal; return m && m.type === "dmMon" ? m.id : ""; }

  return {
    goDmMode() { APP.dmm = { d: dm.load(), ui: dmUiDefault() }; APP.screen = "dmmode"; render(); window.scrollTo(0, 0); },
    dmTab(el) { const s = S(); s.ui.tab = el.dataset.v; s.ui.msg = ""; s.ui.confirm = ""; setConfirm(""); render(); },

    // ---- party
    dmImport() { importText(val("dm-code")); },
    dmPickFile() { const f = document.getElementById("dm-file"); if (f) f.click(); },
    dmImportFile(file) { file.text().then(importText, () => { S().ui.msg = "Could not open that file"; render(); }); },
    dmCardRemove(el) { if (!ask("card:" + el.dataset.id)) return; delete S().d.party[el.dataset.id]; redraw(); },
    dmPartyToCombat() {
      const s = S(); s.d.combat = dm.newCombat();
      Object.values(s.d.party).forEach(c => s.d.combat.rows.push(dm.rowFromCard(c)));
      s.ui.tab = "combat"; redraw();
    },

    // ---- combat
    dmNewCombat() { S().d.combat = dm.newCombat(); redraw(); },
    dmAddParty() { const cb = combat(); Object.values(S().d.party).forEach(c => { if (!cb.rows.some(r => r.card === c.id)) cb.rows.push(dm.rowFromCard(c)); }); dm.sortRows(cb); redraw(); },
    dmRollInit() { const cb = combat(); dm.rollInit(cb); redraw(); },
    dmNext() { const cb = combat(); if (!cb.rows.some(r => r.init != null)) dm.rollInit(cb); dm.nextTurn(cb); redraw(); },
    dmEndCombat() { if (!ask("end")) return; S().d.combat = null; redraw(); },
    dmRowOpen(el) { openModal({ type: "dmRow", id: el.dataset.id }); },
    dmAddBook() {
      const c = S().d.creatures.find(x => x.id === val("dm-bk")); if (!c) return;
      const cb = combat(); dm.addCreatures(cb, c, Math.max(1, Math.min(20, n("dm-bkn", 1))));
      dm.sortRows(cb); redraw();
    },
    dmAddQuick() {
      const name = (val("dm-qn") || "").trim(), hp = n("dm-qh", 0);
      if (!name || hp < 1) { toast("Name and HP needed"); return; }
      const cb = combat(); dm.addCreatures(cb, { name, hp, ac: n("dm-qa", 10), init: n("dm-qi", 0), xp: n("dm-qx", 0) }, Math.max(1, Math.min(20, n("dm-qc", 1))));
      dm.sortRows(cb); redraw();
    },
    dmDamage() {
      const r = row(), a = n("dm-amt", 0); if (!r || a < 1) return;
      const c = dm.damage(r, a); refreshRow();
      toast(c ? `${r.name} takes ${a}. Concentration DC ${c.dc}` : `${r.name} takes ${a}`);
    },
    dmHeal() { const r = row(), a = n("dm-amt", 0); if (!r || a < 1) return; dm.heal(r, a); refreshRow(); },
    dmTemp() { const r = row(), a = n("dm-amt", 0); if (!r || a < 1) return; dm.setTemp(r, a); refreshRow(); },
    dmCond(el) {
      const r = row(); if (!r) return; const name = el.dataset.n, i = r.conds.findIndex(c => c.n === name);
      if (i >= 0) r.conds.splice(i, 1);
      else { const rounds = parseInt(val("dm-rounds"), 10); r.conds.push({ n: name, r: Number.isFinite(rounds) && rounds > 0 ? Math.min(99, rounds) : null }); }
      refreshRow();
    },
    dmConc() { const r = row(); if (!r) return; r.conc = !r.conc; refreshRow(); },
    dmOut() { const r = row(); if (!r) return; r.out = !r.out; refreshRow(); },
    dmRowSave() {
      const r = row(); if (!r) return;
      const nm = (val("dm-rn") || "").trim(); if (nm) r.name = nm.slice(0, 60);
      r.ac = Math.max(0, Math.min(60, n("dm-ra", r.ac))); r.hp = Math.max(1, Math.min(99999, n("dm-rh", r.hp))); r.cur = Math.min(r.cur, r.hp);
      r.note = (val("dm-rt") || "").trim().slice(0, 200); r.alias = (val("dm-ral") || "").trim().slice(0, 40);
      { const iv = parseInt(val("dm-ri"), 10); r.init = Number.isFinite(iv) ? Math.max(-20, Math.min(60, iv)) : null; dm.sortRows(S().d.combat); } refreshRow(); toast("Saved");
    },
    dmRowRemove() { if (!ask("row")) return; const r = row(); if (r) dm.removeRow(S().d.combat, r.id); closeModal(); redraw(); },

    // ---- inputs that act on change
    dmField(el) {
      const s = S(), f = el.dataset.dmf; if (!s) return;
      if (f === "init") { const cb = s.d.combat, r = cb && cb.rows.find(x => x.id === el.dataset.id); if (!r) return; const v = parseInt(el.value, 10); r.init = Number.isFinite(v) ? Math.max(-20, Math.min(60, v)) : null; dm.sortRows(cb); redraw(); }
      else if (f === "encn") { s.d.enc.n = Math.max(1, Math.min(12, parseInt(el.value, 10) || 1)); redraw(); }
      else if (f === "enclv") { s.d.enc.lv = Math.max(1, Math.min(20, parseInt(el.value, 10) || 1)); redraw(); }
      else if (f === "mcr") { s.ui.mcr = el.value; s.ui.limit = 40; render(); }
      else if (f === "mtype") { s.ui.mtype = el.value; s.ui.limit = 40; render(); }
      else if (f === "rwxp") { s.d.rw.xp = Math.max(0, Math.min(1e7, parseInt(el.value, 10) || 0)); redraw(); }
      else if (f === "rwgp") { s.d.rw.gp = Math.max(0, Math.min(1e9, parseInt(el.value, 10) || 0)); redraw(); }
      else if (f === "cr") { const xp = document.getElementById("dc-xp"); if (xp && el.value) xp.value = dm.crXp(el.value); }
    },

    // ---- prep
    dmEncDiff(el) { S().d.enc.diff = el.dataset.v; redraw(); },
    dmEncSkip(el) { const k = S().d.enc.skip, i = k.indexOf(el.dataset.id); if (i >= 0) k.splice(i, 1); else k.push(el.dataset.id); redraw(); },
    dmPickAdd(el) { addPickById(el.dataset.id); },
    dmPickAddId(el) { addPickById(el.dataset.id); },
    dmPickQty(el) { const p = S().d.enc.picks, x = p.find(q => q.cid === el.dataset.id); if (!x) return; x.qty += Number(el.dataset.v); if (x.qty < 1) p.splice(p.indexOf(x), 1); x.qty = Math.min(99, x.qty); redraw(); },
    dmEncClear() { S().d.enc.picks = []; redraw(); },
    dmEncToCombat() { const s = S(); dm.addEncounterToCombat(s.d); dm.sortRows(s.d.combat); s.ui.tab = "combat"; redraw(); },
    dmCreatureNew() { openModal({ type: "dmCreature", id: "" }); },
    dmCreatureEdit(el) { openModal({ type: "dmCreature", id: el.dataset.id }); },
    dmCreatureSave(el) {
      const c = dm.sanitizeCreature({ id: el.dataset.id || undefined, name: val("dc-n"), cr: val("dc-cr"), xp: val("dc-xp"), hp: val("dc-hp"), ac: val("dc-ac"), init: val("dc-in"), note: val("dc-nt") });
      if (!c) { toast("Name needed"); return; }
      const list = S().d.creatures, i = list.findIndex(x => x.id === c.id);
      if (i >= 0) list[i] = c; else list.push(c);
      closeModal(); redraw(); toast("Creature saved");
    },
    dmCreatureDelete(el) {
      if (!ask("cr:" + el.dataset.id)) return; const s = S(), id = el.dataset.id;
      s.d.creatures = s.d.creatures.filter(x => x.id !== id); s.d.enc.picks = s.d.enc.picks.filter(p => p.cid !== id);
      closeModal(); redraw();
    },

    // ---- table screen (player view)
    dmViewOpen() { loadPortraits().then(() => { if (APP.screen === "dmview") render(); }); APP.screen = "dmview"; render(); window.scrollTo(0, 0); },
    dmViewBack() { APP.screen = "dmmode"; if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); render(); },
    dmViewCtl() { const u = S().ui; u.vctl = u.vctl === false; render(); },
    dmViewNums() { const u = S().ui; u.vnums = !u.vnums; render(); },
    dmViewFull() { const d = document; if (d.fullscreenElement) d.exitFullscreen().catch(() => { }); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(() => toast("Full screen blocked")); else toast("Full screen not available"); },
    dmViewWindow() { const w = window.open(location.href.split("#")[0] + "#dmview", "cr-table", "popup,width=1280,height=720"); if (!w) toast("Pop-up blocked"); },
    dmViewClose() { window.close(); if (!window.closed) { APP._dmViewWindow = false; APP.screen = "dmmode"; render(); } },
    // table settings: nothing here is stored until the cleaner has checked it, so a bad value cannot reach the screen
    dmTblSet(el) { const t = S().d.table, k = el.dataset.k; t[k] = el.dataset.v; S().d.table = dm.cleanTable(t); redraw(); },
    dmTblTog(el) { const t = S().d.table, k = el.dataset.k; if (k.startsWith("show.")) t.show[k.slice(5)] = !t.show[k.slice(5)]; else t[k] = !t[k]; S().d.table = dm.cleanTable(t); redraw(); },
    dmTblCycle(el) { const t = S().d.table, k = el.dataset.k, list = dm.TABLE_OPTS[k]; t[k] = list[(list.indexOf(t[k]) + 1) % list.length]; S().d.table = dm.cleanTable(t); redraw(); toast("Enemy HP: " + t[k]); },
    dmMsgPush() {
      const title = (val("tb-mt") || "").trim(), text = (val("tb-mx") || "").trim();
      if (!title && !text) { toast("Message is empty"); return; }
      S().d.table.msg = { on: true, title, text }; S().d.table = dm.cleanTable(S().d.table); redraw(); toast("Pushed to screen");
    },
    dmMsgClear() { S().d.table.msg.on = false; redraw(); },
    dmRowHide() { const r = row(); if (!r) return; r.hid = !r.hid; refreshRow(); },
    dmRowHideId(el) { const cb = S().d.combat, r = cb && cb.rows.find(x => x.id === el.dataset.id); if (!r) return; r.hid = !r.hid; redraw(); },
    dmCview(el) { S().ui.cview = el.dataset.v; render(); },
    dmAlly() { const r = row(); if (!r) return; r.ally = !r.ally; refreshRow(); },

    // ---- bestiary
    dmSrc(el) { const u = S().ui; u.src = el.dataset.v; u.limit = 40; render(); },
    dmMore() { S().ui.limit += 40; render(); },
    dmMonOpen(el) {
      if (APP.modal && ["dmRow", "dmCreature"].includes(APP.modal.type)) { APP._under = APP.modal; APP._underScroll = document.querySelector(".modal-body")?.scrollTop || 0; }
      openModal({ type: "dmMon", id: el.dataset.id });
    },
    dmMonEnc() { addPickById(monId()); },
    dmMonCombat() {
      const c = creatureFor(monId()); if (!c) return;
      const cb = combat(); dm.addCreatures(cb, c, 1); dm.sortRows(cb);
      APP._under = null; closeModal(); redraw(); toast(c.name + " added to combat");
    },
    dmMonCopy() {
      const c = creatureFor(monId()); if (!c) return;
      const list = S().d.creatures;
      if (list.some(x => x.mid && x.mid === c.mid)) { toast("Already in your book"); return; }
      const copy = dm.sanitizeCreature({ ...c, id: undefined }); list.push(copy); persist(); render(); toast("Copied to book");
    },

    // ---- rewards
    dmRwSkip(el) { const k = S().d.rw.skip, i = k.indexOf(el.dataset.id); if (i >= 0) k.splice(i, 1); else k.push(el.dataset.id); redraw(); },
    async dmRwCopy() {
      const p = rewardPlan(S().d);
      const lines = [`Reward: ${p.xp.each} XP and ${p.gp.each} gp each (${p.n} ${p.n === 1 ? "character" : "characters"})`];
      p.people.forEach(({ c, up }) => lines.push(`${c.name}: level ${c.level}${up > c.level ? ` -> ${up}` : ""}`));
      try { await navigator.clipboard.writeText(lines.join("\n")); toast("Summary copied"); } catch (e) { toast("Could not copy"); }
    },

    // ---- player side: send a snapshot of this character to the DM
    dmSendOpen() {
      const c = APP.char; if (!c) return;
      const card = dm.makeCard(c, deriveCharacter(c));
      openModal({ type: "dmSend", name: c.name, code: dm.encodeCard(card), card });
    },
    async dmSendCopy() {
      const m = APP.modal; if (!m) return;
      try { await navigator.clipboard.writeText(m.code); toast("Code copied"); }
      catch (e) { const t = document.getElementById("dm-send"); if (t) { t.focus(); t.select(); } toast("Select and copy the code"); }
    },
    dmSendSave() {
      const m = APP.modal; if (!m) return;
      const safe = String(m.name).replace(/[^\w-]+/g, "-").slice(0, 30) || "character";
      shareOrDownload(`dm-card-${safe}-${dateStamp()}.json`, JSON.stringify(dm.cardFile(m.card), null, 1));
    }
  };
}
