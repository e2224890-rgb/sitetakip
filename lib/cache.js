// localStorage tabanlı basit snapshot önbelleği (stale-while-revalidate deseni).
// Amaç: açılışta son bilinen veriyi ANINDA göstermek, arka planda tazelemek.
// Anahtarlar kullanıcı id'si içerir -> aynı cihazda farklı hesaplar karışmaz.
const ONEK = "sst-cache:";

export function cacheOku(anahtar) {
  try {
    const s = localStorage.getItem(ONEK + anahtar);
    return s ? JSON.parse(s) : null;
  } catch { return null; } // SSR/prerender veya bozuk JSON -> sessizce boş dön
}

export function cacheYaz(anahtar, deger) {
  try { localStorage.setItem(ONEK + anahtar, JSON.stringify(deger)); } catch {}
}

export function cacheSil(anahtar) {
  try { localStorage.removeItem(ONEK + anahtar); } catch {}
}

// Çıkışta tüm snapshot'ları temizle (ortak cihaz güvenliği)
export function cacheTemizle() {
  try {
    const silinecek = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(ONEK)) silinecek.push(k);
    }
    silinecek.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
