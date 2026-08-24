# Saha Teşkilatı Yönetim Sistemi

AK Parti İstanbul İl Başkanlığı saha organizasyon takip uygulaması.
Next.js 14 (App Router) + Supabase + Recharts. Kurulabilir **PWA**.

İl başkanlığı projesi olarak tasarlandı; 39 ilçeye dağıtılacak şekilde
her ilçe kendi üye listesini içe aktarabilir, kendi teşkilatını yönetir.

---

## Kurulum

```bash
npm install
cp .env.example .env      # Supabase URL + anahtarları doldurun
npm run dev               # geliştirme  (http://localhost:3000)
npm run build && npm start  # üretim
```

> `npm run build`, `npm run dev` çalışırken **çalıştırılmamalıdır** — ikisi de
> `.next` dizinini kullanır, üretim derlemesi dev sunucusunun chunk'larını ezer
> ve tarayıcıda `__webpack_modules__[moduleId] is not a function` hatası alırsınız.
> Olursa: dev'i durdurun, `rm -rf .next`, yeniden başlatın.

---

## Yetki modeli

Veriyi koruyan şey **Row Level Security**'dir; arayüzdeki filtreler yalnızca
görünürlük içindir. Kapsam beş eksende tanımlıdır:

```
ilçe · mahalle · bölge · sokak grubu · site
```

| Rol | Görebildiği |
|---|---|
| `il_yonetimi` | her şey |
| `ilce_yonetimi` | kendi ilçesi |
| `mahalle_baskani` | kendi mahallesi |
| `koordinator` / `sorumlu` | sorumlusu olduğu bölgeler + temsilcisi olduğu siteler |
| `grup_baskani` | başkanı ya da ekip üyesi olduğu sokak grupları |
| blok/site rolleri | hesabına bağlı site |

Yazma yetkisi okumadan dardır: `kisi` tablosuna yalnızca yönetim yazabilir
(uygulama hiç yazmaz), `hane` düzenlemeyi bölge sahibi yapabilir, `ziyaret`i
saha görevlisi kendi kapsamında yazar.

Ayrıntı ve gerekçeler: [`sql/11_RLS_KAPSAM_YENIDEN_YAZIM.sql`](sql/11_RLS_KAPSAM_YENIDEN_YAZIM.sql)

### Güvenlik kuralları

- `SUPABASE_SERVICE_ROLE` **asla** `NEXT_PUBLIC_` önekiyle tanımlanmaz; yalnızca
  `app/api/*` route'larında kullanılır. Bu anahtar RLS'i tamamen baypas eder.
- `app/api/*` route'ları service_role ile çalıştığı için oradaki yetki kontrolleri
  veritabanının son savunma hattı değil, **tek** savunma hattıdır.
- Supabase Dashboard'da **kayıt (signup) kapalı** tutulur. Hesaplar yalnızca
  `/api/hesap-ekle` üzerinden yönetim tarafından açılır.
- `anon` rolünün `public` şemada hiçbir yetkisi yoktur.

---

## Mimari

```
app/
  layout.jsx            kök layout (PWA meta, tema, SW kaydı, global css)
  page.jsx              oturum yönlendirmesi: Login | RolDagitici
  manifest.js           PWA manifest (Next metadata route)
  globals.css           tüm stiller + responsive media query'ler
  api/
    hesap-ekle/         hesap açma/güncelleme/silme (service_role)
    site-onay/          sokak-site eşleştirme onayı (service_role)
  components/           rol ekranları ve modüller (~35 bileşen)
lib/
  supabase.js           lazy client (build sırasında env okunmaz)
  sayfali.js            tumSatirlar() — PostgREST 1000 satır sınırını aşar
  hata.js               Supabase/PostgREST hatalarını Türkçeye çevirir
  oturum.js             cikisYap() — çıkışta yerel önbelleği temizler
  cache.js              localStorage snapshot (stale-while-revalidate)
  format.js             saf yardımcılar (fmt, oran, epostaUret, blokParts…)
  constants.js          sabitler
public/
  sw.js                 service worker
  harita/               ilçe sınırı GeoJSON (OSM türevi, ODbL 1.0)
sql/                    uygulanmış veritabanı yamaları + inceleme raporları
scripts/                tek seferlik bakım betikleri
```

### Bilmeye değer iki tuzak

**PostgREST 1000 satırda sessizce keser.** Hata dönmez. Büyük tablolara giden
her sorgu [`lib/sayfali.js`](lib/sayfali.js)'teki `tumSatirlar()` ile
sayfalanmalı, sorguya `{ count: "exact" }` ve deterministik bir `.order()`
eklenmelidir.

**Supabase yazma çağrıları hata fırlatmaz**, sonucun içinde `{ error }` döndürür.
RLS bir satırı filtrelediğinde "0 satır güncellendi" döner. `try/catch` bunu
yakalamaz — dönüşü açıkça kontrol edin, gerekiyorsa `{ count: "exact" }` ile
kaç satırın etkilendiğine bakın.

---

## PWA

- Tarayıcıda "Yükle", telefonda "Ana ekrana ekle" ile kurulur.
- `public/sw.js`: uygulama kabuğu cache'lenir, **Supabase ve `/api` çağrıları
  asla cache'lenmez**.
- Her yayında `sw.js` içindeki `CACHE = "sst-vN"` sürümü artırılmalıdır.

---

## sql/ dizini

Uygulanmış veritabanı yamaları ve inceleme raporları. Dosyalar ne yapıldığını
**ve neden yapıldığını** anlatır; çoğu Supabase migration olarak da kayıtlıdır
ve tekrar çalıştırılması gerekmez.

Bu dizindeki dosyalarda kişi adı, e-posta, telefon veya kullanıcı kimliği
**bulunmaz** — hepsi rol tanımlarıyla anonimleştirilmiştir. Yeni yama yazarken
aynı kurala uyun: veritabanı kişisel veri içerir, depo içermemelidir.
