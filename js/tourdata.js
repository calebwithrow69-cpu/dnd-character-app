// Tour content. Plain words, no tutorial voice: each step says what a thing is and where it is.
// Content file: not scanned by copy-lint (like milestones.js). Keep every title under 5 words and every body under 30.
// sel = the first VISIBLE element that matches; a step with no match is shown centered. ASCII only.
export const TOURS = {
  home: {
    name: "Home tour",
    steps: [
      { sel: "#home-book", title: "Start here", body: "Your latest character opens from this card. With none yet, it opens the start menu: build one, roll one at random, or load a file." },
      { sel: '[data-a="goRoster"]', title: "Characters", body: "Everyone saved on this device. Imports, new characters and the graveyard are on that screen." },
      { sel: ".float", title: "Rules and Notes", body: "The rules glossary works offline. Notes belong to you, not to one character." },
      { sel: '[data-a="openSettings"]', title: "Settings and backups", body: "Characters are stored in this browser only. Export a backup from Data and backups, and install the app so the browser keeps it." }
    ]
  },
  dm: {
    name: "DM tour",
    steps: [
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
      { sel: 'nav.tabs [data-tab="rules"]', title: "Rules", body: "Every class, spell, item and condition, searchable offline. Notes and Shop sit beside it." },
      { sel: '[data-a="openEdit"]', title: "Edit character", body: "Level up or lower, add feats, change scores, mark a character as dead." },
      { sel: 'nav.tabs [data-tab="settings"]', title: "Settings", body: "Sheet style, sounds, rule sets and backups. Backups matter: there is no account behind this app." }
    ]
  }
};
export const REWARD = { id: "silver", name: "Silver", about: "Silver accent colour" };
