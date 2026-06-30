"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { Users, FileText, Search, MapPin, CheckCircle2, Circle, Download, UserCheck, X } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { NUF_RENK, csvIndir, fmt, haneBaslik, oran, sokakAdres, yakRenk } from "../../lib/format";
import GrupBaskanPanel from "./GrupBaskanPanel";
import SokakBolStrip from "./SokakBolStrip";
import Sorumlular from "./Sorumlular";
import ZiyaretModal from "./ZiyaretModal";

export default function Haneler({ birim, userId, yonetici, planla, onGrupSec, haneIds, grup }) {
  const isSite = birim.tip === "site";
  const tablo = isSite ? "site_kayit" : "bolge";
  const sorumluAlan = isSite ? "temsilci_id" : "sorumlu_id";
  const mapsHedef = (h) => {
    if (isSite) {
      const p = [h.adres, h.kapi_no ? "No " + h.kapi_no : null].filter(Boolean);
      return (p.length ? p.join(" ") : (birim.kod || "")).trim();
    }
    return sokakAdres(h.adres || h.no || "");
  };
  const mapsURL = (h) => {
    const ek = [birim.mahalleAd, birim.ilceAd].filter(Boolean).join(" ");
    const q = `${mapsHedef(h)}${ek ? " " + ek : ""} İstanbul`.replace(/\s+/g, " ").trim();
    return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q);
  };

  const [haneler, setHaneler] = useState(null);
  const [ara, setAra] = useState("");
  const [mesgul, setMesgul] = useState(null);
  const [hedefTarih, setHedefTarih] = useState("");
  const [sorumluId, setSorumluId] = useState(birim.sorumlu_id || "");
  const [koordId, setKoordId] = useState(birim.koordinator_id || "");
  const [profiller, setProfiller] = useState([]);
  const [atandi, setAtandi] = useState("");
  const [grupAd, setGrupAd] = useState(grup ? (grup.baskan_ad || "") : "");
  const [zModal, setZModal] = useState(null);
  const [digerAcik, setDigerAcik] = useState(false);
  const [nufBlok, setNufBlok] = useState("");
  useEffect(() => { setGrupAd(grup ? (grup.baskan_ad || "") : ""); }, [grup ? grup.id : null]);

  useEffect(() => { setSorumluId(birim.sorumlu_id || ""); setKoordId(birim.koordinator_id || ""); }, [birim.id]);

  useEffect(() => {
    if (!yonetici) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, ad_soyad, eposta, rol").in("rol", ["sorumlu", "koordinator"]).order("ad_soyad");
      setProfiller(data || []);
    })();
  }, [yonetici]);

  const sorumlular = useMemo(() => profiller.filter((p) => p.rol === "sorumlu"), [profiller]);
  const koordinatorler = useMemo(() => profiller.filter((p) => p.rol === "koordinator"), [profiller]);
  const adById = useMemo(() => { const o = {}; profiller.forEach((p) => o[p.id] = p.ad_soyad || p.eposta); return o; }, [profiller]);

  async function ataAlan(alan, val, setter) {
    setter(val);
    const kolon = alan === "sorumlu_id" ? sorumluAlan : "koordinator_id";
    const { error } = await supabase.from(tablo).update({ [kolon]: val || null }).eq("id", birim.id);
    if (!error) { setAtandi(alan); setTimeout(() => setAtandi(""), 1200); }
  }

  async function parcaliKisi(table, sel, haneIds) {
    const chunks = [];
    for (let i = 0; i < haneIds.length; i += 200) chunks.push(haneIds.slice(i, i + 200));
    const res = await Promise.all(chunks.map((c) => supabase.from(table).select(sel).in("hane_id", c)));
    return res.flatMap((r) => r.data || []);
  }

  async function yukle() {
    setHaneler(null);
    try {
      const hq = supabase.from("hane").select("id, no, adres, kapi_no, kapi_blok, ilce_id").order("no");
      const _hr = await (isSite ? hq.eq("site_kayit_id", birim.id) : hq.eq("bolge_id", birim.id).is("site_kayit_id", null));
      if (_hr.error) throw _hr.error;
      let hRows = _hr.data || [];
      if (haneIds) { const allow = new Set(haneIds); hRows = hRows.filter((h) => allow.has(h.id)); }
      const ids = (hRows || []).map((h) => h.id);
      let kRows = [], zRows = [], meta = null;
      if (isSite) {
        const [k, z, m] = await Promise.all([
          ids.length ? parcaliKisi("kisi", "id, ad, soyad, cinsiyet, telefon, uye, secmen, dogum_yili, hane_id, nufus_il", ids) : Promise.resolve([]),
          ids.length ? parcaliKisi("ziyaret", "hane_id, durum, not_, tarih, onceki_tarih, yaklasim, kapsam", ids) : Promise.resolve([]),
          supabase.from("site_kayit").select("hedef_tarih").eq("id", birim.id).single(),
        ]);
        kRows = k; zRows = z; meta = m.data;
      } else {
        const [k, z, m] = await Promise.all([
          supabase.from("kisi").select("id, ad, soyad, cinsiyet, telefon, uye, secmen, dogum_yili, hane_id, nufus_il").eq("bolge_id", birim.id),
          supabase.from("ziyaret").select("hane_id, durum, not_, tarih, onceki_tarih, yaklasim, kapsam").eq("bolge_id", birim.id),
          supabase.from("bolge").select("hedef_tarih").eq("id", birim.id).single(),
        ]);
        kRows = k.data || []; zRows = z.data || []; meta = m.data;
      }
      setHedefTarih(meta?.hedef_tarih || "");
      const kBy = {}; (kRows || []).forEach((k) => { (kBy[k.hane_id] ||= []).push(k); });
      const zBy = {}; (zRows || []).forEach((z) => { zBy[z.hane_id] = z; });
      setHaneler((hRows || []).map((h) => {
        const z = zBy[h.id] || {};
        return { ...h, kisiler: kBy[h.id] || [], ziyaret: z.durum === "ziyaret_edildi", not_: z.not_ || "", tarih: z.tarih || null, onceki_tarih: z.onceki_tarih || null, yaklasim: z.yaklasim || null, kapsam: z.kapsam || "" };
      }));
    } catch (e) {
      console.error("Haneler yükleme hatası:", e);
      setHaneler([]);   // sonsuz "yükleniyor"da kalmasın
    }
  }
  useEffect(() => { yukle(); }, [birim.id, birim.yenile]);

  async function ziyaretYaz(h, patch) {
    const { data: m } = await supabase.from("ziyaret").select("id").eq("hane_id", h.id).limit(1);
    if (m && m.length) return supabase.from("ziyaret").update(patch).eq("id", m[0].id);
    return supabase.from("ziyaret").insert({ ilce_id: h.ilce_id, bolge_id: isSite ? null : birim.id, hane_id: h.id, kullanici_id: userId, ...patch });
  }

  async function kaydetZiyaret(h, { yaklasim, kapsam, not_ }) {
    if (mesgul) return;
    setMesgul(h.id);
    const now = new Date().toISOString();
    const patch = { durum: "ziyaret_edildi", tarih: now, onceki_tarih: h.tarih || h.onceki_tarih || null, yaklasim: yaklasim || null, kapsam: kapsam || null, not_: not_ ?? null };
    setHaneler((p) => p.map((x) => x.id === h.id ? { ...x, ziyaret: true, tarih: now, onceki_tarih: patch.onceki_tarih, yaklasim: patch.yaklasim, kapsam: patch.kapsam || "", not_: patch.not_ || "" } : x));
    try { await ziyaretYaz(h, patch); } catch {}
    try {
      await supabase.from("ziyaret_log").insert({
        hane_id: h.id, kullanici_id: userId, ilce_id: h.ilce_id,
        bolge_id: isSite ? null : birim.id, tarih: now,
        yaklasim: yaklasim || null, kapsam: kapsam || null, not_: not_ ?? null, durum: "ziyaret_edildi",
      });
    } catch {}
    setMesgul(null); setZModal(null);
  }

  async function sifirla(h) {
    if (mesgul) return;
    setMesgul(h.id);
    const patch = { durum: "bekliyor", onceki_tarih: h.tarih || h.onceki_tarih || null, tarih: null };
    setHaneler((p) => p.map((x) => x.id === h.id ? { ...x, ziyaret: false, onceki_tarih: patch.onceki_tarih, tarih: null } : x));
    try { await ziyaretYaz(h, patch); } catch {}
    setMesgul(null); setZModal(null);
  }

  async function notKaydet(h) {
    const yeni = window.prompt(`${h.no} — ziyaret notu:`, h.not_ || "");
    if (yeni === null) return;
    setHaneler((p) => p.map((x) => x.id === h.id ? { ...x, not_: yeni } : x));
    try { await ziyaretYaz(h, { not_: yeni }); } catch {}
  }

  async function hedefKaydet(tarih) {
    setHedefTarih(tarih);
    await supabase.from(tablo).update({ hedef_tarih: tarih || null }).eq("id", birim.id);
  }

  const suzulmus = useMemo(() => {
    if (!haneler) return [];
    let hs = haneler;
    if (isSite && nufBlok) hs = hs.filter((h) => (h.kapi_blok || "").trim() === nufBlok);
    const a = ara.trim().toLocaleLowerCase("tr"); if (!a) return hs;
    return hs.filter((h) => (h.no || "").toLocaleLowerCase("tr").includes(a) ||
      h.kisiler.some((k) => `${k.ad} ${k.soyad}`.toLocaleLowerCase("tr").includes(a)));
  }, [haneler, ara, nufBlok, isSite]);

  const zSay = (haneler || []).filter((h) => h.ziyaret).length;
  const tHane = (haneler || []).length;
  const yuzde = tHane ? Math.round((zSay / tHane) * 100) : 0;
  const kSay = (haneler || []).reduce((a, h) => a + h.kisiler.length, 0);

  const demografi = useMemo(() => {
    const ks = (haneler || []).flatMap((h) => h.kisiler);
    let erkek = 0, kadin = 0;
    const yas = { "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55-64": 0, "65+": 0 };
    ks.forEach((k) => {
      const c = String(k.cinsiyet || "").toLocaleUpperCase("tr").charAt(0);
      if (c === "E") erkek++; else if (c === "K") kadin++;
      if (k.dogum_yili) {
        const a = 2026 - k.dogum_yili;
        if (a < 25) yas["18-24"]++; else if (a < 35) yas["25-34"]++; else if (a < 45) yas["35-44"]++;
        else if (a < 55) yas["45-54"]++; else if (a < 65) yas["55-64"]++; else yas["65+"]++;
      }
    });
    return { erkek, kadin, toplam: erkek + kadin, yasArr: Object.entries(yas).map(([ad, deger]) => ({ ad, deger })) };
  }, [haneler]);

  const nufBloklar = useMemo(() => {
    if (!isSite) return [];
    const s = new Set();
    (haneler || []).forEach((h) => { const b = (h.kapi_blok || "").trim(); if (b) s.add(b); });
    return [...s].sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  }, [haneler, isSite]);

  useEffect(() => { setNufBlok(""); setDigerAcik(false); }, [birim.id, grup ? grup.id : null]);

  const nufusDagilim = useMemo(() => {
    let hs = haneler || [];
    if (nufBlok) hs = hs.filter((h) => (h.kapi_blok || "").trim() === nufBlok);
    const ks = hs.flatMap((h) => h.kisiler);
    const m = {};
    ks.forEach((k) => { const il = (k.nufus_il || "").trim() || "Bilinmiyor"; m[il] = (m[il] || 0) + 1; });
    const arr = Object.entries(m).map(([ad, deger]) => ({ ad, deger })).sort((a, b) => b.deger - a.deger);
    const N = 10;
    const top = arr.slice(0, N);
    const kalanArr = arr.slice(N);
    const kalan = kalanArr.reduce((a, x) => a + x.deger, 0);
    if (kalan > 0) top.push({ ad: "Diğer", deger: kalan, detay: kalanArr });
    return { arr: top, toplam: ks.length, ilSay: arr.length };
  }, [haneler, nufBlok]);

  const NufusTip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    const box = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12, boxShadow: "0 6px 18px rgba(0,0,0,.12)" };
    if (d.ad === "Diğer" && d.detay) {
      return (
        <div style={{ ...box }}>
          <div style={{ fontWeight: 700 }}>Diğer · {fmt(d.deger)} kişi ({d.detay.length} il)</div>
          <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>Dökümü görmek için listede tıkla</div>
        </div>
      );
    }
    return <div style={box}><b>{d.ad}</b>: {fmt(d.deger)} kişi</div>;
  };

  return (
    <>
      <div className="head"><div><h2 className="disp">{grup ? `${birim.kod}-${grup.no}` : birim.kod}</h2><div className="sub">{birim.kapsam || "—"}</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {grup
            ? <span className="tag" style={{ background: grupAd ? "var(--ok-weak)" : "var(--surface2)", color: grupAd ? "var(--ok)" : "var(--ink2)", borderColor: grupAd ? "#9ccfc7" : "var(--border)" }}><UserCheck size={13} /> Sorumlu: {grupAd || "atanmadı"}</span>
            : yonetici && <span className="tag" style={{ background: sorumluId ? "var(--ok-weak)" : "var(--surface2)", color: sorumluId ? "var(--ok)" : "var(--ink2)", borderColor: sorumluId ? "#9ccfc7" : "var(--border)" }}>
            <UserCheck size={13} /> {isSite ? "Site Temsilcisi" : "Sorumlu"}: {sorumluId ? (adById[sorumluId] || "atandı") : "atanmadı"}</span>}
          <span className="tag"><Users size={13} /> {fmt(tHane)} hane · {fmt(kSay)} kişi</span>
        </div></div>

      {grup && <GrupBaskanPanel grup={grup} onAtandi={(id, ad) => setGrupAd(ad || "")} />}

      {yonetici && !grup && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="atama-strip">
            <div className="as-grup">
              <span className="as-lbl">{isSite ? "SİTE TEMSİLCİSİ (site başkanı)" : "SORUMLU (sokak/site başkanı)"}</span>
              <select className="sel" value={sorumluId} onChange={(e) => ataAlan("sorumlu_id", e.target.value, setSorumluId)}>
                <option value="">— atanmadı —</option>
                {sorumlular.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad || p.eposta}</option>)}
              </select>
              {atandi === "sorumlu_id" && <span className="ok-mini">✓ kaydedildi</span>}
            </div>
            <div className="as-grup">
              <span className="as-lbl">KOORDİNATÖR</span>
              <select className="sel" value={koordId} onChange={(e) => ataAlan("koordinator_id", e.target.value, setKoordId)}>
                <option value="">— atanmadı —</option>
                {koordinatorler.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad || p.eposta}</option>)}
              </select>
              {atandi === "koordinator_id" && <span className="ok-mini">✓ kaydedildi</span>}
            </div>
            {profiller.length === 0 && <span className="dim">Önce Sorumlular sayfasından hesap oluşturun.</span>}
          </div>
        </div>
      )}
      {birim.tip === "bolge" && !grup && yonetici && <SokakBolStrip bolge={birim} />}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="ilerleme">
          <div className="ilerleme-ust">
            <span><b className="mono">{zSay}</b> / {tHane} hane ziyaret edildi</span>
            <span className="mono" style={{ color: yuzde >= 66 ? "var(--ok)" : yuzde >= 33 ? "#b45309" : "var(--accent2)", fontWeight: 700 }}>%{yuzde}</span>
          </div>
          <div className="bar"><i style={{ width: `${yuzde}%`, background: yuzde >= 66 ? "var(--ok)" : "var(--accent)" }} /></div>
        </div>
      </div>

      {(planla || hedefTarih) && (() => {
        const kalan = tHane - zSay;
        const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
        let gun = 0, gunluk = 0;
        if (hedefTarih) { gun = Math.max(1, Math.ceil((new Date(hedefTarih) - bugun) / 86400000)); gunluk = Math.ceil(kalan / gun); }
        const hafta = Math.max(1, Math.ceil(gun / 7));
        const haftalik = Math.ceil(kalan / hafta);
        return (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="plan">
              <div className="plan-sol">
                <div className="plan-num"><b>{fmt(kalan)}</b><span>kalan hane</span></div>
                {hedefTarih && <div className="plan-num"><b>{fmt(gun)}</b><span>gün kaldı</span></div>}
                {hedefTarih && <div className="plan-num vurgu"><b>{fmt(gunluk)}</b><span>günlük hedef</span></div>}
                {hedefTarih && <div className="plan-num"><b>{fmt(haftalik)}</b><span>haftalık hedef</span></div>}
              </div>
              <div className="plan-sag">
                <label>Hedef tarih</label>
                {planla
                  ? <input type="date" className="inp2" value={hedefTarih || ""} onChange={(e) => hedefKaydet(e.target.value)} />
                  : <span className="mono">{hedefTarih ? new Date(hedefTarih).toLocaleDateString("tr-TR") : "belirlenmedi"}</span>}
                {planla && hedefTarih && <button className="btn" onClick={() => hedefKaydet("")} style={{ marginLeft: 8 }}>Temizle</button>}
              </div>
            </div>
            {hedefTarih && <div className="plan-not">Bu {isSite ? "siteyi" : "bölgeyi"} hedefe yetiştirmek için günde ~<b>{fmt(gunluk)}</b> hane ziyaret edilmeli.</div>}
            {!hedefTarih && planla && <div className="plan-not dim">Hedef tarih seçince sistem günlük/haftalık ziyaret hedefini otomatik hesaplar.</div>}
          </div>
        );
      })()}
      {haneler && haneler.length > 0 && (
        <div className="demo-grid">
          <div className="panel pad">
            <div className="panel-h2"><h3>Yaş Aralığı</h3><span className="dim">{fmt(demografi.toplam)} kişi</span></div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={demografi.yasArr} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <XAxis dataKey="ad" tick={{ fontSize: 11, fill: "#5a626c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9097a0" }} axisLine={false} tickLine={false} width={42} />
                <Tooltip cursor={{ fill: "#0000000a" }} formatter={(v) => [fmt(v), "Kişi"]} labelFormatter={(l) => "Yaş " + l} />
                <Bar dataKey="deger" fill="#cf5a26" radius={[5, 5, 0, 0]} maxBarSize={46} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="panel pad">
            <div className="panel-h2"><h3>Cinsiyet</h3><span className="dim">{fmt(demografi.toplam)} kişi</span></div>
            <div className="cins">
              <div className="cins-satir">
                <span className="cins-ad"><span className="dot" style={{ background: "#2563eb" }} /> Erkek</span>
                <b className="mono">{fmt(demografi.erkek)}</b></div>
              <div className="bar"><i style={{ width: `${oran(demografi.erkek, demografi.toplam)}%`, background: "#2563eb" }} /></div>
              <div className="cins-satir" style={{ marginTop: 14 }}>
                <span className="cins-ad"><span className="dot" style={{ background: "#db2777" }} /> Kadın</span>
                <b className="mono">{fmt(demografi.kadin)}</b></div>
              <div className="bar"><i style={{ width: `${oran(demografi.kadin, demografi.toplam)}%`, background: "#db2777" }} /></div>
              <div className="cins-ozet">Erkek %{oran(demografi.erkek, demografi.toplam)} · Kadın %{oran(demografi.kadin, demografi.toplam)}</div>
            </div>
          </div>
        </div>
      )}

      {haneler && haneler.length > 0 && nufusDagilim.ilSay > 0 && (
        <div className="panel pad" style={{ marginBottom: 14 }}>
          <div className="panel-h2"><h3>Nüfus İl Dağılımı{nufBlok ? ` · ${nufBlok} blok` : ""}</h3><span className="dim">{fmt(nufusDagilim.ilSay)} il · {fmt(nufusDagilim.toplam)} kişi</span></div>
          {isSite && nufBloklar.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "2px 0 10px" }}>
              <button onClick={() => { setNufBlok(""); setDigerAcik(false); }}
                style={{ padding: "3px 11px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: "1px solid " + (nufBlok === "" ? "#2563eb" : "#d7dce2"), background: nufBlok === "" ? "#2563eb" : "#fff", color: nufBlok === "" ? "#fff" : "#475569", fontWeight: nufBlok === "" ? 600 : 400 }}>
                Tüm site
              </button>
              {nufBloklar.map((b) => (
                <button key={b} onClick={() => { setNufBlok(b); setDigerAcik(false); }}
                  style={{ padding: "3px 11px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: "1px solid " + (nufBlok === b ? "#2563eb" : "#d7dce2"), background: nufBlok === b ? "#2563eb" : "#fff", color: nufBlok === b ? "#fff" : "#475569", fontWeight: nufBlok === b ? 600 : 400 }}>
                  {b}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 6 }}>
            <div style={{ width: 210, height: 210, flex: "0 0 auto" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={nufusDagilim.arr} dataKey="deger" nameKey="ad" cx="50%" cy="50%" innerRadius={54} outerRadius={92} paddingAngle={1} stroke="#fff" strokeWidth={1}>
                    {nufusDagilim.arr.map((e, i) => <Cell key={i} fill={e.ad === "Diğer" ? "#94a3b8" : NUF_RENK[i % NUF_RENK.length]} />)}
                  </Pie>
                  <Tooltip content={<NufusTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: "1 1 200px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "5px 16px", minWidth: 180 }}>
              {nufusDagilim.arr.map((e, i) => {
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
            const dg = nufusDagilim.arr.find((x) => x.ad === "Diğer");
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
        </div>
      )}

      <div className="panel">
        <div className="panel-h"><h3>Haneler{isSite && nufBlok ? ` · ${nufBlok} blok` : ""}</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isSite && nufBlok && (
              <button onClick={() => setNufBlok("")} title="Blok filtresini kaldır"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb" }}>
                {nufBlok} blok <X size={13} />
              </button>
            )}
            <button className="btn" onClick={() => csvIndir({ kod: birim.kod }, suzulmus)}><Download size={14} /> CSV</button>
            <div className="searchbox"><Search size={13} />
              <input placeholder="Hane / kişi ara…" value={ara} onChange={(e) => setAra(e.target.value)} /></div>
          </div></div>
        {haneler === null ? <div className="merkez">Yükleniyor…</div>
          : suzulmus.length === 0 ? <div className="merkez">Kayıt yok.</div> : (
            <table className="htable hane-table">
              <thead><tr><th>Hane</th><th>Kişiler</th><th className="sag">Seçmen</th><th className="sag">Üye</th><th className="sag">Ziyaret</th></tr></thead>
              <tbody>
                {suzulmus.map((h) => {
                  const sec = h.kisiler.filter((k) => k.secmen).length;
                  const uye = h.kisiler.filter((k) => k.uye).length;
                  return (
                    <tr key={h.id} className={h.ziyaret ? "done" : ""}>
                      <td>
                        <b>{haneBaslik(h, isSite) || "—"}</b>
                        {isSite && h.adres && <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400, marginTop: 2 }}>{h.adres}{h.kapi_no ? ` No ${h.kapi_no}` : ""}</div>}
                        {mapsHedef(h) && (
                          <a href={mapsURL(h)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 4, fontSize: 11.5, color: "#2563eb", textDecoration: "none", marginTop: 4, fontWeight: 600 }}>
                            <MapPin size={12} /> Haritada aç
                          </a>
                        )}
                      </td>
                      <td>{h.kisiler.map((k) => (
                        <span key={k.id} className="kisi-row">
                          <span className="dot" style={{ background: k.uye ? "var(--accent)" : k.secmen ? "var(--ok)" : "#cbd0d6" }} />
                          <b>{k.ad} {k.soyad}</b>
                          <span className="kisi-meta">· {k.cinsiyet?.[0] || "-"} · {k.dogum_yili ? (2026 - k.dogum_yili) : "-"}{k.telefon ? " · " + k.telefon : ""}</span>
                          {k.uye && <span className="kchip">Üye</span>}
                        </span>
                      ))}{h.kisiler.length === 0 && <span className="dim">—</span>}</td>
                      <td className="sag mono" data-label="Seçmen">{sec}</td>
                      <td className="sag mono" data-label="Üye">{uye}</td>
                      <td className="sag">
                        <div className="ziyaret-aksiyon">
                          <button className={"vbtn" + (h.ziyaret ? " on" : "")} disabled={mesgul === h.id} onClick={() => setZModal({ id: h.id })}>
                            {h.ziyaret ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                            {h.ziyaret ? "Ziyaret edildi" : "Bekliyor"}
                          </button>
                          <button className={"not-btn" + (h.not_ ? " dolu" : "")} title={h.not_ ? "Not: " + h.not_ : "Not ekle"} onClick={() => setZModal({ id: h.id })}>
                            <FileText size={14} />
                          </button>
                        </div>
                        {(h.tarih || h.yaklasim || h.kapsam) && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 4, fontSize: 11, color: "#64748b" }}>
                            {h.tarih && <span>{new Date(h.tarih).toLocaleDateString("tr-TR")}</span>}
                            {h.yaklasim && <span style={{ color: yakRenk(h.yaklasim), fontWeight: 700 }}>Yaklaşım {h.yaklasim}/5</span>}
                            {h.kapsam && <span style={{ background: "#f1f5f9", padding: "1px 7px", borderRadius: 10 }}>{h.kapsam}</span>}
                          </div>
                        )}
                        {h.not_ && <div className="hane-not">{h.not_}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>
      {zModal && (() => {
        const h = (haneler || []).find((x) => x.id === zModal.id);
        if (!h) return null;
        return <ZiyaretModal hane={h} isSite={isSite} mapsHref={mapsHedef(h) ? mapsURL(h) : null} mesgul={mesgul === h.id} onKaydet={kaydetZiyaret} onSifirla={sifirla} onKapat={() => setZModal(null)} />;
      })()}
    </>
  );
}

/* ===================== SORUMLULAR & KOORDİNATÖRLER (kişi listesi) ===================== */
/* ===================== Ekip / Blok Atama ===================== */
