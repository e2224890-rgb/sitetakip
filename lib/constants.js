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

// Mahalle nüfusları (TÜİK / ADNKS). Kaynak güncellendiğinde buradan değiştirilir.
// NOT: Uygulamadaki "Kayaşehir" resmî kayıtta "Kayabaşı" mahallesidir.
export const MAHALLE_NUFUS = {
  "Kayaşehir": 112367,
  "Kayabaşı": 112367,
  "Güvercintepe": 76217,
  "Başakşehir": 71244,
  "Başak": 70658,
  "Bahçeşehir 2. Kısım": 61602,
  "Bahçeşehir 1. Kısım": 37332,
  "Şahintepe": 31567,
  "Ziya Gökalp": 31210,
  "Altınşehir": 26909,
  "Şamlar": 1248,
};

// Karşı tarafın yaklaşımı — saha renk kodu (siyah / gri / beyaz)
// DB'de 1-5 arası tutulur: 1=Siyah, 3=Gri, 5=Beyaz (eski 2 ve 4 değerleri de yakınına eşlenir)
export const YAKLASIM_LISTE = [
  { deger: 1, ad: "Siyah", aciklama: "Karşı · olumsuz", bg: "#1f2937", fg: "#ffffff", kenar: "#111827" },
  { deger: 3, ad: "Gri", aciklama: "Kararsız · çekimser", bg: "#9ca3af", fg: "#ffffff", kenar: "#6b7280" },
  { deger: 5, ad: "Beyaz", aciklama: "Olumlu · destek", bg: "#ffffff", fg: "#111827", kenar: "#cbd5e1" },
];

export function yaklasimBilgi(v) {
  const n = Number(v) || 0;
  if (!n) return null;
  if (n <= 2) return YAKLASIM_LISTE[0];
  if (n === 3) return YAKLASIM_LISTE[1];
  return YAKLASIM_LISTE[2];
}

// Teşkilat — mahalleden sorumlu görevliler
// Kişi: { ad, unvan (varsa özel görev), k: true (kadın ise), tel: "05..." }
// İlçe Yürütme Kurulu üyelerinin birim başkanlıkları (akpartibasaksehir.com)
export const ILCE_BIRIM = {
  "ALİ METİN": "Siyasi ve Hukuki İşler Başkanı",
  "AKİF BİLGİÇ": "Teşkilat Başkanı",
  "AHMET KOÇ": "Seçim İşleri Başkanı",
  "ÖMER FARUK TÜRK": "Tanıtım Medya Başkanı",
  "KADİR KURT": "Sosyal Politikalar Başkanı",
  "YUNUS KARAASLAN": "Yerel Yönetimler Başkanı",
  "SİNAN ÇELİKKOL": "Ekonomi İşleri Başkanı",
  "ABDULLAH BEYREK": "Sivil Toplum ve Halkla İlişkiler Başkanı",
  "MUHAMMED BURAK YILDIZ": "Mali ve İdari İşler Başkanı",
  "ESRA AĞILLI": "Sekreterya Birim Başkanı",
};

export const ILCE_BASKANI = { ad: "Feti Ahmet Balin", tel: "" };

// İlçeden sorumlu İl Başkan Yardımcıları (ilçe genelinde gösterilir)
export const IL_SORUMLULAR = [
  { ad: "Çağrı Çaylı", unvan: "Sorumlu İl Yönetim Kurulu Üyesi" },
  { ad: "Yusuf Aslan", unvan: "İl Başkan Yardımcısı - Sosyal Politikalar Başkanı" },
];

export const MAHALLE_TESKILAT = {
  "Altınşehir": {
    baskan: { ad: "DERVİŞ YILDIRIM", tel: "(532) 470-4134" },
    yurutme: { ad: "ÖMER FARUK TÜRK", tel: "(532) 633-4650" },
    yk: [{ ad: "YUSUF DEĞERLİ", tel: "(532) 250-9341" }, { ad: "LEVENT TAN", tel: "(532) 200-9833" }, { ad: "HİKMET DURDU", tel: "(535) 482-9185" }],
    meclis: [{ ad: "CANAN ÖZBEK", k: true, tel: "(532) 160-1944" }, { ad: "HASAN MALKOÇ", tel: "(532) 233-6604" }],
    bby: { ad: "AHMET MELİK", tel: "(505) 222-4167" },
  },
  "Bahçeşehir 1. Kısım": {
    baskan: { ad: "SERDAR KALBİŞEN", tel: "(532) 564-3406" },
    yurutme: { ad: "AHMET KOÇ", tel: "(532) 300-1844" },
    yk: [{ ad: "MURAT ERGÜL", tel: "(542) 301-5252" }],
    meclis: [{ ad: "NURDAN ERTUĞRUL", k: true, tel: "(533) 236-0360" }, { ad: "ONUR GÖZEN", tel: "(532) 401-2727" }, { ad: "NEBAHAT ERKESİM", k: true, tel: "(544) 859-3322" }],
    bby: { ad: "ÖMER FARUK AY", tel: "(507) 641-4308" },
  },
  "Bahçeşehir 2. Kısım": {
    baskan: { ad: "MÜRSEL HÜSEYİN OKTAY", tel: "(532) 485-5536" },
    yurutme: { ad: "KADİR KURT", tel: "(532) 630-5050" },
    yk: [{ ad: "SELAHATTİN PAKER", tel: "(532) 263-4995" }, { ad: "KAAN ULUTAŞ", tel: "(531) 470-4829" }],
    meclis: [{ ad: "VOLKAN KAHRAMAN", tel: "(532) 213-9313" }, { ad: "PERİHAN BANU SAVAŞ", k: true, tel: "(532) 616-7947" }],
    bby: { ad: "ÖMER FARUK AY", tel: "(507) 641-4308" },
  },
  "Başak": {
    baskan: { ad: "ADEM AKDAĞ", tel: "(535) 365-7676" },
    yurutme: { ad: "ESRA AĞILLI", k: true, tel: "(534) 923-6304" },
    yk: [{ ad: "NURAY ÖZŞAFAK", k: true, tel: "(532) 763-6650" }, { ad: "NAİL TİLBAÇ", tel: "(532) 556-7283" }, { ad: "ASİYE YALÇIN", k: true, tel: "(543) 809-4651" }],
    meclis: [{ ad: "ELİF AĞILLI", k: true, tel: "(534) 923-6302" }, { ad: "ÖMER FARUK AY", tel: "(507) 641-4308" }],
    bby: { ad: "ÖMER FARUK AY", tel: "(507) 641-4308" },
  },
  "Başakşehir": {
    baskan: { ad: "İLHAMİ GÜRCAN", tel: "(536) 317-3948" },
    yurutme: { ad: "SİNAN ÇELİKKOL", tel: "(532) 675-2588" },
    yk: [{ ad: "ABDULLAH POLAT", tel: "(532) 452-9405" }, { ad: "MUHAMMED BEŞİNCİ", tel: "(532) 555-1515" }, { ad: "REYYAN SEVİNÇ", k: true, tel: "(506) 060-5191" }, { ad: "FATMA AYDIN", k: true, tel: "(535) 466-1436" }],
    meclis: [{ ad: "FATİH KOÇKAR", tel: "(532) 607-1334" }, { ad: "AHMET OCAKÇI", tel: "(554) 979-3552" }],
    bby: { ad: "ÖMER FARUK AY", tel: "(507) 641-4308" },
  },
  "Güvercintepe": {
    baskan: { ad: "MEHMET BAYRAM", tel: "(536) 309-6305" },
    yurutme: { ad: "ALİ METİN", tel: "(532) 224-9202" },
    yk: [{ ad: "YAŞAR AÇIKGÖZ", tel: "(532) 468-0737" }, { ad: "İRFAN IŞIKYILDIZ", tel: "(532) 642-8769" }, { ad: "HABİBE TUGAY", k: true, tel: "(507) 538-1924" }, { ad: "ENGİN ÖZCAN", tel: "(530) 112-2555" }],
    meclis: [{ ad: "MUSTAFA TEKDEN", tel: "(532) 202-5160" }, { ad: "BARIŞCAN KISACIK", tel: "(537) 438-1764" }],
    bby: { ad: "AHMET MELİK", tel: "(505) 222-4167" },
  },
  "Kayaşehir": {
    baskan: { ad: "AYDIN KISKAÇ", tel: "(542) 767-4417" },
    yurutme: { ad: "ABDULLAH BEYREK", tel: "(532) 585-3888" },
    yk: [{ ad: "MERVE BAYCAR", k: true, tel: "(530) 776-1139" }, { ad: "SEMANUR BEKTAŞ", k: true, tel: "(530) 112-4210" }, { ad: "BUSE GÜLSÜM CEBECİ", k: true, tel: "(530) 952-3319" }],
    meclis: [{ ad: "MURAT ŞAHİN", tel: "(532) 345-3441" }, { ad: "SALİH GEDİKOĞLU", tel: "(561) 614-9561" }],
    bby: { ad: "AHMET MELİK", tel: "(505) 222-4167" },
  },
  "Şahintepe": {
    baskan: { ad: "MEHMET İNCEL", tel: "(533) 012-2924" },
    yurutme: { ad: "KADİR KURT", tel: "(532) 630-5050" },
    yk: [{ ad: "CAFER YAZAR", tel: "(536) 563-7490" }, { ad: "YUSUF ŞİN", tel: "(533) 611-5379" }, { ad: "FURKAN ÇAKIR", tel: "(541) 782-0574" }],
    meclis: [{ ad: "BİRSEN AYVAZ", k: true, tel: "(532) 666-6961" }, { ad: "ABDULLAH AYDIN", tel: "(552) 222-2249" }],
    bby: { ad: "ÖMER FARUK AY", tel: "(507) 641-4308" },
  },
  "Şamlar": {
    baskan: { ad: "DURSUN ÖNDER", tel: "(535) 575-9611" },
    yurutme: { ad: "MUHAMMED BURAK YILDIZ", tel: "(546) 459-6605" },
    yk: [{ ad: "FURKAN TAŞBAŞI", tel: "(536) 717-1201" }],
    meclis: [{ ad: "ERCAN ALİOĞLU", tel: "(534) 597-7255" }],
    bby: { ad: "ÖMER FARUK AY", tel: "(507) 641-4308" },
  },
  "Ziya Gökalp": {
    baskan: { ad: "RAHMİ GÜR", tel: "(544) 328-2057" },
    yurutme: { ad: "SİNAN ÇELİKKOL", tel: "(532) 675-2588" },
    yk: [{ ad: "ALAADİN MOHSEN", tel: "(538) 555-7043" }, { ad: "YILMAZ İSTANBULLU", tel: "(533) 591-6301" }],
    meclis: [{ ad: "EVREN ÖZKAN", tel: "(533) 518-3764" }, { ad: "ERTAN AKBAL", tel: "(532) 514-9576" }],
    bby: { ad: "ÖMER FARUK AY", tel: "(507) 641-4308" },
  },
};

export const BLOK_ROL_LISTE = [["blok_sorumlu", "Blok Sorumlusu"], ["ana_kademe", "Ana Kademe Temsilci"], ["kadin_kollari", "Kadın Temsilci"], ["genclik_kollari", "Gençlik Temsilci"]];

// Site Yönetim Kurulu görevleri (Madde 7) — site geneli, bloğa bağlı değil
export const SITE_YK_LISTE = [["site_teskilat", "Site Teşkilat Sorumlusu"], ["site_sosyal", "Site Sosyal Faaliyet Sorumlusu"], ["site_sekreter", "Site Sekreteri"]];
export const SITE_YK_AD = Object.fromEntries(SITE_YK_LISTE);

export const BLOK_ROL_AD = Object.fromEntries(BLOK_ROL_LISTE);

// Blok adı normalize: "A01", "A1", "A1 BLOK" → "A1" (ama "B1-14" ≠ "B1-15" korunur)
