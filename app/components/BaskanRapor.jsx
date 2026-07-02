"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { fmt, oran, yakRenk } from "../../lib/format";
import { StickyNote, ClipboardCheck, Boxes, UserCheck, Search } from "lucide-react";

const ROL_ET = { blok_sorumlu: "Blok Sorumlusu", ana_kademe: "Ana Kademe", kadin_kollari: "Kadın Kolları", genclik_kollari: "Gençlik Kolları" };
const BLOK_ROLLER = Object.keys(ROL_ET);

// id listesini parçalayıp .in ile çek (uzun IN sorgularını böler)
async function parcaliIn(tablo, kolon, idler, key = "id") {
  const uniq = [...new Set((idler || []).filter(Boolean))];
  const out = [];
  for (let i = 0; i < uniq.length; i += 150) {
    const { data } = await supabase.from(tablo).select(kolon).in(key, uniq.slice(i, i + 150));
    if (data) out.push(...data);
  }
  return out;
}

function haneEtiket(h) {
  if (!h) return "—";
  if (h.site_kayit_id) {
    return [h.kapi_blok ? `${h.kapi_blok} Blok` : null, h.kapi_no ? `Kapı ${h.kapi_no}` : null, h.no ? `D:${h.no}` : null].filter(Boolean).join(" · ") || h.adres || "Hane";
  }
  return [h.adres, h.kapi_no ? `No ${h.kapi_no}` : null].filter(Boolean).join(" ") || "Hane";
}

export default function BaskanRapor({ profil }) {
  const [ilceId, setIlceId] = useState(null);
  const [tab, setTab] = useState("notlar");
  const [ara, setAra] = useState("");
  const [yuk, setYuk] = useState({});      // { tab: true } -> yüklendi
  const [mesgul, setMesgul] = useState(false);
  const [mahAd, setMahAd] = useState({});  // mahalle_id -> ad
  const [d, setD] = useState({ notlar: [], sokak: [], site: [], bloklar: [], siteSor: [] });

  useEffect(() => { (async () => {
    let id = profil.rol === "ilce_yonetimi" ? profil.ilce_id : null;
    if (!id) { const { data } = await supabase.from("ilce").select("id").eq("prefix", "BSK").single(); id = data?.id || null; }
    setIlceId(id);
    const { data: mah } = await supabase.from("mahalle").select("id, ad").eq("ilce_id", id);
    const m = {}; (mah || []).forEach((x) => { m[x.id] = x.ad; }); setMahAd(m);
  })(); }, []);

  useEffect(() => { if (ilceId && !yuk[tab]) yukle(tab); }, [ilceId, tab]);

  async function yukle(t) {
    setMesgul(true);
    try {
      if (t === "notlar") {
        let q = supabase.from("ziyaret").select("hane_id, not_, tarih, yaklasim, kapsam, kullanici_id")
          .not("not_", "is", null).neq("not_", "").order("tarih", { ascending: false }).limit(500);
        if (ilceId) q = q.eq("ilce_id", ilceId);
        const { data: nt } = await q;
        const notlar = nt || [];
        const haneler = await parcaliIn("hane", "id, adres, kapi_no, kapi_blok, no, site_kayit_id", notlar.map((n) => n.hane_id));
        const hBy = {}; haneler.forEach((h) => { hBy[h.id] = h; });
        const uids = [...new Set(notlar.map((n) => n.kullanici_id).filter(Boolean))];
        let profBy = {};
        if (uids.length) { const { data: pr } = await supabase.from("profiles").select("id, ad_soyad, eposta").in("id", uids); (pr || []).forEach((p) => { profBy[p.id] = p; }); }
        setD((s) => ({ ...s, notlar: notlar.map((n) => ({ ...n, hane: hBy[n.hane_id], kisi: profBy[n.kullanici_id] })) }));
      } else if (t === "ziyaret") {
        const [sk, st] = await Promise.all([
          supabase.from("v_rapor_sokak").select("*").eq("ilce_id", ilceId),
          supabase.from("v_rapor_site").select("*").eq("ilce_id", ilceId),
        ]);
        setD((s) => ({ ...s, sokak: sk.data || [], site: st.data || [] }));
      } else if (t === "bloklar") {
        const { data: bg } = await supabase.from("profiles")
          .select("id, ad_soyad, eposta, telefon, meslek, rol, blok, site_kayit_id")
          .in("rol", BLOK_ROLLER).not("site_kayit_id", "is", null);
        const bloklar = bg || [];
        const siteler = await parcaliIn("site_kayit", "id, ad, mahalle_id", bloklar.map((b) => b.site_kayit_id));
        const sBy = {}; siteler.forEach((s) => { sBy[s.id] = s; });
        setD((s) => ({ ...s, bloklar: bloklar.map((b) => ({ ...b, site: sBy[b.site_kayit_id] })) }));
      } else if (t === "siteSor") {
        const mahIds = Object.keys(mahAd);
        let siteler = [];
        if (mahIds.length) siteler = await parcaliIn("site_kayit", "id, ad, mahalle_id, temsilci_id", mahIds, "mahalle_id");
        const temIds = [...new Set(siteler.map((s) => s.temsilci_id).filter(Boolean))];
        let temBy = {};
        if (temIds.length) { const { data: pr } = await supabase.from("profiles").select("id, ad_soyad, eposta, telefon").in("id", temIds); (pr || []).forEach((p) => { temBy[p.id] = p; }); }
        // ilerleme için site özetini (varsa) kullan
        const { data: so } = await supabase.from("v_rapor_site").select("site_kayit_id, toplam, edilen").eq("ilce_id", ilceId);
        const ilBy = {}; (so || []).forEach((x) => { ilBy[x.site_kayit_id] = x; });
        setD((s) => ({ ...s, siteSor: siteler.map((si) => ({ ...si, temsilci: temBy[si.temsilci_id], ilerleme: ilBy[si.id] })) }));
      }
      setYuk((y) => ({ ...y, [t]: true }));
    } catch (e) { /* sessiz */ }
    setMesgul(false);
  }

  const TABS = [
    ["notlar", "Notlar", <StickyNote size={15} key="a" />],
    ["ziyaret", "Ziyaretler", <ClipboardCheck size={15} key="b" />],
    ["bloklar", "Bloklar & Sorumlular", <Boxes size={15} key="c" />],
    ["siteSor", "Site Sorumluları", <UserCheck size={15} key="d" />],
  ];
  const f = ara.trim().toLocaleLowerCase("tr");

  return (
    <div className="page">
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px" }}>Başkan Paneli</h1>
        <div style={{ fontSize: 13, color: "#64748b" }}>Tüm saha verilerine tek yerden bakış — notlar, ziyaret durumu, bloklar ve sorumlular</div>
      </div>

      {/* sekmeler */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map(([id, et, ic]) => (
          <button key={id} onClick={() => { setTab(id); setAra(""); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: "1px solid " + (tab === id ? "#c2410c" : "#e2e8f0"), background: tab === id ? "#c2410c" : "#fff", color: tab === id ? "#fff" : "#334155" }}>
            {ic}{et}
          </button>
        ))}
      </div>

      {/* arama */}
      <div style={{ position: "relative", marginBottom: 12, maxWidth: 420 }}>
        <Search size={15} style={{ position: "absolute", left: 11, top: 10, color: "#94a3b8" }} />
        <input value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Ara…"
          style={{ width: "100%", padding: "8px 10px 8px 32px", border: "1px solid #d1d5db", borderRadius: 9, fontSize: 14 }} />
      </div>

      {mesgul && <div style={{ color: "#64748b", fontSize: 13, padding: 8 }}>Yükleniyor…</div>}

      {/* ---- NOTLAR ---- */}
      {tab === "notlar" && !mesgul && (
        <div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{d.notlar.length} not (son 500)</div>
          {d.notlar.filter((n) => !f || (n.not_ || "").toLocaleLowerCase("tr").includes(f) || haneEtiket(n.hane).toLocaleLowerCase("tr").includes(f)).map((n, i) => (
            <div key={i} style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: "10px 13px", marginBottom: 8, background: "#fff" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                <b style={{ fontSize: 13.5 }}>{haneEtiket(n.hane)}</b>
                {n.yaklasim ? <span style={{ fontSize: 12, fontWeight: 700, color: yakRenk(n.yaklasim) }}>Yaklaşım {n.yaklasim}/5</span> : null}
                {n.kapsam ? <span style={{ fontSize: 12, background: "#eef2ff", color: "#3730a3", padding: "1px 8px", borderRadius: 6 }}>{n.kapsam}</span> : null}
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{n.tarih ? new Date(n.tarih).toLocaleDateString("tr-TR") : ""}{n.kisi ? " · " + (n.kisi.ad_soyad || n.kisi.eposta) : ""}</span>
              </div>
              <div style={{ fontSize: 13.5, color: "#334155" }}>{n.not_}</div>
            </div>
          ))}
          {d.notlar.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, padding: 12 }}>Henüz not girilmemiş.</div>}
        </div>
      )}

      {/* ---- ZİYARETLER ---- */}
      {tab === "ziyaret" && !mesgul && (() => {
        const tumSok = d.sokak, tumSit = d.site;
        const gt = [...tumSok, ...tumSit].reduce((a, r) => ({ t: a.t + (r.toplam || 0), e: a.e + (r.edilen || 0) }), { t: 0, e: 0 });
        const grupla = (arr, adKey) => {
          const g = {};
          arr.filter((r) => !f || (r[adKey] || "").toLocaleLowerCase("tr").includes(f) || (mahAd[r.mahalle_id] || "").toLocaleLowerCase("tr").includes(f))
            .forEach((r) => { (g[r.mahalle_id] = g[r.mahalle_id] || []).push(r); });
          return g;
        };
        const Blok = ({ baslik, arr, adKey }) => {
          const g = grupla(arr, adKey);
          return (
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 8px" }}>{baslik}</h3>
              {Object.keys(g).length === 0 && <div style={{ color: "#94a3b8", fontSize: 13 }}>Kayıt yok.</div>}
              {Object.entries(g).map(([mid, satirlar]) => (
                <div key={mid} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#c2410c", marginBottom: 5 }}>{mahAd[mid] || "—"}</div>
                  {satirlar.sort((a, b) => (b.toplam || 0) - (a.toplam || 0)).map((r, i) => {
                    const pct = oran(r.edilen || 0, r.toplam || 0);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r[adKey] || "—"}</span>
                        <div style={{ width: 120, height: 7, background: "#eef2f7", borderRadius: 4, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: pct >= 80 ? "#16a34a" : pct >= 40 ? "#eab308" : "#f97316" }} /></div>
                        <span style={{ fontSize: 12, color: "#475569", width: 96, textAlign: "right" }}>{fmt(r.edilen || 0)} / {fmt(r.toplam || 0)} · %{pct}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        };
        return (
          <div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "12px 18px" }}>
                <div style={{ fontSize: 12, color: "#9a3412" }}>Toplam Hane</div><div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(gt.t)}</div></div>
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: "12px 18px" }}>
                <div style={{ fontSize: 12, color: "#065f46" }}>Ziyaret Edilen</div><div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(gt.e)}</div></div>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 18px" }}>
                <div style={{ fontSize: 12, color: "#1e40af" }}>Tamamlanma</div><div style={{ fontSize: 22, fontWeight: 800 }}>%{oran(gt.e, gt.t)}</div></div>
            </div>
            <Blok baslik="Sokak Bazlı" arr={tumSok} adKey="sokak_ad" />
            <Blok baslik="Site Bazlı" arr={tumSit} adKey="site_ad" />
          </div>
        );
      })()}

      {/* ---- BLOKLAR & SORUMLULAR ---- */}
      {tab === "bloklar" && !mesgul && (
        <div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{d.bloklar.length} atanmış blok görevlisi</div>
          {d.bloklar.filter((b) => !f || (b.ad_soyad || "").toLocaleLowerCase("tr").includes(f) || (b.site?.ad || "").toLocaleLowerCase("tr").includes(f) || (b.blok || "").toLocaleLowerCase("tr").includes(f))
            .map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 13, fontWeight: 700, minWidth: 150 }}>{b.site?.ad || "—"}</span>
                <span style={{ fontSize: 12, background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 6 }}>{b.blok || "—"} Blok</span>
                <span style={{ fontSize: 12, background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 6 }}>{ROL_ET[b.rol] || b.rol}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{b.ad_soyad || b.eposta}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>{[b.telefon, b.meslek].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          {d.bloklar.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, padding: 12 }}>Henüz blok sorumlusu atanmamış.</div>}
        </div>
      )}

      {/* ---- SİTE SORUMLULARI ---- */}
      {tab === "siteSor" && !mesgul && (
        <div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{d.siteSor.filter((s) => s.temsilci_id).length} temsilcili site · {d.siteSor.length} site</div>
          {d.siteSor.filter((s) => !f || (s.ad || "").toLocaleLowerCase("tr").includes(f) || (s.temsilci?.ad_soyad || "").toLocaleLowerCase("tr").includes(f) || (mahAd[s.mahalle_id] || "").toLocaleLowerCase("tr").includes(f))
            .sort((a, b) => (b.temsilci_id ? 1 : 0) - (a.temsilci_id ? 1 : 0))
            .map((s, i) => {
              const pct = s.ilerleme ? oran(s.ilerleme.edilen || 0, s.ilerleme.toplam || 0) : null;
              return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 150 }}>{s.ad}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{mahAd[s.mahalle_id] || ""}</span>
                  {s.temsilci_id
                    ? <span style={{ fontSize: 12, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 6 }}>{s.temsilci?.ad_soyad || "Temsilci"}{s.temsilci?.telefon ? " · " + s.temsilci.telefon : ""}</span>
                    : <span style={{ fontSize: 12, background: "#fef2f2", color: "#b91c1c", padding: "2px 8px", borderRadius: 6 }}>Temsilci yok</span>}
                  {pct != null && <span style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>{fmt(s.ilerleme.edilen || 0)} / {fmt(s.ilerleme.toplam || 0)} ziyaret · %{pct}</span>}
                </div>
              );
            })}
          {d.siteSor.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, padding: 12 }}>Site bulunamadı.</div>}
        </div>
      )}
    </div>
  );
}
