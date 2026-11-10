/* C.F.B. offline worker.
   The page: network first, but if it hasn't arrived in 1 s the saved copy opens.
   Everything else: the saved copy at once, refreshed in the background.
   Paths are relative to the worker's scope, so it works under /Cruelty-Free-Beauty-/.
   Bump CACHE_VERSION in every change that touches a file listed below. */
const CACHE_VERSION = "cfb-v1";
const PRECACHE = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "learn.js",
  "manifest.webmanifest",
  "assets/logo.svg",
  "assets/fonts/fraunces.woff2",
  "assets/fonts/fraunces-italic.woff2",
  "assets/fonts/inter.woff2",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/apple-touch-icon.png"
];
const PAGE_WAIT = 1000;

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(new Request(u, { cache: "reload" })))))
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

  if (req.mode === "navigate") {
    e.respondWith(pageFirst(req));
  } else {
    e.respondWith(savedThenRefresh(req, e));
  }
});

async function pageFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  const saved = await cache.match(req, { ignoreSearch: true }) || await cache.match("index.html");
  const fresh = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  if (!saved) return fresh;
  const timer = new Promise(r => setTimeout(() => r(saved), PAGE_WAIT));
  return Promise.race([fresh.catch(() => saved), timer]);
}

async function savedThenRefresh(req, e) {
  const cache = await caches.open(CACHE_VERSION);
  const saved = await cache.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  if (saved) {
    e.waitUntil(fresh.catch(() => {}));
    return saved;
  }
  return fresh;
}
