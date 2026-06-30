"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { MapPin } from "lucide-react";
import { haneBaslik, yakRenk } from "../../lib/format";
import { KAPSAMLAR } from "../../lib/constants";
import Haneler from "./Haneler";

export default function ZiyaretModal({ hane, isSite, mapsHref, mesgul, onKaydet, onSifirla, onKapat }) {
  const [yaklasim, setYaklasim] = useState(hane.yaklasim || 0);
  const [kapsam, setKapsam] = useState(hane.kapsam || "");
  const [not_, setNot] = useState(hane.not_ || "");
  const [gecmis, setGecmis] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ziyaret_log").select("tarih, yaklasim, kapsam, not_").eq("hane_id", hane.id).order("tarih", { ascending: false }).limit(50);
      setGecmis(data || []);
    })();
  }, [hane.id, hane.tarih]);
  const baslik = haneBaslik(hane, isSite) || "Hane";
  const yakEtiket = ["", "Çok olumsuz", "Olumsuz", "Kararsız", "Olumlu", "Çok olumlu"];
  return (
    <div onClick={onKapat} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>{baslik}</h3>
          <span style={{ fontSize: 12, color: hane.ziyaret ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>{hane.ziyaret ? "Ziyaret edildi" : "Bekliyor"}</span>
        </div>
        {isSite && hane.adres && <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{hane.adres}{hane.kapi_no ? ` No ${hane.kapi_no}` : ""}</div>}
        {mapsHref && (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 600, marginBottom: 12 }}>
            <MapPin size={14} /> Haritada aç · yol tarifi
          </a>
        )}
        {(hane.tarih || hane.onceki_tarih) && (
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
            {hane.tarih && <>Son ziyaret: <b>{new Date(hane.tarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b></>}
          </div>
        )}

        {gecmis && gecmis.length > 0 && (
          <div style={{ margin: "0 0 14px", border: "1px solid #eef2f7", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", padding: "8px 10px 6px", background: "#f8fafc" }}>GEÇMİŞ ZİYARETLER ({gecmis.length})</div>
            <div style={{ maxHeight: 150, overflowY: "auto" }}>
              {gecmis.map((g, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderTop: "1px solid #f1f5f9", fontSize: 12.5, flexWrap: "wrap" }}>
                  <b style={{ minWidth: 112 }}>{g.tarih ? new Date(g.tarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</b>
                  {g.yaklasim ? <span style={{ color: yakRenk(g.yaklasim), fontWeight: 700 }}>Yaklaşım {g.yaklasim}/5</span> : null}
                  {g.kapsam ? <span style={{ background: "#eef2ff", color: "#3730a3", padding: "1px 8px", borderRadius: 6 }}>{g.kapsam}</span> : null}
                  {g.not_ ? <span style={{ color: "#64748b", width: "100%", marginLeft: 112 }}>— {g.not_}</span> : null}
                </div>
              ))}
            </div>
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>KARŞI TARAFIN YAKLAŞIMI</label>
        <div style={{ display: "flex", gap: 6, margin: "7px 0 4px" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setYaklasim(n)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid " + (yaklasim === n ? yakRenk(n) : "#d1d5db"), background: yaklasim === n ? yakRenk(n) : "#fff", color: yaklasim === n ? "#fff" : "#374151", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{n}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: yaklasim ? yakRenk(yaklasim) : "#94a3b8", fontWeight: 600, marginBottom: 14, minHeight: 16 }}>{yaklasim ? yakEtiket[yaklasim] : "1 = çok olumsuz · 5 = çok olumlu"}</div>

        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>KAPSAM <span style={{ fontWeight: 400, color: "#94a3b8" }}>(seç ya da kendin yaz)</span></label>
        <input list="kapsam-list" value={kapsam} onChange={(e) => setKapsam(e.target.value)} placeholder="Örn: Bayram ziyareti, esnaf ziyareti…" style={{ width: "100%", margin: "7px 0 14px", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 9, fontSize: 14 }} />
        <datalist id="kapsam-list">
          {KAPSAMLAR.map((k) => <option key={k} value={k} />)}
        </datalist>

        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>NOT</label>
        <textarea value={not_} onChange={(e) => setNot(e.target.value)} rows={3} placeholder="Ziyaret notu…" style={{ width: "100%", margin: "7px 0 16px", padding: 10, border: "1px solid #d1d5db", borderRadius: 9, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {hane.ziyaret && <button onClick={() => onSifirla(hane)} disabled={mesgul} style={{ padding: "9px 14px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", marginRight: "auto" }}>Sıfırla (bekliyora al)</button>}
          <button onClick={onKapat} style={{ padding: "9px 14px", background: "#fff", color: "#475569", border: "1px solid #d1d5db", borderRadius: 9, fontSize: 13, cursor: "pointer" }}>Kapat</button>
          <button onClick={() => onKaydet(hane, { yaklasim: yaklasim || null, kapsam, not_ })} disabled={mesgul} style={{ padding: "9px 16px", background: mesgul ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: mesgul ? "default" : "pointer" }}>{mesgul ? "Kaydediliyor…" : "Ziyaret edildi olarak kaydet"}</button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Haneler + ziyaret ===================== */
