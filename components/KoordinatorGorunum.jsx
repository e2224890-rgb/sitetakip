"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { ShieldCheck, ChevronRight, LogOut, Home, Map, CheckCircle2, Crown } from "lucide-react";
import { fmt, oran } from "../../lib/format";
import Haneler from "./Haneler";
import StatCard from "./StatCard";

export default function KoordinatorGorunum({ session, profil }) {
  const [bolgeler, setBolgeler] = useState(null);
  const [mahAd, setMahAd] = useState("");
  const [secBolge, setSecBolge] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: bs } = await supabase.from("bolge")
        .select("id, kod, kapsam, mahalle_id, sorumlu_id").eq("koordinator_id", session.user.id).order("kod");
      const liste = bs || [];
      // mahalle adı
      if (liste.length) {
        const { data: m } = await supabase.from("mahalle").select("ad").eq("id", liste[0].mahalle_id).single();
        setMahAd(m?.ad || "");
      }
      // sorumlu adları
      const sIds = [...new Set(liste.map((b) => b.sorumlu_id).filter(Boolean))];
      let adMap = {};
      if (sIds.length) {
        const { data: ps } = await supabase.from("profiles").select("id, ad_soyad, eposta").in("id", sIds);
        (ps || []).forEach((p) => adMap[p.id] = p.ad_soyad || p.eposta);
      }
      // her bölge için sayımlar
      const zenginler = await Promise.all(liste.map(async (b) => {
        const [h, k, u, z] = await Promise.all([
          supabase.from("hane").select("*", { count: "exact", head: true }).eq("bolge_id", b.id),
          supabase.from("kisi").select("*", { count: "exact", head: true }).eq("bolge_id", b.id),
          supabase.from("kisi").select("*", { count: "exact", head: true }).eq("bolge_id", b.id).eq("uye", true),
          supabase.from("ziyaret").select("*", { count: "exact", head: true }).eq("bolge_id", b.id).eq("durum", "ziyaret_edildi"),
        ]);
        return { ...b, sorumluAd: adMap[b.sorumlu_id] || "—", hane: h.count || 0, kisi: k.count || 0, uye: u.count || 0, ziyaret: z.count || 0 };
      }));
      setBolgeler(zenginler);
    })();
  }, [session.user.id]);

  const t = useMemo(() => {
    const l = bolgeler || [];
    return {
      sokak: l.length,
      hane: l.reduce((a, b) => a + b.hane, 0),
      kisi: l.reduce((a, b) => a + b.kisi, 0),
      uye: l.reduce((a, b) => a + b.uye, 0),
      ziyaret: l.reduce((a, b) => a + b.ziyaret, 0),
    };
  }, [bolgeler]);

  const ilerlemeRenk = (p) => p >= 80 ? "var(--ok)" : p >= 50 ? "var(--accent)" : "#c0392b";

  if (secBolge) {
    return (
      <div className="app saha"><header className="saha-bar">
        <div className="brand"><div className="logo"><Crown size={18} /></div>
          <div><div className="brand-t">Koordinatör · {profil.ad_soyad || ""}</div>
            <div className="brand-s">{mahAd}</div></div></div>
        <button className="btn cikis" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> Çıkış</button>
      </header>
      <main className="main"><div className="page">
        <div className="crumb"><a onClick={() => setSecBolge(null)}>Sokaklarım</a>
          <ChevronRight size={14} /><span className="cur">{secBolge.kod}</span></div>
        <Haneler birim={{ tip: "bolge", ...secBolge }} userId={session.user.id} planla />
      </div></main></div>
    );
  }

  return (
    <div className="app saha">
      <header className="saha-bar">
        <div className="brand"><div className="logo"><Crown size={18} /></div>
          <div><div className="brand-t">Koordinatör · {profil.ad_soyad || session.user.email}</div>
            <div className="brand-s">{mahAd}</div></div></div>
        <button className="btn cikis" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> Çıkış</button>
      </header>
      <main className="main"><div className="page">
        {bolgeler === null ? <div className="merkez">Yükleniyor…</div>
          : bolgeler.length === 0 ? (
            <div className="bos-modul"><Crown size={34} />
              <h3>Henüz size sokak (bölge) atanmadı</h3>
              <p>İlçe/il yönetimi size bölge atadığında burada görünecek.</p></div>
          ) : (
            <>
              <div className="koor-hero">
                <div className="hero-ic"><Crown size={26} /></div>
                <div><div className="hero-k">AK PARTİ · SOKAK KOORDİNATÖRÜ</div>
                  <div className="koor-ad">{profil.ad_soyad || session.user.email}{profil.meslek ? " · " + profil.meslek : ""}</div></div>
                <div className="koor-mah">{(mahAd || "").toLocaleUpperCase("tr")}</div>
              </div>
              <div className="head"><div><h2 className="disp">{mahAd}</h2>
                <div className="sub">1 koordinatör grubu · {t.sokak} sokak · sorumlularını izlersin</div></div>
                <span className="tag"><Crown size={13} /> {profil.ad_soyad || "Koordinatör"}</span></div>

              <div className="grid-stats">
                <StatCard ic={<Map size={15} />} lbl="Sokak" num={fmt(t.sokak)} meta="sorumlu olunan bölge" renk="#9333ea" />
                <StatCard ic={<Home size={15} />} lbl="Hane" num={fmt(t.hane)} meta={`${fmt(t.kisi)} seçmen`} renk="#2563eb" />
                <StatCard ic={<CheckCircle2 size={15} />} lbl="Ziyaret Edilen" num={fmt(t.ziyaret)} meta={`%${oran(t.ziyaret, t.hane)} tamamlandı`} renk="#16a34a" />
                <StatCard ic={<ShieldCheck size={15} />} lbl="AK Parti Üye" num={fmt(t.uye)} meta={`%${oran(t.uye, t.kisi)} oran`} />
              </div>

              <div className="panel">
                <div className="panel-h"><h3>Sorumlu olduğum sokaklar</h3></div>
                <table className="htable">
                  <thead><tr><th>KOD</th><th>SOKAK / KAPSAM</th><th>SOKAK BAŞKANI</th><th className="sag">HANE</th><th>İLERLEME</th></tr></thead>
                  <tbody>
                    {bolgeler.map((b) => {
                      const p = oran(b.ziyaret, b.hane);
                      return (
                        <tr key={b.id} className="tik" onClick={() => setSecBolge(b)} style={{ cursor: "pointer" }}>
                          <td><span className="kodtag">{b.kod}</span></td>
                          <td className="dim">{b.kapsam || "—"}</td>
                          <td>{b.sorumluAd}</td>
                          <td className="sag mono">{b.ziyaret}/{b.hane}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div className="bar" style={{ flex: 1, maxWidth: 120 }}>
                                <i style={{ width: `${p}%`, background: ilerlemeRenk(p) }} /></div>
                              <span className="mono" style={{ color: ilerlemeRenk(p), fontWeight: 700, fontSize: 12 }}>%{p}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </div></main>
    </div>
  );
}

/* ===================== SAHA GÖRÜNÜMÜ (sorumlu/koordinatör) ===================== */
