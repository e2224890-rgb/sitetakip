# Saha Teşkilatı Yönetim Sistemi

Next.js 14 (App Router) + Supabase + Recharts. **PWA** (kurulabilir, çevrimdışı kabuk) ve modüler mimari.

## Yapı
```
app/
  layout.jsx               # kök layout (PWA meta, tema, SW kaydı, global css)
  page.jsx                 # giriş: Page -> Login | RolDagitici
  manifest.js              # PWA manifest (Next metadata route)
  globals.css              # tüm stiller + responsive media query'ler
  api/
    site-onay/route.js
    hesap-ekle/route.js
  components/              # her bileşen kendi dosyasında
    Login.jsx  Yonetim.jsx  RolDagitici.jsx
    Bolgeler.jsx  Haneler.jsx  GrupDetay.jsx  Siteler.jsx
    Gezgin.jsx  IlGeneli.jsx  Sorumlular.jsx
    ZiyaretModal.jsx  KapsamSokaklar.jsx  StatCard.jsx
    SokakBolStrip.jsx  GrupBaskanPanel.jsx  EkipAtama.jsx  RolSlot.jsx
    BlokSlot.jsx  BlokSorumlulari.jsx
    KoordinatorGorunum.jsx  GrupBaskaniGorunum.jsx
    BlokSorumluGorunum.jsx  SahaGorunum.jsx
    PWARegister.jsx         # service worker kaydı (client)
lib/
  supabase.js              # supabase client
  format.js                # saf yardımcılar: fmt, oran, NUF_RENK,
                           #   sokakAdres, haneBaslik, csvIndir,
                           #   yakRenk, normBlok, blokParts
  constants.js             # SAYFA, IST_ILCELER, KAPSAMLAR,
                           #   BLOK_ROL_LISTE, BLOK_ROL_AD
public/
  sw.js                    # service worker (statik cache, API/Supabase bypass)
  icon-192/512/maskable, apple-touch-icon, favicon-32
```

## Çalıştırma
```
npm install
cp .env.local.example .env.local   # Supabase URL + anon key gir
npm run dev      # geliştirme
npm run build && npm start         # üretim
```

## PWA
- Tarayıcıda "Yükle" / telefonda "Ana ekrana ekle" ile kurulur.
- `public/sw.js`: uygulama kabuğu cache'lenir; **Supabase ve /api çağrıları asla cache'lenmez** (veri/oturum tazeliği korunur).
- Yeni yayında `sw.js` içindeki `CACHE = "sst-vN"` sürümünü artır.

## Best-practice notları
- Tek 2.5k satırlık dosya → 23 bileşen + 2 lib modülüne ayrıldı; importlar bağımlılık grafiğinden hesaplandı.
- Saf fonksiyonlar UI'dan ayrıldı (test edilebilir, tek kaynak).
- Global CSS yalnızca `layout.jsx`'te.
- Responsive: `.app`, `.layout`, `.demo-grid`, `.ozet-aside` ve tablolar mobil için media query'lerle uyumlandı.

## Veri/SQL
SQL göçleri ayrı `node-import/` paketinde (nüfus il backfill, site/sokak taşımalar, MV'ler).
