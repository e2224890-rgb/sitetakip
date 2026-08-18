"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Haneler from "./Haneler";

export default function SokakBolStrip({ bolge, onChanged }) {
  const [gruplar, setGruplar] = useState(null);
  const [hedefBoy, setHedefBoy] = useState(150);
  const [mesgul, setMesgul] = useState(false);

  async function yukle() {
    const { data } = await supabase.from("sokak_grup").select("id,no,kisi,hane,kapi_bas,kapi_son").eq("bolge_id", bolge.id).order("no");
    setGruplar(data || []);
  }
  useEffect(() => { setHedefBoy(150); yukle(); }, [bolge.id]);

  async function bol() {
    if (mesgul) return;
    setMesgul(true);
    try {
      const n = await sokakGrupBol(bolge.id, Math.max(1, hedefBoy || 150));
      await yukle();
      if (onChanged) onChanged();
      if (n === 0) alert("Bu sokakta bölünecek hane bulunamadı.");
    } catch (e) {
      alert("Bölme hatası: " + (e?.message || e));
    }
    setMesgul(false);
  }

  async function kaldir() {
    if (!confirm("Bu sokağın grupları silinsin mi? (Sorumlu atamaları da kalkar, haneler tekrar tek sokağa döner.)")) return;
    await supabase.from("sokak_grup").delete().eq("bolge_id", bolge.id);
    await yukle();
    if (onChanged) onChanged();
  }

  if (gruplar === null) return null;
  const bolundu = gruplar.length > 0;

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {bolundu ? (
          <>
            <b style={{ fontSize: 14 }}>Bu sokak {gruplar.length} gruba bölünmüş</b>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Gruplar listede ayrı kart olarak görünür · her birine sorumlu atayın</span>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#475569" }}>Grup boyu:</span>
              <input type="number" min={20} step={10} value={hedefBoy} onChange={(e) => setHedefBoy(Math.max(20, parseInt(e.target.value || "150", 10)))}
                style={{ width: 64, padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, textAlign: "center" }} />
              <button onClick={bol} disabled={mesgul} style={{ padding: "6px 12px", background: mesgul ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: mesgul ? "default" : "pointer" }}>{mesgul ? "Bölünüyor…" : "Yeniden böl"}</button>
              <button onClick={kaldir} style={{ padding: "6px 12px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>Grupları kaldır</button>
            </div>
          </>
        ) : (
          <>
            <b style={{ fontSize: 14 }}>Sokağı sorumlulara böl</b>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Kapı no sırasına göre ~{hedefBoy} kişilik gruplara böler (bir bina/kapı bütün kalır)</span>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#475569" }}>Grup boyu:</span>
              <input type="number" min={20} step={10} value={hedefBoy} onChange={(e) => setHedefBoy(Math.max(20, parseInt(e.target.value || "150", 10)))}
                style={{ width: 64, padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, textAlign: "center" }} />
              <button onClick={bol} disabled={mesgul} style={{ padding: "6px 14px", background: mesgul ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: mesgul ? "default" : "pointer" }}>{mesgul ? "Bölünüyor…" : "Kapı no'ya göre böl"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ===================== Grup sorumlu ataması (Haneler içinde, grup modunda) ===================== */
