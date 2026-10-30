// Offline support.
// - App files: one complete, versioned copy per release. A new release is
//   downloaded whole in the background (never mixing old and new files),
//   then the page applies it: automatically at launch, or with one tap on
//   the "Update ready" banner if the app is already open.
//   => Bump CACHE_VERSION on EVERY code/style change, or players won't get it.
// - Rules data (data/*.json): network first when online, cache when not.
//   Those update live without a version bump.
// - Google Fonts: cached the first time they load, so offline keeps the look.
const CACHE_VERSION = "v60";
const SHELL = "shell-" + CACHE_VERSION;
const FONTS = "fonts-v1";

const SHELL_FILES = [
  "./", "index.html", "manifest.json", "css/styles.css",
  "js/app.js", "js/data.js", "js/store.js", "js/rules.js", "js/dice.js", "js/ui.js", "js/gear.js", "js/progression.js", "js/crypt.js", "js/spells.js", "js/install.js", "js/choices.js", "js/equipment.js", "js/qr.js", "js/sfx.js", "js/changelog.js", "js/species.js", "js/portraits.js", "js/dm.js", "js/creation.js", "js/pdf.js", "js/views/feats.js", "js/featfx.js", "js/combat.js", "js/subtone.js", "js/shield.js", "js/weights.js", "js/views/subclass.js", "js/views/classic.js", "js/hpbar.js", "js/views/character.js", "js/views/play.js", "js/play.js", "js/rollstage.js", "js/riders.js", "js/emblems.js", "js/cxfx.js", "assets/sfx/hit.mp3", "assets/sfx/hit-big.mp3", "js/custombg.js", "js/views/home.js", "js/vendor/pdf-lib.min.js",
  "js/views/roster.js", "js/views/create.js", "js/views/sheet.js", "js/views/modals.js", "js/views/levelup.js", "js/views/settings.js", "js/views/species.js", "js/views/codex.js", "js/views/dm.js", "js/views/loadout.js", "js/views/stylepick.js", "js/views/graveyard.js", "js/views/classicgear.js", "js/effects.js", "js/attackctx.js",
  "data/library.enc.json", "data/campaign.json", "data/seed-gandork.json", "data/terms.json",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  // cache: "reload" skips the browser's HTTP cache so the new copy is really new.
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES.map((u) => new Request(u, { cache: "reload" })))));
  // No skipWaiting here: the page decides when to switch (see index.html).
});

self.addEventListener("message", (event) => {
  if (event.data === "apply-update") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== FONTS && k !== "rules-good").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putCopy(cacheName, request, response) {
  if (!response || (!response.ok && response.type !== "opaque")) return;
  const copy = response.clone(); // clone synchronously, before the body is read
  caches.open(cacheName).then((c) => c.put(request, copy));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { putCopy(FONTS, req, res); return res; })));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes("/data/") && url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(req, { cache: "no-cache" }).then((res) => { putCopy(SHELL, req, res); return res; })
        .catch(() => caches.open(SHELL).then((c) => c.match(req, { ignoreSearch: true })))
    );
    return;
  }

  // App files: only from this release's cache, so every file matches.
  event.respondWith(
    caches.open(SHELL).then((c) => c.match(req, { ignoreSearch: true }))
      .then((hit) => hit || fetch(req).then((res) => { putCopy(SHELL, req, res); return res; }))
  );
});
