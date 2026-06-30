// Site Sokak Takip — Service Worker
// Strateji: statik dosyalar cache-first, sayfa gezinmesi network-first,
// Supabase/API çağrıları HER ZAMAN network (veri tazeliği + auth için cache'lenmez).
const CACHE = "sst-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Yalnızca GET + aynı origin cache'lenir
  if (request.method !== "GET") return;
  // Supabase ve /api -> daima network (asla cache'leme)
  if (url.pathname.startsWith("/api/") || url.hostname.endsWith(".supabase.co")) return;
  if (url.origin !== self.location.origin) return;

  // Sayfa gezinmesi: network-first, çevrimdışıysa cache
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      }).catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Statik varlık: cache-first, yoksa network + cache
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
