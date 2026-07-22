import { createClient } from "@supabase/supabase-js";

// Sunucu tarafı: service_role burada kalır (NEXT_PUBLIC YOK).
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

    const { sokak_id, site_kayit_id } = await req.json();
    if (!sokak_id) return Response.json({ error: "sokak_id gerekli." }, { status: 400 });

    const { data: sk } = await a.from("sokak").select("ilce_id").eq("id", sokak_id).single();
    if (!sk) return Response.json({ error: "Sokak bulunamadı." }, { status: 404 });
    if (caller.rol === "ilce_yonetimi" && sk.ilce_id !== caller.ilce_id)
      return Response.json({ error: "Bu sokak sizin ilçenizde değil." }, { status: 403 });

    const kaynak = site_kayit_id ? "onayli" : null;
    const sid = site_kayit_id || null;
    const e1 = (await a.from("sokak").update({ site_kayit_id: sid, site_kaynak: kaynak }).eq("id", sokak_id)).error;
    const e2 = (await a.from("hane").update({ site_kayit_id: sid, site_kaynak: kaynak }).eq("sokak_id", sokak_id)).error;
    if (e1 || e2) return Response.json({ error: (e1 || e2).message }, { status: 400 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
