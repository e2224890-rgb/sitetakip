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

export const BLOK_ROL_LISTE = [["blok_sorumlu", "Blok Sorumlusu"], ["ana_kademe", "Ana Kademe"], ["kadin_kollari", "Kadın Kolları"], ["genclik_kollari", "Gençlik Kolları"]];

export const BLOK_ROL_AD = Object.fromEntries(BLOK_ROL_LISTE);

// Blok adı normalize: "A01", "A1", "A1 BLOK" → "A1" (ama "B1-14" ≠ "B1-15" korunur)
