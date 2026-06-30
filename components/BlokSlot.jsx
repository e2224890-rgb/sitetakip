"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { blokParts } from "../../lib/format";

export default function BlokSlot({ site, blok, rol, rolEtiket, mevcut, digerHesaplar, onChanged }) {
  const [ad, setAd] = useState(""); const [eposta, setEposta] = useState(""); const [sifre, setSifre] = useState("");
  const [durum, setDurum] = useState(null); const [mesgul, setMesgul] = useState(false);
  async function olustur() {
    setDurum(null);
    if (!eposta || !sifre) { setDurum({ t: "e", m: "E-posta ve şifre gerekli." }); return; }
    if (sifre.length < 6) { setDurum({ t: "e", m: "Şifre en az 6 karakter." }); return; }
    setMesgul(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/hesap-ekle", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ ad_soyad: ad || eposta, eposta, sifre, rol, site_kayit_id: site.id, blok }),
      });
      const txt = await r.text();
      let j = null; try { j = JSON.parse(txt); } catch (_) { }
      if (!r.ok || !j) setDurum({ t: "e", m: j?.error || `Sunucu hatası (${r.status}). "/api/hesap-ekle" bulunamadı ya da derlenemedi — route.js dosyasını ve dev sunucusunu kontrol et.` });
      else { setEposta(""); setSifre(""); setAd(""); onChanged(); }
    } catch (e) { setDurum({ t: "e", m: String(e) }); }
    setMesgul(false);
  }
  async function blokYaz(id, yeniBlok) {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/hesap-ekle", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ id, blok: yeniBlok }) });
  }
  async function varOlanEkle(p) {
    if (!p) return;
    const yeni = [...new Set([...blokParts(p.blok), blok])].join(",");
    await blokYaz(p.id, yeni); onChanged();
  }
  async function cikar() {
    const kalan = blokParts(mevcut.blok).filter((b) => b !== blok);
    if (kalan.length === 0) {
      if (!confirm(`${rolEtiket} hesabı (${mevcut.eposta}) yalnız bu bloğa atanmış — tümden silinsin mi?`)) return;
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/hesap-ekle", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ id: mevcut.id }) });
    } else {
      await blokYaz(mevcut.id, kalan.join(","));
    }
    onChanged();
  }
  const inp = { padding: "6px 9px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 };
  const lbl = <span style={{ minWidth: 116, fontSize: 13, fontWeight: 600, color: "#334155" }}>{rolEtiket}</span>;
  if (mevcut) {
    const kapsadigi = blokParts(mevcut.blok);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderTop: "1px solid #f1f5f9", background: "#f0fdf4" }}>
        {lbl}
        <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✓ {mevcut.eposta}</span>
        {mevcut.ad_soyad && <span style={{ fontSize: 13, color: "#475569" }}>{mevcut.ad_soyad}</span>}
        {kapsadigi.length > 1 && <span style={{ fontSize: 12, color: "#0369a1", background: "#e0f2fe", padding: "2px 8px", borderRadius: 6 }}>{kapsadigi.length} blok: {kapsadigi.join(", ")}</span>}
        <button onClick={cikar} style={{ marginLeft: "auto", padding: "5px 10px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>{kapsadigi.length > 1 ? "Bu bloktan çıkar" : "Hesabı sil"}</button>
      </div>
    );
  }
  return (
    <div style={{ padding: "8px 12px", borderTop: "1px solid #f1f5f9", background: "#fafafa" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {lbl}
        <input placeholder="Ad Soyad" value={ad} onChange={(e) => setAd(e.target.value)} style={{ ...inp, width: 140 }} />
        <input placeholder="E-posta" value={eposta} onChange={(e) => setEposta(e.target.value)} style={{ ...inp, flex: 1, minWidth: 150 }} />
        <input placeholder="Şifre (min 6)" type="text" value={sifre} onChange={(e) => setSifre(e.target.value)} style={{ ...inp, width: 120 }} />
        <button onClick={olustur} disabled={mesgul} style={{ padding: "6px 12px", background: mesgul ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: mesgul ? "default" : "pointer" }}>{mesgul ? "..." : "Hesap aç"}</button>
      </div>
      {(digerHesaplar || []).length > 0 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, marginLeft: 122 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>↪ veya var olan görevliyi bu bloğa da ekle:</span>
          <select className="sel" defaultValue="" onChange={(e) => { const p = digerHesaplar.find((x) => x.id === e.target.value); varOlanEkle(p); e.target.value = ""; }} style={{ ...inp, padding: "5px 8px" }}>
            <option value="">— seç —</option>
            {digerHesaplar.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad ? `${p.ad_soyad} · ` : ""}{p.eposta}{blokParts(p.blok).length ? ` (${blokParts(p.blok).join(", ")})` : ""}</option>)}
          </select>
        </div>
      )}
      {durum && <div style={{ marginTop: 6, fontSize: 13, color: durum.t === "ok" ? "#166534" : "#b91c1c", marginLeft: 122 }}>{durum.m}</div>}
    </div>
  );
}
