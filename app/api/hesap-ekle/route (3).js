import { createClient } from "@supabase/supabase-js";

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
            mahalle_id, grup_id, kisi_id, gorev, sifre_gecici } = await req.json();
    if (!eposta || !sifre) return Response.json({ error: "E-posta ve şifre gerekli." }, { status: 400 });
    if (String(sifre).length < 6) return Response.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 });

    let uid;
    const { data: created, error: eC } = await a.auth.admin.createUser({ email: eposta, password: sifre, email_confirm: true });
    if (eC) {
      const { data: list } = await a.auth.admin.listUsers();
      uid = list?.users?.find((x) => x.email === eposta)?.id;
      if (!uid) return Response.json({ error: eC.message }, { status: 400 });
    } else uid = created.user.id;

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

    // Hedef ilçe (blok rolleri için de kapsam kalsın diye set ediyoruz)
    let hedefIlce = caller.rol === "ilce_yonetimi" ? caller.ilce_id : (ilce_id || null);
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
    if (sifre_gecici !== undefined) guncelle.sifre_gecici = !!sifre_gecici;

    const { error: eP } = await a.from("profiles").update(guncelle).eq("id", uid);
    if (eP) return Response.json({ error: eP.message }, { status: 400 });

    // Ekibe bağla (opsiyonel): kişi eklenirken sokak_ekip satırı da yazılır → giriş yapınca kendi bölgesini görür
    if (grup_id) {
      const rolGorev = gorev === "baskan" ? "baskan" : "uye";
      if (rolGorev === "baskan") await a.from("sokak_ekip").delete().eq("grup_id", grup_id).eq("gorev", "baskan");
      let mv = null;
      if (kisi_id) { const r = await a.from("sokak_ekip").select("id").eq("grup_id", grup_id).eq("kisi_id", kisi_id).maybeSingle(); mv = r.data; }
      const satir = { grup_id, gorev: rolGorev, kisi_id: kisi_id || null, profil_id: uid, ad_soyad: ad_soyad || null, telefon: telefon || null };
      const ekErr = mv
        ? (await a.from("sokak_ekip").update(satir).eq("id", mv.id)).error
        : (await a.from("sokak_ekip").insert(satir)).error;
      if (ekErr) return Response.json({ error: "Hesap açıldı ama ekibe bağlanamadı: " + ekErr.message, id: uid }, { status: 400 });
      // başkansa eski gösterim alanını da güncelle (baskan_id artık gerçek profil → GrupBaskaniGorunum da çalışır)
      if (rolGorev === "baskan") await a.from("sokak_grup").update({ baskan_id: uid, baskan_ad: ad_soyad || null }).eq("id", grup_id);
    }
    return Response.json({ ok: true, id: uid });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// Blok atamasını güncelle: var olan görevliyi başka bloğa da ekle / bloktan çıkar
export async function PATCH(req) {
  try {
    const a = admin();
    if (!a) return Response.json({ error: "Sunucuda SUPABASE_SERVICE_ROLE tanımlı değil." }, { status: 500 });
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    if (!(await yetkiVar(a, token))) return Response.json({ error: "Yetkiniz yok." }, { status: 403 });
    const { id, blok, site_kayit_id, rol } = await req.json();
    if (!id) return Response.json({ error: "id gerekli." }, { status: 400 });
    const upd = {};
    if (blok !== undefined) upd.blok = blok || null;
    if (site_kayit_id !== undefined) upd.site_kayit_id = site_kayit_id || null;
    if (rol !== undefined) {
      const gecerli = [...GENEL_ROLLER, ...BLOK_ROLLER].includes(rol) ? rol : null;
      if (!gecerli) return Response.json({ error: "Geçersiz rol." }, { status: 400 });
      upd.rol = gecerli;
      // Genel role dönerse blok/site bağını temizle (tutarlılık)
      if (!BLOK_ROLLER.includes(gecerli)) { upd.blok = null; upd.site_kayit_id = null; }
    }
    if (Object.keys(upd).length === 0) return Response.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    const { error } = await a.from("profiles").update(upd).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// Hesap silme: bölge + blok atamalarını boşalt + auth kullanıcısını sil
export async function DELETE(req) {
  try {
    const a = admin();
    if (!a) return Response.json({ error: "Sunucuda SUPABASE_SERVICE_ROLE tanımlı değil." }, { status: 500 });
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    if (!(await yetkiVar(a, token))) return Response.json({ error: "Yetkiniz yok." }, { status: 403 });
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id gerekli." }, { status: 400 });
    await a.from("bolge").update({ sorumlu_id: null }).eq("sorumlu_id", id);
    await a.from("bolge").update({ koordinator_id: null }).eq("koordinator_id", id);
    await a.from("sokak_ekip").update({ profil_id: null }).eq("profil_id", id);
    await a.auth.admin.deleteUser(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
