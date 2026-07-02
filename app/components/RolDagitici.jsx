"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../../lib/supabase";
import { cacheOku, cacheYaz } from "../../lib/cache";

// Rol ekranları lazy yükleniyor -> ilk bundle küçülür, sadece kullanıcının
// rolüne ait kod iner. Hash'li chunk'lar SW'de cache-first olduğundan
// ikinci açılıştan itibaren bu yükleme de anında olur.
const Yukleniyor = () => <div className="merkez">Yükleniyor…</div>;
const dyn = (yol) => dynamic(yol, { ssr: false, loading: Yukleniyor });
const Yonetim = dyn(() => import("./Yonetim"));
const KoordinatorGorunum = dyn(() => import("./KoordinatorGorunum"));
const GrupBaskaniGorunum = dyn(() => import("./GrupBaskaniGorunum"));
const BlokSorumluGorunum = dyn(() => import("./BlokSorumluGorunum"));
const SahaGorunum = dyn(() => import("./SahaGorunum"));

export default function RolDagitici({ session }) {
  const cacheAnahtar = `profil:${session.user.id}`;
  // Son bilinen profil varsa ANINDA onunla başla -> "Yükleniyor…" adımı atlanır
  const [profil, setProfil] = useState(() => cacheOku(cacheAnahtar) || undefined);

  useEffect(() => {
    let iptal = false;
    (async () => {
      let { data, error } = await supabase.from("profiles")
        .select("rol, ad_soyad, meslek, ilce_id, site_kayit_id, blok").eq("id", session.user.id).single();
      // site_kayit_id/blok kolonları henüz yoksa (SQL 16 çalışmadıysa) sorgu hata verir —
      // bu durumda admini "sorumlu"ya düşürmemek için kolonsuz tekrar dene.
      if (error) {
        const r = await supabase.from("profiles")
          .select("rol, ad_soyad, meslek, ilce_id").eq("id", session.user.id).single();
        data = r.data;
      }
      if (iptal) return;
      const taze = data || { rol: "sorumlu", ad_soyad: null };
      setProfil(taze);            // rol değiştiyse ekran kendini düzeltir
      cacheYaz(cacheAnahtar, taze); // bir sonraki açılış için sakla
    })();
    return () => { iptal = true; };
  }, [session.user.id]);

  if (profil === undefined) return <Yukleniyor />;
  const rol = profil.rol;
  if (rol === "il_yonetimi" || rol === "ilce_yonetimi") return <Yonetim session={session} profil={profil} />;
  if (rol === "koordinator") return <KoordinatorGorunum session={session} profil={profil} />;
  if (rol === "grup_baskani") return <GrupBaskaniGorunum session={session} profil={profil} />;
  if (rol === "blok_sorumlu" || rol === "ana_kademe" || rol === "kadin_kollari" || rol === "genclik_kollari") return <BlokSorumluGorunum session={session} profil={profil} />;
  return <SahaGorunum session={session} profil={profil} alan="sorumlu_id" baslik="Sorumlu" />;
}
