"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { ChevronRight, Search, UserCheck } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { fmt } from "../../lib/format";
import BlokSorumlulari from "./BlokSorumlulari";
import Haneler from "./Haneler";

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
    setSecMah(m); setSecSite(null); setSecSokak(null); setKapilar([]); setSecKey(new Set()); setMesaj(""); setYukleniyor(true);
    const [{ data: s }, { data: oz }, { data: sk }, { data: pr }] = await Promise.all([
      supabase.from("site_kayit").select("id,ad,blok_sayisi,daire_sayisi,villa_sayisi,baskan,baskan_tel,mudur,mudur_tel,adres,temsilci_id,koordinator_id").eq("mahalle_id", m.mahalle_id).order("ad"),
      supabase.from("mv_site_ozet").select("site_kayit_id,hane,kisi,uye").eq("mahalle_id", m.mahalle_id),
      supabase.from("sokak").select("id,ad").eq("mahalle_id", m.mahalle_id).order("ad"),
      supabase.from("profiles").select("id,ad_soyad,rol").in("rol", ["sorumlu", "koordinator"]),
    ]);
    const ozMap = {}; (oz || []).forEach((o) => ozMap[o.site_kayit_id] = o);
    setSiteler(s || []); setOzet(ozMap); setSokaklar(sk || []); setProfiller(pr || []); setYukleniyor(false);
  }

  async function siteSec(s) {
    setSecSite(s); setSiteTab("atama"); setSecSokak(null); setKapilar([]); setSecKey(new Set()); setMesaj(""); setSiteHane(null);
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
        <div className="mahalle-grid">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ara-kutu"><Search size={15} /><input placeholder="Site ara…" value={ara} onChange={(e) => setAra(e.target.value)} /></div>
            <div className="site-grid">
              {siteFiltre.map((s) => { const o = ozet[s.id] || {}; const bos = !(o.hane > 0); return (
                <div key={s.id} className={"site-kart" + (bos ? " veri-yok" : "")} onClick={() => siteSec(s)}>
                  <div className="sk-ad">{s.ad}</div>
                  <div className="sk-meta">{s.blok_sayisi ?? "?"} blok · {s.daire_sayisi ?? "?"} daire{s.villa_sayisi ? ` · ${s.villa_sayisi} villa` : ""}</div>
                  {bos
                    ? <div className="sk-bekle">Veri bekleniyor</div>
                    : <div className="sk-say"><b>{fmt(o.hane || 0)}</b> hane · <b>{fmt(o.kisi || 0)}</b> kişi</div>}
                  <div className="sk-tem">{s.temsilci_id ? <span className="rozet ok"><UserCheck size={12} /> {profAd[s.temsilci_id]?.ad_soyad || "Temsilci"}</span> : <span className="rozet bos">Temsilci yok</span>}</div>
                </div>
              ); })}
              {siteFiltre.length === 0 && <div className="dim">Site yok.</div>}
            </div>
          </div>
          <aside className="ozet-aside">
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Özet</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["Site", fmt(siteStat.site)], ["Blok", fmt(siteStat.blok)], ["Hane", fmt(siteStat.hane)], ["Kişi", fmt(siteStat.kisi)]].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 21, fontWeight: 800 }}>{v}</div><div style={{ fontSize: 12, color: "var(--ink2)" }}>{l}</div></div>
                ))}
              </div>
            </div>
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Üyelik</div>
              <div style={{ position: "relative" }}>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={sUyeData} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                      <Cell fill="var(--accent2)" /><Cell fill="#e5e9f0" />
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ fontSize: 25, fontWeight: 800, color: "var(--accent2)" }}>%{sUyePct}</div>
                  <div style={{ fontSize: 11, color: "var(--ink2)" }}>üye</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--accent2)", marginRight: 6 }} />Üye <b>{fmt(siteStat.uye)}</b></span>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "#e5e9f0", marginRight: 6 }} />Değil <b>{fmt(Math.max(0, siteStat.kisi - siteStat.uye))}</b></span>
              </div>
            </div>
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Atama durumu</div>
              <div style={{ position: "relative" }}>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={sAtaData} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                      <Cell fill="var(--ok)" /><Cell fill="#e5e9f0" />
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ fontSize: 25, fontWeight: 800, color: "var(--ok)" }}>%{sAtaPct}</div>
                  <div style={{ fontSize: 11, color: "var(--ink2)" }}>atandı</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--ok)", marginRight: 6 }} />Atandı <b>{fmt(siteStat.tem)}</b></span>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "#e5e9f0", marginRight: 6 }} />Kalan <b>{fmt(Math.max(0, siteStat.site - siteStat.tem))}</b></span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: "1px solid #eef2f7" }}><span>Temsilci atanan site</span><b>{siteStat.tem} / {siteStat.site}</b></div>
            </div>
          </aside>
        </div>
      )}

      {!yukleniyor && secSite && (<>
        <div className="crumb"><a onClick={() => { setSecSite(null); setSiteHane(null); }}>{secMah?.ad}</a><ChevronRight size={14} /><span className="cur">{secSite.ad}</span></div>
        <div className="site-detay">
          <div className="sd-bas"><div><h3>{secSite.ad}</h3><div className="dim">{secSite.blok_sayisi ?? "?"} blok · {secSite.daire_sayisi ?? "?"} daire · {secSite.adres || ""}</div></div></div>

          <div style={{ display: "flex", gap: 4, margin: "4px 0 14px", borderBottom: "1px solid #e5e7eb" }}>
            {[["atama", "Site & Haneler"], ["sorumlu", "Blok Görevlileri"]].map(([k, t]) => (
              <button key={k} onClick={() => setSiteTab(k)} style={{ padding: "8px 14px", border: "none", background: "none", borderBottom: "2px solid " + (siteTab === k ? "#2563eb" : "transparent"), color: siteTab === k ? "#2563eb" : "#64748b", fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: -1 }}>{t}</button>
            ))}
          </div>

          {siteTab === "sorumlu" ? <BlokSorumlulari site={secSite} /> : (<>
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
