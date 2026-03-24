const CACHE_NAME = "invox-pwa-v4";
const OFFLINE_URL = "/offline.html";
const CORE_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", OFFLINE_URL];

async function getOfflineResponse() {
  const cached = await caches.match(OFFLINE_URL);
  if (cached) return cached;
  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

function getGatewayTimeoutResponse() {
  return new Response("", { status: 504 });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/")) return;
  if (url.pathname.startsWith("/api/")) return;

  const accept = event.request.headers.get("accept") || "";
  const isNavigation = event.request.mode === "navigate" || accept.includes("text/html");

  if (isNavigation) {
    event.respondWith(fetch(event.request).catch(() => getOfflineResponse()));
    return;
  }

  const destination = event.request.destination || "";
  const isStaticAsset = ["style", "script", "image", "font", "manifest"].includes(destination);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const clone = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => getGatewayTimeoutResponse());
    })
  );
});
