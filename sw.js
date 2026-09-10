// Durable cache for the splat files only. Everything else is passed straight to
// the network, so this worker cannot serve a stale page shell.
//
// The `_headers` immutable rule already keeps repeat visits off the network, but
// a 6-8 MB entry is the first thing evicted from the browser's HTTP cache, and
// iOS Safari is especially quick to drop them. Cache Storage is quota-backed
// rather than eviction-ranked by size, so a returning visitor keeps the hero
// splat instead of re-downloading it.

const CACHE_NAME = "splat-assets-v1";
const SPLAT_PREFIX = "/splats/";

// Splat URLs carry a ?v= stamp (SPLAT_ASSET_VERSION in script.js). When that is
// bumped the previous entry is dead weight worth several megabytes, so drop any
// other cached version of the same file.
const prunePreviousVersions = async (cache, keptRequest) => {
  const keptUrl = new URL(keptRequest.url);
  const stale = (await cache.keys()).filter((request) => {
    const url = new URL(request.url);

    return url.pathname === keptUrl.pathname && url.search !== keptUrl.search;
  });

  await Promise.all(stale.map((request) => cache.delete(request)));
};

const cacheSplat = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  // Partial and error responses would poison the cache for every later visit.
  if (response.status === 200) {
    await cache.put(request, response.clone());
    await prunePreviousVersions(cache, request);
  }

  return response;
};

const isSplatRequest = (request) => {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);

  return url.origin === self.location.origin && url.pathname.startsWith(SPLAT_PREFIX);
};

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter((name) => name.startsWith("splat-assets-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (!isSplatRequest(event.request)) {
    return;
  }

  // A cache failure should never break the page, so fall back to the network.
  event.respondWith(cacheSplat(event.request).catch(() => fetch(event.request)));
});

// On the very first visit the worker activates after the hero splat request has
// already gone out, so nothing lands in Cache Storage until the visit after
// next. The page pings us once the splat is loaded; by then the file is in the
// HTTP cache, so this warms Cache Storage without a second download.
self.addEventListener("message", (event) => {
  const { type, url } = event.data || {};

  if (type !== "warm-splat" || typeof url !== "string") {
    return;
  }

  const request = new Request(new URL(url, self.location.origin).href);

  if (isSplatRequest(request)) {
    event.waitUntil(cacheSplat(request));
  }
});
