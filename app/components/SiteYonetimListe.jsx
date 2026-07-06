"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { UserCheck, Crown, Phone, Users } from "lucide-react";
import { BLOK_ROL_LISTE, BLOK_ROL_AD } from "../../lib/constants";
import { blokParts } from "../../lib/format";

// Rol -> rozet rengi
const ROL_RENK = {
  temsilci: { bg: "#ffedd5", fg: "#9a3412" },
  koordinator: { bg: "#e0e7ff", fg: "#3730a3" },
  blok_sorumlu: { bg: "#e0f2fe", fg: "#0369a1" },
  ana_kademe: { bg: "#ede9fe", fg: "#5b21b6" },
  kadin_kollari: { bg: "#fce7f3", fg: "#9d174d" },
  genclik_kollari: { bg: "#dcfce7", fg: "#166534" },
};

export default function SiteYonetimListe({ site }) {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [baskan, setBaskan] = useState(null);
  const [koord, setKoord] = useState(null);
  const [gorevliler, setGorevliler] = useState([]); // {ad_soyad, rol, blok, telefon}

  useEffect(() => { (async () => {
    setYukleniyor(true);
    // Site başkanı (temsilci) ve koordinatör -> site_kayit üzerinden
    const [{ data: sk }, { data: gr }] = await Promise.all([
      supabase.from("site_kayit").select("temsilci_id, koordinator_id").eq("id", site.id).single(),
      supabase.from("profiles").select("id, ad_soyad, eposta, telefon, meslek, rol, blok")
        .eq("site_kayit_id", site.id).in("rol", BLOK_ROL_LISTE.map((r) => r[0])),
    ]);
    // temsilci/koordinatör profillerini çek
    const ids = [sk?.temsilci_id, sk?.koordinator_id].filter(Boolean);
    let pMap = {};
    if (ids.length) { const { data: pr } = await supabase.from("profiles").select("id, ad_soyad, eposta, telefon").in("id", ids); (pr || []).forEach((p) => { pMap[p.id] = p; }); }
    setBaskan(sk?.temsilci_id ? pMap[sk.temsilci_id] : null);
    setKoord(sk?.koordinator_id ? pMap[sk.koordinator_id] : null);
    setGorevliler(gr || []);
    setYukleniyor(false);
  })(); }, [site.id]);

  // Kademe görevlilerini role göre grupla; her görevlinin bloklarını ayrı satır yap
  const kademeler = BLOK_ROL_LISTE.map(([rol, ad]) => {
    const kisiler = [];
    gorevliler.filter((g) => g.rol === rol).forEach((g) => {
      const bloklar = blokParts(g.blok);
      if (bloklar.length) bloklar.forEach((bk) => kisiler.push({ ...g, blokTek: bk }));
      else kisiler.push({ ...g, blokTek: null });
    });
    return { rol, ad, kisiler };
  });

  const toplamGorevli = gorevliler.length + (baskan ? 1 : 0) + (koord ? 1 : 0);

  const Satir = ({ renk, gorev, ad, blok, tel, meslek }) => (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 12, fontWeight: 700, background: renk.bg, color: renk.fg, padding: "3px 10px", borderRadius: 7, minWidth: 118, textAlign: "center" }}>{gorev}</span>
      {blok ? <span style={{ fontSize: 12, background: "#f1f5f9", color: "#475569", padding: "2px 9px", borderRadius: 6, fontWeight: 600 }}>{blok} Blok</span> : null}
      <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{ad || <span style={{ color: "#cbd5e1", fontWeight: 400 }}>— atanmadı —</span>}</span>
      <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#64748b", display: "flex", gap: 10, alignItems: "center" }}>
        {tel ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {tel}</span> : null}
        {meslek ? <span>{meslek}</span> : null}
      </span>
    </div>
  );

  if (yukleniyor) return <div className="merkez" style={{ padding: 24 }}>Yükleniyor…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 7 }}>
          <Users size={17} /> Site Yönetimi
        </h3>
        <span style={{ fontSize: 12.5, color: "#64748b" }}>{site.ad} · {toplamGorevli} görevli</span>
      </div>

      {/* Üst yönetim: Site Başkanı + Koordinatör */}
      <div style={{ border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden", marginBottom: 14, background: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", padding: "9px 12px", background: "#f8fafc", borderBottom: "1px solid #eef2f7", display: "flex", alignItems: "center", gap: 6 }}>
          <Crown size={13} /> ÜST YÖNETİM
        </div>
        <Satir renk={ROL_RENK.temsilci} gorev="Site Başkanı" ad={baskan?.ad_soyad || baskan?.eposta} tel={baskan?.telefon} />
        <Satir renk={ROL_RENK.koordinator} gorev="Koordinatör" ad={koord?.ad_soyad || koord?.eposta} tel={koord?.telefon} />
      </div>

      {/* Kademe görevlileri */}
      {kademeler.map(({ rol, ad, kisiler }) => (
        <div key={rol} style={{ border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden", marginBottom: 12, background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: ROL_RENK[rol].fg, padding: "9px 12px", background: ROL_RENK[rol].bg + "55", borderBottom: "1px solid #eef2f7", display: "flex", justifyContent: "space-between" }}>
            <span>{ad.toLocaleUpperCase("tr")}</span>
            <span style={{ color: "#94a3b8" }}>{kisiler.length} kişi</span>
          </div>
          {kisiler.length === 0
            ? <div style={{ fontSize: 13, color: "#94a3b8", padding: "10px 12px" }}>Bu kademede henüz atama yok.</div>
            : kisiler
              .sort((a, b) => String(a.blokTek || "").localeCompare(String(b.blokTek || ""), "tr", { numeric: true }))
              .map((k, i) => (
                <Satir key={i} renk={ROL_RENK[rol]} gorev={BLOK_ROL_AD[rol]} ad={k.ad_soyad || k.eposta} blok={k.blokTek} tel={k.telefon} meslek={k.meslek} />
              ))}
        </div>
      ))}
    </div>
  );
}
