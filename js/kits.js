// Ready-made loadouts the shop sells: a set of ordinary shop items bought together at full price. ASCII only.
// Names are looked up in the shop stock; a name the rules file does not sell is left out.
export const KITS = [
  { id: "vanguard", name: "Vanguard Kit", blurb: "Heavy armor, blade and shield", items: [["Chain Mail", 1], ["Shield", 1], ["Longsword", 1], ["Handaxe", 2], ["Javelin", 4], ["Dungeoneer's Pack", 1]] },
  { id: "skirmisher", name: "Skirmisher Kit", blurb: "Light armor, rapier and bow", items: [["Studded Leather Armor", 1], ["Rapier", 1], ["Shortbow", 1], ["Arrows", 20], ["Quiver", 1], ["Thieves' Tools", 1], ["Burglar's Pack", 1]] },
  { id: "arcanist", name: "Arcanist Kit", blurb: "Spellbook, pouch and a staff", items: [["Quarterstaff", 1], ["Dagger", 1], ["Component Pouch", 1], ["Spellbook", 1], ["Robe", 1], ["Scholar's Pack", 1]] },
  { id: "wayfarer", name: "Wayfarer Kit", blurb: "Ranger or druid on the road", items: [["Leather Armor", 1], ["Shield", 1], ["Shortsword", 1], ["Shortbow", 1], ["Arrows", 20], ["Quiver", 1], ["Herbalism Kit", 1], ["Explorer's Pack", 1]] },
  { id: "devotee", name: "Devotee Kit", blurb: "Medium armor, mace and healing", items: [["Chain Shirt", 1], ["Shield", 1], ["Mace", 1], ["Healer's Kit", 1], ["Holy Water", 1], ["Priest's Pack", 1]] },
  { id: "performer", name: "Performer Kit", blurb: "Leather, rapier and a lute", items: [["Leather Armor", 1], ["Rapier", 1], ["Dagger", 1], ["Lute", 1], ["Disguise Kit", 1], ["Entertainer's Pack", 1]] }
];

// Shop rows for the kits: price = every found item at its own price x quantity.
export function kitRows(stock, priceOf) {
  const by = new Map(stock.map(r => [r.name, r]));
  return KITS.map(k => {
    const parts = k.items.map(([n, q]) => ({ name: n, qty: q, row: by.get(n) })).filter(p => p.row);
    const gp = parts.reduce((t, p) => t + Math.round(priceOf(p.row) * 100) * p.qty, 0) / 100;
    return { name: k.name, gp, cat: "Loadouts", group: "Loadouts", kit: k.id, sub: k.blurb, parts };
  }).filter(r => r.parts.length);
}
