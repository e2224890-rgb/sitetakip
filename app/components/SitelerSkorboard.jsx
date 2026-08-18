"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { MapPin, Search, UserCheck, ChevronRight, Building2, ArrowUpDown } from "lucide-react";
import { fmt, oran } from "../../lib/format";
import Haneler from "./Haneler";

const ilerlemeRenk = (p) => p >= 66 ? "#16a34a" : p >= 33 ? "#eab308" : "#f97316";

export default function SitelerSkorboard({ profil }) {
  const [satirlar, setSatirlar] = useState(null);
  const [mahAd, setMahAd] = useState({});
  const [ara, setAra] = useState("");
  const [filtre, setFiltre] = useState("hepsi");   // hepsi | temsilcili | temsilcisiz | eksik(<%33)
  const [sirala, setSirala] = useState("ilerleme");// ilerleme | hane | ad
  const [secSite, setSecSite] = useState(null);

  useEffect(() => { (async () => {
    // 1) Tüm siteler + temsilci/koordinatör  2) hane/kişi/üye özeti  3) ziyaret (v_rapor_site)  4) mahalle adları
    const [{ data: sk }, { data: oz }, { data: rp }, { data: mh }, { data: pr }] = await Promise.all([
      supabase.from("site_kayit").select("id, ad, mahalle_id, blok_sayisi, temsilci_id"),
      supabase.from("mv_site_ozet").select("site_kayit_id, hane, kisi, uye"),
      supabase.from("v_rapor_site").select("site_kayit_id, toplam, edilen"),
      supabase.from("mahalle").select("id, ad"),
      supabase.from("profiles").select("id, ad_soyad, eposta"),
    ]);
    const ozBy = {}; (oz || []).forEach((o) => ozBy[o.site_kayit_id] = o);
    const rpBy = {}; (rp || []).forEach((r) => rpBy[r.site_kayit_id] = r);
    const pAd = {}; (pr || []).forEach((p) => pAd[p.id] = p.ad_soyad || p.eposta);
    const mAd = {}; (mh || []).forEach((m) => mAd[m.id] = m.ad); setMahAd(mAd);
    const list = (sk || []).map((s) => {
      const o = ozBy[s.id] || {}; const r = rpBy[s.id] || {};
      const toplam = r.toplam || o.hane || 0;
      const edilen = r.edilen || 0;
      return {
        id: s.id, ad: s.ad, mahalle_id: s.mahalle_id, blok: s.blok_sayisi || 0,
        hane: o.hane || 0, kisi: o.kisi || 0, uye: o.uye || 0,
        toplam, edilen, ilerleme: oran(edilen, toplam),
        temsilci_id: s.temsilci_id, temsilciAd: s.temsilci_id ? (pAd[s.temsilci_id] || "atandı") : null,
      };
    });
    setSatirlar(list);
  })(); }, []);

  const ozet = useMemo(() => {
    const l = satirlar || [];
    const toplam = l.reduce((a, s) => a + s.toplam, 0);
    const edilen = l.reduce((a, s) => a + s.edilen, 0);
    return {
      site: l.length,
      temsilcili: l.filter((s) => s.temsilci_id).length,
      temsilcisiz: l.filter((s) => !s.temsilci_id).length,
      ilerleme: oran(edilen, toplam),
    };
  }, [satirlar]);

  const gorunen = useMemo(() => {
    let l = satirlar || [];
    const f = ara.trim().toLocaleLowerCase("tr");
    if (f) l = l.filter((s) => (s.ad || "").toLocaleLowerCase("tr").includes(f) || (mahAd[s.mahalle_id] || "").toLocaleLowerCase("tr").includes(f));
    if (filtre === "temsilcili") l = l.filter((s) => s.temsilci_id);
    else if (filtre === "temsilcisiz") l = l.filter((s) => !s.temsilci_id);
    else if (filtre === "eksik") l = l.filter((s) => s.ilerleme < 33);
    l = [...l].sort((a, b) => {
      if (sirala === "hane") return b.hane - a.hane;
      if (sirala === "ad") return (a.ad || "").localeCompare(b.ad || "", "tr");
      return a.ilerleme - b.ilerleme || b.hane - a.hane; // ilerleme: en eksik önce
    });
    return l;
  }, [satirlar, ara, filtre, sirala, mahAd]);

  if (secSite) {
    return (
      <div className="page">
        <div className="crumb"><a onClick={() => setSecSite(null)}>Siteler</a><ChevronRight size={14} /><span className="cur">{secSite.ad}</span></div>
        <Haneler
          birim={{ tip: "site", id: secSite.id, kod: secSite.ad, mahalleAd: mahAd[secSite.mahalle_id],
            kapsam: `${mahAd[secSite.mahalle_id] || ""} · ${secSite.blok || "?"} blok · ${fmt(secSite.hane)} hane`,
            sorumlu_id: secSite.temsilci_id }}
          userId={profil.id}
          yonetici={profil.rol === "il_yonetimi" || profil.rol === "ilce_yonetimi"}
          planla />
      </div>
    );
  }

  const kart = (lbl, val, renk, key) => (
    <button key={lbl} onClick={key ? () => setFiltre(filtre === key ? "hepsi" : key) : undefined}
      style={{ textAlign: "left", cursor: key ? "pointer" : "default", background: key && filtre === key ? renk + "14" : "#fff", border: "1px solid " + (key && filtre === key ? renk : "#eef2f7"), borderRadius: 10, padding: "10px 14px", minWidth: 130 }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{lbl}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: renk }}>{val}</div>
    </button>
  );

  return (
    <div className="page">
      <div className="page-head"><div><h2>Siteler · Skorboard</h2><p className="dim">İlçedeki tüm siteler · ziyaret ilerlemesi ve temsilci durumu</p></div></div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {kart("Toplam Site", satirlar ? fmt(ozet.site) : "…", "#0f172a")}
        {kart("Temsilci atandı", satirlar ? fmt(ozet.temsilcili) : "…", "#16a34a", "temsilcili")}
        {kart("Temsilci yok", satirlar ? fmt(ozet.temsilcisiz) : "…", "#b91c1c", "temsilcisiz")}
        {kart("Az ziyaret (<%33)", satirlar ? fmt((satirlar || []).filter((s) => s.ilerleme < 33).length) : "…", "#f97316", "eksik")}
        <div style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 10, padding: "10px 14px", minWidth: 130 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Genel ilerleme</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#c2410c" }}>%{satirlar ? ozet.ilerleme : 0}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div className="ara-kutu" style={{ flex: 1, minWidth: 200 }}><Search size={15} /><input placeholder="Site veya mahalle ara…" value={ara} onChange={(e) => setAra(e.target.value)} /></div>
        <select className="sel" value={sirala} onChange={(e) => setSirala(e.target.value)} style={{ minWidth: 150 }}>
          <option value="ilerleme">En az ziyaret önce</option>
          <option value="hane">En büyük (hane) önce</option>
          <option value="ad">İsme göre (A-Z)</option>
        </select>
        {filtre !== "hepsi" && <button className="btn" onClick={() => setFiltre("hepsi")}>Filtreyi temizle</button>}
      </div>

      <div className="panel">
        {satirlar === null ? <div className="merkez">Yükleniyor…</div>
          : gorunen.length === 0 ? <div className="merkez">Kayıt yok.</div>
            : (
              <table className="htable">
                <thead><tr>
                  <th>SİTE</th><th>MAHALLE</th><th className="sag">HANE</th><th className="sag">KİŞİ</th>
                  <th className="sag">ÜYE</th><th>TEMSİLCİ</th><th style={{ minWidth: 160 }}>ZİYARET</th>
                </tr></thead>
                <tbody>
                  {gorunen.map((s) => (
                    <tr key={s.id} onClick={() => setSecSite(s)} style={{ cursor: "pointer" }}>
                      <td><b>{s.ad}</b> <ChevronRight size={13} style={{ verticalAlign: "middle", color: "#cbd5e1" }} /></td>
                      <td className="dim">{mahAd[s.mahalle_id] || "—"}</td>
                      <td className="sag mono">{fmt(s.hane)}</td>
                      <td className="sag mono">{fmt(s.kisi)}</td>
                      <td className="sag mono">{fmt(s.uye)}</td>
                      <td>{s.temsilci_id
                        ? <span style={{ fontSize: 12, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 6, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><UserCheck size={11} /> {s.temsilciAd}</span>
                        : <span style={{ fontSize: 12, background: "#fee2e2", color: "#b91c1c", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>Temsilci yok</span>}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="bar" style={{ flex: 1, maxWidth: 90 }}><i style={{ width: `${s.ilerleme}%`, background: ilerlemeRenk(s.ilerleme) }} /></div>
                          <span className="mono" style={{ fontSize: 12, color: ilerlemeRenk(s.ilerleme), fontWeight: 700, minWidth: 34, textAlign: "right" }}>%{s.ilerleme}</span>
                          <span className="dim" style={{ fontSize: 11 }}>{fmt(s.edilen)}/{fmt(s.toplam)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
      </div>
    </div>
  );
}
