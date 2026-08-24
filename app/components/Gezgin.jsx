"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { Building2, Compass, Users, UsersRound, ShieldCheck, ChevronRight, Home, Map, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmt, oran, NUF_RENK } from "../../lib/format";
import { cacheOku, cacheYaz } from "../../lib/cache";
import { ILCE_BASKANI, IL_SORUMLULAR } from "../../lib/constants";
import StatCard from "./StatCard";
import { hataMetni } from "../../lib/hata";

// İlçe toplam nüfusu (seçmenden bağımsız, resmî/tahmini nüfus). İleride başka ilçe eklenince buraya yazılır.
const ILCE_NUFUS = { "Başakşehir": 536797 };

export default function Gezgin({ mahalleler, toplam, bolgeToplam, ilceAd, onSec }) {
  // İlçe geneli nüfus (memleket) il dağılımı — ilçenin tüm mahallelerinden toplanır
  const [nufIl, setNufIl] = useState(null);
  // İlçe kadrosu (ilçe başkanı + il sorumluları) — teskilat tablosundan
  const [ilceKadro, setIlceKadro] = useState({ baskan: null, sorumlular: [] });
  const kadroMid = (mahalleler || []).map((m) => m.mahalle_id).filter(Boolean)[0];
  useEffect(() => {
    if (!kadroMid) return;
    (async () => {
      const { data: m } = await supabase.from("mahalle").select("ilce_id").eq("id", kadroMid).single();
      const iid = m?.ilce_id; if (!iid) return;
      const { data } = await supabase.from("teskilat").select("unvan, ad_soyad, telefon, gorev_metin, sira").eq("ilce_id", iid).in("unvan", ["ilce_baskani", "il_sorumlu"]).order("sira");
      setIlceKadro({ baskan: (data || []).find((r) => r.unvan === "ilce_baskani") || null, sorumlular: (data || []).filter((r) => r.unvan === "il_sorumlu") });
    })();
  }, [kadroMid]);
  const [nufHata, setNufHata] = useState(null);
  const [digerAcik, setDigerAcik] = useState(false);
  // Recharts ResponsiveContainer, hard-refresh'te kabı 0px ölçüp boş çizebiliyor;
  // mount'tan sonra çizince kap gerçek boyutuyla ölçülür ve chart kaybolmaz.
  const [hazir, setHazir] = useState(false);
  useEffect(() => { setHazir(true); }, []);
  const mahIdKey = (mahalleler || []).map((m) => m.mahalle_id).join(",");

  // Ortalama yaş (yaş aralıklarının orta noktalarından ağırlıklı)
  const ortYas = useMemo(() => {
    const ORTA = { "18-24": 21, "25-34": 29.5, "35-44": 39.5, "45-54": 49.5, "55-64": 59.5, "65+": 70 };
    let t = 0, n = 0;
    ((toplam && toplam.yasArr) || []).forEach((y) => { const m = ORTA[y.ad]; if (m && y.deger) { t += m * y.deger; n += y.deger; } });
    return n ? Math.round(t / n) : 0;
  }, [toplam]);

  // Cinsiyete göre ortalama yaş — tek sorgu (mv_mahalle_yas_cins) + önbellek → anında gelir
  const [cinsYas, setCinsYas] = useState(null);
  useEffect(() => {
    const ids = (mahalleler || []).map((m) => m.mahalle_id).filter(Boolean);
    if (!ids.length) { setCinsYas(null); return; }
    const anahtar = `yascins:ilce:${mahIdKey}`;
    const snap = cacheOku(anahtar);
    if (snap) setCinsYas(snap); // ANINDA (önceki ziyaretten)
    let iptal = false;
    (async () => {
      const yil = new Date().getFullYear();
      let sonuc = null;
      // 1) Hızlı yol: hazır özet görünüm
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
        // 2) Yedek yol: görünüm yoksa yaş kovası sayımı
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
  }, [mahIdKey]);
  useEffect(() => {
    setDigerAcik(false);
    const ids = (mahalleler || []).map((m) => m.mahalle_id).filter(Boolean);
    // mahalleler henüz gelmediyse: nufIl'i SIFIRLAMA (son iyi/cache veriyi koru) — F5'te panel kaybolmasın
    if (!ids.length) return;
    const ck = "nufil:" + mahIdKey;
    const snap = cacheOku(ck);
    if (snap && snap.length) { setNufIl(snap); setNufHata(null); } // son bilinen ANINDA (stale-while-revalidate)
    let iptal = false;
    (async () => {
      const { data, error } = await supabase.from("mv_mahalle_nufus_il")
        .select("nufus_il, kisi").in("mahalle_id", ids);
      if (iptal) return;
      if (error) { setNufHata(hataMetni(error)); if (!snap) setNufIl([]); return; }
      const m = {};
      (data || []).forEach((r) => { const il = (r.nufus_il || "").trim() || "Bilinmiyor"; m[il] = (m[il] || 0) + (r.kisi || 0); });
      const arr = Object.entries(m).map(([ad, deger]) => ({ ad, deger })).sort((a, b) => b.deger - a.deger);
      setNufHata(null);
      setNufIl(arr);
      if (arr.length) cacheYaz(ck, arr);
    })();
    return () => { iptal = true; };
  }, [mahIdKey]);

  // Bölge kartı hover -> bölge/grup mantığı (253 bölge, 549 grup, kaçı bölündü, sokak sayısı)
  const [bolgeBilgi, setBolgeBilgi] = useState(null);
  const [bolgeHover, setBolgeHover] = useState(false);
  useEffect(() => {
    const ids = (mahalleler || []).map((m) => m.mahalle_id).filter(Boolean);
    if (!ids.length) return;
    const ck = "bolgebilgi:" + mahIdKey;
    const snap = cacheOku(ck);
    if (snap) setBolgeBilgi(snap);
    let iptal = false;
    (async () => {
      const { data: bs } = await supabase.from("bolge").select("id").in("mahalle_id", ids);
      const bIds = (bs || []).map((b) => b.id);
      /* "Hangi bölgelerde gerçekten kişi var?" sorusu için eskiden ilçenin TÜM
         site-dışı hanesi (33 binden fazla satır) kisi(id) gömülü olarak
         çekiliyordu. Sayfalamasız hâli 1000'de sessizce kesiliyor ve bölgelerin
         çoğunu "kişisiz" gösteriyordu; sayfalanınca da ~34 ardışık istek
         atıyordu — üstelik bu yalnızca bir kart üzerine gelince görünen özet
         için.
         mv_bolge_ozet bu sayıyı bölge başına hazır tutuyor (site haneleri
         zaten hariç). Tek istek, aynı sonuç: 223 dolu bölge. */
      const [skR, sgR, boR] = await Promise.all([
        supabase.from("sokak").select("*", { count: "exact", head: true }).in("mahalle_id", ids),
        bIds.length ? supabase.from("sokak_grup").select("bolge_id").in("bolge_id", bIds) : Promise.resolve({ data: [] }),
        supabase.from("mv_bolge_ozet").select("bolge_id, kisi").in("mahalle_id", ids),
      ]);
      if (iptal) return;
      const gruplar = sgR.data || [];
      const grupluSet = new Set(gruplar.map((g) => g.bolge_id));        // grubu olan bölgeler
      const doluSet = new Set();
      (boR.data || []).forEach((b) => { if ((b.kisi || 0) > 0) doluSet.add(b.bolge_id); });
      // Gerçek bekleyen iş = kişili ama grupsuz bölgeler
      let bekleyen = 0; doluSet.forEach((id) => { if (!grupluSet.has(id)) bekleyen++; });
      const bilgi = {
        sokak: skR.count || 0,
        grup: gruplar.length,
        bolunmus: grupluSet.size,
        bolgeTop: bIds.length,
        dolu: doluSet.size,
        bekleyen,
      };
      setBolgeBilgi(bilgi);
      cacheYaz(ck, bilgi);
    })();
    return () => { iptal = true; };
  }, [mahIdKey]);

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

  if (mahalleler === null) return <div className="merkez">Yükleniyor…</div>;
  const uyeOran = oran(toplam.uye, toplam.kisi);
  // Bölge = sokak-tipi birim (site haneleri bölgeye dahil değil). Gerçek hane/bölge ortalaması:
  const sokakHane = (mahalleler || []).filter((m) => m.tip === "sokak").reduce((a, m) => a + (m.hane || 0), 0);
  const sokakKisi = (mahalleler || []).filter((m) => m.tip === "sokak").reduce((a, m) => a + (m.kisi || 0), 0);
  const haneBolgeOrt = bolgeToplam ? Math.round(sokakHane / bolgeToplam) : 0;
  const kisiBolgeOrt = bolgeToplam ? Math.round(sokakKisi / bolgeToplam) : 0;
  const grupKisiOrt = bolgeBilgi?.grup ? Math.round(sokakKisi / bolgeBilgi.grup) : 0;
  const pasta = [
    { ad: "Üye", deger: toplam.uye, renk: "var(--accent)" },
    { ad: "Diğer", deger: Math.max(0, toplam.kisi - toplam.uye), renk: "#e7e9ed" },
  ];
  return (
    <>
      <div className="head"><div><h2 className="disp">{ilceAd || "Başakşehir"} · İlçe Teşkilatı</h2>
        <div className="sub">{mahalleler.length} mahalle · {fmt(bolgeToplam)} bölge</div></div>
        <span className="tag"><Compass size={13} /> {ilceAd || "Aktif Saha"}</span></div>

      {/* İl/İlçe yönetimi — başkan + sorumlu il başkan yardımcıları */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {(() => {
          const bas = (ad) => String(ad || "").trim().split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toLocaleUpperCase("tr");
          const kart = (ad, unvan, vurgu) => (
            <div key={ad} style={{ display: "flex", alignItems: "center", gap: 10, background: vurgu ? "#fff4ec" : "#fff", border: `1px solid ${vurgu ? "#f0b083" : "#e5eaf2"}`, borderRadius: 11, padding: "10px 14px", flex: "1 1 240px", minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", flex: "0 0 auto", background: vurgu ? "#f0b083" : "#e0edff", color: vurgu ? "#4a1b0c" : "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{bas(ad)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ad}</div>
                <div style={{ fontSize: 11.5, color: "#64748b" }}>{unvan}</div>
              </div>
            </div>
          );
          const basAd = ilceKadro.baskan?.ad_soyad || ILCE_BASKANI.ad;
          const sorumlular = ilceKadro.sorumlular.length
            ? ilceKadro.sorumlular.map((r) => ({ ad: r.ad_soyad, unvan: r.gorev_metin || "İl Sorumlusu" }))
            : IL_SORUMLULAR;
          return [
            kart(basAd, `${ilceAd || "Başakşehir"} İlçe Başkanı`, true),
            ...sorumlular.map((s) => kart(s.ad, s.unvan)),
          ];
        })()}
      </div>
      <div className="grid-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {ILCE_NUFUS[ilceAd || "Başakşehir"] != null &&
          <StatCard ic={<UsersRound size={15} />} lbl="Toplam Nüfus" num={fmt(ILCE_NUFUS[ilceAd || "Başakşehir"])} meta="2025 nüfusu" renk="#7c3aed" />}
        <StatCard ic={<Users size={15} />} lbl="Toplam Seçmen" num={fmt(toplam.kisi)} meta="seçmen kaydı" />
        <StatCard ic={<Home size={15} />} lbl="Hane" num={fmt(toplam.hane)} meta="kayıtlı hane" renk="#2563eb" />
        <StatCard ic={<ShieldCheck size={15} />} lbl="AK Parti Üye" num={fmt(toplam.uye)} meta={`%${uyeOran} üyelik`} renk="#16a34a" />
        <div style={{ position: "relative" }} onMouseEnter={() => setBolgeHover(true)} onMouseLeave={() => setBolgeHover(false)}>
          <StatCard ic={<Map size={15} />} lbl="Bölünmüş Sokak" num={fmt(bolgeToplam)} meta={haneBolgeOrt ? `ort. ${fmt(haneBolgeOrt)} hane/birim` : "bölünmüş sokaklar"} renk="#9333ea" />
          {bolgeHover && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 60, marginTop: 6, width: 320, maxWidth: "88vw", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 14px 40px rgba(15,23,42,.18)", padding: 14, fontSize: 12.5, color: "#334155", lineHeight: 1.55 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: "#6d28d9" }}>Saha Teşkilat Yapısı</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 10px" }}>
                <span>Bölünmüş Sokak</span><b className="mono">{fmt(bolgeToplam)}</b>
                <span>Kayıtlı sokak</span><b className="mono">{bolgeBilgi ? fmt(bolgeBilgi.sokak) : "…"}</b>
                <span>Saha grubu (~150 hane)</span><b className="mono" style={{ color: "#c2410c" }}>{bolgeBilgi ? fmt(bolgeBilgi.grup) : "…"}</b>
                <span>Gruplama bekleyen</span><b className="mono" style={{ color: bolgeBilgi && bolgeBilgi.bekleyen > 0 ? "#b45309" : "#15803d" }}>{bolgeBilgi ? fmt(bolgeBilgi.bekleyen) : "…"}</b>
                <span>Birim başına ort. seçmen</span><b className="mono">{fmt(kisiBolgeOrt)}</b>
                <span>Grup başına ort. seçmen</span><b className="mono">{grupKisiOrt ? fmt(grupKisiOrt) : "…"}</b>
                <span>Birim başına ort. hane</span><b className="mono">{fmt(haneBolgeOrt)}</b>
              </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #eef2f7", color: "#64748b" }}>
                <b style={{ color: "#c2410c" }}>Planlama birimi gruptur (~150 hane), bölünmüş sokak değildir.</b> Her saha sorumlusu bir gruptan mesuldür; bölünmüş sokaklar ortalama {kisiBolgeOrt ? Math.max(1, Math.round(kisiBolgeOrt / 150)) : 2} saha grubuna ayrılır.{" "}
                {bolgeBilgi ? (bolgeBilgi.bekleyen > 0
                  ? <span style={{ color: "#b45309" }}>{fmt(bolgeBilgi.bekleyen)} bölünmüş sokağın gruplaması tamamlanmamıştır; ilgili mahallenin "Sokaklar" ekranından gruplandırınız.</span>
                  : <span style={{ color: "#15803d", fontWeight: 600 }}>Seçmen kayıtlı tüm bölgelerin gruplaması tamamlanmıştır. ✓</span>) : ""}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="layout">
        <div className="panel">
          <div className="panel-h"><h3>Mahalleler</h3><span className="rolepill"><TrendingUp size={13} /> kişiye göre</span></div>
          <div className="cards">
            {mahalleler.map((m) => (
              <div key={m.mahalle_id} className="card" onClick={() => onSec({ id: m.mahalle_id, ad: m.ad, tip: m.tip })}>
                <div className="card-t">{m.ad} <ChevronRight size={15} /></div>
                <div style={{ marginBottom: 8 }}>
                  <span className={"tip-tag " + (m.tip === "site" ? "site" : "sokak")}>
                    {m.tip === "site" ? <Building2 size={11} /> : <Map size={11} />}
                    {m.tip === "site" ? "Site" : "Sokak"}
                  </span>
                </div>
                <div className="card-nums">
                  <div><b>{fmt(m.kisi)}</b><span>kişi</span></div>
                  <div><b>{fmt(m.hane)}</b><span>hane</span></div>
                  <div className="acc"><b>{fmt(m.uye)}</b><span>üye</span></div>
                </div>
                <div className="bar"><i style={{ width: `${oran(m.uye, m.kisi)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
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
            <div><span className="dot" style={{ background: "var(--accent)" }} /> Üye <b>{fmt(toplam.uye)}</b></div>
            <div><span className="dot" style={{ background: "#e7e9ed" }} /> Diğer <b>{fmt(Math.max(0, toplam.kisi - toplam.uye))}</b></div>
          </div>
        </div>
      </div>

      <div className="demo-grid" style={{ marginTop: 15 }}>
        <div className="panel pad">
          <div className="panel-h2"><h3>{ilceAd || "Başakşehir"} İlçesi Yaş Aralığı Grafiği</h3><span className="dim">{fmt(toplam.erkek + toplam.kadin)} kişi{ortYas ? ` · ort. ${ortYas} yaş` : ""}</span></div>
          {hazir ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={toplam.yasArr} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="ad" tick={{ fontSize: 11, fill: "#5a626c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9097a0" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(0) + "b" : v} />
                <Tooltip cursor={{ fill: "#0000000a" }} formatter={(v) => [fmt(v), "Kişi"]} labelFormatter={(l) => "Yaş " + l} />
                <Bar dataKey="deger" fill="#cf5a26" radius={[5, 5, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 210 }} />}
        </div>
        <div className="panel pad">
          <div className="panel-h2"><h3>{ilceAd || "Başakşehir"} İlçesi Cinsiyet Oranı</h3><span className="dim">{fmt(toplam.erkek + toplam.kadin)} kişi</span></div>
          <div className="cins">
            <div className="cins-satir"><span className="cins-ad"><span className="dot" style={{ background: "#2563eb" }} /> Erkek</span><b className="mono">{fmt(toplam.erkek)}</b></div>
            <div className="bar"><i style={{ width: `${oran(toplam.erkek, toplam.erkek + toplam.kadin)}%`, background: "#2563eb" }} /></div>
            <div className="cins-satir" style={{ marginTop: 14 }}><span className="cins-ad"><span className="dot" style={{ background: "#db2777" }} /> Kadın</span><b className="mono">{fmt(toplam.kadin)}</b></div>
            <div className="bar"><i style={{ width: `${oran(toplam.kadin, toplam.erkek + toplam.kadin)}%`, background: "#db2777" }} /></div>
            <div className="cins-ozet" style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", fontSize: 13.5, marginTop: 10, paddingTop: 10, borderTop: "1px solid #eef2f7" }}>
              <span style={{ color: "#1d4ed8", fontWeight: 700 }}>
                Erkek %{oran(toplam.erkek, toplam.erkek + toplam.kadin)}
                {cinsYas?.e ? <span style={{ color: "#475569", fontWeight: 600 }}> · ort. <b style={{ color: "#1d4ed8" }}>{cinsYas.e}</b> yaş</span> : null}
              </span>
              <span style={{ color: "#be185d", fontWeight: 700 }}>
                Kadın %{oran(toplam.kadin, toplam.erkek + toplam.kadin)}
                {cinsYas?.k ? <span style={{ color: "#475569", fontWeight: 600 }}> · ort. <b style={{ color: "#be185d" }}>{cinsYas.k}</b> yaş</span> : null}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel pad" style={{ marginTop: 15 }}>
        <div className="panel-h2">
          <h3>{ilceAd || "Başakşehir"} İlçesi Demografik Yapı · Nüfus İl Dağılımı</h3>
          {nufDag.ilSay > 0 && <span className="dim">{fmt(nufDag.ilSay)} il · {fmt(nufDag.toplam)} kişi</span>}
        </div>
        {nufHata ? (
          <div className="dim" style={{ padding: "10px 2px", color: "#b91c1c" }}>Nüfus verisi alınamadı: {nufHata}</div>
        ) : nufIl === null ? (
          <div className="merkez" style={{ padding: 24 }}>Yükleniyor…</div>
        ) : nufDag.ilSay === 0 ? (
          <div className="dim" style={{ padding: "10px 2px" }}>Bu ilçe için nüfus (memleket) verisi bulunamadı.</div>
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
