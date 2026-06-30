"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { NUF_RENK, fmt } from "../../lib/format";
import KapsamSokaklar from "./KapsamSokaklar";

export default function Bolgeler({ mahalle, onSec, onSecGrup }) {
  const [liste, setListe] = useState(null);
  const [adMap, setAdMap] = useState({});
  const [grupMap, setGrupMap] = useState({});
  const [sokakSay, setSokakSay] = useState(0);
  const [nufMah, setNufMah] = useState(null);
  const [digerMahAcik, setDigerMahAcik] = useState(false);
  const [topluMesgul, setTopluMesgul] = useState(null);

  async function grupYenile(bIds) {
    const gMap = {};
    if (bIds.length) {
      const { data: gs } = await supabase.from("sokak_grup").select("*").in("bolge_id", bIds).order("no");
      (gs || []).forEach((g) => { (gMap[g.bolge_id] ||= []).push(g); });
    }
    setGrupMap(gMap);
  }
  async function topluBol() {
    const bolunmemis = (liste || []).filter((b) => !(grupMap[b.id] && grupMap[b.id].length));
    let hedefler;
    if (bolunmemis.length) {
      hedefler = bolunmemis;
      if (!confirm(`${hedefler.length} bölünmemiş sokak, kapı no sırasına göre ~150 kişilik gruplara bölünecek. Devam edilsin mi?`)) return;
    } else {
      hedefler = liste || [];
      if (!confirm(`Tüm sokaklar zaten bölünmüş. Hepsi (${hedefler.length}) YENİDEN bölünsün mü?\n\nDetay boş kalıyorsa (hane.grup_id yazılmadıysa) bunu kullanın — grup_id'ler yeniden yazılır. Atanmış sokak sorumluları sıfırlanır.`)) return;
    }
    setTopluMesgul({ done: 0, total: hedefler.length });
    let hata = null;
    for (let i = 0; i < hedefler.length; i++) {
      try { await sokakGrupBol(hedefler[i].id, 150); }
      catch (e) { hata = `${hedefler[i].kod}: ${e?.message || e}`; break; }
      setTopluMesgul({ done: i + 1, total: hedefler.length });
    }
    await grupYenile((liste || []).map((b) => b.id));
    setTopluMesgul(null);
    if (hata) alert("Bölme durdu — " + hata);
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
      <div className="mahalle-grid">
      <div className="panel" style={{ flex: 1, minWidth: 0 }}><div className="cards">
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
      <aside className="ozet-aside">
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Özet</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Bölge", fmt(liste.length)], [mahalle.tip === "site" ? "Site/Sokak" : "Sokak", fmt(sokakSay)], ["Hane", fmt(tHane)], ["Kişi", fmt(tKisi)]].map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 21, fontWeight: 800 }}>{v}</div><div style={{ fontSize: 12, color: "var(--ink2)" }}>{l}</div></div>
            ))}
          </div>
        </div>
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Üyelik</div>
          <div style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={uyeData} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                  <Cell fill="var(--accent2)" /><Cell fill="#e5e9f0" />
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 25, fontWeight: 800, color: "var(--accent2)" }}>%{uyePct}</div>
              <div style={{ fontSize: 11, color: "var(--ink2)" }}>üye</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--accent2)", marginRight: 6 }} />Üye <b>{fmt(tUye)}</b></span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "#e5e9f0", marginRight: 6 }} />Değil <b>{fmt(uyeDegil)}</b></span>
          </div>
        </div>
        {nufMahDag.ilSay > 0 && (
          <div className="panel" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Nüfus İli</div>
            <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 6 }}>{fmt(nufMahDag.ilSay)} il · {fmt(nufMahDag.toplam)} kişi</div>
            <ResponsiveContainer width="100%" height={158}>
              <PieChart>
                <Pie data={nufMahDag.arr} dataKey="deger" nameKey="ad" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={1} stroke="#fff" strokeWidth={1}>
                  {nufMahDag.arr.map((e, i) => <Cell key={i} fill={e.ad === "Diğer" ? "#94a3b8" : NUF_RENK[i % NUF_RENK.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [fmt(v) + " kişi", n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {nufMahDag.arr.map((e, i) => {
                const diger = e.ad === "Diğer";
                return (
                  <div key={i} onClick={diger ? () => setDigerMahAcik((v) => !v) : undefined}
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
            {digerMahAcik && (() => {
              const dg = nufMahDag.arr.find((x) => x.ad === "Diğer");
              if (!dg) return null;
              return (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #eef2f7", display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflowY: "auto" }}>
                  {dg.detay.map((x, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.ad}</span>
                      <b className="mono">{fmt(x.deger)}</b>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Atama durumu</div>
          {grupTop > 0 ? (
            <>
              <div style={{ position: "relative" }}>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={atamaData} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                      <Cell fill="var(--ok)" /><Cell fill="#e5e9f0" />
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ fontSize: 25, fontWeight: 800, color: "var(--ok)" }}>%{atamaPct}</div>
                  <div style={{ fontSize: 11, color: "var(--ink2)" }}>atandı</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--ok)", marginRight: 6 }} />Atandı <b>{fmt(grupAtanan)}</b></span>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "#e5e9f0", marginRight: 6 }} />Kalan <b>{fmt(grupTop - grupAtanan)}</b></span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8, paddingTop: 8, borderTop: "1px solid #eef2f7" }}><span>Sorumlu atanan grup</span><b>{grupAtanan} / {grupTop}</b></div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{sorumluEtiket} atanan</span><b>{atanan} / {liste.length}</b></div>
          )}
        </div>
      </aside>
      </div>
    </>
  );
}

/* ===================== Ziyaret kaydı (yaklaşım + kapsam + tarih) ===================== */
