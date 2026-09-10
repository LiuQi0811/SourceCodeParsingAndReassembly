const DEFAULT_CACHE_VERSION = "safe-static-v1";
const CACHE_VERSION = resolveCacheVersion();
const CACHE_PREFIX = "ai-movie:static";
const STATIC_CACHE = `${CACHE_PREFIX}:${CACHE_VERSION}`;
const OWNED_CACHE_PREFIXES = ["ai-movie:", "kanju-ai:"];
const STATIC_ASSET_PATH_PREFIX = "/assets/";
const STATIC_DESTINATIONS = new Set(["font", "image", "script", "style"]);
const HASHED_ASSET_PATH_RE = /-[a-zA-Z0-9_-]{8,}\.(?:css|js|mjs|woff2?|png|jpe?g|webp|gif|avif|svg|ico)$/u;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                OWNED_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
                key !== STATIC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!isCacheableStaticRequest(request)) return;
  event.respondWith(cacheFirstStatic(request, event));
});

function isCacheableStaticRequest(request) {
  if (request.method !== "GET") return false;
  if (request.headers?.has("range")) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (!url.pathname.startsWith(STATIC_ASSET_PATH_PREFIX)) return false;
  if (url.pathname.startsWith("/assets/generated/")) return false;
  if (!HASHED_ASSET_PATH_RE.test(url.pathname)) return false;
  return STATIC_DESTINATIONS.has(request.destination);
}

function resolveCacheVersion() {
  try {
    const version = new URL(self.location.href).searchParams.get("ver");
    if (!version) return DEFAULT_CACHE_VERSION;
    const normalized = version.trim().replace(/[^a-zA-Z0-9._-]/gu, "-").replace(/-+/gu, "-");
    return normalized.slice(0, 80) || DEFAULT_CACHE_VERSION;
  } catch {
    return DEFAULT_CACHE_VERSION;
  }
}

async function cacheFirstStatic(request, event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const contentType = response?.headers?.get("content-type") ?? "";
  if (
    response?.ok &&
    response.status === 200 &&
    response.type !== "opaque" &&
    !contentType.toLowerCase().includes("text/html")
  ) {
    event.waitUntil(cache.put(request, response.clone()).catch(() => undefined));
  }
  return response;
}
