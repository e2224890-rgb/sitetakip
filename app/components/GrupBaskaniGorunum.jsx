"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { ChevronRight, LogOut, UserCheck } from "lucide-react";
import { fmt } from "../../lib/format";
import GrupDetay from "./GrupDetay";

export default function GrupBaskaniGorunum({ session, profil }) {
  const [gruplar, setGruplar] = useState(null);
  const [sec, setSec] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: gs } = await supabase.from("sokak_grup")
        .select("id, no, memleketler, baskan_ad, baskan_tel, baskan_memleket, baskan_id, bolge_id")
        .eq("baskan_id", session.user.id).order("no");
      const liste = gs || [];
      const bIds = [...new Set(liste.map((g) => g.bolge_id).filter(Boolean))];
      let bMap = {};
      if (bIds.length) {
        const { data: bs } = await supabase.from("bolge").select("id, kod, kapsam, mahalle_id").in("id", bIds);
        (bs || []).forEach((b) => bMap[b.id] = b);
      }
      const zengin = await Promise.all(liste.map(async (g) => {
        const bolge = bMap[g.bolge_id] || { kod: "?", kapsam: "" };
        const { data: hrows } = await supabase.from("hane").select("id").eq("grup_id", g.id);
        const haneIds = (hrows || []).map((h) => h.id);
        let ziyaret = 0;
        for (let i = 0; i < haneIds.length; i += 200) {
          const { count } = await supabase.from("ziyaret").select("*", { count: "exact", head: true }).in("hane_id", haneIds.slice(i, i + 200)).eq("durum", "ziyaret_edildi");
          ziyaret += count || 0;
        }
        return { ...g, bolge, hane: haneIds.length, ziyaret };
      }));
      setGruplar(zengin);
    })();
  }, [session.user.id]);

  if (sec) {
    return (
      <div className="app saha"><header className="saha-bar">
        <div className="brand"><div className="logo"><UserCheck size={18} /></div>
          <div><div className="brand-t">Grup Başkanı · {profil.ad_soyad || session.user.email}</div>
            <div className="brand-s">{sec.bolge.kod}-{sec.no}</div></div></div>
        <button className="btn cikis" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> Çıkış</button>
      </header>
        <main className="main"><div className="page">
          <div className="crumb"><a onClick={() => setSec(null)}>Grubum</a>
            <ChevronRight size={14} /><span className="cur">{sec.bolge.kod}-{sec.no}</span></div>
          <GrupDetay bolge={sec.bolge} grup={sec} userId={session.user.id} />
        </div></main></div>
    );
  }

  return (
    <div className="app saha">
      <header className="saha-bar">
        <div className="brand"><div className="logo"><UserCheck size={18} /></div>
          <div><div className="brand-t">Grup Başkanı · {profil.ad_soyad || session.user.email}</div>
            <div className="brand-s">Saha Teşkilatı</div></div></div>
        <button className="btn cikis" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> Çıkış</button>
      </header>
      <main className="main"><div className="page">
        <div className="head"><div><h2 className="disp">Grubum</h2>
          <div className="sub">Sana atanan grup — kişileri görüp ziyaret planı yaparsın</div></div></div>
        {gruplar === null ? <div className="merkez">Yükleniyor…</div>
          : gruplar.length === 0 ? <div className="merkez">Henüz bir gruba atanmadınız. Yönetim sizi bir gruba bağladığında burada görünür.</div>
            : (
              <div className="panel"><div className="cards">
                {gruplar.map((g) => {
                  const p = g.hane ? Math.round(g.ziyaret / g.hane * 100) : 0;
                  return (
                    <div key={g.id} className="card" onClick={() => setSec(g)}>
                      <div className="card-t">{g.bolge.kod}-{g.no} <ChevronRight size={15} /></div>
                      <div className="bolge-stat">
                        <span><b>{fmt(g.hane)}</b> hane</span>
                        <span><b>{fmt(g.ziyaret)}</b> ziyaret</span>
                        <span><b style={{ color: p >= 66 ? "var(--ok)" : "var(--accent2)" }}>%{p}</b></span>
                      </div>
                      <div className="card-kapsam">{(g.memleketler || []).slice(0, 4).join(" · ") || "—"}</div>
                      <div className="atama-chips"><span className="chip u">{g.bolge.kapsam || g.bolge.kod}</span></div>
                    </div>
                  );
                })}
              </div></div>
            )}
      </div></main>
    </div>
  );
}

/* ===================== BLOK SORUMLUSU GÖRÜNÜMÜ (login) ===================== */
