// Tour content. Plain words, no tutorial voice: each step says what a thing is and where it is.
// Content file: not scanned by copy-lint (like milestones.js). Keep every title under 5 words and every body under 30.
// wideSel / wideBody replace sel / body on laptops (1100px and up). sel = the first VISIBLE element that matches; a step with no match is shown centered. ASCII only.
export const TOURS = {
  home: {
    name: "Home tour",
    steps: [
      { sel: "#home-book", title: "Main button", body: "Opens your last character, or starts your first. In DM mode it opens the last campaign." },
      { sel: ".hmode", title: "Player or DM", body: "Switch between your characters and your campaigns. Each DM campaign keeps its own party, creatures and fights." },
      { sel: ".hsec", title: "Your list", body: "Newest first. New creates one, and search appears past six. Manage holds imports and the graveyard." },
      { sel: ".hparts", title: "Rules and Notes", body: "Both work offline. Rules is the glossary. Notes belong to you, not to one character." },
      { sel: ".hbk", title: "Backups", body: "Everything is stored in this browser only. Back up here, and install the app so the browser keeps it." },
      { sel: '[data-a="openSettings"]', title: "Settings", body: "Sheet style, rulesets, sounds, the update history and data tools." }
    ]
  },
  dm: {
    name: "DM tour",
    steps: [
      { go: "dm:party", sel: '[data-a="dmCampOpen"]', title: "Campaigns", body: "Each campaign keeps its own party, creatures, encounters and fight. Switch, rename or add one here." },
      { go: "dm:party", sel: 'nav.tabs [data-v="party"]', title: "Party", body: "Players send a code from Edit character. Each card is a snapshot with its age. Start combat from here with everyone added." },
      { go: "dm:combat", sel: '.dmvsw', title: "Board, List, Screen", body: "Board is the table layout with real numbers. Tap a portrait to change HP or conditions. List shows initiative inputs. Screen is for the TV." },
      { go: "dm:combat", sel: '[data-a="dmNext"], [data-a="dmNewCombat"]', title: "Run the turns", body: "Roll initiative, then Next turn. Conditions with rounds tick down at the end of their creature's turn." },
      { go: "dm:screen", sel: '[data-a="dmViewWindow"]', title: "Table screen", body: "Open it in a new window and put that window on the TV. Both windows follow each other, so either one can press Next turn." },
      { go: "dm:screen", sel: '.tblgrid > .stack:last-child', title: "What the TV shows", body: "Hide enemy numbers, show AC, pick a theme and text size. Push a message or blank the screen between scenes." },
      { go: "dm:bestiary", sel: 'nav.tabs [data-v="bestiary"]', title: "Bestiary", body: "SRD monsters and your own creatures, with full stat blocks. Add any of them to an encounter." },
      { go: "dm:encounters", sel: 'nav.tabs [data-v="encounters"]', title: "Encounters", body: "Build a fight and see its XP against the party's budget: low, moderate or high. Add to combat when ready." },
      { go: "dm:rewards", sel: 'nav.tabs [data-v="rewards"]', title: "Rewards", body: "Defeated XP plus anything you add, split across the party. It shows who levels up." }
    ]
  },
  sheet: {
    name: "Sheet tour",
    steps: [
      { sel: ".status .vitals", title: "Level, HP, AC", body: "The seal is level and XP. The vial is hit points. The shield is armor class. Each one opens its own controls." },
      { sel: 'nav.tabs [data-tab="rules"]', title: "Rules", body: "Every class, spell, item and condition, searchable offline. Notes sits beside it." },
      { sel: ".addcond", title: "Active effects", body: "Conditions, spell effects and drains. They change your numbers, and End removes them." },
      { sel: ".hubcell", wideSel: ".hubfan", title: "Quick tools", body: "The round button opens dice, effects, calculator, rest and initiative. Edit the list in Settings.", wideBody: "The sidebar lists dice, effects, calculator, rest and initiative. Edit the list in Settings." },
      { sel: '[data-a="jumpOpen"]', title: "Search and jump", body: "Find any tab, tool, skill, feature or item. Edit character is in here too: level up, feats, scores." },
      { sel: ".navchar", title: "Back to character", body: "The portrait jumps straight to your character from any page. The arrow goes back one page." },
      { sel: '[data-a="helpOpen"]', title: "Help", body: "The ? replays this tour. Every screen has one in its header." },
      { sel: 'nav.tabs [data-tab="settings"]', title: "Settings", body: "Sheet style, sounds, rule sets and backups. Backups matter: there is no account behind this app." }
    ]
  }
};
export const REWARD = { id: "silver", name: "Silver", about: "Silver accent colour" };
