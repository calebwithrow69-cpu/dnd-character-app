// Version info and changelog. Add the newest release at the TOP of CHANGELOG
// and bump VERSION (and CACHE_VERSION in service-worker.js).
// ASCII only in this file.

export const VERSION = "0.1.23";
export const STAGE = "Pre-build";
export const TESTERS = "Caleb + 1 player";

export const CHANGELOG = [
  {
    v: "0.1.23",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Plainer wording, icon assists.",
    groups: [
      {
        title: "Changed",
        items: [
          "Play Mode: the turn tracker is now one button that reads Turn tracker: Off or Turn tracker: On, with no explanation text.",
          "Play Mode rows: ranged attacks show a bow and melee a sword; spells show their level in a badge, with C for concentration and R for ritual beside the name.",
          "Shorter, plainer wording across hints and empty states."
        ]
      }
    ]
  },
  {
    v: "0.1.22",
    date: "2026-10-30",
    stage: "Pre-build",
    blurb: "Death is final, sheet chooser, simpler Classic gear.",
    groups: [
      {
        title: "Changed",
        items: [
          "A dead character can no longer be touched: the whole sheet is locked until you press Revive, and the moment a third death save fails a dramatic death screen appears. Closing it, or editing the saves, cannot get around it.",
          "After you finish a new character the app always asks whether you want the Classic or Advanced sheet.",
          "Death saves now show the result only after the die has stopped rolling.",
          "Classic sheet Gear tab is now a plain list of items with weight and quantity, an Equipped strip on top, coins, and item details beside the list on wide screens. The paper doll stays on the Advanced sheet.",
          "New sheet header: a slim bar on phones, and a banner on laptops with HP, AC, speed, initiative and proficiency always in view."
        ]
      }
    ]
  },
  {
    v: "0.1.21",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "The Graveyard.",
    groups: [
      {
        title: "New",
        items: [
          "Characters can die. Fail a third death save (or choose Mark as dead in Edit character) and the app asks how they died. A dead character's sheet turns black and white with a banner and a Revive button.",
          "Dead characters leave your character list and rest in the new Graveyard (a button under your list). Each gets a tombstone with their name, level, species, class, subclass and cause of death. Tap a stone to open the sheet, or press Revive to bring them back at 1 hit point."
        ]
      }
    ]
  },
  {
    v: "0.1.20",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Fewer ways to cheat the action economy, and a smarter roll card.",
    groups: [
      {
        title: "New",
        items: [
          "Attacks now use up your Attack action: one swing for most characters, two with Extra Attack, three or four for a high-level Fighter. When the swings are gone the Action is spent (the off-hand attack with a second Light weapon takes your Bonus Action). Unarmed Strike shares the same limit.",
          "Abilities that spend a tracked use (Rage, Wild Shape, Action Surge, Lucky and so on) now ask first and tell you what they will spend and how many uses are left.",
          "The roll card tags every bonus with where it came from, like Rage +2 or Archery +2, and notes where a reroll changed a die.",
          "You can reroll a single damage die with Heroic Inspiration or Piercer, roll the damage twice and keep the better with Savage Attacker, and reroll a d20 with Heroic Inspiration or Halfling Lucky when you roll a 1. Goblin's Fury of the Small shows up as an extra damage option and has its own use tracker."
        ]
      },
      {
        title: "Changed",
        items: [
          "Abilities that switch on and off now have one button: Activate, then End. The separate power-symbol button is gone.",
          "Unarmed Strike is one attack. Claws, bites, horns, Tavern Brawler and the like replace the plain strike with the better version instead of adding a second row. Only a truly separate attack, like the Shifter's Longtooth, gets its own row.",
          "Level up: once you roll for hit points, the roll is locked in, even if you back out and come back.",
          "The heavy-hit sound is 25% quieter."
        ]
      }
    ]
  },
  {
    v: "0.1.19",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Attack and damage rolls now use your feats, features and species.",
    groups: [
      {
        title: "New",
        items: [
          "Unarmed Strike is now an attack of its own, with the options your character really has: Tabaxi, Khajiit and Leonin claws, Lizardfolk bite, Minotaur horns, Satyr ram, Dhampir bite, Shifter fangs, Tavern Brawler, Unarmed Fighting, and the Altered feat's Natural Weapons.",
          "Archery, Dueling, Great Weapon Fighting, Two-Weapon Fighting, Thrown Weapon Fighting, Close Combat Artillerist, Rage damage and Reckless Attack advantage now change your attack and damage rolls by themselves, and the roll card says where each bonus came from.",
          "Optional extras (a thrown weapon's bonus, Ardling's once-per-turn damage) show up as buttons on the roll card instead of being added for you."
        ]
      },
      {
        title: "Changed",
        items: [
          "The off-hand attack with a second Light weapon no longer adds your ability modifier to damage unless you have Two-Weapon Fighting (or it is negative), as the 2024 rules say.",
          "A Versatile weapon counts as one-handed and as two-handed when your other hand is empty, so Dueling and Great Weapon Fighting both apply to it. If you have both styles, only use the one that matches how you actually hold it."
        ]
      },
      { title: "Fixed", items: ["Action Surge no longer costs an action to use."] }
    ]
  },
  {
    v: "0.1.18",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "One-shot abilities no longer stay on.",
    groups: [
      {
        title: "Fixed",
        items: [
          "Action Surge, Second Wind and other one-shot abilities no longer stay switched on after you use them. Only abilities that last a while (Rage, Wild Shape and similar) get an on/off switch."
        ]
      }
    ]
  },
  {
    v: "0.1.17",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "A fuller rules engine underneath.",
    groups: [
      {
        title: "Changed",
        items: [
          "The effects engine now understands conditions (armor, shield, weapon in hand, attack type, toggles, health), formulas (levels, proficiency, ability scores, steps, if/else), set and better-of rules, advantage, rerolls, bonus dice and resistances.",
          "Unarmored Defense for Barbarian, Monk and Draconic Sorcery now comes from data instead of code. Armor Class results are the same."
        ]
      }
    ]
  },
  {
    v: "0.1.16",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Feats and features now change your numbers.",
    groups: [
      {
        title: "New",
        items: [
          "Effects engine: hit points, Armor Class, speed, initiative, saves and skills are worked out from your features, feats and species instead of being set once. Hearty, Tough, Alert, Defense, Speedy, Scout, Fast Movement, Unarmored Movement, Jack of All Trades, Draconic Resilience, Dwarven Toughness and Northern Toughness now apply.",
          "Existing characters are updated automatically. Tough was already counted; anything newly recognized (for example Hearty) is added on top.",
          "Edit character > Custom bonuses lets you add your own +/- to AC, speed, initiative, hit points, saves, skills and spells, and a screen that shows how HP, AC, speed and initiative are worked out. Tap Speed on the sheet for the same screen.",
          "Setting max HP by hand is kept as an adjustment on top of the calculated number."
        ]
      }
    ]
  },
  {
    v: "0.1.15",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Advanced sheet cleanup; proficiencies are read-only.",
    groups: [
      {
        title: "Changed",
        items: [
          "Armor and weapon training boxes can no longer be ticked by tapping. They show what your class gives you.",
          "Advanced > Rolls, Features and More use the same row style as Play, Spells and Gear. Features is grouped into Class, Species and background, and Feats, with no filter or sort controls.",
          "More: rests and Heroic Inspiration are in one panel, and the duplicate Roll initiative button is gone (use the header)."
        ]
      }
    ]
  },
  {
    v: "0.1.14",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Full-screen sheet choice, Classic sub-tabs, proficiency check boxes.",
    groups: [
      {
        title: "New",
        items: [
          "The sheet style choice is now a full screen with a side-by-side comparison. The swap lives in Edit character instead of the top of the sheet.",
          "The Classic sheet has sub-tabs (Sheet, Features, Spells, Equipment, Notes) instead of one long scroll.",
          "Armor and weapon training are check boxes. Older characters are converted automatically; tools and other training stay as text."
        ]
      }
    ]
  },
  {
    v: "0.1.13",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Everything for a character now lives on the Character screen.",
    groups: [
      {
        title: "New",
        items: [
          "Gear and Spells are no longer bottom tabs. The bottom bar is just Character and Rules.",
          "First time you open a character you pick a sheet style: Classic (the printed 2024 sheet on one page, recommended if it is familiar) or Advanced (tabs, Play Mode, loadouts, turn tracking). Switching later asks you to confirm.",
          "Classic now holds your spells and equipment on the same page, and has a search bar for skills, features, spells and items.",
          "Advanced sheet tabs: Play, Spells, Gear, Rolls, Features, More (tools and notes together)."
        ]
      }
    ]
  },
  {
    v: "0.1.12",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Loadouts and a new Gear screen for the Advanced sheet.",
    groups: [
      {
        title: "New",
        items: [
          "Advanced sheet > Gear is rebuilt: a status strip (carrying and attunement), saved loadouts, and your worn gear as rows. The Classic sheet keeps the doll.",
          "Loadouts remember what you are wearing and holding. Tapping one shows a preview of what changes and your new AC. Nothing changes until you press Equip loadout.",
          "Death saves, the hotbar and the Great Weapon Master switch now sit on Play Mode."
        ]
      },
      {
        title: "Removed",
        items: ["The Combat sub-tab on the Advanced sheet. Play Mode does everything it did."]
      }
    ]
  },
  {
    v: "0.1.11",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "One look for lists (first batch of the visual overhaul).",
    groups: [
      {
        title: "Changed",
        items: [
          "Attacks, your spell list, every pick list (spells, feats, weapon mastery, options, conditions) and the level-up New this level step now share the Play Mode look: icon tile, name, small caption, detail line, status and buttons on the right.",
          "Feats are a list instead of a card grid. Ones you cannot take yet are dimmed with the reason underneath.",
          "Section headings use one style everywhere."
        ]
      }
    ]
  },
  {
    v: "0.1.10",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Randomize on every choice screen.",
    groups: [
      {
        title: "New",
        items: [
          "Every class-choice screen (subclass, fighting style, expertise, weapon mastery, tool and option picks, cantrips, spells) has a Randomize button that fills just that screen. It works in creation and in level-up."
        ]
      }
    ]
  },
  {
    v: "0.1.9",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "Creation fixes.",
    groups: [
      {
        title: "Fixed",
        items: [
          "Surprise me now scrolls the chosen class, species or background into view.",
          "You can no longer continue past the cantrips step without picking them all. A Randomize cantrips button fills them in.",
          "The Update now bar no longer covers the page header while it is showing."
        ]
      }
    ]
  },
  {
    v: "0.1.8",
    date: "2026-10-29",
    stage: "Pre-build",
    blurb: "New look for character creation.",
    groups: [
      {
        title: "New",
        items: [
          "Creation has a chapter rail on the left and a live character sheet on the right (laptops). HP, Armor Class, speed, a radar of your ability scores, proficiencies, spells and features update as you choose. Phones show the same sheet under the chapter.",
          "Every class, species and background has its own emblem instead of a letter. Names without a drawing show a monogram. Your own uploaded portrait still replaces the emblem.",
          "The accent colour, the falling particles (leaves, forge sparks, snow, stars and more) and a short colour wash follow whatever you are looking at. Settings > Character creation effects turns them off; the system Reduce motion setting turns them off too.",
          "Point buy joins Standard array, Suggested and Roll 4d6 on the Ability Scores step: 27 points, scores 8 to 15, with + and - on each score. Rolls pop in one by one.",
          "Backgrounds say how they fit the class you picked: which increases hit its primary ability and which skills are already on its list.",
          "Finishing a character stamps a wax seal over the new sheet."
        ]
      }
    ]
  },
  {
    v: "0.1.7",
    date: "2026-10-28",
    stage: "Pre-build",
    blurb: "Play Mode redesign and interactive rolls.",
    groups: [
      {
        title: "New",
        items: [
          "Play Mode now follows the laptop design: sections rail, list with a one-line summary under every ability (to-hit, damage or save DC, range), a detail panel and a roll log. Phones get the same list in one column.",
          "Only the weapon in your hand can attack. Swap weapon is a Bonus Action that picks a different one from your bag. Items shows only things you can use now.",
          "Feats are their own group. A feat with several benefits (Lucky, War Caster) opens into a submenu of its abilities. Lucky now tracks Luck Points.",
          "Rolls wait for a tap. A switch in the corner picks Disadvantage, Normal or Advantage and rolls two dice. After the attack you roll damage with a second tap.",
          "Add-ons appear on the roll screen and can be ignored: Lucky advantage before a d20, Primal Strike (+1d8, once per turn) after a weapon hit, Chalice on healing spells while Starry Form is on, and a Luminous Arrow attack for Starry Form.",
          "Keyboard shortcuts for laptops (/ search, J and K move, Enter use, N next turn, 1 2 3 spend Action, Bonus Action, Reaction). Settings > Keyboard shortcuts turns them off."
        ]
      }
    ]
  },
  {
    v: "0.1.6",
    date: "2026-10-28",
    stage: "Pre-build",
    blurb: "Play Mode.",
    groups: [
      {
        title: "New",
        items: [
          "Play Mode, the first sub-tab on the Advanced sheet: one list of attacks, spells, features and items grouped by Action, Bonus Action, Reaction, Other and Passive. Each row has an icon in its action's colour. Buttons dim when you have no action, reaction or spell slot left; tap a dimmed button to see why.",
          "A Show row with checkboxes for Features, Attacks, Spells, Items and Standard actions (Dodge, Dash, Disengage, Help, Hide, Influence, Ready, Search, Study, Utilize, Grapple, Shove, Opportunity Attack and more). Standard actions are off by default.",
          "Level progression strip, shown while Features is checked. Tap a level to see what it gives.",
          "Full-screen dice roll with special effects for a natural 20 and a natural 1. Settings > Roll animation: Full, Crits only or Off. It calms down if your device asks to reduce motion.",
          "The turn tracker is now on by default. Healing and Superior Healing style potions roll their healing when used from Play Mode."
        ]
      },
      {
        title: "Changed",
        items: ["\"Always on\" is now \"Passive\" in the Combat tab."]
      }
    ]
  },
  {
    v: "0.1.5",
    date: "2026-10-28",
    stage: "Pre-build",
    blurb: "Active abilities.",
    groups: [
      {
        title: "New",
        items: [
          "Turn on an ability (Starry Form, Rage and so on) from its detail on the Combat tab. It shows as an Active chip on your sheet until you turn it off or take a rest. The app only tracks that it is on; it does not apply its effects for you yet.",
          "Hotbar buttons are now bookmarks: tap to add (the bookmark fills with a pop and the new slot appears), tap again to remove. The same small pop plays when you prepare a spell, favorite something in the picker or turn an ability on."
        ]
      },
      {
        title: "Fixed",
        items: [
          "The XP bar and the numbers now agree. The bar always showed progress through your current level (25,000 XP at level 7 is 2,000 of 11,000, so 18%) while the text showed the total; the dialog and sheet now say which is which.",
          "At level 20 the level dialog no longer offers to level up to 21."
        ]
      }
    ]
  },
  {
    v: "0.1.4",
    date: "2026-10-27",
    stage: "Pre-build",
    blurb: "New Character tab and level-up.",
    groups: [
      {
        title: "New",
        items: [
          "Character tab with Combat, Rolls, Features, Tools and Notes. Combat shows what you can do this turn, filtered by Action, Bonus Action or Reaction. Things you cannot use right now are greyed out; tap one to see why.",
          "Tools: optional turn tracker, concentration prompts, initiative, Heroic Inspiration, rests, trackers, conditions and the dice tray.",
          "Classic character sheet (new default): one page laid out like the printed 2024 sheet. The tabbed sheet is now the Advanced sheet; switch any time in Settings or at the top of the sheet.",
          "New look for the sheet: your level is a wax seal with an XP ring (tap it for XP and level up), and your armor shield gets sturdier as AC rises: cloth, leather, wood, steel, banded steel, mithral, then gold.",
          "Spells page redone as a clean list with gem spell slots. Removing a spell or feat now asks \"Are you sure?\" first.",
          "Bag is now a list with each item's weight and a carrying total against your Strength limit (weights from the SRD; items with no listed weight are left out). Coins use coin pictures.",
          "Dark theme recoloured to candlelight with a warm red accent. Fixed menus and buttons replaying their animations on every tap, and the page shifting sideways when a menu opened. Fixed feats with a choice in brackets, like Magic Initiate (Cleric), saying they had no rules data.",
          "Laptop layout: tabs move to a rail on the left and the classic sheet spreads into columns.",
          "Level and XP bar at the top of the sheet (tap to add XP or level up). Tap Armor Class to see and change its bonuses.",
          "Download PDF now fills in the official 2024 character sheet.",
          "Subclass list shows a one-line description of each subclass. The Add a feat button only shows on the Feats list.",
          "Choosing a subclass opens a full page you scroll to read: every feature by level, its own colour and seal. Tap Choose at the bottom.",
          "Hit points now react when you are hit or healed, with sounds. Calm mode (Settings) keeps it quiet.",
          "Level up with XP or milestones, see every new feature first, and feats now apply their ability increases and Tough hit points. Origin feats can be taken at any feat level, and you can make a custom background."
        ]
      }
    ]
  },
  {
    v: "0.1.3",
    date: "2026-10-23",
    stage: "Pre-build",
    blurb: "DM editor.",
    groups: [
      {
        title: "New",
        items: [
          "DM editor on the main menu (PIN protected): edit or add species, classes, subclasses, backgrounds, feats, spells, weapons, items and rules.",
          "Every new entry starts from a template shaped like the real data, so it fits the game.",
          "Export your changes, then fold them into the locked rules so every player gets them in one update."
        ]
      }
    ]
  },
  {
    v: "0.1.2",
    date: "2026-10-23",
    stage: "Pre-build",
    blurb: "Tester build. A new way to pick your species.",
    groups: [
      {
        title: "New",
        items: [
          "Species picker redone: portrait cards you tap open. Sort by A to Z, Source or Favorites first, filter by source, and search by name. Star a species to keep it near the top.",
          "Add your own image to any species (Add image inside the card). It is shrunk and kept on this device only, and it is included when you make a full backup.",
          "Everything a species gives you is on its card, each ability tagged Passive (always on) or Active (an action or limited uses). Tap an ability to read the book text.",
          "Choices are now big tap-able tiles inside the card (dragon color, elf lineage, skills and so on), with the full rules text for your pick right under them.",
          "Choices that belong to a later level (like the Aasimar transformation at level 3) are no longer asked at character creation; the abilities show a Level tag."
        ]
      },
      {
        title: "Good to know",
        items: [
          "The Passive/Active tags and usage lines are the app's reading of the text and can be wrong for oddly written species. The ability text itself is word for word from the rules file.",
          "Tapping a species card also picks it. Tap it again to fold it up; your pick stays."
        ]
      }
    ]
  },
  {
    v: "0.1.1",
    date: "2026-10-23",
    stage: "Pre-build",
    blurb: "Tester build. HP, gear and bug-fix update.",
    groups: [
      {
        title: "New",
        items: [
          "Resistance and vulnerability in the HP box: enter 10, pick Resistant, tap Damage, and 5 is taken. Vulnerable doubles it. A preview shows the result.",
          "Your character figure on the Gear tab now shows what you wear: one marker per slot (head, neck, back, body, hands, rings, belt, feet, main hand, ranged, off hand). Fancier art per item comes later.",
          "The Cloak slot is now called Back and also takes a backpack."
        ]
      },
      {
        title: "Fixed",
        items: [
          "The HP box now opens at the top of the screen, so the phone number pad no longer covers the buttons.",
          "A stack of identical items (like 2 daggers) can now fill more than one slot, one copy each, instead of moving the single copy around."
        ]
      }
    ]
  },
  {
    v: "0.1.0",
    date: "2026-10-23",
    stage: "Pre-build",
    blurb: "First tester build. Played by Caleb and one player; expect rough edges.",
    groups: [
      {
        title: "New",
        items: [
          "Tap the health bar to change HP. Damage, heal and temp HP live behind it now.",
          "The health bar changes as you get hurt: colour slides green to red, cracks appear, and it pulses when you are low.",
          "Dark Tome look: warm dark theme with gold, framed panels and Cinzel headings. Light theme is now Parchment and Ink.",
          "Button animations: press, hover glow, pulse, and an active-tab marker.",
          "Button sounds and a light buzz, made in the app itself (no downloads, works offline).",
          "Settings is now one tap from any screen (gear in the top bar) and has sections: Appearance, Sound and feel, Play, Accessibility, Data and backups, About.",
          "This changelog."
        ]
      },
      {
        title: "Also in this build",
        items: [
          "Glossary on the Rules tab: browse classes, subclasses, progression tables, spells, conditions, items and more.",
          "Phone launch QR code fixed (it did not scan before).",
          "Guided character creation, level-up, SRD 5.2 content, attacks and hotbar, bag grid, short and long rests.",
          "Works offline once loaded. Characters are stored on your device only."
        ]
      },
      {
        title: "Known rough edges",
        items: [
          "Sounds and buzz are untested on iPhone. iPhones do not support the buzz at all.",
          "No automated test suite yet, so regressions are caught by hand.",
          "Back up your characters now and then (Settings > Data and backups). They live only on this device."
        ]
      }
    ]
  }
];
