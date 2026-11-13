/* C.F.B. offline worker.
   Every file comes from one versioned cache, so a launch never mixes a new page
   with old files. A new version (bumped CACHE_VERSION) downloads everything in the
   background, then takes over: the next launch is the new version, whole.
   Paths are relative to the worker's scope, so it works under /Cruelty-Free-Beauty-/.
   Bump CACHE_VERSION in every change that touches a file listed below.
   The launch film is the one exception: it is too big to make the install wait for it, so it
   lives in its own cache (MEDIA), is saved when the page asks (after the film has played), and survives
   app updates. If the film itself changes, bump MEDIA. */
const CACHE_VERSION = "cfb-v28";
const MEDIA = "cfb-media-v3";
/* The Sanctuary's 3D world (its script, three.js, the models): about 3 MB, so it is not in the first
   download. Each file is saved the first time the Sanctuary asks for it, and the world then opens
   offline. Bump WORLD in every change to sanctuary3d.js, sanctuary3d-life.js, assets/sanctuary/ or assets/vendor/three/. */
const WORLD = "cfb-world-v5";
const WORLD_PATHS = ["sanctuary3d.js", "sanctuary3d-life.js", "assets/sanctuary/", "assets/vendor/three/"];
const FILM = "assets/video/launch.mp4";
const PRECACHE = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "learn.js",
  "brands.js",
  "changes.js",
  "home.js",
  "profile.js",
  "scan.js",
  "garden.js",
  "assets/vendor/barcode-detector/barcode-detector.js",
  "assets/vendor/barcode-detector/zxing_reader.wasm",
  "intro.js",
  "data/brands.json",
  "data/questions.json",
  "manifest.webmanifest",
  "assets/logo.svg",
  "assets/images/home-banner.webp",
  "assets/images/gate.webp",
  "assets/pins/brands.webp",
  "assets/pins/scan.webp",
  "assets/pins/profile.webp",
  "assets/pins/learn.webp",
  "assets/pins/home.webp",
  "assets/pins/foundation.webp",
  "assets/pins/concealer.webp",
  "assets/pins/blush.webp",
  "assets/pins/bronzer.webp",
  "assets/pins/lip.webp",
  "assets/fonts/instrument-serif.woff2",
  "assets/fonts/instrument-serif-italic.woff2",
  "assets/fonts/manrope.woff2",
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION && k !== MEDIA && k !== WORLD).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const rel = url.pathname.startsWith(SCOPE) ? url.pathname.slice(SCOPE.length) : "";
  e.respondWith(url.pathname === SCOPE + FILM ? film(req, url) : WORLD_PATHS.some(p => rel.startsWith(p)) ? world(req, url) : fromCache(req, url));
});

/* The launch film. Saved whole when the page asks (after it has played once); after that it is served from
   the cache in the pieces the browser asks for (iPhones only play video served that way). */
let filling = null;
function fill(href) {
  if (filling) return filling;
  filling = fetch(href)                    // the browser has usually just played it: this comes from its own cache
    .then(res => (res.status === 200 ? caches.open(MEDIA).then(c => c.put(href, res)) : null))
    .catch(() => {})
    .then(() => { filling = null; });
  return filling;
}
self.addEventListener("message", e => {
  if (e.data !== "save-film") return;
  const href = location.origin + SCOPE + FILM;
  e.waitUntil(caches.open(MEDIA).then(c => c.match(href)).then(hit => (hit ? null : fill(href))));
});
async function film(req, url) {
  const href = url.origin + url.pathname;
  const cache = await caches.open(MEDIA);
  const saved = await cache.match(href);
  if (!saved) return fetch(req);                      // not saved yet: play from the network; the page asks for the save after it has played
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (!range) return saved;
  const blob = await saved.blob(), size = blob.size;
  let from = range[1] === "" ? Math.max(0, size - Number(range[2])) : Number(range[1]);
  let to = range[1] === "" || range[2] === "" ? size - 1 : Math.min(Number(range[2]), size - 1);
  if (from > to || from >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(blob.slice(from, to + 1), {
    status: 206,
    headers: {
      "Content-Type": saved.headers.get("Content-Type") || "video/mp4",
      "Content-Range": `bytes ${from}-${to}/${size}`,
      "Content-Length": String(to - from + 1),
      "Accept-Ranges": "bytes"
    }
  });
}

async function world(req, url) {
  const cache = await caches.open(WORLD), href = url.origin + url.pathname;
  const saved = await cache.match(href);
  if (saved) return saved;
  const res = await fetch(req);
  if (res.status === 200) cache.put(href, res.clone()).catch(() => {});
  return res;
}

async function fromCache(req, url) {
  const cache = await caches.open(CACHE_VERSION);
  let saved = await cache.match(req, { ignoreSearch: true });
  // the app's own page, whatever query it was opened with; other paths go to the network
  if (!saved && req.mode === "navigate" && (url.pathname === SCOPE || url.pathname === SCOPE + "index.html")) {
    saved = await cache.match("index.html");
  }
  return saved || fetch(req);
}
