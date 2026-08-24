"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../../lib/supabase";
import { cikisYap } from "../../lib/oturum";
import { cacheOku, cacheYaz } from "../../lib/cache";
import { ChevronRight, LogOut, UserCheck, Crown, Building2, Map } from "lucide-react";
const Haneler = dynamic(() => import("./Haneler"), { ssr: false, loading: () => <div className="merkez">Yükleniyor…</div> });
import SokakYonetim from "./SokakYonetim";

export default function SahaGorunum({ session, profil, alan, baslik }) {
  // birim = bölge veya site (ikisi de tip alanıyla ayrışır)
  const [birimler, setBirimler] = useState(null);
  const [secBirim, setSecBirim] = useState(null);
  const [gruplar, setGruplar] = useState([]); // seçili bölgenin sokak grupları (ekip paneli için)

  useEffect(() => {
    const snapAnahtar = `saha2:${alan}:${session.user.id}`;
    const uygula = (liste) => {
      setBirimler(liste);
      if (liste.length === 1) setSecBirim((cur) => cur ?? liste[0]); // kullanıcı gezinmesini ezme
    };
    const snap = cacheOku(snapAnahtar);
    if (snap) uygula(snap); // son bilinen liste ANINDA
    (async () => {
      const uid = session.user.id;
      const [bR, sR] = await Promise.all([
        // Bölge sorumluluğu (bolge.sorumlu_id)
        supabase.from("bolge").select("id, kod, kapsam, mahalle_id").eq(alan, uid).order("kod"),
        // Site başkanlığı/temsilciliği (site_kayit.temsilci_id)
        supabase.from("site_kayit").select("id, ad, blok_sayisi, daire_sayisi, adres, mahalle_id").eq("temsilci_id", uid).order("ad"),
      ]);
      const bolgeler = (bR.data || []).map((b) => ({ tip: "bolge", id: b.id, kod: b.kod, kapsam: b.kapsam || "—", mahalle_id: b.mahalle_id }));
      const siteler = (sR.data || []).map((s) => ({
        tip: "site", id: s.id, kod: s.ad,
        kapsam: `${s.blok_sayisi ?? "?"} blok · ${s.daire_sayisi ?? "?"} daire${s.adres ? " · " + s.adres : ""}`,
        mahalle_id: s.mahalle_id,
      }));
      uygula([...siteler, ...bolgeler]);
      cacheYaz(snapAnahtar, [...siteler, ...bolgeler]);
    })();
  }, []);

  // Seçili bölgenin gruplarını çek -> her grup için Sokak Yönetimi paneli
  useEffect(() => {
    if (!secBirim || secBirim.tip !== "bolge") { setGruplar([]); return; }
    (async () => {
      const { data } = await supabase.from("sokak_grup")
        .select("id, no, baskan_id, baskan_ad").eq("bolge_id", secBirim.id).order("no");
      setGruplar(data || []);
    })();
  }, [secBirim?.id]);

  // Başlık: atanan yere göre -> yalnız site ise "Site Başkanı", yalnız bölge ise baslik ("Sorumlu")
  const unvan = birimler == null ? baslik : (() => {
    const site = birimler.some((b) => b.tip === "site");
    const bolge = birimler.some((b) => b.tip === "bolge");
    if (site && !bolge) return "Site Başkanı";
    if (site && bolge) return "Saha Sorumlusu";
    return baslik;
  })();

  return (
    <div className="app saha">
      <header className="saha-bar">
        <div className="brand"><div className="logo"><Crown size={18} /></div>
          <div><div className="brand-t">{unvan} Paneli</div>
            <div className="brand-s">{profil.ad_soyad || session.user.email}</div></div></div>
        <button className="btn cikis" onClick={() => cikisYap()}><LogOut size={14} /> Çıkış</button>
      </header>
      <main className="main">
        <div className="page">
          {birimler === null ? <div className="merkez">Yükleniyor…</div>
            : birimler.length === 0 ? (
              <div className="bos-modul"><UserCheck size={34} />
                <h3>Henüz size bir yer atanmadı</h3>
                <p>İlçe/il yönetimi size bir bölge ya da site atadığında burada görünecek.</p></div>
            ) : secBirim ? (
              <>
                {birimler.length > 1 && (
                  <div className="crumb"><a onClick={() => setSecBirim(null)}>Atananlarım</a>
                    <ChevronRight size={14} /><span className="cur">{secBirim.kod}</span></div>
                )}
                {secBirim.tip === "bolge" && gruplar.length === 0 && (
                  <div className="panel" style={{ marginBottom: 14, fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a" }}>
                    Bu bölge henüz gruplara bölünmemiş — ekip kurmadan önce yönetim/ilçe bölmesi gerekir.
                  </div>
                )}
                {secBirim.tip === "bolge" && gruplar.map((g) => (
                  <SokakYonetim key={g.id} grup={g} userId={session.user.id} duzenle={true} />
                ))}
                <Haneler birim={secBirim} userId={session.user.id} />
              </>
            ) : (
              <>
                <div className="head"><div><h2 className="disp">Atananlarım</h2>
                  <div className="sub">{birimler.length} yer atandı</div></div></div>
                <div className="panel"><div className="cards">
                  {birimler.map((b) => (
                    <div key={b.tip + b.id} className="card" onClick={() => setSecBirim(b)}>
                      <div className="card-t">{b.kod} <ChevronRight size={15} /></div>
                      <div style={{ marginBottom: 6 }}>
                        <span className={"tip-tag " + (b.tip === "site" ? "site" : "sokak")}>
                          {b.tip === "site" ? <Building2 size={11} /> : <Map size={11} />}
                          {b.tip === "site" ? "Site" : "Bölge"}
                        </span>
                      </div>
                      <div className="card-kapsam">{b.kapsam || "—"}</div>
                    </div>
                  ))}
                </div></div>
              </>
            )}
        </div>
      </main>
    </div>
  );
}
