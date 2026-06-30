"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { fmt } from "../../lib/format";
import Haneler from "./Haneler";
import Siteler from "./Siteler";

export default function GrupDetay({ bolge, grup, userId, yonetici }) {
  const [haneIds, setHaneIds] = useState(null);
  const [g, setG] = useState(grup);
  useEffect(() => {
    setHaneIds(null);
    (async () => {
      const [{ data: gg }, { data: hrows }] = await Promise.all([
        supabase.from("sokak_grup").select("*").eq("id", grup.id).single(),
        supabase.from("hane").select("id").eq("grup_id", grup.id),
      ]);
      const gr = gg || grup; setG(gr);
      setHaneIds((hrows || []).map((h) => h.id));
    })();
  }, [grup.id, bolge.id]);
  if (haneIds === null) return <div className="merkez">Grup yükleniyor…</div>;
  if (haneIds.length === 0) {
    return (
      <div className="panel" style={{ marginBottom: 14 }}>
        <h2 className="disp" style={{ margin: 0 }}>{bolge.kod}-{g.no}</h2>
        <div className="sub" style={{ marginBottom: 12 }}>{bolge.kapsam || ""}{g.kapi_bas ? ` · Kapı ${g.kapi_bas}–${g.kapi_son}` : ""}</div>
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: 14, color: "#9a3412", fontSize: 14, lineHeight: 1.6 }}>
          <b>Bu grupta hane bağlanmamış</b> (sokak_grup'ta {fmt(g.kisi || 0)} kişi yazıyor ama hiçbir hane bu gruba <code>grup_id</code> ile atanmamış).
          <div style={{ marginTop: 8 }}>Sebep büyük olasılıkla <b>11_hane_grup.sql çalışmadı</b> ya da RLS <code>hane</code> UPDATE'i engelliyor.</div>
          <div style={{ marginTop: 8 }}>Çözüm: 11_hane_grup.sql'i çalıştır → üst breadcrumb'tan <b>{bolge.kod}</b>'a dön → <b>Yeniden böl</b>. Hata olursa pop-up'ta görürsün.</div>
        </div>
      </div>
    );
  }
  return <Haneler birim={{ tip: "bolge", ...bolge }} userId={userId} yonetici={yonetici} planla grup={g} haneIds={haneIds} />;
}

/* ===================== Siteler (site-tipi mahalle -> site -> kapı/blok atama) ===================== */
/* ===================== Blok Görevlileri (site detayı sekmesi, login'li) ===================== */
