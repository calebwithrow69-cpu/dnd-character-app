import { renderJump } from "./jump.js";
import { matCost } from "../spellinfo.js";
import { spellIcon } from "./spellicon.js";
import { canPay } from "./spellbrowser.js";
import { renderBrowserBody, renderFilterModal, renderPrepModal, renderLoadPreview, renderListPreview, renderScribe, renderScribeConfirm, renderCompare } from "./spellbrowser.js";
import { areaSvg, areaStats, describeArea, originNote } from "../areagrid.js";
import { PHYS } from "../phys.js";
import { renderDmModal } from "./dmmode.js";
import { renderToolModal, renderQuickEdit, renderAllTools, condEffectsBlock } from "./tools.js";
import { condLine, condNotes } from "../conditions.js";
import { esc, modalShell, searchBox, ICONS, hotbarToggle } from "../ui.js";
import { boxById, boxByName } from "../lootbox.js";
import { renderWhatsNew } from "./whatsnew.js";
import { renderEffectsModal } from "./effects.js";
import { hasFx, upLevels, summary as spellSummary } from "../spellfx.js";
import { oddsList } from "./lootbox.js";
import {
  ABILITIES, ABILITY_LABEL, CONDITIONS, abilityMod, fmtMod, deriveCharacter, hpAverageGain, slotRows
} from "../rules.js";
import { findByName, subclassesFor, enabledSpecies, enabledBackgrounds, allItems, allWeapons } from "../data.js";
import { computeAC, SLOTS, WEAR_CHOICES, ARMOR, itemById, slotOf, slotsOf, fitsOk, wearKind, attunedCount, armorTypeFromName, weaponsOf, itemCategory } from "../gear.js";
import { formatText, infoRow, conditionIcon, glossaryEntry } from "../ui.js";
import { detailFor, renderSpellResults, renderGearResults, acBody } from "./sheet.js";
import { getCredits } from "../dice.js";
import { installCard, installBody, installInfo } from "../install.js";
import { renderSettingsModal, renderChangelogModal } from "./settings.js";
import { xpForLevel } from "../rules.js";
import { ABILITIES as ABS, ABILITY_LABEL as ABL, SKILLS as SKS } from "../rules.js";
import { ALL_TOOLS } from "../choices.js";
import { enabledFeats } from "../data.js";
import { customValid, loadCustom } from "../custombg.js";
import { findTile } from "./character.js";
import { restOptions, rationsHave, rationsNeed } from "../rest.js";
import { hpParts, FX_TARGETS } from "../effects.js";
import { COST_LABEL, isSustained } from "../combat.js";
import { wieldedId } from "../play.js";
import { weaponNumbers } from "../rules.js";
import { renderSubclassPage } from "./subclass.js";
import { renderBadges, renderLevelUp, renderDiscard } from "./notes.js";
import { renderContentUpdate } from "./contentupdate.js";
import { applyDeltas, netCp, fmtNet, COIN_INFO } from "../equipment.js";
import { packBody, packAddBody, isPack } from "./packview.js";
import { renderLoadoutBody, renderLoadoutSave, loadoutsOf, isActive, loadoutPlan } from "./loadout.js";
import { renderCxShop } from "./cxshop.js";
import { layoutModal } from "./layoutedit.js";
import { ftFilterModal } from "./features.js";
import { shopItemModal, shopListsModal, shopListNameModal, shopFilterModal } from "./shop.js";
import { COPY, backupAge, storageReport } from "../storagerisk.js";
import { trashList, daysLeft } from "../trash.js";
import { listCharacters } from "../store.js";
import { trainingFromChar, trainingSummary, isTrained } from "../creation.js";

export function renderModal(app) {
  const m = app.modal;
  if (!m) return "";
  const c = app.char;
  switch (m.type) {
    case "helpIntro": return modalShell("Need help?", `<div class="helpintro"><span class="hi-q">${ICONS.cap}</span><p>Look for the cap icon if you are ever lost or confused.</p></div>`, `<button class="btn" data-a="helpIntroSkip">Skip tour</button><button class="btn pri" data-a="helpIntroGo">Start tour</button>`);
    case "help": return modalShell("Help", `<div class="stack"><button class="btn block" data-a="tourAsk" data-id="home">Home tour</button><button class="btn block" data-a="tourAsk" data-id="sheet">Sheet tour</button><button class="btn block" data-a="tourAsk" data-id="dm">DM tour</button></div>`, `<button class="btn" data-a="closeModal">Done</button>`);
    case "tourAsk": { const T = { home: ["Home tour", "Goes to Home."], sheet: ["Sheet tour", "Opens your last character."], dm: ["DM tour", "Opens DM mode."] }[m.id] || ["Tour", ""];
      return modalShell(`Start the ${T[0]}?`, `<p>${T[1]}</p>`, `<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="tourConfirm">Start</button>`); }
    case "restPick": return modalShell("Rest", `<div class="stack"><button class="btn block" data-a="openShortRest">Short rest</button><button class="btn block" data-a="openLongRest">Long rest</button></div>`, `<button class="btn" data-a="closeModal">Cancel</button>`);
    case "resetApp": return modalShell("Reset app", `<div class="stack"><p class="sub2">Erases every character, note and setting on this device.</p>
      <div class="field"><label for="f-reset">Group password</label><input class="f" id="f-reset" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" ${app.resetBusy ? "disabled" : ""}></div>
      ${app.resetError ? `<p class="small" style="color:var(--red)">${esc(app.resetError)}</p>` : ""}</div>`,
      `<button class="btn" data-a="closeModal">Cancel</button><button class="btn danger" data-a="resetAppGo" ${app.resetBusy ? "disabled" : ""}>${app.resetBusy ? "Checking" : "Erase everything"}</button>`);
    case "tool": return renderToolModal(app, c, deriveCharacter(c));
    case "quickEdit": return renderQuickEdit(app);
    case "allTools": return renderAllTools(app, c);
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
      return modalShell(`Armor class ${d.ac}`, `${acBody(c, d)}`, `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "tile": {
      const e = findTile(app, c, deriveCharacter(c), m.id);
      if (!e) return modalShell("Not found", "", `<button class="btn" data-a="closeModal">Done</button>`);
      const text = e.detail ? detailFor(app, e.detail.kind, e.detail.name, null, e.detail.from).body : formatText(e.text || "");
      const verb = e.src === "Attack" ? "Attack" : e.spell ? (e.src === "Cantrip" ? "Cast" : "Cast...") : e.res ? "Use (spend 1)" : "Use";
      const usable = e.cost !== "Passive" && (e.act || e.type === "feature" || ["Action", "Bonus", "Reaction"].includes(e.cost));
      const isOn = (c.active || []).some(a => a.id === e.id);
      const canToggle = e.cost !== "Passive" && !e.spell && e.src !== "Attack" && (isOn || isSustained(e.text));
      const body = `<div class="tilehead"><span class="tag amber">${COST_LABEL[e.cost]}</span><span class="tag">${esc(e.src)}</span>${e.conc ? `<span class="tag blue">Concentration</span>` : ""}${isOn ? `<span class="tag green">Active</span>` : ""}${e.res && e.res.max != null ? `<span class="tag">${e.res.cur}/${e.res.max} left</span>` : ""}</div>
        ${e.block ? `<div class="tilewhy" role="note"><b>Can't use this right now</b><span>${esc(e.block)}</span></div>` : ""}
        ${text}${e.cost !== "Passive" && !e.detail ? `<p class="sub2" style="margin-top:10px">Action type is read from the text.</p>` : ""}`;
      return modalShell(e.name, body, `<button class="btn" data-a="closeModal">Done</button>${isOn ? `<button class="btn pri" data-a="toggleActive">End</button>` : usable ? `<button class="btn pri" data-a="tileUse" ${e.block ? "disabled" : ""}>${canToggle ? "Activate" : verb}</button>` : ""}`);
    }

    case "swap": {
      const ws = weaponsOf(c), cur = wieldedId(c);
      const rows = ws.map(it => {
        const w = it.weapon, n = weaponNumbers(w, c);
        return `<button class="optcard" data-a="swapTo" data-id="${esc(it.id)}" ${it.id === cur ? "disabled" : ""}>
          <span class="grow"><b>${esc(it.name)}${it.id === cur ? " (in hand)" : ""}</b><span>${fmtMod(n.toHit)} to hit \u00b7 ${esc(n.dice)}${n.dmgMod ? (n.dmgMod > 0 ? "+" : "") + n.dmgMod : ""} ${esc(String(w.dtype || "").toLowerCase())}</span></span></button>`;
      }).join("");
      return modalShell("Swap weapon", `<p class="sub2" style="margin-bottom:8px">Swapping weapons costs a Bonus Action. Only the held weapon attacks.</p><div class="optlist" style="margin-top:0">${rows}</div>`, `<button class="btn" data-a="closeModal">Cancel</button>`);
    }

    case "area": {
      const a = { shape: m.shape, r: +m.r || 0, size: +m.size || 0, len: +m.len || 0, wid: +m.wid || 0, h: +m.h || 0 };
      const mode = app.prefs.gridMode === "hex" ? "hex" : "square", st = areaStats(a, mode);
      return modalShell(describeArea(a),
        `<div class="seg" role="group" aria-label="Grid">${["square", "hex"].map(g => `<button data-a="areaMode" data-mode="${g}" aria-pressed="${mode === g}">${g === "hex" ? "Hex" : "Square"}</button>`).join("")}</div>
         <div class="areabox">${areaSvg(a, mode)}</div>
         <p class="sub2 areacap">${esc(originNote(a))}. Each cell is 5 ft. About ${st.cells} cells${a.shape === "cylinder" ? `, ${a.h} ft tall` : ""}.</p>`,
        `<button class="btn pri" data-a="closeModal">Close</button>`);
    }
    case "matCost": {
      const sp = findByName(app.library.spells, m.name), mc = sp && matCost(sp), gp = (c.coins && c.coins.gp) || 0;
      if (!mc) return modalShell("Component", `<p>No cost</p>`, `<button class="btn pri" data-a="closeModal">Close</button>`);
      const ok = canPay(c, mc.gp);
      return modalShell(`${sp.name}: material`, `<div class="scribe">${spellIcon(sp, "big")}<dl class="kv"><dt>Component</dt><dd>${esc(mc.text)}</dd><dt>Price</dt><dd>${mc.gp.toLocaleString()}${mc.min ? "+" : ""} gp, used up</dd><dt>You have</dt><dd>${gp.toLocaleString()} gp</dd></dl></div>${ok ? "" : `<p class="small" style="color:var(--red)">Not enough coins</p>`}`,
        `<button class="btn" data-a="closeModal">Cancel</button><button class="btn" data-a="matGo" data-pay="0">I have it</button><button class="btn pri" data-a="matGo" data-pay="1" ${ok ? "" : "disabled"}>Pay ${mc.gp.toLocaleString()} gp</button>`);
    }
    case "spCompare": return renderCompare(app);
    case "spFilter": return renderFilterModal(app);
    case "spList": return renderListPreview(app, m.id);
    case "scribe": return modalShell("Scribe spells", renderScribe(app), `<button class="btn pri" data-a="closeModal">Done</button>`);
    case "scribeConfirm": return renderScribeConfirm(app, m);
    case "spPrep": return renderPrepModal(app);
    case "spLoadPrev": return renderLoadPreview(app, m.id);
    case "picker": {
      if (m.picker === "spells") return modalShell("Add spells", renderBrowserBody(app, detailFor), `<button class="btn pri" data-a="closeModal">Done</button>`, "spbrowse");
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
    case "install": return renderInstallIntro(app);
    case "storage": return renderStorage(app);
    case "trash": return renderTrash(app);
    case "confirmStyle": {
      const to = app._style === "advanced" ? "advanced" : "classic";
      return modalShell(`Switch to the ${to} sheet?`, `<p>Characters are not changed.</p>`,
        `<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="confirmStyle">Switch</button>`);
    }
    case "confirmAsk": {
      const a = app._ask || {};
      return modalShell(a.title || "Confirm", `<p>${esc(a.body || "")}</p>`, `<button class="btn" data-a="askNo">${esc(a.no || "Cancel")}</button><button class="btn pri" data-a="askYes">${esc(a.yes || "OK")}</button>`);
    }
    case "confirmClass": {
      const c = app._cls || {};
      const title = c.how === "all" ? "Random character?" : "Change class?";
      const body = c.how === "all" ? `<p>This replaces every choice you made.</p>`
        : `<p><b>${esc(c.from || "")}</b> becomes ${c.how === "random" ? "a random class" : `<b>${esc(c.to || "")}</b>`}.</p><p class="sub2">Class skills, gear and choices reset.</p>`;
      return modalShell(title, body, `<button class="btn" data-a="cancelClass">Keep ${c.how === "all" ? "mine" : esc(c.from || "it")}</button><button class="btn pri" data-a="confirmClass">${c.how === "all" ? "Replace" : "Change class"}</button>`);
    }
    case "confirmRemove": {
      const r = app._rm || {};
      const note = r.what === "spell" ? "It leaves your spell list. You can add it back any time from Add spells."
        : r.what === "note" ? "It is deleted from this device. A backup keeps older copies." : r.what === "feat" ? "It comes off your sheet. Bonuses it already gave, such as ability points or hit points, are not undone." : "";
      return modalShell(`Remove ${r.name || "this"}?`, `<p>Are you sure you want to remove <b>${esc(r.name || "this")}</b>?</p><p class="sub2">${esc(r.note || note)}</p>`,
        `<button class="btn" data-a="cancelRemove">Keep it</button><button class="btn danger" data-a="confirmRemove">Remove</button>`);
    }
    case "customBg": return renderCustomBg(app);
    case "levelMenu": return renderLevelMenu(app);

    case "cxShop": return renderCxShop(app);
    case "applySpell": {
      const sp = findByName(app.library.spells, m.name);
      if (!hasFx(sp)) return "";
      const ups = upLevels(sp);
      const lvls = ups.length ? (m.lvl >= sp.level ? [m.lvl] : []).concat(ups.filter(l => l !== m.lvl)) : [];
      return modalShell(`Apply ${sp.name}`,
        `<p class="sub2" style="margin-bottom:10px">${esc(spellSummary(sp.effects))}${sp.conc ? " \u00b7 Concentration" : ""}</p>
         ${ups.length ? `<div class="optlist" style="margin-top:0">${lvls.map(l => `<button class="optcard" data-a="applySpellGo" data-lvl="${l}"><span class="grow"><b>Level ${l}</b><span>${esc(spellSummary(sp.effects.map(e => typeof e.v === "number" && e.up ? { ...e, v: e.v + e.up * (l - sp.level) } : e)))}</span></span></button>`).join("")}</div>`
         : `<button class="btn pri block" data-a="applySpellGo" data-lvl="${sp.level}">Apply to yourself</button>`}
         <button class="btn ghost block" style="margin-top:10px" data-a="closeModal">Not now</button>`);
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
         <button class="btn ghost block" style="margin-top:10px" data-a="castWith" data-lvl="0">Cast without slot</button>`);
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
        isPack(app, it) ? row("packOpen", { id: it.id }, "\u25a4 Contents") : "",
        consumable ? row("useItem", { id: it.id }, "✓ Use one") : "",
        it.attune ? row("ctxAttune", { id: it.id }, it.attuned ? "◇ End attunement" : "◆ Attune") : "",
        row("addHotbar", { kind: it.weapon ? "attack" : "item", id: it.id, close: "1" }, "➕ Add to hotbar"),
        `<div class="menu-row qtyrow"><span>Quantity</span><span class="stepper"><button data-a="qtyStep" data-id="${it.id}" data-n="-1" aria-label="One fewer">−</button><b>${it.qty}</b><button data-a="qtyStep" data-id="${it.id}" data-n="1" aria-label="One more">+</button></span></div>`,
        boxByName(it.name) && app.prefs.experimental ? row("askOpenBox", { box: boxByName(it.name).id }, "Open") : "",
        row("openItemEdit", { id: it.id }, "✎ Edit details"),
        row("removeItem", { id: it.id }, "🗑 Drop", "danger")
      ].filter(Boolean).join("");
      return modalShell(it.name, `${ref?.text ? `<p class="sub2" style="margin-bottom:10px">${esc((ref.text.split("\n")[0] || "").slice(0, 120))}</p>` : ""}<div class="menu-list">${items}</div>`,
        `<button class="btn" data-a="closeModal">Close</button>`);
    }

    case "debugOn": return modalShell("Debug mode", `<div class="stack"><p class="sub2">Debug numbers skip the rules and stay until cleared.</p><p class="sub2">A full backup downloads first.</p></div>`, `<button class="btn" data-a="closeModal">Cancel</button><button class="btn danger" data-a="debugOnGo">Back up, enable</button>`);

    case "lootConfirm": {
      const b = boxById(m.box);
      if (!b) return "";
      return modalShell("Open " + b.name, `<p>One ${esc(b.name)} is used up.</p>${oddsList(b)}`,
        `<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="confirmOpenBox">Open</button>`);
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

    case "shopItem": { const r = shopItemModal(app, c, m); return modalShell(r.title, r.body, r.foot); }
    case "jump": return renderJump(app);
    case "phys": return modalShell("Physical traits", `<div class="phys-grid">${PHYS.map(([k, l, ph]) => `<label class="phys-f"><span>${l}</span><input class="f" data-phys="${k}" value="${esc((c.phys || {})[k] || "")}" placeholder="${esc(ph)}" maxlength="40" autocomplete="off"></label>`).join("")}</div>`, `<button class="btn pri" data-a="closeModal">Done</button>`);
    case "sheetLayout": { const r = layoutModal(app); return modalShell(r.title, r.body, r.foot); }
    case "ftFilter": { const r = ftFilterModal(app); return modalShell(r.title, r.body, r.foot); }
    case "shopFilter": { const r = shopFilterModal(app, c); return modalShell(r.title, r.body, r.foot); }
    case "shopLists": { const r = shopListsModal(app, c, m); return modalShell(r.title, r.body, r.foot); }
    case "shopListName": { const r = shopListNameModal(app, c, m); return modalShell(r.title, r.body, r.foot); }
    case "wallet": {
      const d = m.d || {}, net = netCp(d), next = applyDeltas(c.coins, d), any = Object.values(d).some(v => parseInt(v, 10));
      const sign = v => { const n = parseInt(v, 10) || 0; return n > 0 ? "pos" : n < 0 ? "neg" : ""; };
      const rows = COIN_INFO.map(([k, nm, col]) => `<div class="wal-row ${sign(d[k])}"><div class="wal-id"><i class="disc" style="--c:${col}" aria-hidden="true"></i><span><b>${k.toUpperCase()}</b><em>${nm}</em></span></div>
        <span class="wal-have">${c.coins[k] || 0}</span>
        <div class="wal-ctl"><button class="iconbtn" data-a="walStep" data-k="${k}" data-s="-1" aria-label="Remove ${nm.toLowerCase()}">\u2212</button><input class="f num" inputmode="text" autocomplete="off" placeholder="0" data-wal="${k}" value="${esc(d[k] || "")}" aria-label="${nm} change"><button class="iconbtn" data-a="walStep" data-k="${k}" data-s="1" aria-label="Add ${nm.toLowerCase()}">+</button></div></div>`).join("");
      const fmt = k => COIN_INFO.filter(([x]) => (k[x] || 0) > 0).map(([x]) => `${k[x]} ${x}`).join(" \u00b7 ") || "nothing";
      const body = `<div class="stack"><div class="wal-head"><span></span><span>Have</span><span>Change</span></div>${rows}
        <div class="wal-step"><span>Step</span><div class="seg" role="group">${[1, 5, 10, 50, 100].map(x => `<button data-a="walSize" data-v="${x}" aria-pressed="${m.step === x}">${x}</button>`).join("")}</div></div>
        <div class="wal-sum"><span>Net</span><b class="net ${net > 0 ? "pos" : net < 0 ? "neg" : ""}">${esc(fmtNet(net))}</b><span>After</span><b class="${next ? "" : "neg"}">${any ? (next ? esc(fmt(next)) : "Not enough coins") : esc(fmt(c.coins))}</b></div></div>`;
      return modalShell("Coins", body, `<button class="btn" data-a="${any ? "walClear" : "closeModal"}">${any ? "Reset" : "Cancel"}</button><button class="btn pri" data-a="walGo" ${any && next ? "" : "disabled"}>Apply</button>`);
    }

    case "pack": {
      const it = itemById(c, m.id); if (!it) return "";
      return modalShell(it.name, m.adding ? packAddBody(app, c, it) : packBody(app, c, it), m.adding ? `<button class="btn" data-a="packAdd" data-id="${esc(it.id)}">Back</button>` : `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "loadouts": {
      const ls = loadoutsOf(c), acNow = computeAC(c).total;
      const rows = ls.map(l => { const on = isActive(c, l), p = loadoutPlan(c, l), dlt = p.acNew - acNow;
        return `<button class="optcard" data-a="loadoutOpen" data-id="${esc(l.id)}" aria-pressed="${on}"><span class="grow"><b>${esc(l.name)}</b><span>${on ? "Equipped now" : `${p.changes.length} change${p.changes.length === 1 ? "" : "s"}`}</span></span><span class="acprev ${on ? "" : dlt > 0 ? "up" : dlt < 0 ? "dn" : ""}">AC ${p.acNew}</span></button>`; }).join("");
      return modalShell("Loadouts", `${rows ? `<div class="optlist" style="margin-top:0">${rows}</div>` : `<p class="muted small">No saved loadouts.</p>`}`, `<button class="btn" data-a="closeModal">Close</button><button class="btn pri" data-a="loadoutSaveOpen">Save current gear</button>`);
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
          const eq2 = { ...c.equipment }; Object.keys(eq2).forEach(s => { if (eq2[s] === it.id && (it.qty || 1) <= 1) delete eq2[s]; }); eq2[m.slot] = it.id;
          const acNow = computeAC(c).total, acNew = computeAC({ ...c, equipment: eq2, inventory: c.inventory.map(x => x.id === it.id && x.attune && !x.attuned && attunedCount(c) < 3 ? { ...x, attuned: true } : x) }).total;
          return `<button class="optcard" data-a="equipHere" data-id="${it.id}" data-slot="${m.slot}"><span class="grow"><b>${esc(it.name)}</b><span class="acprev ${acNew > acNow ? "up" : acNew < acNow ? "dn" : ""}">${acNew === acNow ? "AC " + acNow : "AC " + acNow + " \u2192 " + acNew}</span>
            <span>${k ? ((it.qty || 1) > slotsOf(c, it.id).length ? "Equip another (" + (slotsOf(c, it.id).length + 1) + " of " + (it.qty || 1) + ")" : "Move from " + esc(SLOTS.find(s => s.key === k).label.toLowerCase())) : it.attune && !it.attuned ? "Needs attunement" : "Equip"}</span></span></button>`;
        }).join("") || `<p class="muted small">No matching items.</p>`}</div>`;
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

    case "confirmUse": {
      const e = findTile(app, c, deriveCharacter(c), m.id);
      if (!e) return modalShell("Not found", "", `<button class="btn" data-a="closeModal">Done</button>`);
      const cost = e.cost === "Bonus" ? "Bonus Action" : e.cost === "Action" ? "Action" : e.cost === "Reaction" ? "Reaction" : "";
      const r = e.res, after = r ? r.cur - 1 : 0;
      return modalShell(`Use ${e.name}?`,
        `<p>This spends <b>1 use</b> of ${esc(e.name)}.${r ? ` You have <b>${r.cur} of ${r.max}</b> left, so <b>${after}</b> after this.` : ""}</p>${cost ? `<p class="sub2">It also uses your ${cost}.</p>` : ""}`,
        `<button class="btn" data-a="closeModal">Cancel</button><button class="btn pri" data-a="confirmUseGo">Use ${esc(e.name)}</button>`);
    }

    case "delevel": {
      const hasUndo = (c.levelLog || []).some(e => e.level === c.level && e.undo);
      return modalShell(`Remove level ${c.level}?`,
        `<p>Undoes its HP, feats, ability increases and choices.</p>${hasUndo ? "" : `<p class="sub2">HP uses the average die.</p>`}`,
        `<button class="btn" data-a="closeModal">Cancel</button><button class="btn danger" data-a="confirmDelevel">Remove level</button>`);
    }

    case "died": {
      const who = esc(c.name);
      if (!c.dead) return modalShell(`Mark ${c.name} as dead?`,
        `<p>${who} goes to the Graveyard.</p>
         <label class="field"><span class="lab">How did they die? (optional)</span><input class="f" id="f-cause" maxlength="300" autocomplete="off" placeholder="Where, and to what"></label>`,
        `<button class="btn" data-a="closeModal">Not dead</button><button class="btn pri" data-a="confirmDead">Lay to rest</button>`);
      return `<div class="modal-back diedback" data-a="closeModalBackdrop"><div class="modal diedmodal" role="dialog" aria-modal="true" aria-label="${who} has fallen">
        <div class="diedscene">
          <div class="dstone" aria-hidden="true"><span>R.I.P.</span></div>
          <h2 class="dname">${who}</h2>
          <p class="dfall">has fallen</p>
          <p class="dmeta">Level ${esc(c.level)} ${esc(c.species)} ${esc(c.class)}${c.subclass ? " \u00b7 " + esc(c.subclass) : ""}</p>
          <label class="field dcause"><span class="lab">How did they die? (optional)</span><input class="f" id="f-cause" maxlength="300" autocomplete="off" value="${esc(c.dead.cause || "")}" placeholder="Where, and to what"></label>
          <button class="btn pri dbtn" data-a="confirmDead">Rest in peace</button>
          
        </div></div></div>`;
    }
    case "revive": {
      return modalShell("Bring them back?", `<p>${m.name ? esc(m.name) : "This character"} returns at 1 HP. Death saves cleared.</p>`,
        `<button class="btn" data-a="closeModal">Stay buried</button><button class="btn pri" data-a="reviveGo">Revive</button>`);
    }

    case "longRest": {
      const sel = m.sel || {}, have = rationsHave(c), need = m.need != null ? m.need : rationsNeed(c), short = have < need;
      const opts = restOptions(app.library, c, allWeapons(app.library, app.campaign));
      const row = o => {
        if (o.kind === "pick") {
          const cur = sel[o.id] || o.current;
          return `<div class="lrrow"><p class="lab">${esc(o.label)}</p>
            <div class="seg wrap" role="group" aria-label="${esc(o.label)}">${o.options.map(x => `<button data-a="lrPick" data-id="${o.id}" data-v="${esc(x.v)}" aria-pressed="${cur === x.v}">${esc(x.v)}</button>`).join("")}</div>
            <p class="sub2">${cur ? esc((o.options.find(x => x.v === cur) || {}).hint || "") : "Nothing chosen yet. If you leave this, one is picked at random."}</p></div>`;
        }
        if (o.kind === "swap") {
          const opt = (list, val, blank) => `<option value="">${blank}</option>${list.map(n => `<option ${val === n ? "selected" : ""}>${esc(n)}</option>`).join("")}`;
          return `<div class="lrrow"><p class="lab">${esc(o.label)} <span class="sub2">(optional: change one)</span></p>
            <div class="lrswap"><select class="f" data-modal-sel="mastery.drop" aria-label="Weapon to replace">${opt(o.have, sel["mastery.drop"], "Keep all: " + o.have.join(", "))}</select>
            <select class="f" data-modal-sel="mastery.add" aria-label="New weapon">${opt(o.choices, sel["mastery.add"], "Replace with...")}</select></div></div>`;
        }
        return `<div class="lrrow"><p class="lab">${esc(o.label)}</p><p class="sub2">${esc(o.text)}</p><button class="btn sm" data-a="${o.action}">${esc(o.button)}</button></div>`;
      };
      return modalShell("Take a long rest?",
        `<div class="lrrat"><div class="rowline"><span class="nm">Rations in your pack</span><span class="val">${have}</span></div>
           <div class="rowline"><span class="nm">This rest uses</span><span class="stepper"><button data-a="lrNeed" data-n="-1" aria-label="Use fewer rations" ${need <= 0 ? "disabled" : ""}>\u2212</button><b>${need}</b><button data-a="lrNeed" data-n="1" aria-label="Use more rations" ${need >= 9 ? "disabled" : ""}>+</button></span></div>
           ${short ? `<p class="sub2 lrwarn">Not enough rations: you have ${have} and this rest needs ${need}. Lower the number if your table allows it, or add rations to your pack.</p>` : ""}</div>
         ${opts.length ? `<h3 class="lrh">Long rest options</h3>${opts.map(row).join("")}` : ""}
         <p class="sub2" style="margin-top:12px">Restores HP, slots, Hit Dice, counters. Exhaustion -1.</p>`,
        `<button class="btn" data-a="closeModal">Go back</button><button class="btn pri" data-a="confirmLongRest" ${short ? "disabled" : ""}>Long rest</button>`);
    }

    case "conditions": return renderEffectsModal(app, c);

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
        `<p class="sub2" style="margin-top:12px">Custom bonuses: Edit character.</p>`,
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
            <div class="field"><label>Level ${c.level}</label><div class="btnrow" style="margin:0">${c.level > 1 ? `<button class="btn sm" style="white-space:nowrap" data-a="askDelevel">Lower</button>` : ""}${c.level < 20 ? `<button class="btn sm" style="white-space:nowrap" data-a="startLevelUp">Level up</button>` : ""}</div></div>
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
          <p class="lab" style="margin-top:6px">Feats</p>
          <div class="rowline" style="border:0"><span class="nm">${c.feats.length} on the sheet</span><button class="btn sm" data-a="openPicker" data-picker="feats">Add feat</button></div>
          <p class="sub2">Adds the name only. Level up applies ability increases and choices.</p>
          ${app.prefs.debug ? (() => { const dv = deriveCharacter(c), si = dv.spellInfo, set = (c.custom || []).filter(x => x.kind === "debug").length;
            const row = (t, l, v) => v == null ? "" : `<div class="field"><label>${l}</label><input class="f num" type="number" inputmode="numeric" data-dbg="${t}" value="${v}"></div>`;
            return `<p class="lab" style="margin-top:6px">Debug: set final numbers</p><div class="grid2">${row("ac", "Armor Class", dv.ac)}${row("speed", "Speed (ft)", dv.speed)}${row("init", "Initiative", dv.initiative)}${row("hp.max", "Hit point max", c.hp.max)}${row("pp", "Passive Perception", dv.passivePerception)}${row("spell.dc", "Spell save DC", si && si.dc)}${row("spell.atk", "Spell attack", si && si.attackBonus)}</div>
            <button class="btn block" data-a="debugClear" ${set ? "" : "disabled"}>Clear debug changes${set ? " (" + set + ")" : ""}</button>`; })() : ""}
          <p class="lab" style="margin-top:6px">Custom bonuses</p>
          ${(c.custom || []).map(x => `<div class="rowline"><span class="nm">${esc(x.label || "Custom")} <span class="sub2">${esc((FX_TARGETS.find(t => t[0] === x.t) || [0, x.t])[1])}</span></span><b>${x.v > 0 ? "+" : ""}${x.v}</b><button class="iconbtn" data-a="customRemove" data-id="${esc(x.id)}" aria-label="Remove ${esc(x.label || "bonus")}">${ICONS.close}</button></div>`).join("")}
          <div class="grid3" style="grid-template-columns:1.4fr .7fr 1fr;gap:8px;align-items:end">
            <div class="field"><label for="cb-t">Changes</label><select class="f" id="cb-t">${FX_TARGETS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></div>
            <div class="field"><label for="cb-v">By</label><input class="f num" id="cb-v" type="number" inputmode="numeric" value="1"></div>
            <div class="field"><label for="cb-l">Label</label><input class="f" id="cb-l" maxlength="24" placeholder="Why"></div>
          </div>
          <button class="btn block" data-a="customAdd">Add bonus</button>
          <button class="btn block" data-a="openBreakdown">Breakdown</button>
          <div class="panel" style="margin-top:10px"><div class="panel-body stack">
            <button class="btn block" data-a="downloadPdf">Download character sheet (PDF)</button>
            <button class="btn block" data-a="exportOne">Export character</button>
            <button class="btn block" data-a="dmSendOpen">Send to DM</button>
            ${c.dead ? "" : `<button class="btn block" data-a="markDeadAsk">Mark as dead</button>`}
            <button class="btn danger block" data-a="askDelete">Delete character</button>
          </div></div>
        </div>`,
        `<button class="btn pri" data-a="closeModal">Done</button>`);
    }

    case "dmRow": case "dmCreature": case "dmSend": case "dmMon": case "dmCamps": case "dmCampName":
      return renderDmModal(app);

    case "settings":
      return renderSettingsModal(app);

    case "changelog":
      return renderChangelogModal(app);

    case "badges": return renderBadges(app);
    case "levelUp": return renderLevelUp(app);
    case "nbDiscard": return renderDiscard(app);
    case "whatsNew": return renderWhatsNew(app);
    case "contentUpdate":
      return renderContentUpdate(app);

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
          ${hp.cur <= 0 ? `<p class="small muted">At 0 HP: damage adds a death-save failure, healing restores you.</p>` : ""}
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

// ---- delete: one clear confirmation (the toast afterwards offers Undo)
function renderConfirmDelete(app) {
  const n = esc(app.char.name), shown = esc(String(app.char.name || "Unnamed").slice(0, 40));
  return modalShell(`Delete ${app.char.name}?`,
    `<p>Removes ${n}. Restorable for 30 days.</p>
     <button class="btn block" data-a="exportOne">Save a copy first</button>
     <label class="field" style="display:block;margin-top:12px"><span class="sub2">Type ${shown} to confirm</span>
       <input class="f" id="del-name" data-del-name autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Character name"></label>`,
    `<button class="btn" data-a="cancelDelete">Keep</button><button class="btn danger" id="del-go" data-a="deleteChar" disabled>Delete</button>`);
}

function renderInstallIntro(app) {
  const i = installInfo();
  const line = [i.device, i.browser].filter(x => x && x !== "this device" && x !== "your browser").join(" \u00b7 ");
  const body = `<div class="stor">${line ? `<p class="sub2">${esc(line)}</p>` : ""}<div class="installcard">${installBody(i)}</div></div>`;
  return modalShell("Install The Sheet", body, `<button class="btn pri" data-a="installAck">${i.canPrompt && !i.inApp ? "Not now" : "Done"}</button>`, "stormodal");
}

function renderStorage(app) {
  const r = storageReport(app), first = !!app.modal.first, has = listCharacters().length > 0;
  const body = `<div class="stor">
    <p class="stor-lede">${esc(COPY.lede)}</p>
    <div class="stor-risk risk-${r.level}"><span class="tag risk-tag">${esc(r.label)}</span><b>${esc(r.headline)}</b><span class="sub2">${esc(r.line)}</span></div>
    ${first ? "" : r.why.map(t => `<p>${esc(t)}</p>`).join("")}
    <h3>${esc(COPY.steps)}</h3>
    <ol class="stor-steps">${r.steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol>
    ${!r.info.standalone && !r.info.ios && !r.info.memory ? installCard(app, { inSettings: true }) : ""}
    ${first ? `<details class="stor-more"><summary>Details</summary>${r.why.map(t => `<p>${esc(t)}</p>`).join("")}` : ""}
    <h3>${esc(COPY.erase)}</h3>
    <ul class="stor-erase">${r.erase.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    <p class="stor-close">${esc(COPY.close)}</p>${first ? "</details>" : ""}
    <p class="sub2">Browser protection: ${r.persisted ? "On" : "Off"} \u00b7 Last backup: ${esc(backupAge(app.prefs.lastBackup))}</p>
  </div>`;
  const foot = (has ? `<button class="btn" data-a="exportAll">Back up now</button>` : "") + (first ? `<button class="btn pri" data-a="storageAck">I understand</button>` : `<button class="btn pri" data-a="closeModal">Done</button>`);
  return modalShell(COPY.title, body, foot, "stormodal");
}

function renderTrash(app) {
  const list = trashList(), now = Date.now();
  const rows = list.map(e => { const c = e.char; return `<div class="rowline"><span class="nm" style="flex-direction:column;align-items:flex-start;gap:0"><span>${esc(c.name || "Unnamed")}</span><span class="sub2">${esc([`Level ${c.level || 1}`, c.species, c.class].filter(Boolean).join(" "))} \u00b7 ${daysLeft(e, now)} days left</span></span><button class="btn sm" data-a="trashRestore" data-id="${esc(c.id)}">Restore</button></div>`; }).join("");
  return modalShell("Recently deleted", list.length ? `<div class="panel"><div class="panel-body flush">${rows}</div></div>` : `<p class="sub2">Nothing deleted.</p>`, `<button class="btn pri" data-a="closeModal">Done</button>`);
}

function renderCustomBg(app) {
  const cb = app.customBg, err = customValid(cb);
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(label || v)}</option>`;
  const feats = enabledFeats(app.library, app.campaign).filter(f => /^Origin/i.test(f.type || "")).sort((a, b) => a.name.localeCompare(b.name));
  const reals = app.library.backgrounds.filter(b => !b.custom).sort((a, b) => a.name.localeCompare(b.name));
  const mine = loadCustom();
  return modalShell("Custom background",
    `
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
  if (c.level >= 20) return modalShell("Max level", `<p>${esc(c.name)} is level 20.</p>`, `<button class="btn pri" data-a="closeModal">Done</button>`);
  const next = c.level + 1, need = xpForLevel(next), have = c.xp || 0, mode = c.levelMode || "xp";
  const enough = have >= need, pct = Math.max(0, Math.min(100, Math.round((have - xpForLevel(c.level)) / Math.max(1, need - xpForLevel(c.level)) * 100)));
  const n = v => Number(v).toLocaleString();
  const body = `<div class="seg" role="group" aria-label="How do you level up?">
      <button data-a="lvlMode" data-v="xp" aria-pressed="${mode === "xp"}">Experience points</button>
      <button data-a="lvlMode" data-v="milestone" aria-pressed="${mode === "milestone"}">Milestone</button></div>
    ${mode === "xp" ? `<p style="margin-top:12px"><b class="num">${n(have)}</b> XP in total. Level ${next} starts at <b class="num">${n(need)}</b>.</p>
      <div class="hpbar" style="height:10px;margin:8px 0;border-radius:5px;background:var(--panel2);overflow:hidden"><div style="height:100%;width:${enough ? 100 : pct}%;background:var(--amber)"></div></div>
      <p class="sub2">${enough ? `You have enough XP for level ${next}.` : `The bar is your progress through level ${c.level}: ${n(Math.max(0, have - xpForLevel(c.level)))} of ${n(need - xpForLevel(c.level))} XP. ${n(need - have)} to go.`}</p>
      <div class="field" style="margin-top:12px"><label>Add XP</label>
        <div style="display:flex;gap:8px"><input class="f" id="xp-add" type="number" inputmode="numeric" min="0" placeholder="e.g. 450" style="flex:1" aria-label="XP to add"><button class="btn" data-a="addXp">Add</button></div></div>
      <div class="field"><label>Set total XP</label>
        <div style="display:flex;gap:8px"><input class="f" id="xp-set" type="number" inputmode="numeric" min="0" value="${have}" style="flex:1" aria-label="Total XP"><button class="btn" data-a="setXp">Set</button></div></div>`
    : `<p style="margin-top:12px">Level ${next}. XP set to ${n(need)}.</p>`}`;
  const foot = `<button class="btn" data-a="closeModal">Not yet</button><button class="btn pri" data-a="startLevelUp" ${mode === "xp" && !enough ? "disabled" : ""}>Level up to ${next}</button>`;
  return modalShell("Level up", body, foot);
}
