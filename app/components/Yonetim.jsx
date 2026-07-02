"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { LayoutDashboard, Building2, Compass, Users, ShieldCheck, BadgeCheck, Boxes, FileText, ChevronRight, LogOut, Map, MapPin, Menu, ClipboardList } from "lucide-react";
import Bolgeler from "./Bolgeler";
import Gezgin from "./Gezgin";
import GrupDetay from "./GrupDetay";
import Haneler from "./Haneler";
import IlGeneli from "./IlGeneli";
import Siteler from "./Siteler";
import Sorumlular from "./Sorumlular";
import BaskanRapor from "./BaskanRapor";

export default function Yonetim({ session, profil }) {
  const ilceYon = profil.rol === "ilce_yonetimi";
  const [mahalleler, setMahalleler] = useState(null);
  const [bolgeToplam, setBolgeToplam] = useState(0);      // seçili ilçenin bölge sayısı
  const [ilBolgeToplam, setIlBolgeToplam] = useState(0);  // il geneli bölge sayısı
  const [ilceList, setIlceList] = useState([]);
  const [secIlceId, setSecIlceId] = useState(profil.ilce_id || null);
  const [sayfa, setSayfa] = useState(ilceYon ? "gezgin" : "il");
  const [secMahalle, setSecMahalle] = useState(null);
  const [secBolge, setSecBolge] = useState(null);
  const [secGrup, setSecGrup] = useState(null);
  const [mahalleTab, setMahalleTab] = useState("sokaklar"); // sokak-tipi mahalle içinde: sokaklar | siteler
  const [mahalleSiteSay, setMahalleSiteSay] = useState(0);  // bu mahalledeki site_kayit sayısı
  const [mahalleBolgeSay, setMahalleBolgeSay] = useState(0);// site-tipi mahalledeki sokak-bölge sayısı
  const [drawer, setDrawer] = useState(false);              // mobil yan menü açık mı

  // Çekmece açıkken arka planın kaymasını kilitle
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  // Seçili mahalle sokak-tipiyse, içinde gizli site var mı bak
  useEffect(() => {
    setMahalleTab(secMahalle?.tip === "site" ? "siteler" : "sokaklar");
    if (!secMahalle) { setMahalleSiteSay(0); setMahalleBolgeSay(0); return; }
    (async () => {
      if (secMahalle.tip !== "site") {
        const { count } = await supabase.from("site_kayit")
          .select("id", { count: "exact", head: true })
          .eq("mahalle_id", secMahalle.id);
        setMahalleSiteSay(count || 0); setMahalleBolgeSay(0);
      } else {
        const { count } = await supabase.from("bolge")
          .select("id", { count: "exact", head: true })
          .eq("mahalle_id", secMahalle.id);
        setMahalleBolgeSay(count || 0); setMahalleSiteSay(0);
      }
    })();
  }, [secMahalle?.id]);

  useEffect(() => {
    (async () => {
      let q = supabase.from("mv_mahalle_ozet").select("mahalle_id, ilce_id, ad, prefix, tip, hane, kisi, uye, erkek, kadin, y1824, y2534, y3544, y4554, y5564, y65");
      if (ilceYon && profil.ilce_id) q = q.eq("ilce_id", profil.ilce_id);
      // 3 sorgu tek turda paralel — ilk açılış hızlanır
      const [ozetR, bolgeR, ilceR] = await Promise.all([
        q,
        supabase.from("bolge").select("*", { count: "exact", head: true }),
        supabase.from("ilce").select("id, ad, prefix").order("ad"),
      ]);
      const ml = (ozetR.data || []).filter((m) => m.kisi > 0).sort((a, b) => b.kisi - a.kisi);
      setMahalleler(ml);
      setIlBolgeToplam(bolgeR.count || 0);
      setIlceList(ilceR.data || []);
      const veriIlce = [...new Set(ml.map((m) => m.ilce_id))];
      setSecIlceId((cur) => cur || (ilceYon ? profil.ilce_id : (veriIlce[0] || null)));
    })();
  }, []);

  // seçili ilçenin bölge sayısı
  useEffect(() => {
    (async () => {
      const mIds = (mahalleler || []).filter((m) => m.ilce_id === secIlceId).map((m) => m.mahalle_id);
      if (!mIds.length) { setBolgeToplam(0); return; }
      const { count } = await supabase.from("bolge").select("*", { count: "exact", head: true }).in("mahalle_id", mIds);
      setBolgeToplam(count || 0);
    })();
  }, [mahalleler, secIlceId]);

  const topla = (l) => {
    const s = (f) => l.reduce((a, m) => a + (m[f] || 0), 0);
    return {
      kisi: s("kisi"), hane: s("hane"), uye: s("uye"), erkek: s("erkek"), kadin: s("kadin"),
      yasArr: [
        { ad: "18-24", deger: s("y1824") }, { ad: "25-34", deger: s("y2534") },
        { ad: "35-44", deger: s("y3544") }, { ad: "45-54", deger: s("y4554") },
        { ad: "55-64", deger: s("y5564") }, { ad: "65+", deger: s("y65") },
      ],
    };
  };
  const ilceMahalleler = useMemo(() => (mahalleler || []).filter((m) => m.ilce_id === secIlceId), [mahalleler, secIlceId]);
  const toplam = useMemo(() => topla(ilceMahalleler), [ilceMahalleler]);
  const ilToplam = useMemo(() => topla(mahalleler || []), [mahalleler]);
  const secIlce = useMemo(() => ilceList.find((i) => i.id === secIlceId) || { id: secIlceId, ad: "Başakşehir" }, [ilceList, secIlceId]);
  const veriIlceleri = useMemo(() => {
    const ids = [...new Set((mahalleler || []).map((m) => m.ilce_id))];
    return ids.map((id) => ilceList.find((i) => i.id === id) || { id, ad: "İlçe" });
  }, [mahalleler, ilceList]);
  function ilceSec(id) { setSecIlceId(id); setSecMahalle(null); setSecBolge(null); setSecGrup(null); setDrawer(false); }

  function git(s) { setSayfa(s); setSecMahalle(null); setSecBolge(null); setSecGrup(null); setDrawer(false); }

  const NavBtn = ({ id, ic, label, badge, pasif }) => (
    <button className={"nav" + (sayfa === id ? " on" : "") + (pasif ? " pasif" : "")}
      onClick={() => { if (pasif) { setSayfa("yakinda"); setDrawer(false); return; } git(id); }}>
      {ic} <span>{label}</span>{badge != null && <em className="badge">{badge}</em>}
    </button>
  );

  return (
    <div className="app">
      <header className="mobil-bar">
        <button className="ham" onClick={() => setDrawer(true)} aria-label="Menü"><Menu size={20} /></button>
        <div className="mb-logo"><Building2 size={17} /></div>
        <div>
          <div className="mb-t">Saha Takip</div>
          <div className="mb-s">{ilceYon ? "İlçe Yönetimi" : (secIlce.ad || "").toLocaleUpperCase("tr")}</div>
        </div>
        {!ilceYon && <span className="mb-badge">39 ilçe</span>}
      </header>
      <div className={"drawer-overlay" + (drawer ? " open" : "")} onClick={() => setDrawer(false)} aria-hidden />

      <aside className={"sidebar" + (drawer ? " open" : "")}>
        <div className="brand"><div className="logo"><Building2 size={20} /></div>
          <div><div className="brand-t">Site Sokak Sorumlusu Takip Sistemi</div>
            <div className="brand-s">İSTANBUL İL BAŞKANLIĞI</div></div></div>

        {!ilceYon && <>
          <div className="nav-sec">İl Yönetimi</div>
          <NavBtn id="il" ic={<LayoutDashboard size={17} />} label="İl Geneli" badge={39} />
        </>}

        <div className="nav-sec">{ilceYon ? "İlçe" : secIlce.ad}</div>
        <NavBtn id="gezgin" ic={<Compass size={17} />} label="Teşkilat Gezgini" />
        <NavBtn id="sorumlular" ic={<Users size={17} />} label="Sorumlular" />
        <NavBtn id="siteler" ic={<MapPin size={17} />} label="Siteler" />
        <NavBtn id="rapor" ic={<ClipboardList size={17} />} label="Başkan Paneli" />

        <div className="nav-sec">Modüller</div>
        <NavBtn id="m1" ic={<BadgeCheck size={17} />} label="Üye Doğrulama" pasif />
        <NavBtn id="m2" ic={<Boxes size={17} />} label="YSK Sandık Eşleme" pasif />
        <NavBtn id="m3" ic={<FileText size={17} />} label="Seçim Analizi" pasif />

        <div className="side-foot">
          <div className="who"><div className="av"><ShieldCheck size={16} /></div>
            <div><div className="who-n">{profil.ad_soyad || "İl Başkanlığı"}</div>
              <div className="who-e">{session.user.email}</div></div></div>
          <button className="btn cikis" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> Çıkış Yap</button>
        </div>
      </aside>

      <main className="main">
        {sayfa === "il" && (
          <IlGeneli toplam={ilToplam} mahalleSayisi={(mahalleler || []).length} bolgeToplam={ilBolgeToplam}
            hazir={mahalleler !== null} onBasaksehir={() => { ilceSec(veriIlceleri[0]?.id || secIlceId); git("gezgin"); }} />
        )}
        {sayfa === "gezgin" && (
          <div className="page">
            {!ilceYon && veriIlceleri.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "var(--ink2)", fontWeight: 600 }}>İlçe:</span>
                <select className="sel" value={secIlceId || ""} onChange={(e) => ilceSec(e.target.value)} style={{ minWidth: 180, fontWeight: 600 }}>
                  {veriIlceleri.map((i) => <option key={i.id} value={i.id}>{i.ad}</option>)}
                </select>
                <span style={{ fontSize: 12, color: "var(--ink2)" }}>{veriIlceleri.length} ilçede veri var · diğerleri yüklendikçe burada görünür</span>
              </div>
            )}
            <div className="crumb">
              <a onClick={() => { setSecMahalle(null); setSecBolge(null); setSecGrup(null); }}>{secIlce.ad}</a>
              {secMahalle && <><ChevronRight size={14} /><a onClick={() => { setSecBolge(null); setSecGrup(null); }}>{secMahalle.ad}</a></>}
              {secBolge && <><ChevronRight size={14} />{secGrup ? <a onClick={() => setSecGrup(null)}>{secBolge.kod}</a> : <span className="cur">{secBolge.kod}</span>}</>}
              {secBolge && secGrup && <><ChevronRight size={14} /><span className="cur">{secBolge.kod}-{secGrup.no}</span></>}
            </div>
            {!secMahalle && <Gezgin mahalleler={ilceMahalleler} toplam={toplam} bolgeToplam={bolgeToplam} ilceAd={secIlce.ad}
              onSec={(m) => { setSecMahalle(m); setSecBolge(null); setSecGrup(null); }} />}
            {secMahalle && !secBolge && secMahalle.tip === "site" && mahalleBolgeSay > 0 && (
              <>
                <div className="mah-tabs">
                  <button className={mahalleTab === "siteler" ? "mt act" : "mt"} onClick={() => setMahalleTab("siteler")}>
                    <Building2 size={15} /> Siteler
                  </button>
                  <button className={mahalleTab === "sokaklar" ? "mt act" : "mt"} onClick={() => setMahalleTab("sokaklar")}>
                    <Map size={15} /> Sokaklar <span className="mt-bdg">{mahalleBolgeSay}</span>
                  </button>
                </div>
                {mahalleTab === "siteler"
                  ? <Siteler profil={profil} sabitMahalle={{ mahalle_id: secMahalle.id, ad: secMahalle.ad }} />
                  : <Bolgeler mahalle={{ ...secMahalle, tip: "sokak" }} onSec={(b) => { setSecBolge(b); setSecGrup(null); }} onSecGrup={(b, g) => { setSecBolge(b); setSecGrup(g); }} />}
              </>
            )}
            {secMahalle && !secBolge && secMahalle.tip === "site" && mahalleBolgeSay === 0 &&
              <Siteler profil={profil} sabitMahalle={{ mahalle_id: secMahalle.id, ad: secMahalle.ad }} />}
            {secMahalle && !secBolge && secMahalle.tip !== "site" && mahalleSiteSay > 0 && (
              <>
                <div className="mah-tabs">
                  <button className={mahalleTab === "sokaklar" ? "mt act" : "mt"} onClick={() => setMahalleTab("sokaklar")}>
                    <Map size={15} /> Sokaklar
                  </button>
                  <button className={mahalleTab === "siteler" ? "mt act" : "mt"} onClick={() => setMahalleTab("siteler")}>
                    <Building2 size={15} /> Siteler <span className="mt-bdg">{mahalleSiteSay}</span>
                  </button>
                </div>
                {mahalleTab === "sokaklar"
                  ? <Bolgeler mahalle={secMahalle} onSec={(b) => { setSecBolge(b); setSecGrup(null); }} onSecGrup={(b, g) => { setSecBolge(b); setSecGrup(g); }} />
                  : <Siteler profil={profil} sabitMahalle={{ mahalle_id: secMahalle.id, ad: secMahalle.ad }} />}
              </>
            )}
            {secMahalle && !secBolge && secMahalle.tip !== "site" && mahalleSiteSay === 0 &&
              <Bolgeler mahalle={secMahalle} onSec={(b) => { setSecBolge(b); setSecGrup(null); }} onSecGrup={(b, g) => { setSecBolge(b); setSecGrup(g); }} />}
            {secMahalle && secBolge && !secGrup && <Haneler birim={{ tip: "bolge", ...secBolge, mahalleAd: secMahalle?.ad, ilceAd: secIlce?.ad }} userId={session.user.id} yonetici planla onGrupSec={setSecGrup} />}
            {secMahalle && secBolge && secGrup && <GrupDetay bolge={secBolge} grup={secGrup} userId={session.user.id} yonetici />}
          </div>
        )}
        {sayfa === "sorumlular" && <Sorumlular profil={profil} />}
        {sayfa === "siteler" && <Siteler profil={profil} />}
        {sayfa === "rapor" && <BaskanRapor profil={profil} />}
        {sayfa === "yakinda" && (
          <div className="page"><div className="bos-modul"><Boxes size={34} />
            <h3>Bu modül yakında</h3><p>Bu bölüm sonraki aşamada eklenecek.</p></div></div>
        )}
      </main>

      <nav className="tabbar">
        {!ilceYon && (
          <button className={sayfa === "il" ? "on" : ""} onClick={() => git("il")}>
            <LayoutDashboard size={21} /><span>İl Geneli</span>
          </button>
        )}
        <button className={sayfa === "gezgin" ? "on" : ""} onClick={() => git("gezgin")}>
          <Compass size={21} /><span>Gezgin</span>
        </button>
        <button className={sayfa === "sorumlular" ? "on" : ""} onClick={() => git("sorumlular")}>
          <Users size={21} /><span>Sorumlular</span>
        </button>
        <button className={sayfa === "siteler" ? "on" : ""} onClick={() => git("siteler")}>
          <MapPin size={21} /><span>Siteler</span>
        </button>
      </nav>
    </div>
  );
}

/* ===================== İl Geneli ===================== */
