#!/usr/bin/env node
// Lock or unlock the rules data. The password comes ONLY from the
// CR_PASSWORD environment variable — never written to any file.
//
//   CR_PASSWORD=... node tools/crypt.mjs unlock   data/library.enc.json -> data/library.json
//   CR_PASSWORD=... node tools/crypt.mjs lock     data/library.json -> data/library.enc.json
//
// data/library.json (readable) is gitignored: edit it, lock it, commit
// only the .enc.json. Locking reuses the existing salt so devices that
// already unlocked keep working without retyping the password.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { encryptJSON, decryptWithPassword } from "../js/crypt.js";

const pw = process.env.CR_PASSWORD;
const cmd = process.argv[2];
const ENC = "data/library.enc.json", PLAIN = "data/library.json";
if (!pw) { console.error("Set CR_PASSWORD first."); process.exit(1); }

if (cmd === "unlock") {
  const { data } = await decryptWithPassword(JSON.parse(readFileSync(ENC, "utf8")), pw);
  writeFileSync(PLAIN, JSON.stringify(data, null, 0));
  console.log(`Unlocked -> ${PLAIN} (${data.spells?.length} spells). Don't commit this file.`);
} else if (cmd === "lock") {
  const data = JSON.parse(readFileSync(PLAIN, "utf8"));
  let saltB64;
  if (existsSync(ENC)) {
    const old = JSON.parse(readFileSync(ENC, "utf8"));
    try { await decryptWithPassword(old, pw); saltB64 = old.salt; } catch { console.log("Password differs from the current file: new salt, every device will be asked once."); }
  }
  const out = await encryptJSON(data, pw, { saltB64 });
  writeFileSync(ENC, JSON.stringify(out));
  console.log(`Locked -> ${ENC} (${Math.round(out.data.length / 1024)} KB)`);
} else {
  console.error("Usage: node tools/crypt.mjs lock|unlock"); process.exit(1);
}
