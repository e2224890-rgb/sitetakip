"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { NUF_RENK, fmt } from "../../lib/format";
import KapsamSokaklar from "./KapsamSokaklar";
import DemografiPano from "./DemografiPano";
import { Building2, Map, ChevronRight as ChevronRightIc } from "lucide-react";
import { sokakGrupBol } from "./EkipAtama";

export default function Bolgeler({ mahalle, onSec, onSecGrup }) {
  const [liste, setListe] = useState(null);
  const [adMap, setAdMap] = useState({});
  const [grupMap, setGrupMap] = useState({});
  const [sokakSay, setSokakSay] = useState(0);
  const [siteHane, setSiteHane] = useState({}); // bolge_id -> siteye bağlı hane sayısı
  const [nufMah, setNufMah] = useState(null);
  const [digerMahAcik, setDigerMahAcik] = useState(false);
  const [topluMesgul, setTopluMesgul] = useState(null);
  const [mahStat, setMahStat] = useState(null); // mahalle demografisi (mv_mahalle_ozet + cinsiyet) -> DemografiPano

  async function grupYenile(bIds) {
    const gMap = {};
    if (bIds.length) {
      const { data: gs } = await supabase.from("sokak_grup").select("*").in("bolge_id", bIds).order("no");
      (gs || []).forEach((g) => { (gMap[g.bolge_id] ||= []).push(g); });
    }
    setGrupMap(gMap);
  }
  async function topluBol() {
    // Serbest (siteye bağlı olmayan) hanesi kalmayan bölgeler "bölünmemiş" sayılmaz — bölünecek şey yok
    const serbestVar = (b) => Math.max(0, (b.hane || 0) - (siteHane[b.id] || 0)) > 0;
    const bolunmemis = (liste || []).filter((b) => !(grupMap[b.id] && grupMap[b.id].length) && serbestVar(b));
    const siteliAtlanan = (liste || []).filter((b) => !(grupMap[b.id] && grupMap[b.id].length) && !serbestVar(b));
    let hedefler;
    if (bolunmemis.length) {
      hedefler = bolunmemis;
      if (!confirm(`${hedefler.length} bölünmemiş sokak, kapı no sırasına göre ~150 hanelik gruplara bölünecek. Devam edilsin mi?\n\nNot: Siteye bağlı haneler (site temsilcisi yönetir) bölmeye dahil edilmez.`)) return;
    } else {
      // Bölünmemiş kalmadı → hepsini YENİDEN bölme seçeneği sun (150 HANE hedefiyle)
      hedefler = (liste || []).filter(serbestVar); // tamamı site olanları boşuna deneme
      const not = siteliAtlanan.length
        ? `\n\nNot: ${siteliAtlanan.length} sokak (${siteliAtlanan.map((b) => b.kod).join(", ")}) tamamı site kapsamında olduğu için bölmeye dahil edilmez.`
        : "";
      if (!hedefler.length) { alert("Bölünecek sokak yok — tüm sokaklar site kapsamında." + not); return; }
      if (!confirm(`Tüm sokaklar zaten bölünmüş. ${hedefler.length} sokak ~150 HANE hedefiyle YENİDEN bölünsün mü?\n\nAtanmış sokak sorumluları sıfırlanır.${not}`)) return;
    }
    setTopluMesgul({ done: 0, total: hedefler.length });
    let hata = null; const bosKalan = [];
    for (let i = 0; i < hedefler.length; i++) {
      try {
        const grupSayisi = await sokakGrupBol(hedefler[i].id, 150);
        if (!grupSayisi) bosKalan.push(hedefler[i].kod); // bölünecek serbest hane yok
      }
      catch (e) { hata = `${hedefler[i].kod}: ${e?.message || e}`; break; }
      setTopluMesgul({ done: i + 1, total: hedefler.length });
    }
    await grupYenile((liste || []).map((b) => b.id));
    setTopluMesgul(null);
    if (hata) alert("Bölme durdu — " + hata);
    else if (bosKalan.length) alert(
      `${bosKalan.length} sokak bölünemedi: ${bosKalan.join(", ")}\n\n` +
      `Sebep: Bu sokaklardaki hanelerin tamamı bir SİTEYE bağlı. Siteye bağlı haneler sokak grubuna alınmaz; ` +
      `onlar "Siteler" sekmesinden site temsilcisi ve blok sorumlularıyla yönetilir.`
    );
  }
  useEffect(() => {
    (async () => {
      const [{ data: bs }, { data: ozet }, { count: sk }] = await Promise.all([
        supabase.from("bolge").select("id, kod, kapsam, sorumlu_id, koordinator_id").eq("mahalle_id", mahalle.id).order("kod"),
        supabase.from("mv_bolge_ozet").select("bolge_id, sokak, hane, kisi, uye").eq("mahalle_id", mahalle.id),
        supabase.from("sokak").select("*", { count: "exact", head: true }).eq("mahalle_id", mahalle.id),
      ]);
      setSokakSay(sk || 0);
      const say = {}; (ozet || []).forEach((o) => say[o.bolge_id] = o);
      const arr = (bs || [])
        .filter((b) => !/ADRESYOK/i.test(b.kod || "") && !/adres yok/i.test(b.kapsam || ""))
        .map((b) => ({ ...b, ...(say[b.id] || { sokak: 0, hane: 0, kisi: 0, uye: 0 }) }));
      setListe(arr);
      // Siteye bağlı haneler (sokak grubuna girmez) — bölge bazında sayısı
      (async () => {
        const map = {}; const ADIM = 1000;
        for (let bas = 0; ; bas += ADIM) {
          const { data, error } = await supabase.from("hane").select("bolge_id")
            .eq("mahalle_id", mahalle.id).not("site_kayit_id", "is", null).range(bas, bas + ADIM - 1);
          if (error) break;
          (data || []).forEach((h) => { if (h.bolge_id) map[h.bolge_id] = (map[h.bolge_id] || 0) + 1; });
          if (!data || data.length < ADIM) break;
        }
        setSiteHane(map);
      })();
      const bIds = arr.map((b) => b.id);
      const gMap = {};
      if (bIds.length) {
        const { data: gs } = await supabase.from("sokak_grup").select("*").in("bolge_id", bIds).order("no");
        (gs || []).forEach((g) => { (gMap[g.bolge_id] ||= []).push(g); });
      }
      setGrupMap(gMap);
      const ids = [...new Set(arr.flatMap((b) => [b.sorumlu_id, b.koordinator_id]).filter(Boolean))];
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id, ad_soyad, eposta").in("id", ids);
        const m = {}; (ps || []).forEach((p) => m[p.id] = p.ad_soyad || p.eposta); setAdMap(m);
      } else setAdMap({});
    })();
  }, [mahalle.id]);

  useEffect(() => {
    setDigerMahAcik(false); setNufMah(null);
    (async () => {
      const { data } = await supabase.from("mv_mahalle_nufus_il")
        .select("nufus_il, kisi").eq("mahalle_id", mahalle.id).order("kisi", { ascending: false });
      setNufMah(data || []);
    })();
  }, [mahalle.id]);

  // Mahalle demografisi (yaş MV'den, cinsiyet ham kisi'den ilk-harf sayımıyla) -> DemografiPano
  useEffect(() => {
    setMahStat(null);
    (async () => {
      const [{ data: mo }, eR, kR] = await Promise.all([
        supabase.from("mv_mahalle_ozet").select("kisi,hane,uye,y1824,y2534,y3544,y4554,y5564,y65").eq("mahalle_id", mahalle.id).single(),
        supabase.from("kisi").select("*", { count: "exact", head: true }).eq("mahalle_id", mahalle.id).ilike("cinsiyet", "e%"),
        supabase.from("kisi").select("*", { count: "exact", head: true }).eq("mahalle_id", mahalle.id).ilike("cinsiyet", "k%"),
      ]);
      setMahStat({
        kisi: mo?.kisi || 0, hane: mo?.hane || 0, uye: mo?.uye || 0,
        erkek: eR?.count || 0, kadin: kR?.count || 0,
        yasArr: [
          { ad: "18-24", deger: mo?.y1824 || 0 }, { ad: "25-34", deger: mo?.y2534 || 0 },
          { ad: "35-44", deger: mo?.y3544 || 0 }, { ad: "45-54", deger: mo?.y4554 || 0 },
          { ad: "55-64", deger: mo?.y5564 || 0 }, { ad: "65+", deger: mo?.y65 || 0 },
        ],
      });
    })();
  }, [mahalle.id]);

  const nufMahDag = useMemo(() => {
    const arr = (nufMah || []).map((r) => ({ ad: r.nufus_il, deger: r.kisi }));
    const toplam = arr.reduce((a, x) => a + x.deger, 0);
    const N = 8;
    const top = arr.slice(0, N);
    const kalanArr = arr.slice(N);
    const kalan = kalanArr.reduce((a, x) => a + x.deger, 0);
    if (kalan > 0) top.push({ ad: "Diğer", deger: kalan, detay: kalanArr });
    return { arr: top, toplam, ilSay: arr.length };
  }, [nufMah]);
  if (liste === null) return <div className="merkez">Bölgeler yükleniyor…</div>;
  const sorumluEtiket = mahalle.tip === "site" ? "Site Temsilcisi" : "Sokak Sorumlusu";
  const atanan = liste.filter((b) => b.sorumlu_id).length;
  const tHane = liste.reduce((a, b) => a + (b.hane || 0), 0);
  const tKisi = liste.reduce((a, b) => a + (b.kisi || 0), 0);
  const tUye = liste.reduce((a, b) => a + (b.uye || 0), 0);
  const uyeDegil = tKisi - tUye;
  const uyePct = tKisi ? Math.round((tUye / tKisi) * 100) : 0;
  const grupTop = Object.values(grupMap).reduce((a, gs) => a + gs.length, 0);
  const grupAtanan = Object.values(grupMap).reduce((a, gs) => a + gs.filter((g) => g.baskan_ad).length, 0);
  const uyeData = [{ name: "Üye", value: tUye }, { name: "Üye değil", value: uyeDegil }];
  const atamaPct = grupTop ? Math.round((grupAtanan / grupTop) * 100) : 0;
  const atamaData = [{ name: "Atandı", value: grupAtanan }, { name: "Kalan", value: Math.max(0, grupTop - grupAtanan) }];
  return (
    <>
      <div className="head"><div><h2 className="disp">{mahalle.ad}</h2>
        <div className="sub">{liste.length} bölge · {fmt(sokakSay)} sokak · {fmt(tHane)} hane · {fmt(tKisi)} kişi · <b style={{ color: "var(--accent2)" }}>{fmt(tUye)} üye</b> · {fmt(tKisi - tUye)} üye değil · {grupTop > 0 ? `${grupAtanan} / ${grupTop} ${sorumluEtiket.toLocaleLowerCase("tr")} atandı` : `${atanan} ${sorumluEtiket.toLocaleLowerCase("tr")} atandı`}</div></div>
        {mahalle.tip !== "site" && (() => {
          const hepBolundu = liste.length > 0 && liste.every((b) => grupMap[b.id] && grupMap[b.id].length);
          return (
            <button onClick={topluBol} disabled={!!topluMesgul}
              style={{ alignSelf: "center", padding: "8px 14px", background: topluMesgul ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: topluMesgul ? "default" : "pointer", whiteSpace: "nowrap" }}>
              {topluMesgul ? `Bölünüyor… ${topluMesgul.done}/${topluMesgul.total}` : hepBolundu ? "Tüm sokakları yeniden böl" : "Tüm sokakları 150'lik böl"}
            </button>
          );
        })()}
      </div>
      <DemografiPano
        stat={mahStat || { kisi: tKisi, hane: tHane, uye: tUye, erkek: 0, kadin: 0, yasArr: [] }}
        ekstra={{ ic: <Map size={15} />, lbl: "Bölge", num: fmt(liste.length), meta: `${fmt(sokakSay)} sokak · ${grupTop} grup`, renk: "#9333ea" }}
        mahalleIds={[mahalle.id]}
        baslik={`${mahalle.ad} Mahallesi`}
      />
      <div className="panel" style={{ marginTop: 15 }}><div className="cards">
        {liste.map((b) => {
          const gs = (grupMap[b.id] || []).filter((g) => (g.hane || 0) > 0 || (g.kisi || 0) > 0);
          if (gs.length) {
            return gs.map((g) => (
              <div key={g.id} className="card" onClick={() => onSecGrup && onSecGrup(b, g)}>
                <div className="card-t">{b.kod}-{g.no} <ChevronRight size={15} /></div>
                <div className="bolge-stat">
                  <span><b>{fmt(g.hane)}</b> hane</span>
                  <span><b>{fmt(g.kisi)}</b> kişi</span>
                  <span><b style={{ color: "var(--accent2)" }}>{fmt(g.uye)}</b> üye</span>
                  <span><b>{fmt((g.kisi || 0) - (g.uye || 0))}</b> üye değil</span>
                </div>
                <div className="card-kapsam">{g.kapi_bas
                  ? `${b.kapsam ? b.kapsam + " · " : ""}Kapı ${g.kapi_bas}${g.kapi_son && g.kapi_son !== g.kapi_bas ? `–${g.kapi_son}` : ""}`
                  : (b.kapsam || "—")}</div>
                <div className="atama-chips">
                  {g.baskan_ad
                    ? <span className="chip u">{sorumluEtiket}: {g.baskan_ad}</span>
                    : <span className="chip s">{sorumluEtiket} yok</span>}
                </div>
              </div>
            ));
          }
          if ((b.hane || 0) === 0 && (b.kisi || 0) === 0) return null;
          return (
            <div key={b.id} className="card" onClick={() => onSec(b)}>
              <div className="card-t">{b.kod} <ChevronRight size={15} /></div>
              <div className="bolge-stat">
                <span><b>{fmt(b.sokak)}</b> {mahalle.tip === "site" ? "blok/sokak" : "sokak"}</span>
                <span><b>{fmt(b.hane)}</b> hane</span>
                <span><b>{fmt(b.kisi)}</b> kişi</span>
                <span><b style={{ color: "var(--accent2)" }}>{fmt(b.uye)}</b> üye</span>
                <span><b>{fmt((b.kisi || 0) - (b.uye || 0))}</b> üye değil</span>
              </div>
              {siteHane[b.id] > 0 && (() => {
                const serbest = Math.max(0, (b.hane || 0) - siteHane[b.id]);
                const tamamen = serbest === 0;
                return (
                  <div style={{ fontSize: 11.5, color: tamamen ? "#3730a3" : "#92400e", background: tamamen ? "#eef2ff" : "#fef3c7", border: `1px solid ${tamamen ? "#c7d2fe" : "#fde68a"}`, borderRadius: 8, padding: "5px 9px", marginTop: 6, lineHeight: 1.35 }}>
                    {tamamen
                      ? <><b>Tamamı site kapsamında</b> ({fmt(siteHane[b.id])} hane) — sokak sorumlusu atanmaz, bölünmez. Site temsilcisi ve blok sorumluları <b>Siteler</b> sekmesinden atanır.</>
                      : <><b>{fmt(siteHane[b.id])} hane site kapsamında</b> — site temsilcisi/blok sorumluları yönetir, sokak grubuna girmez. Sokak sorumlusunun ilgileneceği: <b>{fmt(serbest)} hane</b>.</>}
                  </div>
                );
              })()}
              <KapsamSokaklar kapsam={b.kapsam} />
              <div className="atama-chips">
                {b.sorumlu_id
                  ? <span className="chip u">{sorumluEtiket}: {adMap[b.sorumlu_id] || "atandı"}</span>
                  : <span className="chip s">{sorumluEtiket} yok</span>}
                {b.koordinator_id
                  ? <span className="chip k">Koordinatör: {adMap[b.koordinator_id] || "atandı"}</span>
                  : <span className="chip s">Koordinatör yok</span>}
              </div>
            </div>
          );
        })}
      </div></div>
    </>
  );
}

/* ===================== Ziyaret kaydı (yaklaşım + kapsam + tarih) ===================== */
