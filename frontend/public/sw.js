/* FiNot Chat — minimal service worker.
   Network-first for navigations; cache-first for hashed static assets.
   Intentionally NOT caching /api/* (always live). */

const CACHE = "finot-chat-v2";
const PRECACHE = ["/", "/chat", "/manifest.webmanifest", "/finot-logo.png", "/finot_logo-192.png", "/finot_logo-512.png"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => null))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/")) return; // never cache API

    // Navigations: network-first, fall back to cached /chat
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => null);
                    return res;
                })
                .catch(() => caches.match(request).then((m) => m || caches.match("/chat")))
        );
        return;
    }

    // Static assets: cache-first
    if (url.pathname.startsWith("/assets/") || /\.(png|jpe?g|svg|webp|ico|woff2?)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(request).then((m) => {
                if (m) return m;
                return fetch(request).then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => null);
                    return res;
                });
            })
        );
    }
});

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : "" };
    }

    event.waitUntil(self.registration.showNotification(data.title || "FiNot", {
        body: data.body || "Ada pembaruan keuangan untukmu.",
        icon: "/finot_logo-192.png",
        badge: "/finot_logo-192.png",
        tag: data.tag || "finot-update",
        data: { url: data.url || "/chat" },
        vibrate: [120, 60, 120],
    }));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || "/chat", self.location.origin).href;
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
            for (const client of windows) {
                if (client.url === target && "focus" in client) return client.focus();
            }
            return clients.openWindow ? clients.openWindow(target) : undefined;
        })
    );
});
