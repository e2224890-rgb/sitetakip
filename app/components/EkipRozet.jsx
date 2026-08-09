"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

/* Sorumlunun / bölgenin / grubun YÖNETİMİNİ (sokak_ekip) gösterir.
   Tıklayınca ekranda ORTALANAN sabit bir pencere açılır — hiçbir yerde kesilmez. */
export default function EkipRozet({ bolgeId, grupId, cocuk }) {
  const [acik, setAcik] = useState(false);
  const [ekip, setEkip] = useState(null);

  async function yukle() {
    if (ekip !== null) return;
    let gids = [];
    if (grupId) gids = [grupId];
    else if (bolgeId) {
      const { data: gs } = await supabase.from("sokak_grup").select("id").eq("bolge_id", bolgeId);
      gids = (gs || []).map((g) => g.id);
    }
    if (!gids.length) { setEkip([]); return; }
    const { data } = await supabase.from("sokak_ekip")
      .select("gorev, ad_soyad, telefon, grup_id").in("grup_id", gids);
    setEkip((data || []).sort((a, b) => (a.gorev === "baskan" ? -1 : b.gorev === "baskan" ? 1 : 0)));
  }

  const ac = (e) => { e.stopPropagation(); setAcik(true); yukle(); };
  const kapat = () => setAcik(false);

  const baskan = (ekip || []).filter((e) => e.gorev === "baskan");
  const uyeler = (ekip || []).filter((e) => e.gorev !== "baskan");

  return (
    <>
      <span onClick={ac} style={{ cursor: "pointer", display: "inline-flex", width: "100%" }}>{cocuk}</span>
      {acik && (
        <div onClick={kapat}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 360, maxHeight: "80vh", overflowY: "auto", background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px rgba(0,0,0,0.3)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <b style={{ fontSize: 15, color: "#0f172a" }}>Sokak Yönetimi</b>
              <button onClick={kapat} style={{ marginLeft: "auto", border: "none", background: "#f1f5f9", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16, color: "#475569", lineHeight: 1 }}>×</button>
            </div>
            {ekip === null && <div style={{ fontSize: 13, color: "#94a3b8" }}>Yükleniyor…</div>}
            {ekip !== null && ekip.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8" }}>Henüz ekip kurulmadı.</div>}
            {baskan.map((e, i) => (
              <div key={"b" + i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, marginBottom: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 9, padding: "8px 10px" }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", padding: "1px 7px", borderRadius: 999 }}>👑 BAŞKAN</span>
                <b>{e.ad_soyad || "—"}</b>{e.telefon && <span style={{ color: "#64748b", marginLeft: "auto" }}>{e.telefon}</span>}
              </div>
            ))}
            {uyeler.map((e, i) => (
              <div key={"u" + i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, marginBottom: 6, background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 9, padding: "8px 10px" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, background: "#eef2ff", color: "#3730a3", padding: "1px 7px", borderRadius: 999 }}>ÜYE</span>
                <span>{e.ad_soyad || "—"}</span>{e.telefon && <span style={{ color: "#64748b", marginLeft: "auto" }}>{e.telefon}</span>}
              </div>
            ))}
            {ekip !== null && (
              <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 10, textAlign: "center" }}>
                başkan {baskan.length ? "1" : "0"} · üye {uyeler.length}/3
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
