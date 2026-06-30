import { createClient } from "@supabase/supabase-js";

// Sunucu tarafı: service_role burada kalır, tarayıcıya gitmez.
// .env.local:  SUPABASE_SERVICE_ROLE=sb_secret_...   (NEXT_PUBLIC YOK!)
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !svc) return null;
  return createClient(url, svc, { auth: { persistSession: false } });
}
async function yetkiVar(a, token) {
  const { data: u } = await a.auth.getUser(token);
  if (!u?.user) return null;
  const { data: prof } = await a.from("profiles").select("rol, ilce_id").eq("id", u.user.id).single();
  if (!prof || !["il_yonetimi", "ilce_yonetimi"].includes(prof.rol)) return null;
  return { id: u.user.id, rol: prof.rol, ilce_id: prof.ilce_id };
}

export async function POST(req) {
  try {
    const a = admin();
    if (!a) return Response.json({ error: "Sunucuda SUPABASE_SERVICE_ROLE tanımlı değil (.env.local)." }, { status: 500 });
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const caller = await yetkiVar(a, token);
    if (!caller) return Response.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

    const { ad_soyad, eposta, sifre, rol, telefon, meslek, tc_no, ilce_id } = await req.json();
    if (!eposta || !sifre) return Response.json({ error: "E-posta ve şifre gerekli." }, { status: 400 });
    if (String(sifre).length < 6) return Response.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 });

    let uid;
    const { data: created, error: eC } = await a.auth.admin.createUser({ email: eposta, password: sifre, email_confirm: true });
    if (eC) {
      const { data: list } = await a.auth.admin.listUsers();
      uid = list?.users?.find((x) => x.email === eposta)?.id;
      if (!uid) return Response.json({ error: eC.message }, { status: 400 });
    } else uid = created.user.id;

    const gecerliRol = ["sorumlu", "koordinator", "ilce_yonetimi"].includes(rol) ? rol : "sorumlu";
    // İlçe başkanı yalnız kendi ilçesine ekler; il başkanlığı seçtiği ilçeye.
    let hedefIlce = caller.rol === "ilce_yonetimi" ? caller.ilce_id : (ilce_id || null);
    if (!hedefIlce) { const { data: bsk } = await a.from("ilce").select("id").eq("prefix", "BSK").single(); hedefIlce = bsk?.id || null; }
    const { error: eP } = await a.from("profiles").update({
      ad_soyad: ad_soyad || null, rol: gecerliRol,
      ilce_id: hedefIlce, telefon: telefon || null, meslek: meslek || null,
      tc_no: tc_no || null, aktif: true,
    }).eq("id", uid);
    if (eP) return Response.json({ error: eP.message }, { status: 400 });
    return Response.json({ ok: true, id: uid });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// Hesap silme: bölge atamalarını boşalt + auth kullanıcısını sil
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
    await a.auth.admin.deleteUser(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
