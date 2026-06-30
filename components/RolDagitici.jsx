"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import BlokSorumluGorunum from "./BlokSorumluGorunum";
import GrupBaskaniGorunum from "./GrupBaskaniGorunum";
import KoordinatorGorunum from "./KoordinatorGorunum";
import SahaGorunum from "./SahaGorunum";
import Yonetim from "./Yonetim";

export default function RolDagitici({ session }) {
  const [profil, setProfil] = useState(undefined);
  useEffect(() => {
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
      setProfil(data || { rol: "sorumlu", ad_soyad: null });
    })();
  }, [session.user.id]);

  if (profil === undefined) return <div className="merkez">Yükleniyor…</div>;
  const rol = profil.rol;
  if (rol === "il_yonetimi" || rol === "ilce_yonetimi") return <Yonetim session={session} profil={profil} />;
  if (rol === "koordinator") return <KoordinatorGorunum session={session} profil={profil} />;
  if (rol === "grup_baskani") return <GrupBaskaniGorunum session={session} profil={profil} />;
  if (rol === "blok_sorumlu" || rol === "ana_kademe" || rol === "kadin_kollari" || rol === "genclik_kollari") return <BlokSorumluGorunum session={session} profil={profil} />;
  return <SahaGorunum session={session} profil={profil} alan="sorumlu_id" baslik="Sorumlu" />;
}

/* ===================== Giriş ===================== */
