// Offline support.
// - App files: served from cache instantly, refreshed in the background,
//   so new code shows up on the next launch with no manual steps.
// - Rules data (data/*.json): network first when online, cache when not.
// - Google Fonts: cached the first time they load, so offline keeps the look.
const CACHE_VERSION = "v5";
const SHELL = "shell-" + CACHE_VERSION;
const FONTS = "fonts-v1";

const SHELL_FILES = [
  "./", "index.html", "manifest.json", "css/styles.css",
  "js/app.js", "js/data.js", "js/store.js", "js/rules.js", "js/dice.js", "js/ui.js", "js/gear.js", "js/progression.js", "js/crypt.js", "js/spells.js",
  "js/views/roster.js", "js/views/create.js", "js/views/sheet.js", "js/views/modals.js", "js/views/levelup.js",
  "data/library.enc.json", "data/campaign.json", "data/seed-gandork.json", "data/terms.json",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== FONTS).map((k) => caches.delete(k))))
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
      fetch(req).then((res) => { putCopy(SHELL, req, res); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req).then((res) => { putCopy(SHELL, req, res); return res; }).catch(() => cached);
      return cached || network;
    })
  );
});
