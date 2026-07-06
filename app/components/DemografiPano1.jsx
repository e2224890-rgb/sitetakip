"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { Users, Home, ShieldCheck } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmt, oran, NUF_RENK } from "../../lib/format";
import { cacheOku, cacheYaz } from "../../lib/cache";
import StatCard from "./StatCard";

/*
  Paylaşımlı demografi panosu — her drill-down seviyesinde AYNI grafik seti,
  yalnız kapsam (props) değişir. İçerik: StatCard'lar + Üyelik + Yaş + Cinsiyet + Nüfus İl.

  Props:
    stat        : { kisi, hane, uye, erkek, kadin, yasArr }  (yasArr = [{ad,deger}, ...])
    ekstra      : { ic, lbl, num, meta, renk }  -> 4. StatCard (İlçe'de "Bölge", Siteler'de "Site")
    mahalleIds  : string[]  -> nüfus dağılımı bu mahallelerden toplanır
    baslik      : chart başlıklarının önüne gelen metin (ör. "Başakşehir İlçesi")
    children    : sol paneldeki liste (mahalle kartları / site kartları) — Üyelik'in yanına yerleşir

  Kullanım — İLÇE (Gezgin):
    <DemografiPano
      stat={toplam}
      ekstra={{ ic:<Map size={15}/>, lbl:"Bölge", num:fmt(bolgeToplam), meta:"≈150 hane / bölge", renk:"#9333ea" }}
      mahalleIds={mahalleler.map(m => m.mahalle_id)}
      baslik={`${ilceAd} İlçesi`}
    >
      <div className="panel"><div className="cards">{mahalle kartları}</div></div>
    </DemografiPano>

  Kullanım — SİTELER LİSTESİ (Siteler, sabitMahalle):
    <DemografiPano
      stat={mahalleOzet}                         // mv_mahalle_ozet'ten o mahallenin satırı
      ekstra={{ ic:<Building2 size={15}/>, lbl:"Site", num:fmt(siteStat.site), meta:`${siteStat.blok} blok`, renk:"#0891b2" }}
      mahalleIds={[secMah.mahalle_id]}
      baslik={secMah.ad}
    >
      <div className="panel"><div className="cards">{site kartları}</div></div>
    </DemografiPano>
*/
export default function DemografiPano({ stat, ekstra, mahalleIds, baslik = "", children }) {
  const { kisi = 0, hane = 0, uye = 0, erkek = 0, kadin = 0, yasArr = [] } = stat || {};
  const uyeOran = oran(uye, kisi);
  const cinsTop = erkek + kadin;
  const pasta = [
    { ad: "Üye", deger: uye, renk: "var(--accent)" },
    { ad: "Diğer", deger: Math.max(0, kisi - uye), renk: "#e7e9ed" },
  ];

  // Recharts ResponsiveContainer hard-refresh'te kabı 0px ölçebiliyor -> mount'tan sonra çiz
  const [hazir, setHazir] = useState(false);
  useEffect(() => { setHazir(true); }, []);

  // Nüfus (memleket) il dağılımı — verilen mahallelerden toplanır.
  // Stale-while-revalidate: F5'te son bilinen veri cache'ten ANINDA gelir; hata yutulmaz.
  const idKey = (mahalleIds || []).filter(Boolean).join(",");
  const [nufIl, setNufIl] = useState(null);
  const [nufHata, setNufHata] = useState(null);
  const [digerAcik, setDigerAcik] = useState(false);
  useEffect(() => {
    setDigerAcik(false);
    const ids = (mahalleIds || []).filter(Boolean);
    if (!ids.length) return; // henüz gelmediyse son iyi/cache veriyi koru
    const ck = "nufil:" + idKey;
    const snap = cacheOku(ck);
    if (snap && snap.length) { setNufIl(snap); setNufHata(null); }
    let iptal = false;
    (async () => {
      const { data, error } = await supabase.from("mv_mahalle_nufus_il")
        .select("nufus_il, kisi").in("mahalle_id", ids);
      if (iptal) return;
      if (error) { setNufHata(error.message || String(error)); if (!snap) setNufIl([]); return; }
      const m = {};
      (data || []).forEach((r) => { const il = (r.nufus_il || "").trim() || "Bilinmiyor"; m[il] = (m[il] || 0) + (r.kisi || 0); });
      const arr = Object.entries(m).map(([ad, deger]) => ({ ad, deger })).sort((a, b) => b.deger - a.deger);
      setNufHata(null); setNufIl(arr);
      if (arr.length) cacheYaz(ck, arr);
    })();
    return () => { iptal = true; };
  }, [idKey]);

  const nufDag = useMemo(() => {
    const arr = nufIl || [];
    const toplamK = arr.reduce((a, x) => a + x.deger, 0);
    const N = 10;
    const top = arr.slice(0, N);
    const kalanArr = arr.slice(N);
    const kalan = kalanArr.reduce((a, x) => a + x.deger, 0);
    if (kalan > 0) top.push({ ad: "Diğer", deger: kalan, detay: kalanArr });
    return { arr: top, toplam: toplamK, ilSay: arr.length };
  }, [nufIl]);

  const b = (s) => (baslik ? baslik + " " : "") + s;

  return (
    <>
      {/* Özet kartları */}
      <div className="grid-stats">
        <StatCard ic={<Users size={15} />} lbl="Toplam Seçmen" num={fmt(kisi)} meta="seçmen kaydı" />
        <StatCard ic={<Home size={15} />} lbl="Hane" num={fmt(hane)} meta="kayıtlı hane" renk="#2563eb" />
        <StatCard ic={<ShieldCheck size={15} />} lbl="AK Parti Üye" num={fmt(uye)} meta={`%${uyeOran} üyelik`} renk="#16a34a" />
        {ekstra && <StatCard ic={ekstra.ic} lbl={ekstra.lbl} num={ekstra.num} meta={ekstra.meta} renk={ekstra.renk} />}
      </div>

      {/* Sol: çağıranın listesi (children) · Sağ: Üyelik donut */}
      <div className="layout">
        {children}
        <div className="panel pad">
          <div className="panel-h"><h3>Üyelik</h3></div>
          <div className="pie-wrap">
            <PieChart width={200} height={200}>
              <Pie data={pasta} dataKey="deger" nameKey="ad" cx="50%" cy="50%" innerRadius={55} outerRadius={85} strokeWidth={0}>
                {pasta.map((p, i) => <Cell key={i} fill={p.renk} />)}
              </Pie>
            </PieChart>
            <div className="pie-mid"><div className="pie-big">%{uyeOran}</div><div className="pie-sub">üye</div></div>
          </div>
          <div className="legend">
            <div><span className="dot" style={{ background: "var(--accent)" }} /> Üye <b>{fmt(uye)}</b></div>
            <div><span className="dot" style={{ background: "#e7e9ed" }} /> Diğer <b>{fmt(Math.max(0, kisi - uye))}</b></div>
          </div>
        </div>
      </div>

      {/* Yaş + Cinsiyet */}
      <div className="demo-grid" style={{ marginTop: 15 }}>
        <div className="panel pad">
          <div className="panel-h2"><h3>{b("Yaş Aralığı Grafiği")}</h3><span className="dim">{fmt(cinsTop)} kişi</span></div>
          {hazir ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={yasArr} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="ad" tick={{ fontSize: 11, fill: "#5a626c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9097a0" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(0) + "b" : v} />
                <Tooltip cursor={{ fill: "#0000000a" }} formatter={(v) => [fmt(v), "Kişi"]} labelFormatter={(l) => "Yaş " + l} />
                <Bar dataKey="deger" fill="#cf5a26" radius={[5, 5, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 210 }} />}
        </div>
        <div className="panel pad">
          <div className="panel-h2"><h3>{b("Cinsiyet Oranı")}</h3><span className="dim">{fmt(cinsTop)} kişi</span></div>
          <div className="cins">
            <div className="cins-satir"><span className="cins-ad"><span className="dot" style={{ background: "#2563eb" }} /> Erkek</span><b className="mono">{fmt(erkek)}</b></div>
            <div className="bar"><i style={{ width: `${oran(erkek, cinsTop)}%`, background: "#2563eb" }} /></div>
            <div className="cins-satir" style={{ marginTop: 14 }}><span className="cins-ad"><span className="dot" style={{ background: "#db2777" }} /> Kadın</span><b className="mono">{fmt(kadin)}</b></div>
            <div className="bar"><i style={{ width: `${oran(kadin, cinsTop)}%`, background: "#db2777" }} /></div>
            <div className="cins-ozet">Erkek %{oran(erkek, cinsTop)} · Kadın %{oran(kadin, cinsTop)}</div>
          </div>
        </div>
      </div>

      {/* Nüfus İl Dağılımı — asla sessizce kaybolmaz: yükleniyor / hata / boş / veri */}
      <div className="panel pad" style={{ marginTop: 15 }}>
        <div className="panel-h2">
          <h3>{b("Demografik Yapı · Nüfus İl Dağılımı")}</h3>
          {nufDag.ilSay > 0 && <span className="dim">{fmt(nufDag.ilSay)} il · {fmt(nufDag.toplam)} kişi</span>}
        </div>
        {nufHata ? (
          <div className="dim" style={{ padding: "10px 2px", color: "#b91c1c" }}>Nüfus verisi alınamadı: {nufHata}</div>
        ) : nufIl === null ? (
          <div className="merkez" style={{ padding: 24 }}>Yükleniyor…</div>
        ) : nufDag.ilSay === 0 ? (
          <div className="dim" style={{ padding: "10px 2px" }}>Bu kapsamda nüfus (memleket) verisi bulunamadı.</div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 6 }}>
              <div style={{ width: 210, height: 210, flex: "0 0 auto" }}>
                {hazir && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={nufDag.arr} dataKey="deger" nameKey="ad" cx="50%" cy="50%" innerRadius={54} outerRadius={92} paddingAngle={1} stroke="#fff" strokeWidth={1}>
                        {nufDag.arr.map((e, i) => <Cell key={i} fill={e.ad === "Diğer" ? "#94a3b8" : NUF_RENK[i % NUF_RENK.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [fmt(v) + " kişi", n]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={{ flex: "1 1 200px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "5px 16px", minWidth: 180 }}>
                {nufDag.arr.map((e, i) => {
                  const diger = e.ad === "Diğer";
                  return (
                    <div key={i} onClick={diger ? () => setDigerAcik((v) => !v) : undefined}
                      style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: diger ? "pointer" : "default" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: diger ? "#94a3b8" : NUF_RENK[i % NUF_RENK.length], flex: "0 0 auto" }} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: diger ? "underline dotted" : "none" }}>
                        {e.ad}{diger ? ` (${e.detay.length} il ▾)` : ""}
                      </span>
                      <b className="mono">{fmt(e.deger)}</b>
                    </div>
                  );
                })}
              </div>
            </div>
            {digerAcik && (() => {
              const dg = nufDag.arr.find((x) => x.ad === "Diğer");
              if (!dg) return null;
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eef1f4" }}>
                  <div className="dim" style={{ fontSize: 12, marginBottom: 8 }}>"Diğer" içindeki iller ({dg.detay.length} il · {fmt(dg.deger)} kişi)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "4px 16px" }}>
                    {dg.detay.map((x, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.ad}</span>
                        <b className="mono">{fmt(x.deger)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </>
  );
}
