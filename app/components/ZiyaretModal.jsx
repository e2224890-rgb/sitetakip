"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { MapPin } from "lucide-react";
import { haneBaslik, yakRenk } from "../../lib/format";
import { YAKLASIM_LISTE, yaklasimBilgi } from "../../lib/constants";
import { KAPSAMLAR } from "../../lib/constants";
import Haneler from "./Haneler";
import { hataOnekli } from "../../lib/hata";

export default function ZiyaretModal({ hane, isSite, mapsHref, mesgul, onKaydet, onSifirla, onKapat }) {
  const [yaklasim, setYaklasim] = useState(hane.yaklasim || 0);
  const [kapsam, setKapsam] = useState(hane.kapsam || "");
  const [not_, setNot] = useState(hane.not_ || "");
  const [talepAcik, setTalepAcik] = useState(false);
  const [talep, setTalep] = useState({ kisi_id: "", ad_soyad: "", telefon: "", kategori: "", baslik: "", aciklama: "", oncelik: "normal" });
  const [talepMesaj, setTalepMesaj] = useState("");
  const [talepMesgul, setTalepMesgul] = useState(false);
  async function talepKaydet() {
    if (!talep.baslik.trim()) { setTalepMesaj("Başlık gerekli."); return; }
    setTalepMesgul(true); setTalepMesaj("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const kisi = (hane.kisiler || []).find((k) => k.id === talep.kisi_id);
      const sahip = talep.kisi_id ? `${kisi?.ad || ""} ${kisi?.soyad || ""}`.trim() : talep.ad_soyad.trim();
      const { data: t, error } = await supabase.from("talep").insert({
        hane_id: hane.id, kisi_id: talep.kisi_id || null,
        kategori: talep.kategori.trim() || null, baslik: talep.baslik.trim(), aciklama: talep.aciklama.trim() || null,
        durum: "yeni", oncelik: talep.oncelik, ad_soyad: sahip || null, telefon: (talep.telefon || kisi?.telefon || "").trim() || null,
        olusturan_id: session?.user?.id || null,
      }).select("id").single();
      if (error) throw error;
      /* İlk süreç kaydını talep_log_tg trigger'ı zaten yazıyor
         (islem='olusturuldu', aciklama=başlık). Buradaki elle insert hem çift
         kayıt üretecekti hem de talep_log.islem NOT NULL olduğu ve
         gönderilmediği için her seferinde hataya düşüyordu. */
      setTalep({ kisi_id: "", ad_soyad: "", telefon: "", kategori: "", baslik: "", aciklama: "", oncelik: "normal" });
      setTalepAcik(false); setTalepMesaj("Talep kaydedildi ✓");
    } catch (e) { setTalepMesaj(hataOnekli("Kaydedilemedi", e)); }
    setTalepMesgul(false);
  }
  const [gecmis, setGecmis] = useState(null);
  const [kisiMap, setKisiMap] = useState({}); // kullanici_id -> profil (ad_soyad, rol)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ziyaret_log").select("tarih, yaklasim, kapsam, not_, kullanici_id").eq("hane_id", hane.id).order("tarih", { ascending: false }).limit(50);
      const list = data || [];
      setGecmis(list);
      const uids = [...new Set(list.map((g) => g.kullanici_id).filter(Boolean))];
      if (uids.length) {
        const { data: pr } = await supabase.from("profiles").select("id, ad_soyad, eposta, rol").in("id", uids);
        const m = {}; (pr || []).forEach((p) => { m[p.id] = p; }); setKisiMap(m);
      } else setKisiMap({});
    })();
  }, [hane.id, hane.tarih]);
  // Rol -> okunur etiket. Site bağlamında "sorumlu" = Site Başkanı.
  const rolEtiket = (rol) => {
    const blok = { blok_sorumlu: "Blok Sorumlusu", ana_kademe: "Ana Kademe Temsilci", kadin_kollari: "Kadın Temsilci", genclik_kollari: "Gençlik Temsilci" };
    if (blok[rol]) return blok[rol];
    if (rol === "sorumlu") return isSite ? "Site Temsilcisi" : "Sorumlu";
    if (rol === "koordinator") return "Koordinatör";
    if (rol === "grup_baskani") return "Grup Başkanı";
    if (rol === "il_yonetimi" || rol === "ilce_yonetimi") return "Yönetim";
    return "Görevli";
  };
  const rolRenk = (rol) => rol === "kadin_kollari" ? { bg: "#fce7f3", fg: "#9d174d" }
    : rol === "genclik_kollari" ? { bg: "#dcfce7", fg: "#166534" }
      : rol === "ana_kademe" ? { bg: "#e0e7ff", fg: "#3730a3" }
        : rol === "sorumlu" ? { bg: "#ffedd5", fg: "#9a3412" }
          : { bg: "#f1f5f9", fg: "#475569" };
  const baslik = haneBaslik(hane, isSite) || "Hane";
  const yakEtiket = ["", "Çok olumsuz", "Olumsuz", "Kararsız", "Olumlu", "Çok olumlu"];
  return (
    <div onClick={onKapat} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", WebkitOverflowScrolling: "touch", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>{baslik}</h3>
          <span style={{ fontSize: 12, color: hane.ziyaret ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>{hane.ziyaret ? "Ziyaret edildi" : "Bekliyor"}</span>
        </div>
        {isSite && hane.adres && <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{hane.adres}{hane.kapi_no ? ` No ${hane.kapi_no}` : ""}</div>}
        {mapsHref && (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 5, fontSize: 13, color: "#2563eb", textDecoration: "none", fontWeight: 600, marginBottom: 12 }}>
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
              {gecmis.map((g, i) => {
                const p = g.kullanici_id ? kisiMap[g.kullanici_id] : null;
                const rk = p ? rolRenk(p.rol) : null;
                return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderTop: "1px solid #f1f5f9", fontSize: 12.5, flexWrap: "wrap" }}>
                  <b style={{ minWidth: 112 }}>{g.tarih ? new Date(g.tarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</b>
                  {g.yaklasim ? (() => { const y = yaklasimBilgi(g.yaklasim); return <span style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: y.bg, border: `1px solid ${y.kenar}`, display: "inline-block" }} />{y.ad}</span>; })() : null}
                  {g.kapsam ? <span style={{ background: "#eef2ff", color: "#3730a3", padding: "1px 8px", borderRadius: 6 }}>{g.kapsam}</span> : null}
                  {p ? <span style={{ background: rk.bg, color: rk.fg, padding: "1px 8px", borderRadius: 6, fontWeight: 600 }}>{p.ad_soyad || p.eposta} · {rolEtiket(p.rol)}</span> : null}
                  {g.not_ ? <span style={{ color: "#64748b", width: "100%", marginLeft: 112 }}>— {g.not_}</span> : null}
                </div>
                );
              })}
            </div>
          </div>
        )}

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginTop: 14 }}>KARŞI TARAFIN YAKLAŞIMI</label>
        <div style={{ display: "flex", gap: 8, margin: "7px 0 6px" }}>
          {YAKLASIM_LISTE.map((y) => {
            const secili = yaklasimBilgi(yaklasim)?.deger === y.deger;
            return (
              <button key={y.deger} onClick={() => setYaklasim(y.deger)} title={y.aciklama}
                style={{
                  flex: 1, padding: "12px 0 10px", borderRadius: 11, cursor: "pointer",
                  border: secili ? `3px solid #2563eb` : `1px solid ${y.kenar}`,
                  background: y.bg, color: y.fg, fontWeight: 800, fontSize: 14,
                  boxShadow: secili ? "0 0 0 3px #bfdbfe" : "none",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                }}>
                <span style={{ fontSize: 15 }}>{y.ad}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.85 }}>{y.aciklama}</span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 14, minHeight: 16 }}>
          {yaklasim
            ? <span style={{ color: "#334155" }}>Seçilen: <b>{yaklasimBilgi(yaklasim)?.ad}</b> — {yaklasimBilgi(yaklasim)?.aciklama}</span>
            : "Siyah = karşı · Gri = kararsız · Beyaz = olumlu"}
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>KAPSAM <span style={{ fontWeight: 400, color: "#94a3b8" }}>(seç ya da kendin yaz)</span></label>
        <input list="kapsam-list" value={kapsam} onChange={(e) => setKapsam(e.target.value)} placeholder="Örn: Bayram ziyareti, esnaf ziyareti…" style={{ width: "100%", margin: "7px 0 14px", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 9, fontSize: 14 }} />
        <datalist id="kapsam-list">
          {KAPSAMLAR.map((k) => <option key={k} value={k} />)}
        </datalist>

        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>NOT</label>
        <textarea value={not_} onChange={(e) => setNot(e.target.value)} rows={3} placeholder="Ziyaret notu…" style={{ width: "100%", margin: "7px 0 12px", padding: 10, border: "1px solid #d1d5db", borderRadius: 9, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />

        {/* TALEP EKLE */}
        <div style={{ border: "1px solid #e5eaf2", borderRadius: 10, padding: "10px 12px", marginBottom: 14, background: "#fafbfc" }}>
          <button type="button" onClick={() => setTalepAcik((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#166534", padding: 0 }}>
            📋 Talep ekle {talepAcik ? "▲" : "▼"}
            {talepMesaj && !talepAcik && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 400, color: talepMesaj.includes("✓") ? "#16a34a" : "#dc2626" }}>{talepMesaj}</span>}
          </button>
          {talepAcik && (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <select value={talep.kisi_id} onChange={(e) => setTalep((s2) => ({ ...s2, kisi_id: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
                <option value="">Talep sahibi seç (haneden) — ya da elle yaz</option>
                {(hane.kisiler || []).map((k) => <option key={k.id} value={k.id}>{k.ad} {k.soyad}</option>)}
              </select>
              {!talep.kisi_id && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={talep.ad_soyad} onChange={(e) => setTalep((s2) => ({ ...s2, ad_soyad: e.target.value }))} placeholder="Ad Soyad (elle)" style={{ flex: 2, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                  <input value={talep.telefon} onChange={(e) => setTalep((s2) => ({ ...s2, telefon: e.target.value }))} placeholder="Telefon" style={{ flex: 1, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={talep.kategori} onChange={(e) => setTalep((s2) => ({ ...s2, kategori: e.target.value }))} placeholder="Kategori (Altyapı, Sosyal Yardım…)" style={{ flex: 1, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                <select value={talep.oncelik} onChange={(e) => setTalep((s2) => ({ ...s2, oncelik: e.target.value }))} style={{ width: 120, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
                  <option value="dusuk">Düşük</option><option value="normal">Normal</option><option value="yuksek">Yüksek</option>
                </select>
              </div>
              <input value={talep.baslik} onChange={(e) => setTalep((s2) => ({ ...s2, baslik: e.target.value }))} placeholder="Talep başlığı *" style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
              <textarea value={talep.aciklama} onChange={(e) => setTalep((s2) => ({ ...s2, aciklama: e.target.value }))} rows={2} placeholder="Açıklama" style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
              {talepMesaj && <div style={{ fontSize: 12, color: talepMesaj.includes("✓") ? "#16a34a" : "#dc2626" }}>{talepMesaj}</div>}
              <button type="button" onClick={talepKaydet} disabled={talepMesgul} style={{ padding: "8px", background: "#166534", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{talepMesgul ? "Kaydediliyor…" : "Talebi kaydet"}</button>
            </div>
          )}
        </div>

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
