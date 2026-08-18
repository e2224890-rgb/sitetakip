// Supabase/PostgREST tek istekte en fazla 1000 satır döndürür (varsayılan max-rows).
// Limit aşıldığında HATA VERMEZ — sessizce keser. Büyük bölge/sitelerde bu, eksik
// hane/kişi listesi ve yanlış ziyaret-üye oranı demekti. Bu yardımcı, satırların
// tamamı gelene kadar .range() ile sayfa sayfa çeker.
//
// Kullanım — sorgu kurucu (bas, son) alır ve HER SAYFADA yeni builder döndürmelidir
// (supabase builder'ı tek kullanımlıktır):
//   const hepsi = await tumSatirlar((bas, son) =>
//     supabase.from("kisi").select("id, ad", { count: "exact" }).eq("bolge_id", id).order("id").range(bas, son));
//
// NOT: sorguya { count: "exact" } ve deterministik bir .order(...) eklemek şart.
// Sıralama olmadan sayfalar arasında satır tekrarı/kaybı olabilir.

const SAYFA_BOY = 1000;
const AZAMI_TUR = 200; // güvenlik freni: 200k satır — sonsuz döngüyü engeller

export async function tumSatirlar(sorguKur, sayfaBoy = SAYFA_BOY) {
  const hepsi = [];
  let bas = 0;
  let toplam = null;
  for (let tur = 0; tur < AZAMI_TUR; tur++) {
    const { data, error, count } = await sorguKur(bas, bas + sayfaBoy - 1);
    if (error) throw error;
    const parca = data || [];
    hepsi.push(...parca);
    if (toplam === null && typeof count === "number") toplam = count;
    if (!parca.length) break;
    bas += parca.length; // sunucu daha az döndürdüyse (max-rows düşükse) ona göre ilerle
    if (toplam !== null ? hepsi.length >= toplam : parca.length < sayfaBoy) break;
  }
  return hepsi;
}
