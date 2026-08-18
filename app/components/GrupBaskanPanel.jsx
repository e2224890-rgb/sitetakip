"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Haneler from "./Haneler";
import Sorumlular from "./Sorumlular";

export default function GrupBaskanPanel({ grup, onAtandi }) {
  const [g, setG] = useState(grup);
  const [profiller, setProfiller] = useState([]);
  const [atandi, setAtandi] = useState(false);
  const [hata, setHata] = useState(null);
  useEffect(() => { setG(grup); }, [grup.id]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("id, ad_soyad, eposta, rol").in("rol", ["sorumlu", "koordinator"]).order("ad_soyad");
      setProfiller(data || []);
    })();
  }, []);

  async function ata(val) {
    setHata(null);
    const prof = profiller.find((p) => p.id === val);
    const ad = prof ? (prof.ad_soyad || prof.eposta) : null;
    const { data, error } = await supabase.from("sokak_grup").update({ baskan_id: val || null, baskan_ad: ad }).eq("id", g.id).select("id");
    if (error) { setHata("Kaydedilemedi: " + error.message); return; }
    if (!data || data.length === 0) { setHata("Kaydedilemedi — 0 satır güncellendi (sokak_grup UPDATE'i RLS engelliyor olabilir)."); return; }
    setG((x) => ({ ...x, baskan_id: val || null, baskan_ad: ad }));
    setAtandi(true); setTimeout(() => setAtandi(false), 1500);
    if (onAtandi) onAtandi(val || null, ad);
  }

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="atama-strip">
        <div className="as-grup">
          <span className="as-lbl">SOKAK SORUMLUSU</span>
          <select className="sel" value={g.baskan_id || ""} onChange={(e) => ata(e.target.value)}>
            <option value="">— atanmadı —</option>
            {profiller.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad || p.eposta}</option>)}
          </select>
          {atandi && <span className="ok-mini">✓ kaydedildi</span>}
        </div>
        {profiller.length === 0 && <span className="dim">Önce Sorumlular sayfasından hesap oluşturun.</span>}
      </div>
      {hata && <div style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{hata}</div>}
    </div>
  );
}

/* ===================== Grup Detayı (BSK-GUV-001-1) — Haneler'i gruba göre süzer ===================== */
