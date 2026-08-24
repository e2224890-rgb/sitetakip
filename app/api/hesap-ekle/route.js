import { createClient } from "@supabase/supabase-js";
import { hataMetni, hataOnekli } from "../../../lib/hata";

// Sunucu tarafı: service_role burada kalır, tarayıcıya gitmez.
// .env.local (ve Vercel env):  SUPABASE_SERVICE_ROLE=...   (NEXT_PUBLIC YOK!)
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !svc) return null;
  return createClient(url, svc, { auth: { persistSession: false } });
}
const ADMIN_ROLLER = ["il_yonetimi", "ilce_yonetimi"];
const EKIP_KURUCU = ["sorumlu", "koordinator"]; // kendi ekibini kurabilen saha rolleri
async function yetkiVar(a, token) {
  const { data: u } = await a.auth.getUser(token);
  if (!u?.user) return null;
  const { data: prof } = await a.from("profiles").select("rol, ilce_id").eq("id", u.user.id).single();
  if (!prof || ![...ADMIN_ROLLER, ...EKIP_KURUCU].includes(prof.rol)) return null;
  return { id: u.user.id, rol: prof.rol, ilce_id: prof.ilce_id };
}

/* YETKİ YÜKSELTME KAPATILDI.
   Bu route service_role ile çalışır, yani RLS'i tamamen baypas eder — buradaki
   kontroller veritabanının SON savunma hattı değil, TEK savunma hattıdır.
   Eskiden PATCH ve DELETE yalnızca yetkiVar() çağırıyordu; o da sorumlu ve
   koordinator rollerini kabul ettiği için herhangi bir saha sorumlusu tek bir
   istekle kendini ilce_yonetimi yapabiliyor (GENEL_ROLLER içinde o rol var) ya
   da il başkanının hesabını silebiliyordu. Artık her ikisi de yönetim istiyor
   ve hedef, çağıranın kapsamında olmak zorunda. */
function adminMi(caller) { return !!caller && ADMIN_ROLLER.includes(caller.rol); }

// Hedef profil çağıranın yetki alanında mı?
//   il_yonetimi   -> herkes
//   ilce_yonetimi -> yalnızca kendi ilçesindekiler, il yönetimi hariç
async function kapsamdaMi(a, caller, hedefId) {
  if (caller.rol === "il_yonetimi") return true;
  const { data: h } = await a.from("profiles").select("rol, ilce_id").eq("id", hedefId).maybeSingle();
  if (!h) return false;
  if (h.rol === "il_yonetimi") return false;              // ilçe, ili yönetemez
  return !!caller.ilce_id && h.ilce_id === caller.ilce_id;
}

/* PostgREST tek istekte en fazla 1000 satır döndürür; .limit(2000) sessizce
   1000'e iner. Telefon eşleşmesi bu yüzden 1000. profilden sonra çalışmıyordu
   ve mükerrer hesap sorununu geri getiriyordu. Sayfa sayfa tarayıp bulunca
   duruyoruz. */
async function telefonlaProfilBul(a, telNorm) {
  const SAYFA = 1000;
  for (let bas = 0; bas < 200000; bas += SAYFA) {
    const { data, error } = await a.from("profiles")
      .select("id, eposta, telefon").not("telefon", "is", null)
      .order("id").range(bas, bas + SAYFA - 1);
    if (error) return null;
    const parca = data || [];
    const es = parca.find((p) => String(p.telefon).replace(/\D/g, "").slice(-10) === telNorm);
    if (es) return es;
    if (parca.length < SAYFA) return null;
  }
  return null;
}

/* auth.admin.listUsers() sayfa başına 50 kayıt döndürür. Sistemde 49 kullanıcı
   vardı — yani bu sınır bir sonraki hesapta patlayacaktı. Sayfaları geziyoruz. */
async function authKullaniciBulEposta(a, eposta) {
  const hedef = String(eposta || "").toLowerCase();
  for (let sayfa = 1; sayfa <= 200; sayfa++) {
    const { data, error } = await a.auth.admin.listUsers({ page: sayfa, perPage: 200 });
    if (error) return null;
    const liste = data?.users || [];
    const es = liste.find((x) => String(x.email || "").toLowerCase() === hedef);
    if (es) return es;
    if (liste.length < 200) return null;
  }
  return null;
}

const BLOK_ROLLER = ["blok_sorumlu", "ana_kademe", "kadin_kollari", "genclik_kollari", "site_teskilat", "site_sosyal", "site_sekreter"];
const GENEL_ROLLER = ["sorumlu", "koordinator", "ilce_yonetimi"];
const SAHA_ROLLER = ["grup_baskani", "mahalle_baskani"]; // ekip üyesi / mahalle başkanı

export async function POST(req) {
  try {
    const a = admin();
    if (!a) return Response.json({ error: "Sunucuda SUPABASE_SERVICE_ROLE tanımlı değil (.env.local)." }, { status: 500 });
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const caller = await yetkiVar(a, token);
    if (!caller) return Response.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

    const { ad_soyad, eposta, sifre, rol, telefon, meslek, tc_no, ilce_id, site_kayit_id, blok,
            mahalle_id, grup_id, kisi_id, gorev, sifre_gecici, benzersizEposta } = await req.json();
    if (!eposta || !sifre) return Response.json({ error: "E-posta ve şifre gerekli." }, { status: 400 });
    if (String(sifre).length < 6) return Response.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 });

    let uid;
    let epostaKullanilan = eposta;
    let mevcutHesap = false;

    /* AYNI KİŞİYE İKİNCİ HESAP AÇMA.
       Daha önce bu kontrol yoktu: SokakYonetim/TeskilatYonetim e-postayı rastgele
       ekle ürettiği için aynı kişi ikinci kez atandığında mevcut hesabı bulunamıyor,
       yeni hesap açılıyordu. 7 kişide mükerrer hesap oluştu; atamalar bir hesaba,
       kullanıcının bildiği şifre diğerine bağlı kaldığı için sahadaki kişi kendi
       bölgesini göremedi (bkz. sql/06_mukerrer_hesap_duzelt.sql).

       Eşleştirme sırası: (1) hedef e-posta zaten kayıtlıysa o hesap, (2) telefonun
       son 10 hanesi tutuyorsa o hesap. Telefon tutmuyorsa aynı isimli FARKLI kişi
       kabul edilir ve aşağıdaki benzersizleştirme devreye girer. */
    const telNorm = String(telefon || "").replace(/\D/g, "").slice(-10);
    {
      const { data: epostaSahibi } = await a.from("profiles").select("id, eposta, telefon").eq("eposta", eposta).maybeSingle();
      if (epostaSahibi) {
        const sahipTel = String(epostaSahibi.telefon || "").replace(/\D/g, "").slice(-10);
        // e-posta aynı + (telefon yoksa ya da tutuyorsa) -> aynı kişi
        if (!telNorm || !sahipTel || sahipTel === telNorm) { uid = epostaSahibi.id; mevcutHesap = true; }
      }
      if (!uid && telNorm.length === 10) {
        const es = await telefonlaProfilBul(a, telNorm);
        if (es) { uid = es.id; epostaKullanilan = es.eposta; mevcutHesap = true; }
      }
    }

    if (mevcutHesap) {
      // hesap var: yeni auth kullanıcısı açma, aşağıdaki atama adımları bu id'ye işlesin
    } else if (benzersizEposta) {
      // ad.soyad@... çakışırsa ad.soyad1@, ad.soyad2@ ... dener
      const at = eposta.indexOf("@");
      const yerel = at >= 0 ? eposta.slice(0, at) : eposta;
      const alan = at >= 0 ? eposta.slice(at) : "@akpartibasaksehir.com";
      let n = 0, ok = false;
      while (n <= 50) {
        const deneme = n === 0 ? `${yerel}${alan}` : `${yerel}${n}${alan}`;
        const { data: cr, error: e2 } = await a.auth.admin.createUser({ email: deneme, password: sifre, email_confirm: true });
        if (!e2) { uid = cr.user.id; epostaKullanilan = deneme; ok = true; break; }
        const m = (e2.message || "").toLowerCase();
        if (m.includes("already") || m.includes("registered") || m.includes("exists") || e2.code === "email_exists") { n++; continue; }
        return Response.json({ error: hataMetni(e2) }, { status: 400 });
      }
      if (!ok) return Response.json({ error: "Uygun benzersiz e-posta bulunamadı." }, { status: 400 });
    } else {
      const { data: created, error: eC } = await a.auth.admin.createUser({ email: eposta, password: sifre, email_confirm: true });
      if (eC) {
        const mevcut = await authKullaniciBulEposta(a, eposta);
        uid = mevcut?.id;
        if (!uid) return Response.json({ error: hataMetni(eC) }, { status: 400 });
      } else uid = created.user.id;
    }

    // Rol yetkilendirme: yönetim her rolü açabilir; sorumlu/koordinatör YALNIZCA grup_baskani (ekip üyesi) açabilir
    const isAdmin = ADMIN_ROLLER.includes(caller.rol);
    const talep = rol || "grup_baskani";
    let gecerliRol;
    if (isAdmin) {
      gecerliRol = [...GENEL_ROLLER, ...BLOK_ROLLER, ...SAHA_ROLLER].includes(talep) ? talep : "sorumlu";
    } else {
      if (talep !== "grup_baskani") return Response.json({ error: "Bu rolü yalnızca yönetim açabilir." }, { status: 403 });
      gecerliRol = "grup_baskani";
    }

    // Hedef ilçe (blok rolleri için de kapsam kalsın diye set ediyoruz).
    // Yalnızca il yönetimi başka bir ilçeyi seçebilir; diğer roller için istek
    // gövdesindeki ilce_id yok sayılır — aksi halde bir sorumlu başka ilçede
    // hesap açabilirdi.
    let hedefIlce = caller.rol === "il_yonetimi" ? (ilce_id || null) : caller.ilce_id;
    if (!hedefIlce) { const { data: bsk } = await a.from("ilce").select("id").eq("prefix", "BSK").single(); hedefIlce = bsk?.id || null; }

    // İletişim bilgileri her rol için yazılır (blok sorumlusu da normal kullanıcı gibi tam bilgiyle)
    const guncelle = {
      ad_soyad: ad_soyad || null, rol: gecerliRol, ilce_id: hedefIlce, aktif: true,
      telefon: telefon || null, meslek: meslek || null, tc_no: tc_no || null,
    };
    if (BLOK_ROLLER.includes(gecerliRol)) {
      // BLOK GÖREVLİSİ: ayrıca siteye ve bloğa bağla
      guncelle.site_kayit_id = site_kayit_id || null;
      guncelle.blok = blok || null;
    }
    if (gecerliRol === "mahalle_baskani" || mahalle_id) guncelle.mahalle_id = mahalle_id || null;
    // Mevcut hesap yeniden kullanılıyorsa şifre durumuna DOKUNMA: kişi şifresini
    // çoktan belirlemiş olabilir, sifre_gecici=true yazmak onu tekrar şifre
    // değiştirme ekranına düşürür.
    if (sifre_gecici !== undefined && !mevcutHesap) guncelle.sifre_gecici = !!sifre_gecici;

    const { error: eP } = await a.from("profiles").update(guncelle).eq("id", uid);
    if (eP) return Response.json({ error: hataMetni(eP) }, { status: 400 });

    // Ekibe bağla (opsiyonel): kişi eklenirken sokak_ekip satırı da yazılır → giriş yapınca kendi bölgesini görür
    if (grup_id) {
      /* GRUP SAHİPLİĞİ. Bu blok aşağıda sokak_grup.baskan_id ve bolge.sorumlu_id
         yazıyor. Sahiplik doğrulanmadığı için bir sorumlu, başka bir bölgenin
         grup_id'sini göndererek kendini o bölgenin sorumlusu yapabiliyordu. */
      const { data: gk } = await a.from("sokak_grup")
        .select("bolge_id, bolge:bolge_id ( ilce_id, sorumlu_id, koordinator_id )")
        .eq("id", grup_id).maybeSingle();
      if (!gk) return Response.json({ error: "Grup bulunamadı." }, { status: 404 });
      const b = gk.bolge || {};
      const grupYetkisi =
        caller.rol === "il_yonetimi" ? true
        : caller.rol === "ilce_yonetimi" ? (!!caller.ilce_id && b.ilce_id === caller.ilce_id)
        : (b.sorumlu_id === caller.id || b.koordinator_id === caller.id);
      if (!grupYetkisi) return Response.json({ error: "Bu grup sizin yetki alanınızda değil." }, { status: 403 });

      const rolGorev = gorev === "baskan" ? "baskan" : "uye";
      if (rolGorev === "baskan") await a.from("sokak_ekip").delete().eq("grup_id", grup_id).eq("gorev", "baskan");
      let mv = null;
      if (kisi_id) { const r = await a.from("sokak_ekip").select("id").eq("grup_id", grup_id).eq("kisi_id", kisi_id).maybeSingle(); mv = r.data; }
      const satir = { grup_id, gorev: rolGorev, kisi_id: kisi_id || null, profil_id: uid, ad_soyad: ad_soyad || null, telefon: telefon || null };
      const ekErr = mv
        ? (await a.from("sokak_ekip").update(satir).eq("id", mv.id)).error
        : (await a.from("sokak_ekip").insert(satir)).error;
      if (ekErr) return Response.json({ error: hataOnekli("Hesap açıldı ama ekibe bağlanamadı", ekErr), id: uid }, { status: 400 });
      // başkansa eski gösterim alanını da güncelle (baskan_id artık gerçek profil → GrupBaskaniGorunum da çalışır)
      if (rolGorev === "baskan") {
        await a.from("sokak_grup").update({ baskan_id: uid, baskan_ad: ad_soyad || null }).eq("id", grup_id);
        // Bölge seviyesindeki gösterim de aynı kişiyi göstersin (tek kaynak)
        const { data: g } = await a.from("sokak_grup").select("bolge_id").eq("id", grup_id).single();
        if (g?.bolge_id) await a.from("bolge").update({ sorumlu_id: uid }).eq("id", g.bolge_id);
      }
    }
    // mevcutHesap: yeni hesap açılmadı, kişinin var olan hesabı kullanıldı —
    // arayüz "şifre saha2026" diye yanıltıcı bir kutu göstermemeli.
    return Response.json({ ok: true, id: uid, eposta: epostaKullanilan, mevcutHesap });
  } catch (e) {
    return Response.json({ error: hataMetni(e) }, { status: 500 });
  }
}

// Blok atamasını güncelle: var olan görevliyi başka bloğa da ekle / bloktan çıkar
export async function PATCH(req) {
  try {
    const a = admin();
    if (!a) return Response.json({ error: "Sunucuda SUPABASE_SERVICE_ROLE tanımlı değil." }, { status: 500 });
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const caller = await yetkiVar(a, token);
    if (!adminMi(caller)) return Response.json({ error: "Bu işlem için yönetim yetkisi gerekli." }, { status: 403 });
    const { id, blok, site_kayit_id, rol } = await req.json();
    if (!id) return Response.json({ error: "id gerekli." }, { status: 400 });
    if (!(await kapsamdaMi(a, caller, id)))
      return Response.json({ error: "Bu kullanıcı sizin yetki alanınızda değil." }, { status: 403 });
    const upd = {};
    if (blok !== undefined) upd.blok = blok || null;
    if (site_kayit_id !== undefined) upd.site_kayit_id = site_kayit_id || null;
    if (rol !== undefined) {
      const gecerli = [...GENEL_ROLLER, ...BLOK_ROLLER].includes(rol) ? rol : null;
      if (!gecerli) return Response.json({ error: "Geçersiz rol." }, { status: 400 });
      // Yönetim rolünü yalnızca il yönetimi dağıtabilir; ilçe yönetimi kendi
      // dengi bir hesap açıp yetki zincirini genişletemez.
      if (gecerli === "ilce_yonetimi" && caller.rol !== "il_yonetimi")
        return Response.json({ error: "İlçe yönetimi rolünü yalnızca il yönetimi verebilir." }, { status: 403 });
      upd.rol = gecerli;
      // Genel role dönerse blok/site bağını temizle (tutarlılık)
      if (!BLOK_ROLLER.includes(gecerli)) { upd.blok = null; upd.site_kayit_id = null; }
    }
    if (Object.keys(upd).length === 0) return Response.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    // .select() ile kaç satırın gerçekten güncellendiğini görüyoruz: olmayan bir
    // id gönderildiğinde update hata vermez, 0 satır günceller ve eskiden
    // yanıltıcı biçimde { ok: true } dönüyordu.
    const { data: guncellenen, error } = await a.from("profiles").update(upd).eq("id", id).select("id");
    if (error) return Response.json({ error: hataMetni(error) }, { status: 400 });
    if (!guncellenen || guncellenen.length === 0)
      return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: hataMetni(e) }, { status: 500 });
  }
}

// Hesap silme: bölge + blok atamalarını boşalt + auth kullanıcısını sil
export async function DELETE(req) {
  try {
    const a = admin();
    if (!a) return Response.json({ error: "Sunucuda SUPABASE_SERVICE_ROLE tanımlı değil." }, { status: 500 });
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const caller = await yetkiVar(a, token);
    if (!adminMi(caller)) return Response.json({ error: "Bu işlem için yönetim yetkisi gerekli." }, { status: 403 });
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id gerekli." }, { status: 400 });
    if (id === caller.id) return Response.json({ error: "Kendi hesabınızı silemezsiniz." }, { status: 400 });
    if (!(await kapsamdaMi(a, caller, id)))
      return Response.json({ error: "Bu kullanıcı sizin yetki alanınızda değil." }, { status: 403 });

    // Atamaları boşalt. sokak_grup.baskan_id'nin ON DELETE davranışı yok
    // (NO ACTION), yani temizlenmezse grup başkanı olan bir kullanıcının
    // silinmesi FK ihlaliyle başarısız oluyordu.
    const temizle = [
      a.from("bolge").update({ sorumlu_id: null }).eq("sorumlu_id", id),
      a.from("bolge").update({ koordinator_id: null }).eq("koordinator_id", id),
      a.from("sokak_grup").update({ baskan_id: null }).eq("baskan_id", id),
      a.from("sokak_ekip").update({ profil_id: null }).eq("profil_id", id),
    ];
    for (const istek of temizle) {
      const { error } = await istek;
      if (error) return Response.json({ error: hataOnekli("Atamalar temizlenemedi", error) }, { status: 400 });
    }
    const { error: eSil } = await a.auth.admin.deleteUser(id);
    if (eSil) return Response.json({ error: hataOnekli("Hesap silinemedi", eSil) }, { status: 400 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: hataMetni(e) }, { status: 500 });
  }
}
