/* C.F.B. offline worker.
   Every file comes from one versioned cache, so a launch never mixes a new page
   with old files. A new version (bumped CACHE_VERSION) downloads everything in the
   background, then takes over: the next launch is the new version, whole.
   Paths are relative to the worker's scope, so it works under /Cruelty-Free-Beauty-/.
   Bump CACHE_VERSION in every change that touches a file listed below. */
const CACHE_VERSION = "cfb-v12";
const PRECACHE = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "learn.js",
  "brands.js",
  "profile.js",
  "scan.js",
  "assets/vendor/barcode-detector/barcode-detector.js",
  "assets/vendor/barcode-detector/zxing_reader.wasm",
  "intro.js",
  "data/brands.json",
  "manifest.webmanifest",
  "assets/logo.svg",
  "assets/fonts/fraunces.woff2",
  "assets/fonts/fraunces-italic.woff2",
  "assets/fonts/inter.woff2",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/icon-maskable-512.png"
];
const SCOPE = new URL(self.registration.scope).pathname;   // e.g. /Cruelty-Free-Beauty-/

self.addEventListener("install", e => {
  // all or nothing: if any file fails, this version doesn't install and the old one stays
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(fromCache(req, url));
});

async function fromCache(req, url) {
  const cache = await caches.open(CACHE_VERSION);
  let saved = await cache.match(req, { ignoreSearch: true });
  // the app's own page, whatever query it was opened with; other paths go to the network
  if (!saved && req.mode === "navigate" && (url.pathname === SCOPE || url.pathname === SCOPE + "index.html")) {
    saved = await cache.match("index.html");
  }
  return saved || fetch(req);
}
