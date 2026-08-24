"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { Users, Home, ShieldCheck, UsersRound } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmt, oran, NUF_RENK } from "../../lib/format";
import { cacheOku, cacheYaz } from "../../lib/cache";
import StatCard from "./StatCard";
import { MAHALLE_NUFUS, ILCE_BASKANI, MAHALLE_TESKILAT, ILCE_BIRIM } from "../../lib/constants";
import { hataMetni } from "../../lib/hata";

/*
  Paylaşımlı demografi panosu — her drill-down seviyesinde AYNI grafik seti, yalnız kapsam değişir.
  İçerik: StatCard'lar + Üyelik + Yaş + Cinsiyet + Nüfus İl.

  İKİ MOD:
    - children VARSA  -> "yan" mod (İlçe): sol sütun = children (mahalle kartları), sağ = Üyelik.
    - children YOKSA  -> "yalın" mod (Siteler): sadece grafikler; kart listesini çağıran ALTA koyar.

  Props:
    stat       : { kisi, hane, uye, erkek, kadin, yasArr }   (yasArr = [{ad,deger}, ...])
    ekstra     : { ic, lbl, num, meta, renk }   -> 4. StatCard
    mahalleIds : string[]  -> nüfus dağılımı bu mahallelerden toplanır
    baslik     : chart başlıklarının önüne gelen metin
    children   : (ops.) sol paneldeki kart listesi
*/
export default function DemografiPano({ stat, ekstra, mahalleIds, baslik = "", children }) {
  const { kisi = 0, hane = 0, uye = 0, erkek = 0, kadin = 0, yasArr = [] } = stat || {};
  const uyeOran = oran(uye, kisi);
  // Ortalama yaş: yaş aralıklarının orta noktalarından ağırlıklı ortalama (yaklaşık)
  const ortYas = useMemo(() => {
    const ORTA = { "18-24": 21, "25-34": 29.5, "35-44": 39.5, "45-54": 49.5, "55-64": 59.5, "65+": 70 };
    let t = 0, n = 0;
    (yasArr || []).forEach((y) => { const m = ORTA[y.ad]; if (m && y.deger) { t += m * y.deger; n += y.deger; } });
    return n ? Math.round(t / n) : 0;
  }, [yasArr]);
  const cinsTop = erkek + kadin;
  const yasTop = (yasArr || []).reduce((a, x) => a + (x.deger || 0), 0);
  const pasta = [
    { ad: "Üye", deger: uye, renk: "var(--accent)" },
    { ad: "Diğer", deger: Math.max(0, kisi - uye), renk: "#e7e9ed" },
  ];

  const [hazir, setHazir] = useState(false);
  useEffect(() => { setHazir(true); }, []);

  const idKey = (mahalleIds || []).filter(Boolean).join(",");
  // Teskilat artik DB'den (teskilat tablosu) — statik MAHALLE_TESKILAT yerine
  const [teskilatDb, setTeskilatDb] = useState(null);
  const mahId = (mahalleIds || []).filter(Boolean)[0] || null;
  useEffect(() => {
    if (!mahId) { setTeskilatDb(null); return; }
    (async () => {
      const { data } = await supabase.from("teskilat")
        .select("unvan, ad_soyad, telefon, kadin, sira").eq("mahalle_id", mahId).order("sira");
      if (!data || !data.length) { setTeskilatDb(null); return; }
      const t = { baskan: null, yurutme: null, yk: [], meclis: [], bby: null };
      data.forEach((r) => {
        const k = { ad: r.ad_soyad, tel: r.telefon || "", k: !!r.kadin };
        if (r.unvan === "baskan") t.baskan = k;
        else if (r.unvan === "yurutme") t.yurutme = k;
        else if (r.unvan === "yk") t.yk.push(k);
        else if (r.unvan === "meclis") t.meclis.push(k);
        else if (r.unvan === "bby") t.bby = k;
      });
      setTeskilatDb(t);
    })();
  }, [mahId]);
  // Cinsiyete göre ortalama yaş — tek sorgu + önbellek (anında)
  const [cinsYas, setCinsYas] = useState(null);
  useEffect(() => {
    const ids = (mahalleIds || []).filter(Boolean);
    if (!ids.length) { setCinsYas(null); return; }
    const anahtar = `yascins:mah:${idKey}`;
    const snap = cacheOku(anahtar);
    if (snap) setCinsYas(snap); // ANINDA
    let iptal = false;
    (async () => {
      const yil = new Date().getFullYear();
      let sonuc = null;
      const { data, error } = await supabase.from("mv_mahalle_yas_cins").select("c, kisi, ort_dogum").in("mahalle_id", ids);
      if (!error && data && data.length) {
        const agg = {};
        data.forEach((r) => {
          const c = String(r.c || "").toLocaleUpperCase("tr").charAt(0);
          if (!agg[c]) agg[c] = { n: 0, t: 0 };
          agg[c].n += r.kisi || 0; agg[c].t += (r.kisi || 0) * Number(r.ort_dogum || 0);
        });
        const hes = (c) => (agg[c] && agg[c].n ? Math.round(yil - agg[c].t / agg[c].n) : 0);
        sonuc = { e: hes("E"), k: hes("K") };
      } else {
        const KOVA = [[21, yil - 24, yil - 18], [29.5, yil - 34, yil - 25], [39.5, yil - 44, yil - 35], [49.5, yil - 54, yil - 45], [59.5, yil - 64, yil - 55], [70, 1900, yil - 65]];
        const sor = async (harf) => {
          const s = await Promise.all(KOVA.map(([, lo, hi]) =>
            supabase.from("kisi").select("*", { count: "exact", head: true })
              .in("mahalle_id", ids).ilike("cinsiyet", harf + "%").gte("dogum_yili", lo).lte("dogum_yili", hi)));
          let t = 0, n = 0;
          s.forEach((r, i) => { const c = r?.count || 0; t += KOVA[i][0] * c; n += c; });
          return n ? Math.round(t / n) : 0;
        };
        const [e, k] = await Promise.all([sor("e"), sor("k")]);
        sonuc = { e, k };
      }
      if (!iptal && sonuc && (sonuc.e || sonuc.k)) { setCinsYas(sonuc); cacheYaz(anahtar, sonuc); }
    })();
    return () => { iptal = true; };
  }, [idKey]);
  const [nufIl, setNufIl] = useState(null);
  const [nufHata, setNufHata] = useState(null);
  const [digerAcik, setDigerAcik] = useState(false);
  useEffect(() => {
    setDigerAcik(false);
    const ids = (mahalleIds || []).filter(Boolean);
    if (!ids.length) return;
    const ck = "nufil:" + idKey;
    const snap = cacheOku(ck);
    if (snap && snap.length) { setNufIl(snap); setNufHata(null); }
    let iptal = false;
    (async () => {
      const { data, error } = await supabase.from("mv_mahalle_nufus_il")
        .select("nufus_il, kisi").in("mahalle_id", ids);
      if (iptal) return;
      if (error) { setNufHata(hataMetni(error)); if (!snap) setNufIl([]); return; }
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

  // ---- panel parçaları (iki modda da tekrar kullanılır) ----
  const uyelikPanel = (
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
  );

  const yasPanel = (
    <div className="panel pad">
      <div className="panel-h2"><h3>{b("Yaş Aralığı Grafiği")}</h3><span className="dim">{fmt(yasTop)} kişi{ortYas ? ` · ort. ${ortYas} yaş` : ""}</span></div>
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
  );

  const cinsPanel = (
    <div className="panel pad">
      <div className="panel-h2"><h3>{b("Cinsiyet Oranı")}</h3><span className="dim">{fmt(cinsTop)} kişi</span></div>
      {cinsTop === 0 ? (
        <div className="dim" style={{ padding: "18px 2px" }}>Bu kapsamda cinsiyet verisi bulunamadı.</div>
      ) : (
        <div className="cins">
          <div className="cins-satir"><span className="cins-ad"><span className="dot" style={{ background: "#2563eb" }} /> Erkek</span><b className="mono">{fmt(erkek)}</b></div>
          <div className="bar"><i style={{ width: `${oran(erkek, cinsTop)}%`, background: "#2563eb" }} /></div>
          <div className="cins-satir" style={{ marginTop: 14 }}><span className="cins-ad"><span className="dot" style={{ background: "#db2777" }} /> Kadın</span><b className="mono">{fmt(kadin)}</b></div>
          <div className="bar"><i style={{ width: `${oran(kadin, cinsTop)}%`, background: "#db2777" }} /></div>
          <div className="cins-ozet" style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", fontSize: 13.5, marginTop: 10, paddingTop: 10, borderTop: "1px solid #eef2f7" }}>
            <span style={{ color: "#1d4ed8", fontWeight: 700 }}>
              Erkek %{oran(erkek, cinsTop)}
              {cinsYas?.e ? <span style={{ color: "#475569", fontWeight: 600 }}> · ort. <b style={{ color: "#1d4ed8" }}>{cinsYas.e}</b> yaş</span> : null}
            </span>
            <span style={{ color: "#be185d", fontWeight: 700 }}>
              Kadın %{oran(kadin, cinsTop)}
              {cinsYas?.k ? <span style={{ color: "#475569", fontWeight: 600 }}> · ort. <b style={{ color: "#be185d" }}>{cinsYas.k}</b> yaş</span> : null}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const nufusPanel = (
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
  );

  return (
    <>
      {(() => {
        // Mahalle teşkilatı — telefonlu, kadın pembe/erkek mavi
        const mahAd = String(baslik || "").replace(/\s*Mahallesi\s*$/i, "").trim();
        const t = teskilatDb;  // DB tablosundan
        if (!t) return null;
        const bas = (ad) => String(ad || "").trim().split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toLocaleUpperCase("tr");
        const satir = (kisi, gorev, vurgu) => {
          if (!kisi) return null;
          const kadin = !!kisi.k;
          const renk = kadin ? { bg: "#fce7f3", fg: "#9d174d" } : { bg: "#e0edff", fg: "#1e40af" };
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: vurgu ? (kadin ? "#fdf2f8" : "#fff4ec") : "#f6f8fb", border: vurgu ? `1px solid ${kadin ? "#f9a8d4" : "#f0b083"}` : "1px solid transparent", borderRadius: 9, padding: vurgu ? "10px 12px" : "8px 12px" }}>
              <div style={{ width: vurgu ? 34 : 30, height: vurgu ? 34 : 30, borderRadius: "50%", flex: "0 0 auto", background: renk.bg, color: renk.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800 }}>{bas(kisi.ad)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: vurgu ? 14 : 13, fontWeight: 700, color: "#0f172a", wordBreak: "break-word", overflowWrap: "anywhere" }}>{kisi.ad}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{gorev}</div>
                {(() => {
                  const b = ILCE_BIRIM[String(kisi.ad || "").trim().toLocaleUpperCase("tr")];
                  return b ? <div style={{ fontSize: 10.5, color: "#c2410c", fontWeight: 600, marginTop: 1 }}>{b}</div> : null;
                })()}
                {kisi.tel ? <a href={`tel:${kisi.tel.replace(/[^0-9+]/g, "")}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 11.5, color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>{kisi.tel}</a> : null}
              </div>
            </div>
          );
        };
        const ilceList = [
          [t.yurutme, "İlçe Yürütme Kurulu Üyesi"],
          ...((t.yk && t.yk.length ? t.yk : []).map((p) => [p, "İlçe Yönetim Kurulu Üyesi"])),
          ...((t.meclis && t.meclis.length ? t.meclis : []).map((p) => [p, "Belediye Meclis Üyesi"])),
        ].filter(([k]) => k);
        return (
          <div className="panel" style={{ padding: "13px 15px 15px", marginBottom: 12 }}>
            {satir(t.baskan, "Mahalle Başkanı", true)}
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.5, margin: "12px 0 7px" }}>İLÇE YÖNETİMİ</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
              {ilceList.map(([kisi, gorev], i) => <div key={i}>{satir(kisi, gorev)}</div>)}
            </div>
            {t.bby ? (<>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.5, margin: "12px 0 7px" }}>BELEDİYE</div>
              {satir(t.bby, "Belediye Başkan Yardımcısı")}
            </>) : null}
          </div>
        );
      })()}
      <div className="grid-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {(() => {
          // Mahalle nüfusu (TÜİK). baslik "Kayaşehir Mahallesi" -> "Kayaşehir"
          const ad = String(baslik || "").replace(/\s*Mahallesi\s*$/i, "").trim();
          const nuf = MAHALLE_NUFUS[ad];
          if (!nuf) return null;
          return <StatCard ic={<UsersRound size={15} />} lbl={`${ad} Mahallesi Toplam Nüfus`} num={fmt(nuf)} renk="#7c3aed" />;
        })()}
        <StatCard ic={<Users size={15} />} lbl="Toplam Seçmen" num={fmt(kisi)} meta="seçmen kaydı" />
        <StatCard ic={<Home size={15} />} lbl="Hane" num={fmt(hane)} meta="kayıtlı hane" renk="#2563eb" />
        <StatCard ic={<ShieldCheck size={15} />} lbl="AK Parti Üye" num={fmt(uye)} meta={`%${uyeOran} üyelik`} renk="#16a34a" />
        {ekstra && <StatCard ic={ekstra.ic} lbl={ekstra.lbl} num={ekstra.num} meta={ekstra.meta} renk={ekstra.renk} onClick={ekstra.onClick} />}
      </div>

      {children ? (
        <>
          {/* YAN MOD (İlçe): sol = kart listesi, sağ = Üyelik */}
          <div className="layout">{children}{uyelikPanel}</div>
          <div className="demo-grid" style={{ marginTop: 15 }}>{yasPanel}{cinsPanel}</div>
        </>
      ) : (
        <>
          {/* YALIN MOD (Siteler): grafikler önce; kart listesini çağıran alta koyar */}
          <div className="layout">{yasPanel}{uyelikPanel}</div>
          <div style={{ marginTop: 15 }}>{cinsPanel}</div>
        </>
      )}

      {nufusPanel}
    </>
  );
}
