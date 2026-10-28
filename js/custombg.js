// Custom backgrounds (2024 rules): the player picks the three ability scores,
// an Origin feat, two skills and a tool. Saved on this device only and added to
// the background list as if they were part of the rules. ASCII only.
import { ABILITY_LABEL, ABILITIES, SKILLS } from "./rules.js";

const LS = "dnd-custom-bg-v1";
export const loadCustom = () => { try { const v = JSON.parse(localStorage.getItem(LS)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
export const saveCustom = list => { try { localStorage.setItem(LS, JSON.stringify(list)); return true; } catch (e) { return false; } };

export const blankCustom = () => ({ name: "", abilities: ["", "", ""], feat: "", skills: ["", ""], tool: "", equipFrom: "", about: "" });

export function customValid(cb) {
  const ab = cb.abilities.filter(Boolean), sk = cb.skills.filter(Boolean);
  if (!cb.name.trim()) return "Give it a name.";
  if (ab.length !== 3 || new Set(ab).size !== 3) return "Pick three different ability scores.";
  if (!cb.feat) return "Pick an Origin feat.";
  if (sk.length !== 2 || new Set(sk).size !== 2) return "Pick two different skills.";
  if (!cb.tool) return "Pick a tool proficiency.";
  return "";
}

export function backgroundFromCustom(cb, L) {
  const labels = cb.abilities.map(a => ABILITY_LABEL[a]);
  const skills = cb.skills.map(id => SKILLS.find(s => s.id === id)?.label).filter(Boolean);
  const from = (L.backgrounds || []).find(b => b.name === cb.equipFrom && !b.custom);
  const eq = (/Equipment:\s*([^\n]+)/.exec(from?.effect || "") || [])[1] || "Choose A or B: (A) 50 GP; or (B) 50 GP";
  return {
    name: cb.name.trim(), custom: true, source: "Custom", abilities: labels, skills, feat: cb.feat, tool: cb.tool,
    desc: cb.about || "A background you built yourself.",
    effect: `Ability Scores: ${labels.join(", ")}\n\nFeat: ${cb.feat}\n\nSkill Proficiencies: ${skills.join(", ")}\n\nTool Proficiency: ${cb.tool}\n\nEquipment: ${eq}`
  };
}

export function syncCustom(L) {
  if (!L || !Array.isArray(L.backgrounds)) return;
  const real = L.backgrounds.filter(b => !b.custom);
  const names = new Set(real.map(b => b.name));
  L.backgrounds = [...real, ...loadCustom().filter(cb => cb.name && !names.has(cb.name.trim()) && !customValid(cb)).map(cb => backgroundFromCustom(cb, L))];
}
