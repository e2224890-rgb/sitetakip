"use client";
import { useState, useEffect } from "react";

export default function RolSlot({ etiket, mevcut, onKaydet }) {
  const [ad, setAd] = useState(mevcut?.ad_soyad || "");
  const [tel, setTel] = useState(mevcut?.telefon || "");
  const [ok, setOk] = useState(false);
  useEffect(() => { setAd(mevcut?.ad_soyad || ""); setTel(mevcut?.telefon || ""); }, [mevcut?.id]);
  const degisti = ad !== (mevcut?.ad_soyad || "") || tel !== (mevcut?.telefon || "");
  async function kaydet() { await onKaydet(ad.trim(), tel.trim()); setOk(true); setTimeout(() => setOk(false), 1400); }
  const inp = { padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 };
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
      <span style={{ width: 112, fontSize: 12, color: "#475569", fontWeight: 600 }}>{etiket}</span>
      <input placeholder="Ad Soyad" value={ad} onChange={(e) => setAd(e.target.value)} style={{ ...inp, flex: 1, minWidth: 140 }} />
      <input placeholder="Telefon" value={tel} onChange={(e) => setTel(e.target.value)} style={{ ...inp, width: 120 }} />
      {degisti && <button onClick={kaydet} style={{ padding: "5px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Kaydet</button>}
      {ok && <span style={{ color: "#16a34a", fontSize: 13 }}>✓</span>}
    </div>
  );
}
