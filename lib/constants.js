// Sabitler
export const SAYFA = 50;

export const IST_ILCELER = [
  "Adalar","Arnavutköy","Ataşehir","Avcılar","Bağcılar","Bahçelievler","Bakırköy",
  "Başakşehir","Bayrampaşa","Beşiktaş","Beykoz","Beylikdüzü","Beyoğlu","Büyükçekmece",
  "Çatalca","Çekmeköy","Esenler","Esenyurt","Eyüpsultan","Fatih","Gaziosmanpaşa",
  "Güngören","Kadıköy","Kağıthane","Kartal","Küçükçekmece","Maltepe","Pendik",
  "Sancaktepe","Sarıyer","Silivri","Sultanbeyli","Sultangazi","Şile","Şişli",
  "Tuzla","Ümraniye","Üsküdar","Zeytinburnu"
];

/* ===================== Kök ===================== */

export const KAPSAMLAR = ["Genel ziyaret", "Üye kaydı", "Bayram", "Taziye", "Geçmiş olsun", "Talep / şikayet", "Davet / etkinlik", "Anket / yoklama"];

export const BLOK_ROL_LISTE = [["blok_sorumlu", "Blok Sorumlusu"], ["ana_kademe", "Ana Kademe Temsilci"], ["kadin_kollari", "Kadın Temsilci"], ["genclik_kollari", "Gençlik Temsilci"]];

// Site Yönetim Kurulu görevleri (Madde 7) — site geneli, bloğa bağlı değil
export const SITE_YK_LISTE = [["site_teskilat", "Site Teşkilat Sorumlusu"], ["site_sosyal", "Site Sosyal Faaliyet Sorumlusu"], ["site_sekreter", "Site Sekreteri"]];
export const SITE_YK_AD = Object.fromEntries(SITE_YK_LISTE);

export const BLOK_ROL_AD = Object.fromEntries(BLOK_ROL_LISTE);

// Blok adı normalize: "A01", "A1", "A1 BLOK" → "A1" (ama "B1-14" ≠ "B1-15" korunur)
