/**
 * Şamlar DÜZELTME — grupları temizleyip doğru ekiple yeniden kurar.
 * - Her grubun sokak_ekip'ini SIFIRLAR (eski test kayıtları: KADİFE, AYŞE vb. gider).
 * - Kişileri e-postadan bulur; hesabı varsa YENİDEN KULLANIR (kopya açmaz), yoksa açar.
 * - Her grubun ilk kişisi = başkan (sorumlu), gerisi üye (grup_baskani).
 *
 * ÇALIŞTIRMA (proje kökünde):
 *   1) Dosya başındaki SUPABASE_URL / SERVICE_ROLE'u doldur (ya da ortam değişkeni ver).
 *   2) node samlar_ekip_duzelt.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

// .env / .env.local'i otomatik oku (elle doldurmaya gerek yok)
function envOku() {
  const g = {};
  for (const dosya of [".env", ".env.local"]) {   // .env.local sonra okunur -> üzerine yazar
    try {
      const t = fs.readFileSync(dosya, "utf8");
      t.split(/\r?\n/).forEach((l) => { const i = l.indexOf("="); if (i > 0 && !l.trim().startsWith("#")) g[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["\']|["\']$/g, ""); });
    } catch {}
  }
  return g;
}
const ENV = envOku();

// Anahtarlar YALNIZCA ortamdan/.env'den gelir — dosyaya gömülmez (git'e sızmasın).
const SUPABASE_URL = process.env.SUPABASE_URL || ENV.SUPABASE_URL || ENV.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || ENV.SUPABASE_SERVICE_ROLE;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE bulunamadı.\n" +
    "Proje kökündeki .env dosyasına ekleyin ya da ortam değişkeni olarak verin.");
  process.exit(1);
}

const SIFRE = "saha2026";
const DOMAIN = "@akpartibasaksehir.com";
const MAHALLE = "Şamlar";

const GRUPLAR = [
  { no: 1, kisiler: [
    { ad: "Hamide Konuk", tel: "05353425770" },
    { ad: "Cüneyt Önder", tel: "05317149537" },
    { ad: "Turan Orhan", tel: "05377799562", not: "izinde" },
    { ad: "Uğur Selalmaz", tel: "05304782557" },
    { ad: "Yusuf Altınışık", tel: "05013709223" },
    { ad: "Azime Konuk", tel: "05352430309" },
  ]},
  { no: 2, kisiler: [
    { ad: "Mustafa Toprak", tel: "05436907058" },
    { ad: "Nurgül Kurtuluş", tel: "05312714855" },
    { ad: "Mehmet Aslan", tel: "05074502785" },
    { ad: "Alperen Önder", tel: "05512538360" },
    { ad: "Fatma Konuk", tel: "05558821883" },
  ]},
  { no: 3, kisiler: [
    { ad: "Fatma Ağar", tel: "05452204997" },
    { ad: "Faik Şaka", tel: "05059833467" },
    { ad: "Ali Eren Yılmaz", tel: "05384953359" },
    { ad: "Rıdvan Öten", tel: "05372885291" },
    { ad: "Ayla Yağız Ramazan", tel: "05389740362" },
  ]},
];

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const trSlug = (t) => (t || "").toLocaleLowerCase("tr")
  .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
  .replace(/[^a-z0-9]/g, "");

// Tüm auth kullanıcılarını e-posta->id olarak bir kez topla
let _kullaniciMap = null;
async function kullaniciMap() {
  if (_kullaniciMap) return _kullaniciMap;
  _kullaniciMap = {};
  for (let page = 1; page <= 30; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    (data?.users || []).forEach((u) => { if (u.email) _kullaniciMap[u.email.toLowerCase()] = u.id; });
    if (!data?.users?.length || data.users.length < 1000) break;
  }
  return _kullaniciMap;
}

// Kişi için hesabı bul (varsa) ya da aç; uid + eposta döner
async function hesapBulVeyaAc(ad, tel, rol) {
  const [a1, ...rest] = ad.trim().split(/\s+/);
  const yerel = `${trSlug(a1) || "ad"}.${trSlug(rest.join(" ")) || "soyad"}`;
  const map = await kullaniciMap();
  // önce mevcut ad.soyad / ad.soyadN hesaplarını ara
  for (let n = 0; n <= 50; n++) {
    const eposta = `${yerel}${n === 0 ? "" : n}${DOMAIN}`;
    if (map[eposta.toLowerCase()]) {
      const uid = map[eposta.toLowerCase()];
      await sb.from("profiles").update({ ad_soyad: ad.trim(), rol, telefon: tel || null, sifre_gecici: true, aktif: true }).eq("id", uid);
      return { uid, eposta, yeni: false };
    }
  }
  // yoksa yeni aç
  for (let n = 0; n <= 50; n++) {
    const eposta = `${yerel}${n === 0 ? "" : n}${DOMAIN}`;
    const { data, error } = await sb.auth.admin.createUser({ email: eposta, password: SIFRE, email_confirm: true });
    if (!error) {
      _kullaniciMap[eposta.toLowerCase()] = data.user.id;
      await sb.from("profiles").update({ ad_soyad: ad.trim(), rol, telefon: tel || null, sifre_gecici: true, aktif: true }).eq("id", data.user.id);
      return { uid: data.user.id, eposta, yeni: true };
    }
    const m = (error.message || "").toLowerCase();
    if (m.includes("already") || m.includes("registered") || m.includes("exists")) continue;
    throw new Error(`${ad}: ${error.message}`);
  }
  throw new Error(`${ad}: hesap açılamadı`);
}

async function grupBul(sira) {
  const { data: mah } = await sb.from("mahalle").select("id, ad").ilike("ad", `%${MAHALLE}%`).limit(1);
  if (!mah || !mah.length) throw new Error(`Mahalle bulunamadı: ${MAHALLE}`);
  const { data: bolgeler } = await sb.from("bolge").select("id, kod").eq("mahalle_id", mah[0].id).order("kod");
  if (!bolgeler || bolgeler.length < sira) throw new Error(`Şamlar'da ${sira}. bölge yok (mevcut ${bolgeler?.length || 0})`);
  const bolge = bolgeler[sira - 1];
  let { data: gruplar } = await sb.from("sokak_grup").select("id, no").eq("bolge_id", bolge.id).order("no");
  if (!gruplar || !gruplar.length) {
    const { data: yeni, error } = await sb.from("sokak_grup").insert({ bolge_id: bolge.id, no: 1 }).select("id, no").single();
    if (error) throw new Error(`${bolge.kod}: grup oluşturulamadı — ${error.message}`);
    gruplar = [yeni];
  }
  return { bolgeId: bolge.id, bolgeKod: bolge.kod, grupId: gruplar[0].id };
}

(async () => {
  if (SUPABASE_URL.includes("BURAYA") || SERVICE_ROLE.includes("BURAYA")) {
    console.error("HATA: SUPABASE_URL ve SERVICE_ROLE'u doldur.");
    process.exit(1);
  }
  const rapor = [];
  for (const g of GRUPLAR) {
    const { bolgeId, bolgeKod, grupId } = await grupBul(g.no);
    // 1) grubu temizle (eski test kayıtları gitsin)
    await sb.from("sokak_ekip").delete().eq("grup_id", grupId);
    console.log(`\n=== Grup ${g.no} -> ${bolgeKod} : temizlendi, yeniden kuruluyor ===`);
    for (let i = 0; i < g.kisiler.length; i++) {
      const k = g.kisiler[i];
      const baskanMi = i === 0;
      const rol = baskanMi ? "sorumlu" : "grup_baskani";
      try {
        const { uid, eposta, yeni } = await hesapBulVeyaAc(k.ad, k.tel, rol);
        await sb.from("sokak_ekip").insert({ grup_id: grupId, gorev: baskanMi ? "baskan" : "uye", profil_id: uid, ad_soyad: k.ad, telefon: k.tel || null });
        if (baskanMi) {
          await sb.from("sokak_grup").update({ baskan_id: uid, baskan_ad: k.ad }).eq("id", grupId);
          await sb.from("bolge").update({ sorumlu_id: uid }).eq("id", bolgeId);
        }
        const etiket = baskanMi ? "BAŞKAN" : "üye";
        rapor.push({ grup: g.no, kisi: k.ad, rol: etiket, eposta, not: k.not || "" });
        console.log(`  [${etiket}] ${k.ad} -> ${eposta}${yeni ? " (yeni)" : " (mevcut)"}${k.not ? " · " + k.not : ""}`);
      } catch (e) {
        console.error(`  HATA: ${k.ad} — ${e.message}`);
      }
    }
  }
  console.log("\n=== GİRİŞ BİLGİLERİ ===\nGrup | Rol | Ad | E-posta | Şifre(saha2026) | Not");
  rapor.forEach((r) => console.log(`${r.grup} | ${r.rol} | ${r.kisi} | ${r.eposta} | ${SIFRE} | ${r.not}`));
  process.exit(0);
})();
