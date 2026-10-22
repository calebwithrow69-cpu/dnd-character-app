# Character Runner — notes for Claude sessions

Offline-first D&D 2024 character sheet (static PWA on GitHub Pages, no build step, no accounts).
Characters live only in each player's browser storage; the repo holds the app and the rules data.

## The rules data is password-locked
- `data/library.enc.json` is the only copy of the rules in the repo (AES-GCM, key from the group password via PBKDF2). Book text must never be committed readable.
- `data/library.json` (readable) is gitignored. Never `git add -f` it. Before committing, `git grep -I "Celestial Resistance"` should find nothing.
- The password is never stored in the repo, in memory files, or in any file. Ask the user for it each session.
- To edit rules: `CR_PASSWORD=<from user> node tools/crypt.mjs unlock` → edit `data/library.json` → `CR_PASSWORD=<same> node tools/crypt.mjs lock` → commit only the `.enc.json`.
- Locking with the same password keeps the salt, so players' devices update silently. A new password makes every device ask once.
- `data/campaign.json` (DM allowlist + homebrew) and `data/seed-gandork.json` are the user's own content and stay readable.

## Layout
- `js/rules.js` math and tables · `js/gear.js` slots/armor/AC · `js/progression.js` level-up plan from class tables (levels 1–10 from the book import, 11–20 from SRD 5.2)
- `js/data.js` loading, unlocking, update checks (file fingerprint, no version bumps needed). The readable rules are never kept in localStorage (shared quota with characters); the locked file lives in the offline cache and is opened at launch with the remembered key · `js/store.js` characters, migrations, backups
- `js/choices.js` reads species/background/feat choices out of rules text; entries that read wrong get a `choiceFix` in the rules file ({drop, options, add, when}) · `js/equipment.js` starting-gear packages, prices, coins · `js/install.js` install button / desktop shortcut
- `js/views/*` screens · `js/app.js` events and actions · `service-worker.js` offline cache
- **Bump `CACHE_VERSION` on every code or style change** (and list new files in `SHELL_FILES`). Players only get new code when it changes; the page then applies it at launch or via the "Update now" bar. Rules/campaign JSON updates live without a bump.

## SRD 5.2
- `tools/srd-import.mjs <5e-database/src/2024/en>` merges the 2024 SRD (from github.com/5e-bits/5e-database) into `data/library.json`: adds only what's missing, rebuilds the 12 SRD subclasses' features, adds class levels 11–20. Content is CC-BY-4.0: the credit is stored in `library.credits` and shown in Settings — keep it.

## Before pushing
- `node --check` every JS file; test in a real browser (Playwright, Chromium at `/opt/pw-browsers/chromium`) on phone (390×844) and laptop widths.
