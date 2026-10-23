// Version info and changelog. Add the newest release at the TOP of CHANGELOG
// and bump VERSION (and CACHE_VERSION in service-worker.js).
// ASCII only in this file.

export const VERSION = "0.1.1";
export const STAGE = "Pre-build";
export const TESTERS = "Caleb + 1 player";

export const CHANGELOG = [
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
