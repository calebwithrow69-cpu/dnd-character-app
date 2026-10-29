import { esc, modalShell, searchBox, ICONS, hotbarToggle } from "../ui.js";
import {
  ABILITIES, ABILITY_LABEL, CONDITIONS, abilityMod, fmtMod, deriveCharacter, hpAverageGain, slotRows
} from "../rules.js";
import { findByName, subclassesFor, enabledSpecies, enabledBackgrounds, allItems, allWeapons } from "../data.js";
import { SLOTS, WEAR_CHOICES, ARMOR, itemById, slotOf, slotsOf, fitsOk, wearKind, attunedCount, armorTypeFromName, weaponsOf, itemCategory } from "../gear.js";
import { formatText, infoRow, conditionIcon, glossaryEntry } from "../ui.js";
import { detailFor, renderSpellResults, renderGearResults, acBody } from "./sheet.js";
import { getCredits } from "../dice.js";
import { installCard } from "../install.js";
import { renderSettingsModal, renderChangelogModal } from "./settings.js";
import { xpForLevel } from "../rules.js";
import { ABILITIES as ABS, ABILITY_LABEL as ABL, SKILLS as SKS } from "../rules.js";
import { ALL_TOOLS } from "../choices.js";
import { enabledFeats } from "../data.js";
import { customValid, loadCustom } from "../custombg.js";
import { shopStock, walletCp, fmtPrice } from "../equipment.js";
import { findTile } from "./character.js";
import { hpParts, FX_TARGETS } from "../effects.js";
import { COST_LABEL, isSustained } from "../combat.js";
import { wieldedId } from "../play.js";
import { weaponNumbers } from "../rules.js";
import { renderSubclassPage } from "./subclass.js";
import { renderLoadoutBody, renderLoadoutSave } from "./loadout.js";

export function renderModal(app) {
  const m = app.modal;
  if (!m) return "";
  const c = app.char;
  switch (m.type) {
    case "detail": {
      const d = detailFor(app, m.kind, m.name, m.i, m.from);
      const foot = [
        d.removeFeat != null ? `<button class="btn danger" data-a="askRemove" data-do="removeFeat" data-what="feat" data-name="${esc(m.name)}" data-i="${d.removeFeat}">Remove feat</button>` : "",
        d.removeWeapon != null ? `<button class="btn danger" data-a="removeWeapon" data-i="${d.removeWeapon}">Remove weapon</button>` : "",
        d.removeItem != null ? `<button class="btn danger" data-a="removeItem" data-i="${d.removeItem}">Remove item</button>` : "",
        `<button class="btn" data-a="closeModal">Done</button>`
      ].join("");
      return modalShell(d.title, d.body, foot);
    }

    case "subclass": return renderSubclassPage(app);

    case "ac": {
      const d = deriveCharacter(c);
      return modalShell(`Armor class ${d.ac}`, `<p class="sub2" style="margin-bottom:8px">Where your armor class comes from. Armor and shields you wear are added automatically.</p>${acBody(c, d)}`, `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "tile": {
      const e = findTile(app, c, deriveCharacter(c), m.id);
      if (!e) return modalShell("Not found", "", `<button class="btn" data-a="closeModal">Done</button>`);
      const text = e.detail ? detailFor(app, e.detail.kind, e.detail.name, null, e.detail.from).body : formatText(e.text || "");
      const verb = e.src === "Attack" ? "Attack" : e.spell ? (e.src === "Cantrip" ? "Cast" : "Cast...") : e.res ? "Use (spend 1)" : "Use";
      const usable = e.cost !== "Passive" && (e.act || ["Action", "Bonus", "Reaction"].includes(e.cost));
      const isOn = (c.active || []).some(a => a.id === e.id);
      const canToggle = e.cost !== "Passive" && !e.spell && e.src !== "Attack" && (isOn || isSustained(e.text));
      const body = `<div class="tilehead"><span class="tag amber">${COST_LABEL[e.cost]}</span><span class="tag">${esc(e.src)}</span>${e.conc ? `<span class="tag blue">Concentration</span>` : ""}${isOn ? `<span class="tag green">Active</span>` : ""}${e.res && e.res.max != null ? `<span class="tag">${e.res.cur}/${e.res.max} left</span>` : ""}</div>
        ${e.block ? `<div class="tilewhy" role="note"><b>Can't use this right now</b><span>${esc(e.block)}</span></div>` : ""}
        ${text}${e.cost !== "Passive" && !e.detail ? `<p class="sub2" style="margin-top:10px">The action type is the app's reading of the text above.</p>` : ""}${canToggle ? `<p class="sub2" style="margin-top:10px">Turn on shows it as an Active chip on your sheet until you turn it off or take a rest. The app does not apply its effects for you.</p>` : ""}`;
      return modalShell(e.name, body, `<button class="btn" data-a="closeModal">Done</button>${canToggle ? `<button class="btn" data-a="toggleActive" ${!isOn && e.block ? "disabled" : ""}>${isOn ? "Turn off" : "Turn on"}</button>` : ""}${usable ? `<button class="btn pri" data-a="tileUse" ${e.block ? "disabled" : ""}>${verb}</button>` : ""}`);
    }

    case "swap": {
      const ws = weaponsOf(c), cur = wieldedId(c);
      const rows = ws.map(it => {
        const w = it.weapon, n = weaponNumbers(w, c);
        return `<button class="optcard" data-a="swapTo" data-id="${esc(it.id)}" ${it.id === cur ? "disabled" : ""}>
          <span class="grow"><b>${esc(it.name)}${it.id === cur ? " (in hand)" : ""}</b><span>${fmtMod(n.toHit)} to hit \u00b7 ${esc(n.dice)}${n.dmgMod ? (n.dmgMod > 0 ? "+" : "") + n.dmgMod : ""} ${esc(String(w.dtype || "").toLowerCase())}</span></span></button>`;
      }).join("");
      return modalShell("Swap weapon", `<p class="sub2" style="margin-bottom:8px">Drawing a weapon takes a Bonus Action. You can only attack with the weapon in your hand.</p><div class="optlist" style="margin-top:0">${rows}</div>`, `<button class="btn" data-a="closeModal">Cancel</button>`);
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

    case "confirmDelete": return renderConfirmDelete(app);
    case "confirmStyle": {
      const to = app._style === "advanced" ? "advanced" : "classic";
      return modalShell(`Switch to the ${to} sheet?`, `<p>Are you sure? Your characters are not changed, only how the sheet is laid out.</p><p class="sub2">${to === "advanced" ? "Advanced splits the sheet into tabs and adds Play Mode, loadouts and turn tracking." : "Classic puts everything on one page like the printed 2024 sheet."}</p>`,
        `<button class="btn" data-a="closeModal">Keep my current sheet</button><button class="btn pri" data-a="confirmStyle">Switch</button>`);
    }
    case "confirmRemove": {
      const r = app._rm || {};
      const note = r.what === "spell" ? "It leaves your spell list. You can add it back any time from Add spells."
        : r.what === "feat" ? "It comes off your sheet. Bonuses it already gave, such as ability points or hit points, are not undone." : "";
      return modalShell(`Remove ${r.name || "this"}?`, `<p>Are you sure you want to remove <b>${esc(r.name || "this")}</b>?</p><p class="sub2">${esc(note)}</p>`,
        `<button class="btn" data-a="cancelRemove">Keep it</button><button class="btn danger" data-a="confirmRemove">Remove</button>`);
    }
    case "customBg": return renderCustomBg(app);
    case "levelMenu": return renderLevelMenu(app);

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
            ${kind === "armor" ? `<div class="field"><label>Armor type</label>${sel("armorType", atype, [["", "Choose..."], ...Object.entries(ARMOR).map(([n, a]) => [n, a.base == null ? "Clothing (no armor)" : `${n} — ${a.cat}, AC ${a.base}${a.dexCap == null ? " + Dex" : a.dexCap ? " + Dex (max 2)" : ""}`])])}</div>` : ""}
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

    case "itemMenu": {
      const it = itemById(c, m.id);
      if (!it) return "";
      const kind = wearKind(it), k = slotOf(c, it.id);
      const ref = findByName(allItems(app.library, app.campaign), it.name) || findByName(allWeapons(app.library, app.campaign), it.name);
      const fitSlot = SLOTS.map(s => s.key).find(s => !c.equipment[s] && fitsOk(it, s, c)) || SLOTS.map(s => s.key).find(s => fitsOk(it, s, c));
      const consumable = /potion|elixir|scroll|oil|ammunition|arrow|bolt|bullet|ration|food|dust|bead/i.test(it.name + " " + (it.type || ""));
      const row = (a, data, label, extra = "") => `<button class="menu-row ${extra}" data-a="${a}" ${Object.entries(data).map(([kk, v]) => `data-${kk}="${esc(v)}"`).join(" ")}>${label}</button>`;
      const items = [
        it.weapon ? row("attackRoll", { id: it.id, close: "1" }, "⚔ Attack") : "",
        k ? row("unequip", { id: it.id }, "✋ Take off") : (kind && fitSlot ? row("equipHere", { id: it.id, slot: fitSlot }, "🛡 Equip") : ""),
        consumable ? row("useItem", { id: it.id }, "✓ Use one") : "",
        it.attune ? row("ctxAttune", { id: it.id }, it.attuned ? "◇ End attunement" : "◆ Attune") : "",
        row("addHotbar", { kind: it.weapon ? "attack" : "item", id: it.id, close: "1" }, "➕ Add to hotbar"),
        `<div class="menu-row qtyrow"><span>Quantity</span><span class="stepper"><button data-a="qtyStep" data-id="${it.id}" data-n="-1" aria-label="One fewer">−</button><b>${it.qty}</b><button data-a="qtyStep" data-id="${it.id}" data-n="1" aria-label="One more">+</button></span></div>`,
        row("openItemEdit", { id: it.id }, "✎ Edit details"),
        row("removeItem", { id: it.id }, "🗑 Drop", "danger")
      ].filter(Boolean).join("");
      return modalShell(it.name, `${ref?.text ? `<p class="sub2" style="margin-bottom:10px">${esc((ref.text.split("\n")[0] || "").slice(0, 120))}</p>` : ""}<div class="menu-list">${items}</div>`,
        `<button class="btn" data-a="closeModal">Close</button>`);
    }

    case "hotbarAdd": {
      const weapons = weaponsOf(c);
      const spells = (c.spellcasting.spells || []);
      const feats = (c.feats || []);
      const cls = findByName(app.library.classes, c.class);
      const sub = c.subclass ? findByName(app.library.subclasses, c.subclass) : null;
      const already = new Set((c.hotbar || []).map(h => h.kind + ":" + (h.id || h.name)));
      const sect = (title, rows) => rows.length ? `<div class="grouph">${title}</div>${rows.join("")}` : "";
      const addRow = (kind, idOrName, label, sub2) => {
        const key = kind + ":" + idOrName, on = already.has(key);
        const data = kind === "spell" || kind === "ability" ? `data-name="${esc(idOrName)}"` : `data-id="${esc(idOrName)}"`;
        return `<div class="rowline"><span class="nm">${esc(label)}${sub2 ? ` <span class="sub2">${esc(sub2)}</span>` : ""}</span>
          ${hotbarToggle(c, kind, idOrName, label, true)}</div>`;
      };
      const feRows = [...((cls?.features) || []), ...((sub?.features) || [])].filter(f => f.lv <= c.level && f.name && f.name !== "Subclass Feature" && !f.intro)
        .map(f => addRow("ability", f.name, f.name, `Lv ${f.lv}`));
      return modalShell("Add to hotbar",
        `<div class="results">
          ${sect("Attacks", weapons.map(w => addRow("attack", w.id, w.name, "weapon")))}
          ${sect("Spells", spells.map(s => addRow("spell", s.name, s.name)))}
          ${sect("Items", c.inventory.filter(i => !i.weapon).map(i => addRow("item", i.id, i.name)))}
          ${sect("Class & subclass abilities", feRows)}
          ${sect("Feats", feats.map(f => addRow("ability", f, f)))}
          ${!weapons.length && !spells.length && !c.inventory.length ? `<p class="muted small" style="padding:12px 0">Nothing to add yet.</p>` : ""}
        </div>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "loadout": { const r = renderLoadoutBody(app, c, m); return modalShell(r.title, r.body, r.foot); }
    case "loadoutSave": { const r = renderLoadoutSave(app, c); return modalShell(r.title, r.body, r.foot); }

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
            <span>${k ? ((it.qty || 1) > slotsOf(c, it.id).length ? "Equip another (" + (slotsOf(c, it.id).length + 1) + " of " + (it.qty || 1) + ")" : "Move from " + esc(SLOTS.find(s => s.key === k).label.toLowerCase())) : it.attune && !it.attuned ? "Needs attunement" : "Equip"}</span></span></button>`;
        }).join("") || `<p class="muted small">Nothing in your bag fits here. Add items from the Bag section, or tap an item there and set what it's worn on.</p>`}</div>`;
      return modalShell(label, body, `${cur ? `<button class="btn" data-a="unequip" data-id="${cur.id}" data-slot="${m.slot}">Take off</button>` : ""}<button class="btn pri" data-a="closeModal">Done</button>`);
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

    case "breakdown": {
      const d = deriveCharacter(c), sg = n => (n > 0 ? "+" : "") + n;
      const block = (title, total, parts) => `<h3 class="bd-h"><span>${title}</span><b>${total}</b></h3><div class="bd">${parts.map(([n, v]) => `<div class="rowline"><span class="nm">${esc(n)}</span><b>${typeof v === "number" ? sg(v) : esc(v)}</b></div>`).join("")}</div>`;
      const dex = Math.floor((c.abilities.dex - 10) / 2);
      return modalShell("How your numbers are worked out",
        block("Hit point maximum", hpParts(c).total, hpParts(c).parts) +
        block("Armor Class", d.ac, d.acInfo.parts) +
        block("Speed", d.speed + " ft", [["Base", (Number(c.speed) || 30) + " ft"], ...d.speedFx.map(x => [x.src, sg(x.v) + " ft"])]) +
        block("Initiative", sg(d.initiative), [["Dexterity", dex], ...(c.initBonus ? [["Set by hand", c.initBonus]] : []), ...d.initFx.map(x => [x.src, x.v])]) +
        `<p class="sub2" style="margin-top:12px">Add or fix a number yourself under Edit character, Custom bonuses.</p>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`);
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
          <p class="lab" style="margin-top:6px">Custom bonuses</p>
          ${(c.custom || []).map(x => `<div class="rowline"><span class="nm">${esc(x.label || "Custom")} <span class="sub2">${esc((FX_TARGETS.find(t => t[0] === x.t) || [0, x.t])[1])}</span></span><b>${x.v > 0 ? "+" : ""}${x.v}</b><button class="iconbtn" data-a="customRemove" data-id="${esc(x.id)}" aria-label="Remove ${esc(x.label || "bonus")}">${ICONS.close}</button></div>`).join("")}
          <div class="grid3" style="grid-template-columns:1.4fr .7fr 1fr;gap:8px;align-items:end">
            <div class="field"><label for="cb-t">Changes</label><select class="f" id="cb-t">${FX_TARGETS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></div>
            <div class="field"><label for="cb-v">By</label><input class="f num" id="cb-v" type="number" inputmode="numeric" value="1"></div>
            <div class="field"><label for="cb-l">Label</label><input class="f" id="cb-l" maxlength="24" placeholder="Why"></div>
          </div>
          <button class="btn block" data-a="customAdd">Add bonus</button>
          <button class="btn block" data-a="openBreakdown">How HP, AC, speed and initiative are worked out</button>
          <p class="lab" style="margin-top:6px">Sheet style</p>
          <div class="seg" role="group" aria-label="Sheet style">${[["classic", "Classic"], ["advanced", "Advanced"]].map(([v, l]) => `<button data-a="setPrefV" data-k="sheetStyle" data-v="${v}" aria-pressed="${(app.prefs.sheetStyle || "classic") === v}">${l}</button>`).join("")}</div>
          <p class="sub2">Switching asks you to confirm. Your character is not changed.</p>
          <div class="panel" style="margin-top:10px"><div class="panel-body stack">
            <button class="btn block" data-a="downloadPdf">Download character sheet (PDF)</button>
            <button class="btn block" data-a="exportOne">Save a backup of this character</button>
            <button class="btn danger block" data-a="askDelete">Delete character</button>
          </div></div>
        </div>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "settings":
      return renderSettingsModal(app);

    case "changelog":
      return renderChangelogModal(app);

    case "hp": {
      const hp = c.hp;
      const res = app.hpRes || "normal";
      return modalShell("Hit points",
        `<div class="stack">
          <div class="hpreadout"><b class="num">${hp.cur}</b><span class="muted"> / ${hp.max} HP${hp.temp ? ` &middot; +${hp.temp} temp` : ""}</span></div>
          <input class="f num" id="hp-amt" type="number" inputmode="numeric" min="0" placeholder="How much?" aria-label="Amount of damage or healing">
          <div><p class="lab">Damage taken as</p><div class="seg" role="group" aria-label="Resistance">
            ${[["normal", "Normal"], ["resist", "Resistant (half)"], ["vuln", "Vulnerable (x2)"]].map(([v, l]) => `<button data-a="hpRes" data-v="${v}" aria-pressed="${res === v}">${l}</button>`).join("")}</div>
            <div id="hp-preview" class="small muted" style="min-height:1.3em;margin-top:4px"></div></div>
          <div class="gloss-chips" style="margin:0">${[1, 5, 10, 20].map(n => `<button class="gloss-chip" data-a="hpQuick" data-n="${n}">+${n}</button>`).join("")}<button class="gloss-chip" data-a="hpQuick" data-n="0">Clear</button></div>
          <div class="grid3">
            <button class="btn" data-a="hpApply" data-mode="damage" style="border-color:var(--red);color:var(--red)">Damage</button>
            <button class="btn" data-a="hpApply" data-mode="heal" style="border-color:var(--green);color:var(--green)">Heal</button>
            <button class="btn" data-a="hpApply" data-mode="temp" style="border-color:var(--blue);color:var(--blue)">Temp HP</button>
          </div>
          ${hp.cur <= 0 ? `<p class="small muted">At 0 HP, damage adds a death-save failure and healing brings you back up. Death saves are on the Stats tab.</p>` : ""}
        </div>`,
        "").replace('class="modal-back"', 'class="modal-back top"');
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

// ---- delete: one clear confirmation (the toast afterwards offers Undo)
function renderConfirmDelete(app) {
  const n = esc(app.char.name);
  return modalShell(`Delete ${app.char.name}?`, `<p>This removes ${n} from this device. Without a backup file, they're gone for good.</p>`,
    `<button class="btn" data-a="cancelDelete">Keep</button><button class="btn danger" data-a="deleteChar">Delete</button>`);
}

function renderCustomBg(app) {
  const cb = app.customBg, err = customValid(cb);
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(label || v)}</option>`;
  const feats = enabledFeats(app.library, app.campaign).filter(f => /^Origin/i.test(f.type || "")).sort((a, b) => a.name.localeCompare(b.name));
  const reals = app.library.backgrounds.filter(b => !b.custom).sort((a, b) => a.name.localeCompare(b.name));
  const mine = loadCustom();
  return modalShell("Custom background",
    `<p class="small muted">The 2024 rules let you build your own background. Choose its three ability scores, an Origin feat, two skills and a tool. You then split +2/+1 (or +1 each) among the three scores when you set your ability scores.</p>
     <div class="field"><label>Name</label><input class="f" data-cb="name" value="${esc(cb.name)}" placeholder="e.g. Caravan Guard" autocomplete="off"></div>
     <div class="field"><label>Three ability scores</label><div class="grid3">${[0, 1, 2].map(i => `<select class="f" data-cb="ab${i}" aria-label="Ability ${i + 1}"><option value="">Choose</option>${ABS.map(a => opt(a, cb.abilities[i], ABL[a])).join("")}</select>`).join("")}</div></div>
     <div class="field"><label>Origin feat</label><select class="f" data-cb="feat"><option value="">Choose</option>${feats.map(f => opt(f.name, cb.feat)).join("")}</select></div>
     <div class="field"><label>Two skills</label><div class="grid2">${[0, 1].map(i => `<select class="f" data-cb="sk${i}" aria-label="Skill ${i + 1}"><option value="">Choose</option>${SKS.map(x => opt(x.id, cb.skills[i], x.label)).join("")}</select>`).join("")}</div></div>
     <div class="field"><label>Tool proficiency</label><select class="f" data-cb="tool"><option value="">Choose</option>${ALL_TOOLS.map(t => opt(t, cb.tool)).join("")}</select></div>
     <div class="field"><label>Starting equipment from</label><select class="f" data-cb="equipFrom"><option value="">50 GP instead</option>${reals.map(b => opt(b.name, cb.equipFrom)).join("")}</select></div>
     <div class="field"><label>Notes (optional)</label><textarea class="f" data-cb="about" rows="2">${esc(cb.about)}</textarea></div>
     ${mine.length ? `<p class="lab" style="margin-top:10px">Your saved backgrounds</p>${mine.map(m => `<div class="rowline"><span class="nm">${esc(m.name)}</span><button class="btn sm" data-a="cbEdit" data-name="${esc(m.name)}">Edit</button><button class="btn sm danger" data-a="cbDelete" data-name="${esc(m.name)}">Remove</button></div>`).join("")}` : ""}`,
    `${err ? `<span class="why grow">${esc(err)}</span>` : ""}<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="cbSave" ${err ? "disabled" : ""}>Save and use</button>`);
}

function renderLevelMenu(app) {
  const c = app.char;
  if (c.level >= 20) return modalShell("Max level", `<p>${esc(c.name)} is level 20, the highest level. There is nothing left to level up to.</p>`, `<button class="btn pri" data-a="closeModal">Done</button>`);
  const next = c.level + 1, need = xpForLevel(next), have = c.xp || 0, mode = c.levelMode || "xp";
  const enough = have >= need, pct = Math.max(0, Math.min(100, Math.round((have - xpForLevel(c.level)) / Math.max(1, need - xpForLevel(c.level)) * 100)));
  const n = v => Number(v).toLocaleString();
  const body = `<div class="seg" role="group" aria-label="How do you level up?">
      <button data-a="lvlMode" data-v="xp" aria-pressed="${mode === "xp"}">Experience points</button>
      <button data-a="lvlMode" data-v="milestone" aria-pressed="${mode === "milestone"}">Milestone</button></div>
    ${mode === "xp" ? `<p style="margin-top:12px"><b class="num">${n(have)}</b> XP in total. Level ${next} starts at <b class="num">${n(need)}</b>.</p>
      <div class="hpbar" style="height:10px;margin:8px 0;border-radius:5px;background:var(--panel2);overflow:hidden"><div style="height:100%;width:${enough ? 100 : pct}%;background:var(--amber)"></div></div>
      <p class="sub2">${enough ? `You have enough XP for level ${next}.` : `The bar is your progress through level ${c.level}: ${n(Math.max(0, have - xpForLevel(c.level)))} of ${n(need - xpForLevel(c.level))} XP. ${n(need - have)} to go.`}</p>
      <div class="field" style="margin-top:12px"><label>Add the XP you just earned</label>
        <div style="display:flex;gap:8px"><input class="f" id="xp-add" type="number" inputmode="numeric" min="0" placeholder="e.g. 450" style="flex:1" aria-label="XP to add"><button class="btn" data-a="addXp">Add</button></div></div>
      <div class="field"><label>Or set your total XP</label>
        <div style="display:flex;gap:8px"><input class="f" id="xp-set" type="number" inputmode="numeric" min="0" value="${have}" style="flex:1" aria-label="Total XP"><button class="btn" data-a="setXp">Set</button></div></div>`
    : `<p style="margin-top:12px">Your DM decides when the party levels up. Take level ${next} whenever they say so. Your XP is set to ${n(need)} to match.</p>`}`;
  const foot = `<button class="btn" data-a="closeModal">Not yet</button><button class="btn pri" data-a="startLevelUp" ${mode === "xp" && !enough ? "disabled" : ""}>Level up to ${next}</button>`;
  return modalShell("Level up", body, foot);
}
