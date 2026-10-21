import { esc, modalShell, searchBox, ICONS } from "../ui.js";
import {
  ABILITIES, ABILITY_LABEL, CONDITIONS, abilityMod, fmtMod, deriveCharacter, hpAverageGain, slotRows
} from "../rules.js";
import { findByName, subclassesFor, enabledSpecies, enabledBackgrounds, allItems, allWeapons } from "../data.js";
import { SLOTS, WEAR_CHOICES, ARMOR, itemById, slotOf, fitsOk, wearKind, attunedCount, armorTypeFromName } from "../gear.js";
import { formatText, infoRow, conditionIcon, glossaryEntry } from "../ui.js";
import { detailFor, renderSpellResults, renderGearResults } from "./sheet.js";
import { getCredits } from "../dice.js";
import { installCard } from "../install.js";
import { shopStock, walletCp, fmtPrice } from "../equipment.js";

export function renderModal(app) {
  const m = app.modal;
  if (!m) return "";
  const c = app.char;
  switch (m.type) {
    case "detail": {
      const d = detailFor(app, m.kind, m.name, m.i, m.from);
      const foot = [
        d.removeFeat != null ? `<button class="btn danger" data-a="removeFeat" data-i="${d.removeFeat}">Remove feat</button>` : "",
        d.removeWeapon != null ? `<button class="btn danger" data-a="removeWeapon" data-i="${d.removeWeapon}">Remove weapon</button>` : "",
        d.removeItem != null ? `<button class="btn danger" data-a="removeItem" data-i="${d.removeItem}">Remove item</button>` : "",
        `<button class="btn" data-a="closeModal">Done</button>`
      ].join("");
      return modalShell(d.title, d.body, foot);
    }

    case "picker": {
      const titles = { spells: "Add spells", items: "Add to your bag", feats: "Add a feat" };
      let filters = "";
      if (m.picker === "spells") {
        filters = `<div class="seg" style="margin-top:10px" role="group" aria-label="Spell level">
            <button data-a="pickerLevel" data-lv="" aria-pressed="${app.pickerLevel == null}">All</button>
            ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<button data-a="pickerLevel" data-lv="${l}" aria-pressed="${app.pickerLevel === l}">${l === 0 ? "C" : l}</button>`).join("")}
          </div>
          <label class="rowline" style="cursor:pointer"><span class="nm small">Include other classes' spells</span>
            <input type="checkbox" data-a="pickerAllClasses" ${app.pickerAllClasses ? "checked" : ""}></label>`;
      }
      const results = m.picker === "spells" ? renderSpellResults(app) : renderGearResults(app, m.picker);
      return modalShell(titles[m.picker],
        `${searchBox("picker", app.pickerQuery, m.picker === "spells" ? `Search ${esc(c.class)} spells` : "Search, or type a name to add your own")}
         ${filters}
         <div class="results" id="results-picker">${results}</div>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "shop": {
      const cats = ["All", "Weapons", "Armor", "Gear", "Magic & potions"];
      const cat = app.shopCat || "All";
      const discount = (c.feats || []).some(f => /^Crafter\b/.test(f));
      return modalShell("Shop",
        `<p class="small">You have <b class="num">${esc(fmtWallet(c.coins))}</b>.${discount ? ` <span class="tag green">Crafter: 20% off nonmagical</span>` : ""}</p>
         ${searchBox("shop", app.shopQuery, "Search the shop")}
         <div class="seg" style="margin-top:10px" role="group" aria-label="Category">${cats.map(k => `<button data-a="shopCat" data-cat="${esc(k)}" aria-pressed="${cat === k}">${esc(k === "Magic & potions" ? "Magic" : k)}</button>`).join("")}</div>
         <div class="results" id="results-shop">${renderShopResults(app)}</div>
         <p class="sub2" style="margin-top:8px">Gear prices come from your DM's rules file; weapons and armor use the Player's Handbook list.</p>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "cast": {
      const sp = findByName(app.library.spells, m.name) || { name: m.name, level: 1 };
      const rows = slotRows(c.class, c.level).filter(r => r.level >= sp.level);
      const opts = rows.map(r => {
        const left = r.max - (c.spellcasting.slotsUsed[r.level - 1] || 0);
        return `<button class="optcard" data-a="castWith" data-lvl="${r.level}" ${left <= 0 ? "disabled" : ""}>
          <span class="grow"><b>${r.pact ? "Pact slot" : "Level " + r.level + " slot"}${r.level > sp.level ? " (upcast)" : ""}</b><span>${left} left</span></span></button>`;
      }).join("");
      return modalShell(`Cast ${sp.name}`,
        `${sp.conc && c.concentration && c.concentration !== sp.name ? `<p class="small" style="color:var(--red);margin-bottom:10px">This ends your concentration on ${esc(c.concentration)}.</p>` : ""}
         <div class="optlist" style="margin-top:0">${opts || `<p class="muted">No slot of level ${sp.level} or higher.</p>`}</div>
         <button class="btn ghost block" style="margin-top:10px" data-a="castWith" data-lvl="0">Cast without a slot (ritual, item, free use)</button>`);
    }

    case "item": {
      const it = itemById(c, m.id);
      if (!it) return "";
      const ref = findByName(allItems(app.library, app.campaign), it.name) || findByName(allWeapons(app.library, app.campaign), it.name);
      const kind = wearKind(it);
      const k = slotOf(c, it.id);
      const atype = it.armor?.type || armorTypeFromName(it.name) || "";
      const w = it.weapon;
      const sel = (key, val, opts) => `<select class="f" data-item-field="${key}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(val) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
      const body = `
        ${ref?.text ? `<details class="about" style="margin:0 0 12px;border:0;padding:0" ${m.open ? "open" : ""}><summary class="lab" style="cursor:pointer">What it does</summary>${formatText(ref.text)}</details>` : ""}
        <div class="stack">
          <div class="grid2">
            <div class="field"><label>Name</label><input class="f" data-item-field="name" value="${esc(it.name)}"></div>
            <div class="field"><label>Quantity</label><input class="f num" type="number" inputmode="numeric" min="0" data-item-field="qty" value="${it.qty}"></div>
          </div>
          ${w ? `<div class="grid3">
              <div class="field"><label>Damage</label><input class="f num" data-weapon-field="dice" value="${esc(w.dice)}"></div>
              <div class="field"><label>Type</label><input class="f" data-weapon-field="dtype" value="${esc(w.dtype || "")}"></div>
              <div class="field"><label>Magic +</label><input class="f num" type="number" inputmode="numeric" data-weapon-field="magic" value="${w.magic || 0}"></div>
            </div>
            <div class="grid2">
              <div class="field"><label>Melee or ranged</label><select class="f" data-weapon-field="kind">${["Melee", "Ranged"].map(v => `<option ${w.kind === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
              <div class="field"><label>Attacks with</label><select class="f" data-weapon-field="ability">${[["", "Auto"], ["str", "Strength"], ["dex", "Dexterity"], ["fin", "Better of the two"]].map(([v, l]) => `<option value="${v}" ${(w.ability || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
            </div>
            <div class="field"><label>Properties</label><input class="f" data-weapon-field="props" value="${esc(w.props || "")}" placeholder="e.g. Finesse, Light, Two-Handed"></div>`
          : `<div class="field"><label>Worn on</label>${sel("slot", it.slot || (kind || "none"), [["none", "Not worn — just carried"], ...WEAR_CHOICES.slice(1)])}</div>
            ${kind === "armor" ? `<div class="field"><label>Armor type</label>${sel("armorType", atype, [["", "Choose…"], ...Object.entries(ARMOR).map(([n, a]) => [n, a.base == null ? "Clothing (no armor)" : `${n} — ${a.cat}, AC ${a.base}${a.dexCap == null ? " + Dex" : a.dexCap ? " + Dex (max 2)" : ""}`])])}</div>` : ""}
            ${kind ? `<div class="grid3">
              ${kind === "armor" || kind === "shield" ? `<div class="field"><label>Magic +</label><input class="f num" type="number" inputmode="numeric" data-item-field="magic" value="${it.magic || 0}"></div>` : ""}
              <div class="field"><label>AC bonus</label><input class="f num" type="number" inputmode="numeric" data-item-field="acBonus" value="${it.acBonus || 0}"></div>
              <div class="field"><label>Save bonus</label><input class="f num" type="number" inputmode="numeric" data-item-field="saveBonus" value="${it.saveBonus || 0}"></div>
            </div>` : ""}`}
          ${kind ? `<label class="rowline" style="cursor:pointer"><span class="nm">Needs attunement</span><input type="checkbox" data-a="toggleAttuneReq" ${it.attune ? "checked" : ""}></label>
            ${it.attune ? `<label class="rowline" style="cursor:pointer"><span class="nm">Attuned <span class="sub2">${attunedCount(c)}/3 used</span></span><input type="checkbox" data-a="toggleAttuned" ${it.attuned ? "checked" : ""}></label>` : ""}` : ""}
          <div class="field"><label>Notes</label><textarea class="f" data-item-notes="${c.inventory.indexOf(it)}" style="min-height:70px">${esc(it.notes || "")}</textarea></div>
          ${!w ? `<button class="btn sm ghost" data-a="makeWeapon">This is a weapon — add attack stats</button>` : ""}
        </div>`;
      const foot = [
        k ? `<button class="btn" data-a="unequip" data-id="${it.id}">Take off</button>` : "",
        `<button class="btn danger" data-a="removeItem" data-id="${it.id}">Remove</button>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`
      ].join("");
      return modalShell(it.name, body, foot);
    }

    case "slot": {
      const label = SLOTS.find(s => s.key === m.slot).label;
      const cur = itemById(c, c.equipment[m.slot]);
      const options = c.inventory.filter(it => it.id !== cur?.id && fitsOk(it, m.slot, c));
      const body = `
        ${cur ? `<div class="optcard" aria-pressed="true"><span class="grow"><b>${esc(cur.name)}</b><span>Equipped now</span></span>
          <button class="btn sm" data-a="openItem" data-id="${cur.id}">Details</button></div>` : ""}
        <p class="lab" style="margin-top:12px">${options.length ? "From your bag" : ""}</p>
        <div class="optlist" style="margin-top:4px">${options.map(it => {
          const k = slotOf(c, it.id);
          return `<button class="optcard" data-a="equipHere" data-id="${it.id}" data-slot="${m.slot}"><span class="grow"><b>${esc(it.name)}</b>
            <span>${k ? "Move from " + esc(SLOTS.find(s => s.key === k).label.toLowerCase()) : it.attune && !it.attuned ? "Needs attunement" : "Equip"}</span></span></button>`;
        }).join("") || `<p class="muted small">Nothing in your bag fits here. Add items from the Bag section, or tap an item there and set what it's worn on.</p>`}</div>`;
      return modalShell(label, body, `${cur ? `<button class="btn" data-a="unequip" data-id="${cur.id}">Take off</button>` : ""}<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "shortRest": {
      const left = c.hitDice.total - c.hitDice.spent;
      const conMod = abilityMod(c.abilities.con);
      return modalShell("Short rest",
        `<p>Spend Hit Dice to heal: each is d${c.hitDice.die} ${fmtMod(conMod)}.</p>
         <div class="rowline"><span class="nm">Hit Dice left</span><span class="val">${left} / ${c.hitDice.total}</span></div>
         <div class="rowline"><span class="nm">Hit points</span><span class="val">${c.hp.cur} / ${c.hp.max}</span></div>
         <button class="btn block" style="margin-top:10px" data-a="spendHitDie" ${left <= 0 || c.hp.cur >= c.hp.max ? "disabled" : ""}>Spend one Hit Die</button>
         ${(m.log || []).length ? `<p class="small muted" style="margin-top:10px">${m.log.map(esc).join("<br>")}</p>` : ""}`,
        `<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="finishShortRest">Finish short rest</button>`);
    }

    case "longRest":
      return modalShell("Take a long rest?",
        `<p>This restores all hit points, all spell slots, all Hit Dice and all trackers, ends concentration, and lowers exhaustion by 1.</p>`,
        `<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="confirmLongRest">Long rest</button>`);

    case "conditions": {
      const firstLine = n => { const g = glossaryEntry(n); return g ? esc(g.text.split(/(?<=\.)\s/)[0]).slice(0, 110) : ""; };
      return modalShell("Conditions",
        `<p class="small muted" style="margin-bottom:10px">Tap to turn a condition on or off. Tap (i) to read the full rule.</p>
        <div class="condgrid">${CONDITIONS.map(x => {
          const on = c.conditions.includes(x), key = "condition:" + x;
          return infoRow({ key, action: "toggleCondition", data: { name: x }, title: x, sub: firstLine(x), pressed: on, open: app.info.has(key),
            detail: app.info.has(key) ? formatText(glossaryEntry(x)?.text || "") : "",
            badge: `${conditionIcon(x)}` });
        }).join("")}</div>
        <div class="rowline" style="margin-top:12px"><span class="nm">${conditionIcon("Exhaustion")} <button class="term" data-term="condition:Exhaustion">Exhaustion</button></span>
          <span class="stepper"><button data-a="exhStep" data-n="-1" aria-label="Less exhaustion">−</button><b>${c.exhaustion}</b><button data-a="exhStep" data-n="1" aria-label="More exhaustion">+</button></span></div>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "resource": {
      const r = m.i != null ? c.resources[m.i] : { name: "", max: 2, reset: "long" };
      return modalShell(m.i != null ? "Edit tracker" : "New tracker",
        `<div class="stack">
          <div class="field"><label>Name</label><input class="f" data-modal="name" value="${esc(m.name ?? r.name)}" placeholder="e.g. Wild Shape, Rage, Ki"></div>
          <div class="field"><label>Uses</label><input class="f num" type="number" inputmode="numeric" min="1" max="99" data-modal="max" value="${esc(m.max ?? r.max)}"></div>
          <div><p class="lab">Comes back on</p><div class="seg">
            <button data-a="resReset" data-v="short" aria-pressed="${(m.reset ?? r.reset) === "short"}">Short or long rest</button>
            <button data-a="resReset" data-v="long" aria-pressed="${(m.reset ?? r.reset) !== "short"}">Long rest</button></div></div>
        </div>`,
        `${m.i != null ? `<button class="btn danger" data-a="deleteResource">Delete</button>` : `<button class="btn" data-a="closeModal">Cancel</button>`}
         <button class="btn pri" data-a="saveResource">Save</button>`);
    }

    case "edit": {
      const subs = subclassesFor(app.library, c.class);
      const species = enabledSpecies(app.library, app.campaign).map(s => s.name);
      const bgs = enabledBackgrounds(app.library, app.campaign).map(s => s.name);
      const opt = (list, cur) => [...new Set([cur, ...list])].filter(Boolean).map(n => `<option ${n === cur ? "selected" : ""}>${esc(n)}</option>`).join("");
      return modalShell("Edit character",
        `<div class="stack">
          <div class="field"><label>Name</label><input class="f" data-edit="name" value="${esc(c.name)}"></div>
          <div class="grid2">
            <div class="field"><label>Level</label><input class="f num" type="number" inputmode="numeric" min="1" max="20" data-edit="level" value="${c.level}"></div>
            <div class="field"><label>Max HP</label><input class="f num" type="number" inputmode="numeric" min="1" data-edit="maxhp" value="${c.hp.max}"></div>
          </div>
          ${subs.length ? `<div class="field"><label>Subclass</label><select class="f" data-edit="subclass"><option value="">None yet</option>${opt(subs.map(s => s.name), c.subclass)}</select></div>` : ""}
          <div class="grid2">
            <div class="field"><label>Species</label><select class="f" data-edit="species">${opt(species, c.species)}</select></div>
            <div class="field"><label>Background</label><select class="f" data-edit="background">${opt(bgs, c.background)}</select></div>
          </div>
          <div class="grid2">
            <div class="field"><label>Speed (ft)</label><input class="f num" type="number" inputmode="numeric" data-edit="speed" value="${c.speed}"></div>
            <div class="field"><label>Initiative bonus</label><input class="f num" type="number" inputmode="numeric" data-edit="initBonus" value="${c.initBonus || 0}"></div>
          </div>
          <p class="lab" style="margin-top:6px">Ability scores</p>
          <div class="grid3">${ABILITIES.map(a => `<label class="abil"><span class="an">${ABILITY_LABEL[a]}</span>
            <input type="number" inputmode="numeric" min="1" max="30" data-edit-ability="${a}" value="${c.abilities[a]}" aria-label="${ABILITY_LABEL[a]}"></label>`).join("")}</div>
          <p class="lab" style="margin-top:6px">Saving throw proficiencies</p>
          <div class="grid3">${ABILITIES.map(a => `<label class="rowline" style="border:0;cursor:pointer;justify-content:flex-start"><input type="checkbox" data-a="toggleSaveProf" data-ab="${a}" ${c.saveProf.includes(a) ? "checked" : ""}> ${ABILITY_LABEL[a].slice(0, 3)}</label>`).join("")}</div>
          <div class="panel" style="margin-top:10px"><div class="panel-body stack">
            <button class="btn block" data-a="exportOne">Save a backup of this character</button>
            ${m.confirmDelete
              ? `<p class="small" style="color:var(--red)">Delete ${esc(c.name)} from this device? This can't be undone unless you have a backup.</p>
                 <div class="btnrow"><button class="btn" data-a="cancelDelete">Keep</button><button class="btn danger" data-a="deleteChar">Yes, delete</button></div>`
              : `<button class="btn danger block" data-a="askDelete">Delete character</button>`}
          </div></div>
        </div>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "settings": {
      const theme = app.prefs.theme || "auto", size = app.prefs.size || "normal";
      const L = app.library;
      return modalShell("Settings",
        `<div class="stack">
          <div><p class="lab">Theme</p><div class="seg">
            ${["auto", "light", "dark"].map(t => `<button data-a="setTheme" data-v="${t}" aria-pressed="${theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div></div>
          <div><p class="lab">Text size</p><div class="seg">
            ${[["normal", "Normal"], ["large", "Large"], ["xl", "Extra large"]].map(([v, l]) => `<button data-a="setSize" data-v="${v}" aria-pressed="${size === v}">${l}</button>`).join("")}</div></div>
          <div class="panel"><div class="panel-head"><h2>Open with one tap</h2></div><div class="panel-body">${installCard(app, { inSettings: true })}</div></div>
          <div class="panel"><div class="panel-head"><h2>Backups</h2></div><div class="panel-body stack">
            <p class="small muted">Characters live only on this device. Save a backup file now and then — send it to yourself or keep it in Files.</p>
            <button class="btn block" data-a="exportAll">Save a backup of all characters</button>
            <button class="btn block" data-a="importPrompt">Restore from a backup file</button>
            <p class="sub2">${app.persisted ? "This browser has agreed to keep your data." : "Tip: installing the app to your home screen keeps your data safest."}</p>
          </div></div>
          <div class="panel"><div class="panel-head"><h2>Rules data</h2></div><div class="panel-body stack small">
            <p class="muted">App updates install themselves: when one is ready the app reloads at launch, or shows an <b>Update now</b> bar if it's already open. Nothing to redownload.</p>
            <p>${esc(app.campaign.name || "Campaign")}: ${L.classes.length} classes, ${L.species.length} species, ${L.spells.length} spells, ${L.items.length} items.</p>
            <button class="btn block" data-a="checkUpdates">Check for updates now</button>
          </div></div>
        </div>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "slots":
      return modalShell("The Gambler's Den",
        `<div style="text-align:center">
          <div style="font-size:2.6rem;letter-spacing:12px;margin:8px 0">${m.reels ? m.reels.join(" ") : "❔ ❔ ❔"}</div>
          <p class="muted">${m.msg || "You found the secret table. Play money only."}</p>
          <p style="margin-top:6px">Credits: <b class="num">${getCredits()}</b></p>
        </div>`,
        `<button class="btn" data-a="closeModal">Walk away</button><button class="btn pri" data-a="spinSlots">Spin (5)</button>`);
  }
  return "";
}

export function renderRollCard(app) {
  const r = app.roll;
  if (!r) return "";
  const solo = !(app.screen === "sheet");
  return `<div class="rollcard ${solo ? "solo" : ""}" role="status" aria-live="polite"><div class="in">
    <div class="ttl"><span>${esc(r.title)}</span><button class="iconbtn" style="width:36px;height:36px" data-a="dismissRoll" aria-label="Dismiss">${ICONS.close}</button></div>
    <div class="res">${r.parts.map(p => `<div class="${p.crit ? "crit" : ""} ${p.fumble ? "fumble" : ""}">
      <div class="lbl">${esc(p.label)}</div><div class="big">${p.total}</div><div class="bd">${p.bd}</div></div>`).join("")}</div>
    ${r.alt ? `<div class="alt">${r.alt}</div>` : ""}
  </div></div>`;
}

export function shopPrice(c, row) {
  const crafter = (c.feats || []).some(f => /^Crafter\b/.test(f));
  return crafter && !row.magic ? Math.round(row.gp * 80) / 100 : row.gp;
}
export function fmtWallet(coins) {
  const parts = ["pp", "gp", "ep", "sp", "cp"].filter(k => +coins?.[k]).map(k => `${coins[k]} ${k}`);
  return parts.length ? parts.join(", ") : "no money";
}
export function renderShopResults(app) {
  const L = app.library, C = app.campaign, c = app.char;
  const q = (app.shopQuery || "").trim().toLowerCase();
  const cat = app.shopCat || "All";
  const rows = shopStock(L, C, allWeapons(L, C), allItems(L, C), Object.keys(ARMOR).filter(a => a !== "Clothing"))
    .filter(r => (cat === "All" || r.cat === cat) && (!q || r.name.toLowerCase().includes(q)));
  if (!rows.length) return `<p class="muted small" style="padding:12px 0">Nothing matches.</p>`;
  const have = walletCp(c.coins);
  return rows.slice(0, 120).map(r => {
    const gp = shopPrice(c, r), cost = Math.round(gp * 100);
    const owned = c.inventory.filter(i => i.name === r.name).reduce((t, i) => t + (i.qty || 0), 0);
    const key = "shop:" + r.name, open = app.info.has(key);
    return `<div class="shopitem ${open ? "open" : ""}"><div class="rowline shoprow">
      <button class="nm" data-a="toggleInfo" data-key="${esc(key)}" aria-expanded="${open}">
        <span>${esc(r.name)}</span><span class="sub2">${esc([r.cat, r.sub].filter(Boolean).join(" · ").slice(0, 70))}${owned ? ` · you have ${owned}` : ""}</span></button>
      <button class="btn sm ${cost <= have ? "pri" : ""}" data-a="buyItem" data-name="${esc(r.name)}" ${cost > have ? "disabled" : ""} aria-label="Buy ${esc(r.name)} for ${esc(fmtPrice(gp))}">${esc(fmtPrice(gp))}</button>
    </div>${open ? `<div class="about">${shopDetail(app, r)}</div>` : ""}</div>`;
  }).join("") + (rows.length > 120 ? `<p class="sub2">Showing 120 of ${rows.length}. Search to narrow it down.</p>` : "");
}

function shopDetail(app, r) {
  const L = app.library, C = app.campaign;
  if (r.cat === "Armor") {
    if (r.name === "Shield") return `<p>+2 to AC while you hold it in your off hand.</p>`;
    const a = ARMOR[r.name];
    return `<dl class="kv"><dt>Type</dt><dd>${esc(a.cat)} armor</dd><dt>AC</dt><dd>${a.base}${a.dexCap == null ? " + Dex modifier" : a.dexCap ? ` + Dex modifier (max ${a.dexCap})` : ""}</dd>
      ${a.str ? `<dt>Strength</dt><dd>${a.str}+ or your Speed drops by 10 feet</dd>` : ""}${a.stealth ? `<dt>Stealth</dt><dd>Disadvantage</dd>` : ""}</dl>`;
  }
  if (r.cat === "Weapons") {
    const w = allWeapons(L, C).find(x => x.name === r.name) || {};
    return `<dl class="kv"><dt>Damage</dt><dd>${esc(w.dice || "")} ${esc(w.dtype || "")}</dd><dt>Type</dt><dd>${esc([w.cat, w.kind].filter(Boolean).join(" "))}</dd>
      ${w.props ? `<dt>Properties</dt><dd>${esc(w.props)}</dd>` : ""}${w.mastery ? `<dt>Mastery</dt><dd><button class="term" data-term="mastery:${esc(w.mastery)}">${esc(w.mastery)}</button></dd>` : ""}</dl>`;
  }
  const it = allItems(L, C).find(x => x.name === r.name);
  return formatText(it?.text || "");
}
