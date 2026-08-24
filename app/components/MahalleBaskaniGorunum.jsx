"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { cikisYap } from "../../lib/oturum";
import { ChevronRight, LogOut, MapPin } from "lucide-react";
import Bolgeler from "./Bolgeler";
import Haneler from "./Haneler";
import GrupDetay from "./GrupDetay";
import Siteler from "./Siteler";

/* Mahalle Başkanı görünümü (login)
   - profiles.mahalle_id ile atandığı TEK mahalleye kilitli
   - o mahallenin bölgelerini, hanelerini, kişilerini ve demografisini görür
   - DUZENLE=false → salt-okunur (izleme). true yaparsan kendi mahallesinde
     sorumlu ataması / sokak bölme / ziyaret girişi de açılır. */
export default function MahalleBaskaniGorunum({ session, profil }) {
  const DUZENLE = false; // ← yönetim yetkisi için true yap

  const [mahalle, setMahalle] = useState(undefined); // undefined=yükleniyor · null=atanmamış
  const [secBolge, setSecBolge] = useState(null);
  const [secGrup, setSecGrup] = useState(null);
  const [tab, setTab] = useState("sokaklar"); // site-tipi mahallede: sokaklar | siteler
  const [siteSay, setSiteSay] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("profiles").select("mahalle_id").eq("id", session.user.id).single();
      const mid = p?.mahalle_id;
      if (!mid) { setMahalle(null); return; }
      const { data: mo } = await supabase.from("mv_mahalle_ozet").select("mahalle_id, ad, tip").eq("mahalle_id", mid).single();
      setMahalle(mo ? { id: mo.mahalle_id, ad: mo.ad, tip: mo.tip || "sokak" } : { id: mid, ad: "Mahallem", tip: "sokak" });
    })();
  }, [session.user.id]);

  // site-tipi olmayan mahallede gizli site var mı (Siteler sekmesi rozeti)
  useEffect(() => {
    if (!mahalle || mahalle.tip === "site") { setSiteSay(0); return; }
    (async () => {
      const { count } = await supabase.from("site_kayit").select("id", { count: "exact", head: true }).eq("mahalle_id", mahalle.id);
      setSiteSay(count || 0);
    })();
  }, [mahalle?.id]);

  const cikis = () => cikisYap();

  const Bar = ({ alt }) => (
    <header className="saha-bar">
      <div className="brand"><div className="logo"><MapPin size={18} /></div>
        <div><div className="brand-t">Mahalle Başkanı · {profil.ad_soyad || session.user.email}</div>
          <div className="brand-s">{alt}</div></div></div>
      <button className="btn cikis" onClick={cikis}><LogOut size={14} /> Çıkış</button>
    </header>
  );

  if (mahalle === undefined) return <div className="app saha"><Bar alt="Saha Teşkilatı" /><main className="main"><div className="merkez">Yükleniyor…</div></main></div>;
  if (mahalle === null) return (
    <div className="app saha"><Bar alt="Saha Teşkilatı" />
      <main className="main"><div className="page"><div className="merkez">
        Henüz bir mahalleye atanmadınız. Yönetim sizi bir mahalleye bağladığında burada görünür.
      </div></div></main></div>
  );

  // mahalle objesi Bolgeler'e giderken salt-okunur bayrağı taşır (böl butonunu gizlemek için)
  const mahalleObj = { ...mahalle, salt: !DUZENLE };

  return (
    <div className="app saha">
      <Bar alt={mahalle.ad} />
      <main className="main"><div className="page">
        <div className="crumb">
          <a onClick={() => { setSecBolge(null); setSecGrup(null); }}>{mahalle.ad}</a>
          {secBolge && <><ChevronRight size={14} />{secGrup
            ? <a onClick={() => setSecGrup(null)}>{secBolge.kod}</a>
            : <span className="cur">{secBolge.kod}</span>}</>}
          {secBolge && secGrup && <><ChevronRight size={14} /><span className="cur">{secBolge.kod}-{secGrup.no}</span></>}
        </div>

        {!secBolge && mahalle.tip === "site" && (
          <Siteler profil={profil} sabitMahalle={{ mahalle_id: mahalle.id, ad: mahalle.ad }} salt={!DUZENLE} />
        )}

        {!secBolge && mahalle.tip !== "site" && siteSay > 0 && (
          <div className="mah-tabs">
            <button className={tab === "sokaklar" ? "mt act" : "mt"} onClick={() => setTab("sokaklar")}>Sokaklar</button>
            <button className={tab === "siteler" ? "mt act" : "mt"} onClick={() => setTab("siteler")}>Siteler <span className="mt-bdg">{siteSay}</span></button>
          </div>
        )}

        {!secBolge && mahalle.tip !== "site" && (tab === "siteler" && siteSay > 0
          ? <Siteler profil={profil} sabitMahalle={{ mahalle_id: mahalle.id, ad: mahalle.ad }} salt={!DUZENLE} />
          : <Bolgeler mahalle={mahalleObj}
              onSec={(b) => { setSecBolge(b); setSecGrup(null); }}
              onSecGrup={(b, g) => { setSecBolge(b); setSecGrup(g); }} />
        )}

        {secBolge && !secGrup && (
          <Haneler birim={{ tip: "bolge", ...secBolge, mahalleAd: mahalle.ad }}
            userId={session.user.id} yonetici={DUZENLE} planla={DUZENLE} onGrupSec={setSecGrup} />
        )}
        {secBolge && secGrup && (
          <GrupDetay bolge={secBolge} grup={secGrup} userId={session.user.id} yonetici={DUZENLE} />
        )}
      </div></main>
    </div>
  );
}
