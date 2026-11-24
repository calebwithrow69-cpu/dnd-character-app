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
  sheet: {
    name: "Sheet tour",
    steps: [
      { sel: ".status .vitals", title: "Level, HP, AC", body: "The seal is level and XP. The vial is hit points. The shield is armor class. Each one opens its own controls." },
      { sel: "nav.tabs", title: "Sections", body: "Character is the sheet itself. Notes, Rules, Shop and Settings sit beside it." },
      { sel: '[data-a="openEdit"]', title: "Edit character", body: "Level up or lower, add feats, change scores, mark a character as dead." },
      { sel: 'nav.tabs [data-tab="settings"]', title: "Settings", body: "Sheet style, sounds, rule sets and backups. Backups matter: there is no account behind this app." }
    ]
  }
};
export const REWARD = { id: "silver", name: "Silver", about: "Silver accent colour" };
