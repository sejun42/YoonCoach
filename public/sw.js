const CACHE = "yooncoach-static-v3";
const PRECACHE = ["/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((key) => key.startsWith("yooncoach-") && key !== CACHE).map((key) => caches.delete(key)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Only immutable assets are cached. Authenticated HTML, RSC and API data stay on the network.
  if (!url.pathname.startsWith("/_next/static/") && url.pathname !== "/icon.svg") return;
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  }));
});

self.addEventListener("push", (event) => {
  const defaults = { title: "YoonCoach", body: "오늘의 기록을 확인해 주세요.", url: "/" };
  let payload = defaults;
  if (event.data) { try { payload = { ...defaults, ...JSON.parse(event.data.text()) }; } catch { payload = defaults; } }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body, icon: "/icon.svg", badge: "/icon.svg", data: { url: payload.url || "/" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ("focus" in client && client.url.includes(target)) return client.focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  }));
});
