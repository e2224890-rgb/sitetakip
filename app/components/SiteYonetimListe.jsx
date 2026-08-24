"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { UserCheck, Crown, Phone, Users } from "lucide-react";
import { BLOK_ROL_LISTE, BLOK_ROL_AD, SITE_YK_LISTE, SITE_YK_AD } from "../../lib/constants";
import { blokParts } from "../../lib/format";
import { hataMetni } from "../../lib/hata";

// Rol -> rozet rengi
const ROL_RENK = {
  temsilci: { bg: "#ffedd5", fg: "#9a3412" },
  koordinator: { bg: "#e0e7ff", fg: "#3730a3" },
  blok_sorumlu: { bg: "#e0f2fe", fg: "#0369a1" },
  ana_kademe: { bg: "#ede9fe", fg: "#5b21b6" },
  kadin_kollari: { bg: "#fce7f3", fg: "#9d174d" },
  genclik_kollari: { bg: "#dcfce7", fg: "#166534" },
  site_teskilat: { bg: "#fef9c3", fg: "#854d0e" },
  site_sosyal: { bg: "#cffafe", fg: "#155e75" },
  site_sekreter: { bg: "#f3e8ff", fg: "#6b21a8" },
};

export default function SiteYonetimListe({ site }) {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [baskan, setBaskan] = useState(null);
  const [koord, setKoord] = useState(null);
  const [gorevliler, setGorevliler] = useState([]); // {ad_soyad, rol, blok, telefon}

  const [havuz, setHavuz] = useState([]); // rol bazlı aday havuzu (ilçe geneli)
  const [ykMesaj, setYkMesaj] = useState("");

  // Bir görev için adaylar: o roldeki HERKES (ilçe geneli) + genel sorumlular + üst yönetim.
  // Zaten bu göreve bu sitede atanmış olanları hariç tut (dropdown'da tekrar çıkmasın).
  function adaylar(gorevRol, haricId) {
    return havuz.filter((p) => {
      if (p.id === haricId) return false; // bu görevde zaten atanmış kişiyi listeleme
      return p.rol === gorevRol || p.rol === "sorumlu" || p._ust;
    });
  }

  async function yukle() {
    setYukleniyor(true);
    const rolLstesi = [...BLOK_ROL_LISTE.map((r) => r[0]), ...SITE_YK_LISTE.map((r) => r[0]), "sorumlu"];
    const [{ data: sk }, { data: gr }, { data: tumRol }] = await Promise.all([
      supabase.from("site_kayit").select("temsilci_id, koordinator_id").eq("id", site.id).single(),
      // bu siteye bağlı görevliler (mevcut atamaları göstermek için)
      supabase.from("profiles").select("id, ad_soyad, eposta, telefon, meslek, rol, blok, site_kayit_id")
        .eq("site_kayit_id", site.id).in("rol", rolLstesi),
      // İLÇE GENELİ o rollerdeki tüm kişiler (aday havuzu) — siteye bağlı olması şart değil
      supabase.from("profiles").select("id, ad_soyad, eposta, telefon, meslek, rol, blok, site_kayit_id")
        .in("rol", rolLstesi),
    ]);
    const ids = [sk?.temsilci_id, sk?.koordinator_id].filter(Boolean);
    let pMap = {};
    if (ids.length) { const { data: pr } = await supabase.from("profiles").select("id, ad_soyad, eposta, telefon, rol").in("id", ids); (pr || []).forEach((p) => { pMap[p.id] = p; }); }
    const bsk = sk?.temsilci_id ? { ...pMap[sk.temsilci_id], _ust: true } : null;
    const krd = sk?.koordinator_id ? { ...pMap[sk.koordinator_id], _ust: true } : null;
    setBaskan(bsk); setKoord(krd);
    setGorevliler((gr || []).filter((p) => p.rol !== "sorumlu"));
    // Havuz: ilçe geneli roldekiler + üst yönetim (benzersiz). Üst yönetimi işaretle.
    const hm = {};
    (tumRol || []).forEach((p) => { hm[p.id] = p; });
    [bsk, krd].forEach((p) => { if (p && p.id) hm[p.id] = { ...(hm[p.id] || p), ...p, _ust: true }; });
    setHavuz(Object.values(hm).sort((a, b) => (a.ad_soyad || a.eposta || "").localeCompare(b.ad_soyad || b.eposta || "", "tr")));
    setYukleniyor(false);
  }
  useEffect(() => { yukle(); }, [site.id]);

  // Göreve ata / görevden çıkar. cikarId verilirse o kişiyi görevden alır.
  async function ykAta(gorevRol, profileId, cikarId) {
    setYkMesaj("Kaydediliyor…");
    const { data: { session } } = await supabase.auth.getSession();
    if (cikarId || !profileId) {
      // Görevden çıkar: belirli kişi (cikarId) ya da o görevdeki ilk kişi -> 'sorumlu'ya çevir, blok temizle
      const hedef = cikarId || gorevliler.find((g) => g.rol === gorevRol)?.id;
      if (!hedef) { setYkMesaj(""); return; }
      const r = await fetch("/api/hesap-ekle", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ id: hedef, rol: "sorumlu", blok: null }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setYkMesaj(hataMetni(j.error || { status: r.status })); return; }
    } else {
      // Ata: role çevir, bu siteye bağla, blok'u TEMİZLE (site geneli görev, bloğa bağlı değil)
      const r = await fetch("/api/hesap-ekle", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ id: profileId, rol: gorevRol, site_kayit_id: site.id, blok: null }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setYkMesaj(hataMetni(j.error || { status: r.status })); return; }
    }
    setYkMesaj(""); await yukle();
  }

  // Kademe görevlilerini role göre grupla; her görevlinin bloklarını ayrı satır yap
  const kademeler = BLOK_ROL_LISTE.map(([rol, ad]) => {
    const kisiler = [];
    gorevliler.filter((g) => g.rol === rol).forEach((g) => {
      const bloklar = blokParts(g.blok);
      if (bloklar.length) bloklar.forEach((bk) => kisiler.push({ ...g, blokTek: bk }));
      else kisiler.push({ ...g, blokTek: null });
    });
    return { rol, ad, kisiler };
  });

  const toplamGorevli = gorevliler.length + (baskan ? 1 : 0) + (koord ? 1 : 0);

  const Satir = ({ renk, gorev, ad, blok, tel, meslek }) => (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 12, fontWeight: 700, background: renk.bg, color: renk.fg, padding: "3px 10px", borderRadius: 7, minWidth: 118, textAlign: "center" }}>{gorev}</span>
      {blok ? <span style={{ fontSize: 12, background: "#f1f5f9", color: "#475569", padding: "2px 9px", borderRadius: 6, fontWeight: 600 }}>{blok} Blok</span> : null}
      <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{ad || <span style={{ color: "#cbd5e1", fontWeight: 400 }}>— atanmadı —</span>}</span>
      <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#64748b", display: "flex", gap: 10, alignItems: "center" }}>
        {tel ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {tel}</span> : null}
        {meslek ? <span>{meslek}</span> : null}
      </span>
    </div>
  );

  if (yukleniyor) return <div className="merkez" style={{ padding: 24 }}>Yükleniyor…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 7 }}>
          <Users size={17} /> AK Parti Site Temsilciliği Yönetimi
        </h3>
        <span style={{ fontSize: 12.5, color: "#64748b" }}>{site.ad} · {toplamGorevli} görevli</span>
      </div>

      {/* Üst yönetim: Site Başkanı + Koordinatör */}
      <div style={{ border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden", marginBottom: 14, background: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", padding: "9px 12px", background: "#f8fafc", borderBottom: "1px solid #eef2f7", display: "flex", alignItems: "center", gap: 6 }}>
          <Crown size={13} /> ÜST YÖNETİM
        </div>
        <Satir renk={ROL_RENK.temsilci} gorev="Site Temsilcisi" ad={baskan?.ad_soyad || baskan?.eposta} tel={baskan?.telefon} />
        <Satir renk={ROL_RENK.koordinator} gorev="Koordinatör" ad={koord?.ad_soyad || koord?.eposta} tel={koord?.telefon} />
      </div>

      {/* SİTE YÖNETİM KURULU (Madde 7) */}
      {(() => {
        const ykGorevliler = SITE_YK_LISTE.map(([rol, ad]) => ({ rol, ad, kisi: gorevliler.find((g) => g.rol === rol) || null }));
        const dolu = ykGorevliler.filter((y) => y.kisi);
        // Madde 7/2: aynı kişi birden fazla görevde mi?
        const sayac = {};
        dolu.forEach((y) => { const k = y.kisi.id; sayac[k] = (sayac[k] || 0) + 1; });
        const cokGorevli = dolu.filter((y) => sayac[y.kisi.id] > 1);
        return (
          <div style={{ border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden", marginBottom: 14, background: "#fff" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", padding: "9px 12px", background: "#f8fafc", borderBottom: "1px solid #eef2f7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Users size={13} /> SİTE YÖNETİM KURULU</span>
              <span style={{ color: "#94a3b8" }}>{dolu.length}/3 görev dolu</span>
            </div>
            {ykGorevliler.map(({ rol, ad, kisi }) => (
              <div key={rol} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 12, fontWeight: 700, background: ROL_RENK[rol].bg, color: ROL_RENK[rol].fg, padding: "3px 10px", borderRadius: 7, minWidth: 190, textAlign: "center" }}>{ad}</span>
                <select value={kisi?.id || ""} onChange={(e) => ykAta(rol, e.target.value || null)}
                  style={{ flex: 1, minWidth: 180, padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fff" }}>
                  <option value="">— atanmadı —</option>
                  {adaylar(rol, kisi?.id).map((p) => {
                    const et = p.rol === rol ? (p.site_kayit_id && p.site_kayit_id !== site.id ? " (başka sitede)" : "") : p._ust ? " (üst yönetim)" : " (sorumlu)";
                    return <option key={p.id} value={p.id}>{p.ad_soyad || p.eposta}{et}</option>;
                  })}
                </select>
                {kisi?.telefon ? <span style={{ fontSize: 12.5, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {kisi.telefon}</span> : null}
                {kisi ? <button onClick={() => ykAta(rol, null, kisi.id)} title="Görevden çıkar" style={{ border: "none", background: "#fef2f2", color: "#b91c1c", borderRadius: 7, padding: "3px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Çıkar</button> : null}
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: "#94a3b8", padding: "6px 12px" }}>Havuzda yalnız bu siteye bağlı kişiler görünür. Yeni kişi eklemek için <b>Sorumlular</b> ekranını kullanın.{ykMesaj ? <span style={{ color: "#c2410c", marginLeft: 8 }}>{ykMesaj}</span> : null}</div>
            {cokGorevli.length > 0 && (
              <div style={{ fontSize: 12, color: "#9a3412", background: "#fff7ed", padding: "8px 12px", borderTop: "1px solid #fed7aa", lineHeight: 1.5 }}>
                <b>Madde 7/2 uyarısı:</b> Üye sayısı yetersiz olduğundan aynı kişi birden fazla görev üstlenmiş ({[...new Set(cokGorevli.map((y) => y.kisi.ad_soyad || y.kisi.eposta))].join(", ")}). Bu durum <b>İlçe Teşkilat Başkanına bildirilmelidir</b>.
              </div>
            )}
          </div>
        );
      })()}

      {/* Blok/saha görevlileri */}
      {kademeler.map(({ rol, ad, kisiler }) => (
        <div key={rol} style={{ border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden", marginBottom: 12, background: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: ROL_RENK[rol].fg, padding: "9px 12px", background: ROL_RENK[rol].bg + "55", borderBottom: "1px solid #eef2f7", display: "flex", justifyContent: "space-between" }}>
            <span>{ad.toLocaleUpperCase("tr")}</span>
            <span style={{ color: "#94a3b8" }}>{kisiler.length} kişi</span>
          </div>
          {kisiler.length > 0 && (() => {
            // Aynı kişiyi tek satırda göster (blok bazlı çoğaltma yok -> site geneli görev)
            const tekil = []; const gor = new Set();
            kisiler.forEach((k) => { if (!gor.has(k.id)) { gor.add(k.id); tekil.push(k); } });
            return tekil.map((k, i) => (
              <div key={k.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 12px", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 12, fontWeight: 700, background: ROL_RENK[rol].bg, color: ROL_RENK[rol].fg, padding: "3px 10px", borderRadius: 7, minWidth: 118, textAlign: "center" }}>{BLOK_ROL_AD[rol]}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{k.ad_soyad || k.eposta}</span>
                <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#64748b", display: "flex", gap: 10, alignItems: "center" }}>
                  {k.telefon ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {k.telefon}</span> : null}
                  {k.meslek ? <span>{k.meslek}</span> : null}
                  <button onClick={() => ykAta(rol, null, k.id)} title="Görevden çıkar"
                    style={{ border: "none", background: "#fef2f2", color: "#b91c1c", borderRadius: 7, padding: "3px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Çıkar</button>
                </span>
              </div>
            ));
          })()}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 12px", borderTop: kisiler.length ? "1px solid #f1f5f9" : "none" }}>
            <span style={{ fontSize: 12, color: "#64748b", minWidth: 118 }}>{kisiler.length ? "+ kişi ekle" : "Ata"}</span>
            <select value="" onChange={(e) => { if (e.target.value) ykAta(rol, e.target.value); e.target.value = ""; }}
              style={{ flex: 1, minWidth: 180, padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13.5, background: "#fff" }}>
              <option value="">— kişi seç (site geneli ata) —</option>
              {adaylar(rol).filter((p) => !kisiler.some((k) => k.id === p.id)).map((p) => {
                const et = p.rol === rol ? (p.site_kayit_id && p.site_kayit_id !== site.id ? " (başka sitede)" : "") : p._ust ? " (üst yönetim)" : " (sorumlu)";
                return <option key={p.id} value={p.id}>{p.ad_soyad || p.eposta}{et}</option>;
              })}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
