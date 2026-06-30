// Site Sokak Takip — Service Worker (otomatik güncellenen)
// Strateji: sayfa gezinmesi DAİMA network-first (her açılışta taze HTML),
// /_next/static/* hash'li dosyalar cache-first (kalıcı), Supabase/API asla cache'lenmez.
// Cache adı her sürümde artırılır -> eski cache temizlenir -> güncel sürüm garanti gelir.
const CACHE = "sst-v3";
const SHELL = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Sayfadan "hemen güncelle" mesajı gelirse beklemeden devral
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  // Supabase ve /api -> daima network (asla cache'leme)
  if (url.pathname.startsWith("/api/") || url.hostname.endsWith(".supabase.co")) return;
  if (url.origin !== self.location.origin) return;

  // Sayfa gezinmesi (HTML): network-first -> her açılışta en güncel arayüz
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => { caches.open(CACHE).then((c) => c.put(request, res.clone())); return res; })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Next hash'li statik varlık (/_next/static/*) -> cache-first (içerik değişmez)
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
          return res;
        })
      )
    );
    return;
  }

  // Diğer aynı-origin GET (ikon, manifest vb.): network-first, çevrimdışında cache
  e.respondWith(
    fetch(request)
      .then((res) => { if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); } return res; })
      .catch(() => caches.match(request))
  );
});
