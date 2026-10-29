// Advanced sheet > Gear: readiness strip (AC, load, attunement), saved loadouts, and worn gear as rows.
// A loadout is a named copy of c.equipment. Tapping one opens a preview; nothing changes until you confirm.
import { esc, ICONS, kRow, kGroup } from "../ui.js";
import { SLOTS, itemById, fitsOk, computeAC, itemCategory } from "../gear.js";
import { carried, fmtLb } from "../weights.js";

const GROUPS = [["Weapons", "amber", ["main", "off", "ranged"]], ["Armor and clothing", "green", ["head", "cloak", "armor", "gloves", "boots"]], ["Accessories", "blue", ["neck", "belt", "ring1", "ring2"]]];
const SLOT_ICON = { head: "shield", neck: "star", cloak: "shield", armor: "shield", gloves: "shield", belt: "gear", boots: "shield", ring1: "ring", ring2: "ring", main: "sword", off: "shield", ranged: "bolt" };
const CAT_GLYPH = { weapon: "sword", armor: "shield", shield: "shield", potion: "flask", scroll: "scroll", ring: "ring", wondrous: "spell", ammo: "bolt", focus: "bolt", tool: "gear", gear: "flask" };
const glyph = it => ICONS[CAT_GLYPH[itemCategory(it)] || "flask"] || ICONS.star;
const label = k => (SLOTS.find(s => s.key === k) || {}).label || k;

export const loadoutsOf = c => Array.isArray(c.loadouts) ? c.loadouts : [];
const sameEq = (a, b) => { const ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort(); return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]); };
export const isActive = (c, l) => sameEq(l.eq, c.equipment || {});

// What a loadout would do right now: only entries still in the bag and still legal are applied.
export function loadoutPlan(c, l) {
  const eq = {}, missing = [], illegal = [], used = {};
  Object.entries(l.eq || {}).forEach(([slot, id]) => {
    const it = itemById(c, id);
    if (!it) { missing.push(slot); return; }
    used[id] = (used[id] || 0) + 1;
    if (used[id] > (it.qty || 1)) { illegal.push([slot, it.name, "not enough copies"]); return; }
    eq[slot] = id;
  });
  // legality depends on the main hand (two-handed), so check against the loadout itself
  const asChar = { ...c, equipment: eq };
  Object.keys(eq).forEach(slot => { const it = itemById(c, eq[slot]); if (!fitsOk(it, slot, asChar)) { illegal.push([slot, it.name, "does not fit"]); delete eq[slot]; } });
  const slots = SLOTS.map(s => s.key), now = c.equipment || {};
  const changes = slots.filter(k => (now[k] || null) !== (eq[k] || null)).map(k => ({ slot: k, from: itemById(c, now[k]), to: itemById(c, eq[k]) }));
  const acNow = computeAC(c).total, acNew = computeAC({ ...c, equipment: eq }).total;
  const needAttune = [...new Set(Object.values(eq))].map(id => itemById(c, id)).filter(it => it && it.attune && !it.attuned).map(it => it.name);
  return { eq, changes, acNow, acNew, missing, illegal, needAttune };
}

const pips = n => [0, 1, 2].map(i => `<i class="${i < n ? "on" : ""}"></i>`).join("");

export function readinessStrip(app, c, d) {
  const w = carried(c), pct = Math.min(100, Math.round(w.total / w.capacity * 100));
  const att = (c.inventory || []).filter(i => i.attuned).length;
  const stealth = d.acInfo && d.acInfo.stealthDis;
  return `<div class="ld-ready">
    <div class="ld-m"><div class="h"><span>Carrying</span><b>${fmtLb(w.total)} / ${w.capacity} lb</b></div><div class="wbar ${w.total > w.capacity ? "over" : ""}" style="margin:0"><div class="track"><i style="width:${pct}%"></i></div></div></div>
    <div class="ld-m"><div class="h"><span>Attuned</span><b>${att} / 3</b></div><div class="ld-pips">${pips(att)}</div></div>
    ${stealth ? `<p class="ld-flag">Your armor gives Stealth disadvantage.</p>` : ""}
  </div>`;
}

export function loadoutCards(app, c) {
  const ls = loadoutsOf(c), acNow = computeAC(c).total;
  return `<div class="ld-row">${kGroup("Loadouts", ls.length ? "tap to preview" : "")}
    <div class="ld-cards">${ls.map(l => {
    const on = isActive(c, l), p = loadoutPlan(c, l), dlt = p.acNew - acNow;
    return `<button class="ld-card ${on ? "on" : ""}" data-a="loadoutOpen" data-id="${esc(l.id)}"><b>${esc(l.name)}</b><span class="n">AC ${p.acNew}</span>
      <span class="d ${on ? "" : dlt > 0 ? "up" : dlt < 0 ? "dn" : ""}">${on ? "Equipped" : `${dlt > 0 ? "+" : ""}${dlt} AC · ${p.changes.length} change${p.changes.length === 1 ? "" : "s"}`}</span></button>`;
  }).join("")}
      <button class="ld-card add" data-a="loadoutSaveOpen"><b>+ Save current gear</b><span class="d">as a loadout</span></button></div>
    ${ls.length ? "" : `<p class="sub2" style="margin:4px 2px 0">A loadout remembers what you are wearing and holding, for example a melee set and a stealth set. Applying one always shows a preview first.</p>`}</div>`;
}

export function wornRows(app, c) {
  return GROUPS.map(([g, tone, keys]) => {
    const filled = keys.filter(k => (c.equipment || {})[k]).length;
    return kGroup(g, `${filled}/${keys.length}`, { tone }) + `<div class="k-list">` + keys.map(k => {
      const it = itemById(c, (c.equipment || {})[k]);
      const main = itemById(c, (c.equipment || {}).main), blocked = k === "off" && !it && main && /two-handed/i.test(main.weapon?.props || "");
      if (!it) return kRow({ icon: ICONS[SLOT_ICON[k]] || ICONS.star, tone: "faint", off: true, title: blocked ? "Both hands used" : "Empty", cap: label(k), mainAttrs: `data-a="slotTap" data-slot="${k}"`, status: blocked ? "" : "Equip" });
      return kRow({ icon: glyph(it), tone, title: it.name, cap: label(k), sub: it.attune ? (it.attuned ? "Attuned" : "Needs attunement") : "", status: "Change", mainAttrs: `data-a="slotTap" data-slot="${k}"` });
    }).join("") + `</div>`;
  }).join("");
}

// ---- the preview modal ----
export function renderLoadoutBody(app, c, m) {
  const l = loadoutsOf(c).find(x => x.id === m.id);
  if (!l) return { title: "Loadout", body: `<p class="muted">That loadout is gone.</p>`, foot: `<button class="btn" data-a="closeModal">Close</button>` };
  const p = loadoutPlan(c, l), on = isActive(c, l), dlt = p.acNew - p.acNow;
  const rows = p.changes.map(ch => {
    const word = ch.to && ch.from ? "Swap" : ch.to ? "Equip" : "Take off";
    return kRow({ icon: ch.to ? glyph(ch.to) : glyph(ch.from), tone: ch.to ? (ch.from ? "amber" : "green") : "red", cap: `${label(ch.slot)} · ${word}`,
      title: ch.to ? ch.to.name : ch.from.name, sub: ch.from && ch.to ? `Instead of ${ch.from.name}` : "" });
  }).join("");
  const warn = [
    ...p.missing.map(k => `${label(k)}: that item is no longer in your bag, so the slot stays empty.`),
    ...p.illegal.map(([k, n, why]) => `${label(k)}: ${n} ${why}, so it is skipped.`),
    ...(p.needAttune.length ? [`Needs attunement first: ${p.needAttune.join(", ")}. Attune from the item menu.`] : [])
  ];
  const body = `${on ? `<p class="sub2">This is what you are wearing now.</p>` : ""}
    <div class="quick" style="grid-template-columns:repeat(2,1fr);margin:0 0 6px"><div><b>${p.acNow}</b><span>AC now</span></div><div><b>${p.acNew}${dlt ? ` <small style="color:var(--${dlt > 0 ? "green" : "red"})">${dlt > 0 ? "+" : ""}${dlt}</small>` : ""}</b><span>AC after</span></div></div>
    ${p.changes.length ? kGroup("What changes", p.changes.length, { tone: "amber" }) + `<div class="k-list">${rows}</div>` : `<p class="muted small" style="padding:10px 0">Nothing would change.</p>`}
    ${warn.length ? `<div class="tilewhy" role="note" style="margin-top:12px">${warn.map(w => `<span>${esc(w)}</span>`).join("")}</div>` : ""}
    <div class="ld-edit"><button class="linkbtn" data-a="loadoutUpdate" data-id="${esc(l.id)}">Replace with what I am wearing now</button>
      ${m.confirmDelete ? `<button class="btn danger sm" data-a="loadoutDelete" data-id="${esc(l.id)}">Yes, delete it</button>` : `<button class="linkbtn" data-a="loadoutAskDelete">Delete loadout</button>`}</div>`;
  return { title: l.name, body, foot: `<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="loadoutApply" data-id="${esc(l.id)}" ${p.changes.length ? "" : "disabled"}>Equip loadout</button>` };
}

export function renderLoadoutSave(app, c) {
  const n = loadoutsOf(c).length + 1;
  const worn = Object.keys(c.equipment || {}).length;
  return { title: "Save current gear", body: `<p class="sub2" style="margin-bottom:10px">${worn ? `Saves the ${worn} slot${worn === 1 ? "" : "s"} you have filled right now.` : "Nothing is equipped right now, so this loadout would be empty."}</p>
    <div class="field"><label for="f-ldname">Name</label><input id="f-ldname" class="f" maxlength="24" value="Loadout ${n}" autocomplete="off"></div>`,
    foot: `<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="loadoutSave">Save</button>` };
}
