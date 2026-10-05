/* Hairlux Academy site: service worker.
 *
 * Strategy
 *  - Pages (navigations): network first, so customers always get the latest
 *    site; falls back to the last cached copy, then to offline.html.
 *  - Our own CSS/JS: network first (with a short timeout), so a deploy never
 *    pairs new HTML with stale scripts; cached copy used offline / on slow networks.
 *  - Images, fonts and CDN libraries: stale-while-revalidate: instant loads,
 *    refreshed in the background.
 *  - The Hairlux API, payments (Paystack), lesson videos/files (signed S3
 *    links) and anything else cross-origin: NEVER intercepted or cached.
 *    Enrolments, progress, assessments and certificates always go live.
 *
 * Bump VERSION on each deploy that changes this file; old caches are
 * removed on activate.
 */
const VERSION = 'v1-2026-09-29';
const PRECACHE = `hxacademy-precache-${VERSION}`;
const PAGES = `hxacademy-pages-${VERSION}`;
const ASSETS = `hxacademy-assets-${VERSION}`;
const MAX_PAGES = 40;
const MAX_ASSETS = 150;

const PRECACHE_URLS = [
  'offline.html',
  'manifest.webmanifest',
  'assets/img/pwa/icon-192.png',
  'assets/img/pwa/icon-512.png',
  'assets/img/pwa/favicon-32.png',
];

// Third-party hosts whose static files are safe to cache (fonts, jQuery, Webflow runtime).
const CDN_HOSTS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'ajax.googleapis.com',
  'd3e54v103j8qbb.cloudfront.net',
  'cdn.prod.website-files.com',
]);

const STATIC_EXT = /\.(?:css|js|mjs|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|json|webmanifest)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: 'reload' }))))
  );
  // Don't auto-activate an update mid-session; the page offers "Refresh" (see pwa.js).
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PRECACHE, PAGES, ASSETS]);
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('hxacademy-') && !keep.has(k)).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'CLEAR_PAGE_CACHE') caches.delete(PAGES); // e.g. on logout
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirstPage(event) {
  const req = event.request;
  try {
    const preload = await event.preloadResponse;
    const res = preload || await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(PAGES).then((c) => c.put(stripQuery(req.url), copy)).then(() => trim(PAGES, MAX_PAGES));
    }
    return res;
  } catch (_) {
    const cached = await caches.match(stripQuery(req.url), { cacheName: PAGES });
    if (cached) return cached;
    return (await caches.match('offline.html', { cacheName: PRECACHE })) || Response.error();
  }
}

// Network first, but don't leave the customer staring at a blank page on a
// weak connection: after `timeoutMs` serve the cached copy if we have one.
async function networkFirstAsset(event, timeoutMs = 3500) {
  const req = event.request;
  const cache = await caches.open(ASSETS);
  const network = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone()).then(() => trim(ASSETS, MAX_ASSETS));
    return res;
  });
  const cached = await cache.match(req);
  if (!cached) return network;
  event.waitUntil(network.catch(() => {}));
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), timeoutMs));
  return Promise.race([network.catch(() => cached), timeout]);
}

async function staleWhileRevalidate(event) {
  const req = event.request;
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    // opaque (no-cors CDN) responses are cached too; status 0 is expected for those.
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone()).then(() => trim(ASSETS, MAX_ASSETS));
    }
    return res;
  }).catch(() => cached);
  if (cached) { event.waitUntil(network); return cached; }
  return network;
}

// Pages are cached without their query string (?source=pwa, ?reference=…), so
// one copy per page and no payment references stored.
function stripQuery(url) {
  const u = new URL(url);
  u.search = '';
  u.hash = '';
  return u.toString();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.has(url.hostname)) return; // API, Paystack, Maps, etc.
  if (sameOrigin && url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate' && sameOrigin) {
    event.respondWith(networkFirstPage(event));
    return;
  }
  if (sameOrigin && /\.(?:css|js|mjs)$/i.test(url.pathname)) {
    event.respondWith(networkFirstAsset(event));
    return;
  }
  if (CDN_HOSTS.has(url.hostname) || STATIC_EXT.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
