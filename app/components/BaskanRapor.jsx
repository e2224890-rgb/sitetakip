"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { fmt, oran, yakRenk, normBlok, blokParts } from "../../lib/format";
import { StickyNote, ClipboardCheck, Boxes, UserCheck, Search } from "lucide-react";

const ROL_ET = { blok_sorumlu: "Blok Sorumlusu", ana_kademe: "Ana Kademe", kadin_kollari: "Kadın Kolları", genclik_kollari: "Gençlik Kolları" };
const BLOK_ROLLER = Object.keys(ROL_ET);

// Not/ziyaret girenin rolünü okunur etikete çevir (site bağlamında sorumlu = Site Başkanı)
function rolEtiket(rol, isSite) {
  if (ROL_ET[rol]) return ROL_ET[rol];
  if (rol === "sorumlu") return isSite ? "Site Başkanı" : "Sorumlu";
  if (rol === "koordinator") return "Koordinatör";
  if (rol === "grup_baskani") return "Grup Başkanı";
  if (rol === "il_yonetimi" || rol === "ilce_yonetimi") return "Yönetim";
  return "Görevli";
}
function rolRenk(rol) {
  return rol === "kadin_kollari" ? { bg: "#fce7f3", fg: "#9d174d" }
    : rol === "genclik_kollari" ? { bg: "#dcfce7", fg: "#166534" }
      : rol === "ana_kademe" ? { bg: "#e0e7ff", fg: "#3730a3" }
        : rol === "sorumlu" ? { bg: "#ffedd5", fg: "#9a3412" }
          : rol === "blok_sorumlu" ? { bg: "#e0f2fe", fg: "#0369a1" }
            : { bg: "#f1f5f9", fg: "#475569" };
}

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
        // hanelerin site adları
        const siteIds = [...new Set(haneler.map((h) => h.site_kayit_id).filter(Boolean))];
        const sitAd = {};
        if (siteIds.length) { const st = await parcaliIn("site_kayit", "id, ad", siteIds); st.forEach((s) => { sitAd[s.id] = s.ad; }); }
        const uids = [...new Set(notlar.map((n) => n.kullanici_id).filter(Boolean))];
        let profBy = {};
        if (uids.length) { const { data: pr } = await supabase.from("profiles").select("id, ad_soyad, eposta, rol").in("id", uids); (pr || []).forEach((p) => { profBy[p.id] = p; }); }
        setD((s) => ({ ...s, notlar: notlar.map((n) => ({ ...n, hane: hBy[n.hane_id], siteAd: sitAd[hBy[n.hane_id]?.site_kayit_id], kisi: profBy[n.kullanici_id] })) }));
      } else if (t === "ziyaret") {
        const [sk, st, toplamR, edilenR] = await Promise.all([
          supabase.from("v_rapor_sokak").select("*").eq("ilce_id", ilceId),
          supabase.from("v_rapor_site").select("*").eq("ilce_id", ilceId),
          // Gerçek hane (çift saymadan): her hane 1 kez
          supabase.from("hane").select("*", { count: "exact", head: true }).eq("ilce_id", ilceId),
          // Ziyaret edilen benzersiz hane
          supabase.from("ziyaret").select("hane_id", { count: "exact", head: true }).eq("ilce_id", ilceId).eq("durum", "ziyaret_edildi"),
        ]);
        setD((s) => ({ ...s, sokak: sk.data || [], site: st.data || [], gercekToplam: toplamR.count || 0, gercekEdilen: edilenR.count || 0 }));
      } else if (t === "bloklar") {
        const { data: bg } = await supabase.from("profiles")
          .select("id, ad_soyad, eposta, telefon, meslek, rol, blok, site_kayit_id")
          .in("rol", BLOK_ROLLER).not("site_kayit_id", "is", null);
        const bloklar = bg || [];
        const siteIdSet = [...new Set(bloklar.map((b) => b.site_kayit_id).filter(Boolean))];
        const siteler = await parcaliIn("site_kayit", "id, ad, mahalle_id", siteIdSet);
        const sBy = {}; siteler.forEach((s) => { sBy[s.id] = s; });
        // Görevlisi olan sitelerin TÜM bloklarını çek -> atanmamış blokları bulmak için
        let vblok = [];
        if (siteIdSet.length) vblok = await parcaliIn("v_site_blok", "site_kayit_id, kapi_blok, hane, kisi", siteIdSet, "site_kayit_id");
        // site -> normalize blok kümesi (tüm bloklar)
        const siteBloklar = {}; // site_kayit_id -> Set(normBlok)
        vblok.forEach((v) => { const k = normBlok(v.kapi_blok); if (!k) return; (siteBloklar[v.site_kayit_id] ||= new Set()).add(k); });
        // site -> atanmış blok kümesi (blok_sorumlu rolü olan bloklar)
        const atanmisBlok = {}; // site_kayit_id -> Set(normBlok)
        bloklar.forEach((b) => {
          if (b.rol !== "blok_sorumlu" || !b.site_kayit_id) return;
          blokParts(b.blok).forEach((bk) => { (atanmisBlok[b.site_kayit_id] ||= new Set()).add(normBlok(bk)); });
        });
        // her site için: toplam blok, atanmış blok, boş blok
        const bosBloklar = []; // {siteAd, mahalle_id, bloklar:[...]}
        Object.entries(siteBloklar).forEach(([sid, set]) => {
          const atanmis = atanmisBlok[sid] || new Set();
          const bos = [...set].filter((bk) => !atanmis.has(bk)).sort((a, b) => String(a).localeCompare(String(b), "tr", { numeric: true }));
          if (bos.length) bosBloklar.push({ site_kayit_id: sid, ad: sBy[sid]?.ad || "—", mahalle_id: sBy[sid]?.mahalle_id, bloklar: bos, toplam: set.size, atanan: [...set].length - bos.length });
        });
        bosBloklar.sort((a, b) => b.bloklar.length - a.bloklar.length);
        const toplamBlok = Object.values(siteBloklar).reduce((a, s) => a + s.size, 0);
        const atananBlok = toplamBlok - bosBloklar.reduce((a, x) => a + x.bloklar.length, 0);
        setD((s) => ({ ...s, bloklar: bloklar.map((b) => ({ ...b, site: sBy[b.site_kayit_id] })), bosBloklar, blokOzet: { toplamBlok, atananBlok, bosBlok: toplamBlok - atananBlok } }));
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
  const [siteFiltre, setSiteFiltre] = useState("hepsi"); // hepsi | atanan | atanmayan
  const [blokFiltre, setBlokFiltre] = useState("hepsi"); // hepsi | blok_sorumlu | ana_kademe | kadin_kollari | genclik_kollari
  const [acikMah, setAcikMah] = useState(() => new Set()); // ziyaret kırılımında açık mahalleler
  const f = ara.trim().toLocaleLowerCase("tr");
  const mahToggle = (k) => setAcikMah((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

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
                {n.siteAd ? <span style={{ fontSize: 12, background: "#f5f3ff", color: "#6d28d9", padding: "1px 8px", borderRadius: 6, fontWeight: 600 }}>{n.siteAd}</span> : null}
                {n.yaklasim ? <span style={{ fontSize: 12, fontWeight: 700, color: yakRenk(n.yaklasim) }}>Yaklaşım {n.yaklasim}/5</span> : null}
                {n.kapsam ? <span style={{ fontSize: 12, background: "#eef2ff", color: "#3730a3", padding: "1px 8px", borderRadius: 6 }}>{n.kapsam}</span> : null}
                {n.kisi ? (() => { const rk = rolRenk(n.kisi.rol); return <span style={{ fontSize: 12, background: rk.bg, color: rk.fg, padding: "1px 8px", borderRadius: 6, fontWeight: 600 }}>{n.kisi.ad_soyad || n.kisi.eposta} · {rolEtiket(n.kisi.rol, !!n.hane?.site_kayit_id)}</span>; })() : null}
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{n.tarih ? new Date(n.tarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
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
        // Üst kart: gerçek hane (çift saymayan). Yoksa view toplamına düş.
        const viewT = [...tumSok, ...tumSit].reduce((a, r) => ({ t: a.t + (r.toplam || 0), e: a.e + (r.edilen || 0) }), { t: 0, e: 0 });
        const gt = { t: d.gercekToplam ?? viewT.t, e: d.gercekEdilen ?? viewT.e };
        const grupla = (arr, adKey) => {
          const g = {};
          arr.filter((r) => !f || (r[adKey] || "").toLocaleLowerCase("tr").includes(f) || (mahAd[r.mahalle_id] || "").toLocaleLowerCase("tr").includes(f))
            .forEach((r) => { (g[r.mahalle_id] = g[r.mahalle_id] || []).push(r); });
          return g;
        };
        const cubuk = (pct) => (
          <div style={{ width: 120, height: 7, background: "#eef2f7", borderRadius: 4, overflow: "hidden", flex: "0 0 auto" }}>
            <div style={{ width: pct + "%", height: "100%", background: pct >= 80 ? "#16a34a" : pct >= 40 ? "#eab308" : "#f97316" }} />
          </div>
        );
        const Blok = ({ baslik, arr, adKey, tur }) => {
          const g = grupla(arr, adKey);
          const mahListe = Object.entries(g)
            .map(([mid, satirlar]) => {
              const mt = satirlar.reduce((a, r) => ({ t: a.t + (r.toplam || 0), e: a.e + (r.edilen || 0) }), { t: 0, e: 0 });
              return { mid, satirlar, ...mt };
            })
            .sort((a, b) => b.t - a.t);
          return (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
                {baslik} <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>({mahListe.length} mahalle)</span>
              </h3>
              {mahListe.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13 }}>Kayıt yok.</div>}
              {mahListe.map(({ mid, satirlar, t, e }) => {
                const anahtar = tur + ":" + mid;
                const acik = acikMah.has(anahtar) || !!f; // arama varken hepsi açık
                const pct = oran(e, t);
                return (
                  <div key={mid} style={{ border: "1px solid #eef2f7", borderRadius: 12, marginBottom: 10, overflow: "hidden", background: "#fff" }}>
                    <button onClick={() => mahToggle(anahtar)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: acik ? "#f8fafc" : "#fff", border: "none", borderBottom: acik ? "1px solid #eef2f7" : "none", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 12, color: "#94a3b8", width: 14 }}>{acik ? "▾" : "▸"}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#c2410c", flex: 1, minWidth: 0 }}>{mahAd[mid] || "—"}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{fmt(satirlar.length)} {tur === "sokak" ? "sokak" : "site"}</span>
                      {cubuk(pct)}
                      <span style={{ fontSize: 12, color: "#475569", width: 118, textAlign: "right", fontWeight: 600 }}>{fmt(e)} / {fmt(t)} · %{pct}</span>
                    </button>
                    {acik && (
                      <div style={{ padding: "4px 14px 8px" }}>
                        {satirlar.sort((a, b) => (b.toplam || 0) - (a.toplam || 0)).map((r, i) => {
                          const p = oran(r.edilen || 0, r.toplam || 0);
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                              <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#334155" }}>{r[adKey] || "—"}</span>
                              {cubuk(p)}
                              <span style={{ fontSize: 12, color: "#475569", width: 118, textAlign: "right" }}>{fmt(r.edilen || 0)} / {fmt(r.toplam || 0)} · %{p}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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
            <Blok baslik="Sokak Bazlı" arr={tumSok} adKey="sokak_ad" tur="sokak" />
            <Blok baslik="Site Bazlı" arr={tumSit} adKey="site_ad" tur="site" />
          </div>
        );
      })()}

      {/* ---- BLOKLAR & SORUMLULAR ---- */}
      {tab === "bloklar" && !mesgul && (
        <div>
          {(() => {
            const say = { blok_sorumlu: 0, ana_kademe: 0, kadin_kollari: 0, genclik_kollari: 0 };
            d.bloklar.forEach((b) => { if (say[b.rol] != null) say[b.rol]++; });
            const siteSet = new Set(d.bloklar.map((b) => b.site_kayit_id).filter(Boolean));
            const kart = (lbl, val, renk, key) => (
              <button key={lbl} onClick={() => setBlokFiltre(key)}
                style={{ textAlign: "left", cursor: "pointer", background: blokFiltre === key ? renk + "14" : "#fff", border: "1px solid " + (blokFiltre === key ? renk : "#eef2f7"), borderRadius: 10, padding: "10px 14px", minWidth: 120 }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>{lbl}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: renk }}>{fmt(val)}</div>
              </button>
            );
            return (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                {kart("Toplam Görevli", d.bloklar.length, "#0f172a", "hepsi")}
                {kart("Blok Sorumlusu", say.blok_sorumlu, "#0369a1", "blok_sorumlu")}
                {kart("Ana Kademe", say.ana_kademe, "#3730a3", "ana_kademe")}
                {kart("Kadın Kolları", say.kadin_kollari, "#9d174d", "kadin_kollari")}
                {kart("Gençlik Kolları", say.genclik_kollari, "#166534", "genclik_kollari")}
                {d.blokOzet ? (
                  <div style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 10, padding: "10px 14px", minWidth: 150 }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Blok sorumlusu (blok)</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>
                      <span style={{ color: "#166534" }}>{fmt(d.blokOzet.atananBlok)}</span>
                      <span style={{ color: "#94a3b8", fontSize: 15 }}> / {fmt(d.blokOzet.toplamBlok)}</span>
                      {d.blokOzet.bosBlok > 0 ? <span style={{ color: "#b91c1c", fontSize: 13, fontWeight: 700 }}> · {fmt(d.blokOzet.bosBlok)} boş</span> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()}
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>Karta tıklayarak kademeye göre filtreleyin{blokFiltre !== "hepsi" ? <> · <b style={{ color: "#c2410c", cursor: "pointer" }} onClick={() => setBlokFiltre("hepsi")}>filtreyi temizle</b></> : null}</div>

          {(blokFiltre === "hepsi" || blokFiltre === "blok_sorumlu") && d.bosBloklar && d.bosBloklar.length > 0 && (
            <div style={{ border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#b91c1c", marginBottom: 8 }}>
                Blok sorumlusu ATANMAMIŞ bloklar · {fmt(d.blokOzet?.bosBlok || 0)} blok / {fmt(d.bosBloklar.length)} site
              </div>
              {d.bosBloklar
                .filter((x) => !f || (x.ad || "").toLocaleLowerCase("tr").includes(f) || (mahAd[x.mahalle_id] || "").toLocaleLowerCase("tr").includes(f))
                .map((x, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", padding: "6px 0", borderTop: i ? "1px solid #fee2e2" : "none" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 160 }}>{x.ad}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8", minWidth: 90 }}>{mahAd[x.mahalle_id] || ""}</span>
                    <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>{x.bloklar.length} boş</span>
                    <span style={{ fontSize: 12, color: "#334155", flex: 1, minWidth: 200 }}>
                      {x.bloklar.slice(0, 30).map((bk, j) => (
                        <span key={j} style={{ display: "inline-block", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", padding: "1px 7px", borderRadius: 6, margin: "2px 4px 2px 0" }}>{bk}</span>
                      ))}
                      {x.bloklar.length > 30 ? <span style={{ color: "#94a3b8" }}>+{x.bloklar.length - 30}</span> : null}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {d.bloklar
            .filter((b) => blokFiltre === "hepsi" || b.rol === blokFiltre)
            .filter((b) => !f || (b.ad_soyad || "").toLocaleLowerCase("tr").includes(f) || (b.site?.ad || "").toLocaleLowerCase("tr").includes(f) || (b.blok || "").toLocaleLowerCase("tr").includes(f))
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
          {(() => {
            const atanan = d.siteSor.filter((s) => s.temsilci_id).length;
            const toplam = d.siteSor.length;
            const atanmayan = toplam - atanan;
            const kart = (lbl, val, renk, aktifKey) => (
              <button key={lbl} onClick={() => setSiteFiltre(aktifKey)}
                style={{ textAlign: "left", cursor: "pointer", background: siteFiltre === aktifKey ? renk + "14" : "#fff", border: "1px solid " + (siteFiltre === aktifKey ? renk : "#eef2f7"), borderRadius: 10, padding: "10px 14px", minWidth: 130 }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>{lbl}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: renk }}>{fmt(val)}</div>
              </button>
            );
            return (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                {kart("Tüm site", toplam, "#0f172a", "hepsi")}
                {kart("Temsilci atandı", atanan, "#166534", "atanan")}
                {kart("Temsilci yok", atanmayan, "#b91c1c", "atanmayan")}
                <div style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 10, padding: "10px 14px", minWidth: 130 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Atanma oranı</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#c2410c" }}>%{oran(atanan, toplam)}</div>
                </div>
              </div>
            );
          })()}
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>Karta tıklayarak filtreleyebilirsiniz{siteFiltre !== "hepsi" ? " · " : ""}{siteFiltre !== "hepsi" ? <b style={{ color: "#c2410c", cursor: "pointer" }} onClick={() => setSiteFiltre("hepsi")}>filtreyi temizle</b> : null}</div>
          {d.siteSor
            .filter((s) => siteFiltre === "hepsi" || (siteFiltre === "atanan" ? s.temsilci_id : !s.temsilci_id))
            .filter((s) => !f || (s.ad || "").toLocaleLowerCase("tr").includes(f) || (s.temsilci?.ad_soyad || "").toLocaleLowerCase("tr").includes(f) || (mahAd[s.mahalle_id] || "").toLocaleLowerCase("tr").includes(f))
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
