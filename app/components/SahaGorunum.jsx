"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { ChevronRight, LogOut, UserCheck, Crown } from "lucide-react";
import Haneler from "./Haneler";

export default function SahaGorunum({ session, profil, alan, baslik }) {
  const [bolgeler, setBolgeler] = useState(null);
  const [secBolge, setSecBolge] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bolge")
        .select("id, kod, kapsam, mahalle_id").eq(alan, session.user.id).order("kod");
      const liste = data || [];
      setBolgeler(liste);
      if (liste.length === 1) setSecBolge(liste[0]);
    })();
  }, []);

  return (
    <div className="app saha">
      <header className="saha-bar">
        <div className="brand"><div className="logo"><Crown size={18} /></div>
          <div><div className="brand-t">{baslik} Paneli</div>
            <div className="brand-s">{profil.ad_soyad || session.user.email}</div></div></div>
        <button className="btn cikis" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> Çıkış</button>
      </header>
      <main className="main">
        <div className="page">
          {bolgeler === null ? <div className="merkez">Yükleniyor…</div>
            : bolgeler.length === 0 ? (
              <div className="bos-modul"><UserCheck size={34} />
                <h3>Henüz size bölge atanmadı</h3>
                <p>İlçe/il yönetimi size bir bölge atadığında burada görünecek.</p></div>
            ) : secBolge ? (
              <>
                {bolgeler.length > 1 && (
                  <div className="crumb"><a onClick={() => setSecBolge(null)}>Bölgelerim</a>
                    <ChevronRight size={14} /><span className="cur">{secBolge.kod}</span></div>
                )}
                <Haneler birim={{ tip: "bolge", ...secBolge }} userId={session.user.id} />
              </>
            ) : (
              <>
                <div className="head"><div><h2 className="disp">Bölgelerim</h2>
                  <div className="sub">{bolgeler.length} bölge atandı</div></div></div>
                <div className="panel"><div className="cards">
                  {bolgeler.map((b) => (
                    <div key={b.id} className="card" onClick={() => setSecBolge(b)}>
                      <div className="card-t">{b.kod} <ChevronRight size={15} /></div>
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
