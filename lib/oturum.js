import { supabase } from "./supabase";
import { cacheTemizle } from "./cache";

/* ORTAK ÇIKIŞ.
   Eskiden 9 ayrı yerde doğrudan supabase.auth.signOut() çağrılıyordu ve
   cache.js'teki cacheTemizle() — kendi yorumunda "ortak cihaz güvenliği" yazdığı
   halde — hiçbir yerden çağrılmıyordu. Sonuç: çıkış yapıldıktan sonra
   localStorage'da hane listeleri (ad, adres, telefon), profil ve bölge
   snapshot'ları duruyordu. Kurumsal/ortak cihazda sonraki kullanıcı bunları
   görebiliyordu.

   Sıra önemli: önce yerel veriyi sil, sonra oturumu kapat. Tersi olursa
   onAuthStateChange bileşenleri söker ve temizlik çalışmadan kalabilir. */
export async function cikisYap() {
  cacheTemizle();
  try {
    await supabase.auth.signOut();
  } finally {
    // signOut ağ hatası verse bile yerel oturum anahtarları gitsin
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-")) localStorage.removeItem(k);
      }
    } catch {}
  }
}
