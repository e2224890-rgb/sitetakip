// Site Sokak Takip — Service Worker
// Strateji (v4):
//   - Sayfa gezinmesi: STALE-WHILE-REVALIDATE -> cache'teki HTML ANINDA gösterilir,
//     arka planda taze sürüm indirilip cache güncellenir. Açılış ağ hızından bağımsız olur.
//   - /_next/static/* hash'li dosyalar: cache-first (içerik değişmez).
//   - Supabase ve /api: ASLA cache'lenmez.
// GÜNCELLİK GARANTİSİ: Her deploy'da CACHE sürümünü artırın (sst-v4 -> sst-v5).
// Yeni SW aktive olunca eski cache silinir + PWARegister sayfayı bir kez yeniler
// -> kullanıcı en geç bir sonraki öne gelişte yeni sürümü alır.
const CACHE = "sst-v4";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

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

  // Sayfa gezinmesi (HTML): stale-while-revalidate
  // 1) Cache'te varsa ANINDA onu ver (açılış gecikmesi sıfıra iner)
  // 2) Aynı anda ağdan tazesini çek, cache'i güncelle (bir sonraki açılış taze olur)
  if (request.mode === "navigate") {
    e.respondWith((async () => {
      const cached = (await caches.match(request)) || (await caches.match("/"));
      const agIstegi = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const kopya = res.clone();
            caches.open(CACHE).then((c) => c.put(request, kopya));
          }
          return res;
        })
        .catch(() => null);
      if (cached) {
        e.waitUntil(agIstegi); // arka plan tazelemesi SW kapanmadan tamamlansın
        return cached;
      }
      const taze = await agIstegi;
      return taze || new Response("Çevrimdışı — bağlantı kurulamadı.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })());
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
