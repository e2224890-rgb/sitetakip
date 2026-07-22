"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { ChevronRight, Search, UserCheck, Building2, Users } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { fmt, oran } from "../../lib/format";
import BlokSorumlulari from "./BlokSorumlulari";
import SiteYonetimListe from "./SiteYonetimListe";
import Haneler from "./Haneler";
import DemografiPano from "./DemografiPano";

export default function Siteler({ profil, sabitMahalle }) {
  const ilceYon = profil.rol === "ilce_yonetimi";
  const [mahalleler, setMahalleler] = useState([]);
  const [secMah, setSecMah] = useState(null);
  const [siteler, setSiteler] = useState([]);
  const [ozet, setOzet] = useState({});
  const [profiller, setProfiller] = useState([]);
  const [sokaklar, setSokaklar] = useState([]);
  const [secSite, setSecSite] = useState(null);
  const [siteTab, setSiteTab] = useState("atama");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [ara, setAra] = useState("");
  const [secSokak, setSecSokak] = useState(null);
  const [kapilar, setKapilar] = useState([]);
  const [secKey, setSecKey] = useState(() => new Set());
  const [mesaj, setMesaj] = useState("");
  const [siteHane, setSiteHane] = useState(null);
  const [yenile, setYenile] = useState(0);
  const [mahStat, setMahStat] = useState(null);
  const sonMahRef = useRef(null); // son seçilen mahalle -> arka plan cinsiyet sayımı hâlâ geçerli mi? // mahallenin demografisi (mv_mahalle_ozet) -> DemografiPano

  const siteAd = useMemo(() => { const o = {}; siteler.forEach((s) => o[s.id] = s); return o; }, [siteler]);
  const profAd = useMemo(() => { const o = {}; profiller.forEach((p) => o[p.id] = p); return o; }, [profiller]);
  const keyOf = (r) => `${r.kapi_no}|${r.kapi_blok ?? "∅"}`;

  useEffect(() => { (async () => {
    if (sabitMahalle) { setMahalleler([sabitMahalle]); mahalleSec(sabitMahalle); return; }
    let q = supabase.from("mv_mahalle_ozet").select("mahalle_id, ilce_id, ad, tip");
    if (ilceYon && profil.ilce_id) q = q.eq("ilce_id", profil.ilce_id);
    const { data } = await q;
    // Bu mahalleler site-tipi olarak işaretli ama Siteler'de istenmiyor (sokak-tipi yönetilecek)
    const HARIC_MAH = new Set(["başak1", "başak2", "fenertepe"]);
    const norm = (s) => String(s || "").toLocaleLowerCase("tr").replace(/[^0-9a-zçğıiöşü]/g, "");
    const list = (data || []).filter((m) => m.tip === "site" && !HARIC_MAH.has(norm(m.ad))).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
    setMahalleler(list);
    if (list[0]) mahalleSec(list[0]);
  })(); }, [sabitMahalle?.mahalle_id]);

  async function mahalleSec(m) {
    setSecMah(m); setSecSite(null); setSecSokak(null); setKapilar([]); setSecKey(new Set()); setMesaj(""); setYukleniyor(true); setMahStat(null);
    sonMahRef.current = m.mahalle_id;
    // Hızlı sorgular -> sayfa ANINDA açılır
    const [{ data: s }, { data: oz }, { data: sk }, { data: pr }, { data: mo }] = await Promise.all([
      supabase.from("site_kayit").select("id,ad,blok_sayisi,daire_sayisi,villa_sayisi,baskan,baskan_tel,mudur,mudur_tel,adres,temsilci_id,koordinator_id").eq("mahalle_id", m.mahalle_id).order("ad"),
      supabase.from("mv_site_ozet").select("site_kayit_id,hane,kisi,uye").eq("mahalle_id", m.mahalle_id),
      supabase.from("sokak").select("id,ad").eq("mahalle_id", m.mahalle_id).order("ad"),
      supabase.from("profiles").select("id,ad_soyad,rol").in("rol", ["sorumlu", "koordinator"]),
      supabase.from("mv_mahalle_ozet").select("kisi,hane,uye,erkek,kadin,y1824,y2534,y3544,y4554,y5564,y65").eq("mahalle_id", m.mahalle_id).single(),
    ]);
    const ozMap = {}; (oz || []).forEach((o) => ozMap[o.site_kayit_id] = o);
    setMahStat({
      kisi: mo?.kisi || 0, hane: mo?.hane || 0, uye: mo?.uye || 0,
      erkek: mo?.erkek || 0, kadin: mo?.kadin || 0, // MV değeri (hızlı); doğru cinsiyet arkadan gelir
      yasArr: [
        { ad: "18-24", deger: mo?.y1824 || 0 }, { ad: "25-34", deger: mo?.y2534 || 0 },
        { ad: "35-44", deger: mo?.y3544 || 0 }, { ad: "45-54", deger: mo?.y4554 || 0 },
        { ad: "55-64", deger: mo?.y5564 || 0 }, { ad: "65+", deger: mo?.y65 || 0 },
      ],
    });
    setSiteler(s || []); setOzet(ozMap); setSokaklar(sk || []); setProfiller(pr || []); setYukleniyor(false);

    // Cinsiyet doğru sayımı (E/K ve Erkek/Kadın karışık) -> arka planda, sayfayı bekletmeden
    const mid = m.mahalle_id;
    Promise.all([
      supabase.from("kisi").select("*", { count: "exact", head: true }).eq("mahalle_id", mid).ilike("cinsiyet", "e%"),
      supabase.from("kisi").select("*", { count: "exact", head: true }).eq("mahalle_id", mid).ilike("cinsiyet", "k%"),
    ]).then(([eR, kR]) => {
      if (sonMahRef.current !== mid) return; // kullanıcı başka mahalleye geçtiyse ez me
      setMahStat((st) => st ? { ...st, erkek: eR?.count || 0, kadin: kR?.count || 0 } : st);
    }).catch(() => { });
  }

  async function siteSec(s, tab = "atama") {
    setSecSite(s); setSiteTab(tab); setSecSokak(null); setKapilar([]); setSecKey(new Set()); setMesaj(""); setSiteHane(null);
    const { data } = await supabase.from("hane").select("no, kisi(ad,soyad,uye)").eq("site_kayit_id", s.id).limit(500);
    setSiteHane(data || []);
  }

  async function sokakSec(skId) {
    const sk = sokaklar.find((x) => x.id === skId); setSecSokak(sk || null); setSecKey(new Set()); setMesaj("");
    if (!sk) { setKapilar([]); return; }
    const { data } = await supabase.from("v_kapi_blok").select("kapi_no,kapi_blok,hane,kisi,site_kayit_id").eq("sokak_id", sk.id);
    const sorted = (data || []).sort((a, b) => ((parseInt(a.kapi_no) || 0) - (parseInt(b.kapi_no) || 0)) || String(a.kapi_blok || "").localeCompare(String(b.kapi_blok || "")));
    setKapilar(sorted);
  }

  function toggle(r) { setSecKey((s) => { const n = new Set(s); const k = keyOf(r); n.has(k) ? n.delete(k) : n.add(k); return n; }); }
  function kapiToggle(rows) { setSecKey((s) => { const n = new Set(s); const keys = rows.map(keyOf); const hepsi = keys.every((k) => n.has(k)); keys.forEach((k) => hepsi ? n.delete(k) : n.add(k)); return n; }); }

  const secimOzet = useMemo(() => { let hane = 0, kisi = 0; kapilar.forEach((r) => { if (secKey.has(keyOf(r))) { hane += r.hane; kisi += r.kisi; } }); return { hane, kisi }; }, [secKey, kapilar]);
  const kapiGrup = useMemo(() => { const g = {}; kapilar.forEach((r) => { (g[r.kapi_no] ||= []).push(r); }); return g; }, [kapilar]);

  async function ata(siteId) {
    if (!secSokak) return;
    setMesaj("Kaydediliyor...");
    const byKapi = {};
    secKey.forEach((k) => { const [kn, blok] = k.split("|"); (byKapi[kn] ||= []).push(blok === "∅" ? null : blok); });
    const body = { site_kayit_id: siteId || null, site_kaynak: siteId ? "manuel" : null };
    for (const kn of Object.keys(byKapi)) {
      const bl = byKapi[kn]; const nonnull = bl.filter((b) => b !== null); const hasNull = bl.some((b) => b === null);
      if (nonnull.length) await supabase.from("hane").update(body).eq("sokak_id", secSokak.id).eq("kapi_no", kn).in("kapi_blok", nonnull);
      if (hasNull) await supabase.from("hane").update(body).eq("sokak_id", secSokak.id).eq("kapi_no", kn).is("kapi_blok", null);
    }
    await sokakSec(secSokak.id);
    if (secSite) {
      const { count } = await supabase.from("hane").select("id", { count: "exact", head: true }).eq("site_kayit_id", secSite.id);
      setOzet((o) => ({ ...o, [secSite.id]: { ...(o[secSite.id] || {}), hane: count || 0 } }));
    }
    setSecKey(new Set());
    setMesaj(siteId ? "✓ Atandı" : "✓ Kaldırıldı");
    setYenile((v) => v + 1);
  }

  async function atamaKaydet(siteId, alan, deger) {
    await supabase.from("site_kayit").update({ [alan]: deger || null }).eq("id", siteId);
    setSiteler((arr) => arr.map((s) => s.id === siteId ? { ...s, [alan]: deger || null } : s));
    setSecSite((s) => s && s.id === siteId ? { ...s, [alan]: deger || null } : s);
  }

  const siteFiltre = siteler
    .filter((s) => !ara || (s.ad || "").toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr")))
    .sort((a, b) => ((ozet[b.id]?.hane || 0) - (ozet[a.id]?.hane || 0)) || (a.ad || "").localeCompare(b.ad || "", "tr"));

  const siteStat = (() => {
    const sum = (f) => siteler.reduce((a, s) => a + (ozet[s.id]?.[f] || 0), 0);
    return {
      site: siteler.length,
      blok: siteler.reduce((a, s) => a + (s.blok_sayisi || 0), 0),
      hane: sum("hane"), kisi: sum("kisi"), uye: sum("uye"),
      tem: siteler.filter((s) => s.temsilci_id).length,
    };
  })();
  const sUyePct = siteStat.kisi ? Math.round((siteStat.uye / siteStat.kisi) * 100) : 0;
  const sUyeData = [{ name: "Üye", value: siteStat.uye }, { name: "Değil", value: Math.max(0, siteStat.kisi - siteStat.uye) }];
  const sAtaPct = siteStat.site ? Math.round((siteStat.tem / siteStat.site) * 100) : 0;
  const sAtaData = [{ name: "Atandı", value: siteStat.tem }, { name: "Kalan", value: Math.max(0, siteStat.site - siteStat.tem) }];

  return (
    <div className={sabitMahalle ? "" : "page"}>
      {!sabitMahalle && <>
        <div className="page-head"><div><h2>Siteler</h2><p className="dim">Site-tipi mahalleler · kapı/blok ile toplu atama</p></div></div>
        <div className="mah-chips">
          {mahalleler.map((m) => (<button key={m.mahalle_id} className={"chip" + (secMah?.mahalle_id === m.mahalle_id ? " on" : "")} onClick={() => mahalleSec(m)}>{m.ad}</button>))}
        </div>
      </>}
      {yukleniyor && <div className="dim" style={{ padding: 20 }}>Yükleniyor…</div>}

      {!yukleniyor && !secSite && secMah && (
        <>
          <DemografiPano
            stat={mahStat || { kisi: siteStat.kisi, hane: siteStat.hane, uye: siteStat.uye, erkek: 0, kadin: 0, yasArr: [] }}
            ekstra={{ ic: <Building2 size={15} />, lbl: "Site", num: fmt(siteStat.site), meta: `${fmt(siteStat.blok)} blok · ${siteStat.tem}/${siteStat.site} temsilci`, renk: "#0891b2", onClick: () => document.getElementById("site-listesi")?.scrollIntoView({ behavior: "smooth", block: "start" }) }}
            mahalleIds={[secMah.mahalle_id]}
            baslik={`${secMah.ad} Mahallesi`}
          />
          <div className="ara-kutu" id="site-listesi" style={{ marginTop: 15, scrollMarginTop: 14 }}><Search size={15} /><input placeholder="Site ara…" value={ara} onChange={(e) => setAra(e.target.value)} /></div>
          <div className="panel">
              {siteFiltre.length === 0
                ? <div className="merkez">Site yok.</div>
                : (
                  <div className="cards">
                    {siteFiltre.map((s) => {
                      const o = ozet[s.id] || {};
                      const bos = !(o.hane > 0);
                      return (
                        <div key={s.id} className="card" onClick={() => siteSec(s)}>
                          <div className="card-t">{s.ad} <ChevronRight size={15} /></div>
                          <div style={{ marginBottom: 8 }}>
                            <span className="tip-tag site">
                              <Building2 size={11} /> {s.blok_sayisi ?? "?"} blok · {s.daire_sayisi ?? "?"} daire{s.villa_sayisi ? ` · ${s.villa_sayisi} villa` : ""}
                            </span>
                          </div>
                          {bos ? (
                            <div className="bolge-stat"><span className="dim">Veri bekleniyor</span></div>
                          ) : (
                            <>
                              <div className="card-nums">
                                <div><b>{fmt(o.kisi || 0)}</b><span>kişi</span></div>
                                <div><b>{fmt(o.hane || 0)}</b><span>hane</span></div>
                                <div className="acc"><b>{fmt(o.uye || 0)}</b><span>üye</span></div>
                              </div>
                              <div className="bar"><i style={{ width: `${oran(o.uye || 0, o.kisi || 0)}%` }} /></div>
                            </>
                          )}
                          <div className="atama-chips" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            {s.temsilci_id
                              ? <span className="chip u"><UserCheck size={12} /> Temsilci: {profAd[s.temsilci_id]?.ad_soyad || "atandı"}</span>
                              : <span className="chip s">Temsilci yok</span>}
                            <button
                              onClick={(e) => { e.stopPropagation(); siteSec(s, "yonetim"); }}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#4338ca", background: "#eef2ff", border: "1px solid #e0e7ff", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}
                              title="Blok Sorumlusu · Ana Kademe · Kadın Temsilci · Gençlik Temsilci">
                              <Users size={13} /> Yönetim Listesi
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
        </>
      )}

      {!yukleniyor && secSite && (<>
        <div className="crumb"><a onClick={() => { setSecSite(null); setSiteHane(null); }}>{secMah?.ad}</a><ChevronRight size={14} /><span className="cur">{secSite.ad}</span></div>
        <div className="site-detay">
          <div className="sd-bas"><div><h3>{secSite.ad}</h3><div className="dim">{secSite.blok_sayisi ?? "?"} blok · {secSite.daire_sayisi ?? "?"} daire · {secSite.adres || ""}</div></div></div>

          <div style={{ display: "flex", gap: 4, margin: "4px 0 14px", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" }}>
            {[["atama", "Site & Haneler"], ["yonetim", "AK Parti Site Temsilciliği Yönetimi"], ["sorumlu", "Blok Atama"]].map(([k, t]) => (
              <button key={k} onClick={() => setSiteTab(k)} style={{ padding: "8px 14px", border: "none", background: "none", borderBottom: "2px solid " + (siteTab === k ? "#2563eb" : "transparent"), color: siteTab === k ? "#2563eb" : "#64748b", fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: -1 }}>{t}</button>
            ))}
          </div>

          {siteTab === "yonetim" ? <SiteYonetimListe site={secSite} />
            : siteTab === "sorumlu" ? <BlokSorumlulari site={secSite} /> : (<>
          <Haneler
            birim={{ tip: "site", id: secSite.id, kod: secSite.ad, mahalleAd: secMah?.ad,
              kapsam: `${secSite.blok_sayisi ?? "?"} blok · ${secSite.daire_sayisi ?? "?"} daire${secSite.adres ? " · " + secSite.adres : ""}`,
              sorumlu_id: secSite.temsilci_id, koordinator_id: secSite.koordinator_id, yenile }}
            userId={profil.id}
            yonetici={profil.rol === "il_yonetimi" || profil.rol === "ilce_yonetimi"}
            planla />
          </>)}
        </div>
      </>)}
    </div>
  );
}
