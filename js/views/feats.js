// Feat picker (medallion grid). Used for the feat choice at an ability-score level and for fighting styles.
// Two columns of round-icon cards; tap one for a sheet with the full rules text split into its benefits.
// Book text is shown exactly as stored. The Trait / Ability tag is the app's reading. ASCII only.
import { esc, formatText } from "../ui.js";
import { classifyText } from "../species.js";

const ICON = {
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z",
  book: "M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3z M8 4v13",
  heart: "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z",
  tool: "M14 6a4 4 0 00-5 5L3 17l4 4 6-6a4 4 0 005-5l-3 3-3-1-1-3z",
  sword: "M5 19L19 5M14 5h5v5M7 14l3 3M4 20l3-3",
  shield: "M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z",
  wand: "M4 20L15 9M13 5l1.5-2M17 7l2-1M19 11l2 .5M15 9l2 2",
  arrow: "M4 12h14M13 6l6 6-6 6",
  bow: "M6 4c8 2 12 8 12 16M6 4l12 16M6 4v4M6 4h4",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5z",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"
};
const svg = (d, s, w = 1.6, col = "currentColor") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const chev = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

export const featUiDefault = () => ({ sort: "az", type: "All", open: null, tOpen: new Set() });
const uiOf = app => app.featUi || (app.featUi = featUiDefault());

// Icon is the app's own pick from the feat's name and type, never from book text.
export function featIcon(f) {
  const n = (f.name + " " + (f.type || "")).toLowerCase();
  const rules = [
    [/epic boon/, "crown"], [/archer|crossbow|sharpshooter|ranged|thrown|bow/, "bow"],
    [/shield|armor|defen|sentinel|protect|dueling|blind/, "shield"], [/lucky|fate|chance/, "star"],
    [/alert|observant|perception|sight/, "eye"], [/tough|heal|resilien|durable|hit point/, "heart"],
    [/alchem|poison|potion/, "flask"], [/mobile|speed|charger|athlete|dash|skulker/, "arrow"],
    [/magic|spell|caster|ritual|telekin|telepath|fey|shadow|elemental|initiate|adept|wizard/, "wand"],
    [/skill|crafter|tool|expert|linguist|actor|musician/, "tool"], [/lore|scholar|book|linguist/, "book"],
    [/weapon|master|slayer|fighting|combat|dual|polearm|savage|grappler|brawler|crusher|piercer|slasher/, "sword"]
  ];
  for (const [re, k] of rules) if (re.test(n)) return ICON[k];
  return ICON.bolt;
}

export const typeLabel = f => {
  const t = (f.type || "").replace(/\s*\(.*$/, "").trim();
  return t.replace(/\s+Feat$/i, "") || "Feat";
};
export function prereqLabel(f) {
  const m = /\((?:Prerequisites?):\s*(.*)\)\s*$/i.exec(f.type || "");
  if (!m) return "No prerequisite";
  return m[1].split(/[,;]\s*/).map(s => s.trim()).filter(Boolean).join(" · ");
}

// Split "Intro. Name. text\n\nName. text" into benefits, exactly as written.
export function parseFeat(f) {
  const paras = String(f.text || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const benefits = [];
  let intro = "", asi = "";
  for (const p of paras) {
    const m = /^([A-Z][A-Za-z'’ \-]{1,40})\.\s+([\s\S]+)$/.exec(p);
    if (m) {
      if (/^Ability Score Increase$/i.test(m[1])) asi = m[2].split(/(?<=\.)\s/)[0];
      benefits.push({ name: m[1], body: m[2], ...classifyText(m[2]) });
    } else if (!benefits.length && /benefits?\.?$/i.test(p)) intro = p;
    else if (benefits.length) benefits[benefits.length - 1].body += "\n\n" + p;
    else benefits.push({ name: f.name, body: p, ...classifyText(p) });
  }
  if (!benefits.length) benefits.push({ name: f.name, body: f.text || "", ...classifyText(f.text || "") });
  return { intro, asi, benefits };
}

// items: [{ f, ok, why }]
export function renderFeatControls(app, items) {
  const u = uiOf(app);
  const types = [...new Set(items.map(i => typeLabel(i.f)))];
  const sources = new Set(items.map(i => i.f.source || ""));
  const showType = types.length > 1;
  return `<div class="sp-controls" style="margin-top:12px">
    <label class="sp-sel"><span>Sort by</span>
      <select class="f" data-a="featSort" aria-label="Sort feats">
        <option value="az" ${u.sort === "az" ? "selected" : ""}>A to Z</option>
        ${showType ? `<option value="type" ${u.sort === "type" ? "selected" : ""}>Type</option>` : ""}
        ${sources.size > 1 ? `<option value="source" ${u.sort === "source" ? "selected" : ""}>Source</option>` : ""}
        <option value="open" ${u.sort === "open" ? "selected" : ""}>Available first</option>
      </select></label>
    ${showType ? `<label class="sp-sel"><span>Type</span>
      <select class="f" data-a="featType" aria-label="Filter by type">
        <option value="All">All types</option>
        ${types.map(t => `<option value="${esc(t)}" ${u.type === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
      </select></label>` : ""}
  </div>`;
}

function visible(app, items) {
  const u = uiOf(app);
  const q = (app.lvl && app.lvl.query || "").trim().toLowerCase();
  const list = items.filter(i => (u.type === "All" || typeLabel(i.f) === u.type) && (!q || i.f.name.toLowerCase().includes(q)));
  const by = (a, b) => a.f.name.localeCompare(b.f.name);
  list.sort((a, b) => u.sort === "type" ? typeLabel(a.f).localeCompare(typeLabel(b.f)) || by(a, b)
    : u.sort === "source" ? (a.f.source || "").localeCompare(b.f.source || "") || by(a, b)
    : u.sort === "open" ? (b.ok - a.ok) || by(a, b) : by(a, b));
  return list;
}

export function renderFeatGrid(app, items, selected) {
  const list = visible(app, items);
  if (!list.length) return `<p class="muted small" style="padding:12px 0">Nothing matches.</p>`;
  return `<p class="sub2 sp-count">${list.length} shown</p><div class="fgrid">${list.map(({ f, ok, why }) => {
    const on = selected === f.name;
    return `<button class="fcard ${on ? "on" : ""} ${ok ? "" : "locked"}" data-a="featOpen" data-name="${esc(f.name)}" aria-label="${esc(f.name)}${ok ? "" : ", not available yet"}">
      ${on ? `<span class="fchosen">CHOSEN</span>` : ""}
      <span class="fmed">${svg(featIcon(f), 34)}</span>
      <span class="fname">${esc(f.name)}</span>
      <span class="fchip">${esc(typeLabel(f))}</span>
      <span class="fpre">${esc(ok ? prereqLabel(f) : why || prereqLabel(f))}</span>
    </button>`;
  }).join("")}</div>`;
}

// The bottom sheet for the opened feat. pick = the app action that records the choice.
export function renderFeatSheet(app, items, selected, pick) {
  const u = uiOf(app);
  const it = u.open && items.find(i => i.f.name === u.open);
  if (!it) return "";
  const { f, ok, why } = it, p = parseFeat(f), on = selected === f.name;
  const benefits = p.benefits.map(b => {
    const key = f.name + ":" + b.name, open = u.tOpen.has(key), act = b.kind === "active";
    return `<div class="sp-trait ${open ? "open" : ""}">
      <button class="sp-tbtn" data-a="featBenefit" data-key="${esc(key)}" aria-expanded="${open}">
        <span class="grow"><b>${esc(b.name)}</b></span>
        <span class="flag ${act ? "act" : "pas"}">${act ? "Ability" : "Trait"}</span>
        <span class="chev">${chev}</span></button>
      ${open ? `<div class="about">${formatText(b.body)}</div>` : ""}</div>`;
  }).join("");
  return `<div class="modal-back" data-a="featCloseBackdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(f.name)}">
    <div class="modal-head fhead">
      <span class="fmed sm">${svg(featIcon(f), 28)}</span>
      <div class="grow"><h2>${esc(f.name)}</h2><div class="sub2">${esc(typeLabel(f))}${f.source ? " · " + esc(f.source) : ""}</div></div>
      <button class="iconbtn" data-a="featClose" aria-label="Close">&times;</button></div>
    <div class="modal-body">
      <div class="fchips"><span class="fpill">${esc(prereqLabel(f))}</span>${p.asi ? `<span class="fpill amber">${esc(p.asi)}</span>` : ""}</div>
      ${ok ? "" : `<p class="small" style="margin-top:10px;color:var(--amber)">Not available yet: ${esc(why || "")}</p>`}
      <div class="sp-sechead"><h3>Benefits</h3><span class="sub2">Tap one to read it</span></div>
      <div class="sp-traits">${benefits}</div>
    </div>
    <div class="modal-foot"><button class="btn pri block" data-a="featChoose" data-name="${esc(f.name)}" data-pick="${esc(pick)}" ${ok && !on ? "" : "disabled"}>${on ? "Chosen" : ok ? "Choose " + esc(f.name) : "Not available yet"}</button></div>
  </div></div>`;
}
