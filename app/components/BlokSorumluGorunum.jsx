"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../../lib/supabase";
import { cikisYap } from "../../lib/oturum";
import { cacheOku, cacheYaz } from "../../lib/cache";
import { LogOut, UserCheck } from "lucide-react";
import { blokParts, normBlok } from "../../lib/format";
import { tumSatirlar } from "../../lib/sayfali";
import { BLOK_ROL_AD, SITE_YK_AD, SITE_YK_LISTE } from "../../lib/constants";
const Haneler = dynamic(() => import("./Haneler"), { ssr: false, loading: () => <div className="merkez">Yükleniyor…</div> });

export default function BlokSorumluGorunum({ session, profil }) {
  const [site, setSite] = useState(null);
  const [haneIds, setHaneIds] = useState(null);
  const [hata, setHata] = useState(null);
  const ykRol = SITE_YK_LISTE.some(([r]) => r === profil.rol); // Site YK görevi (blok yok, site geneli)
  // Site geneli mod: YK rolü, VEYA blok rolü olup henüz blok atanmamış (site geneli görevli).
  const siteGeneli = ykRol || !profil.blok;
  useEffect(() => {
    const snapAnahtar = `bloksorumlu:${session.user.id}`;
    const snap = cacheOku(snapAnahtar);
    if (snap) { setSite(snap.site || null); setHaneIds(snap.haneIds || []); } // ANINDA
    (async () => {
      if (!profil.site_kayit_id) {
        setHata("Hesabınıza henüz bir site bağlanmamış. Yönetim sizi bir siteye atadığında veriler burada görünecek.");
        setHaneIds([]); return;
      }
      // Site geneli mod (YK veya bloğu atanmamış kademe): bloğa gerek yok, tüm site.
      const { data: s } = await supabase.from("site_kayit").select("*").eq("id", profil.site_kayit_id).single();
      if (siteGeneli) {
        setSite(s); setHaneIds([]); setHata(null);
        cacheYaz(snapAnahtar, { site: s, haneIds: [] });
        return;
      }
      // En büyük sitede 4.802 hane var; sayfalanmadan çekilince blok
      // görevlisinin hane listesi 1000'de kesiliyordu.
      const hs = await tumSatirlar((bas, son) => supabase.from("hane")
        .select("id, kapi_blok", { count: "exact" })
        .eq("site_kayit_id", profil.site_kayit_id).order("id").range(bas, son));
      const want = blokParts(profil.blok);
      const ids = (hs || []).filter((h) => want.includes(normBlok(h.kapi_blok))).map((h) => h.id);
      setSite(s); setHaneIds(ids); setHata(null);
      cacheYaz(snapAnahtar, { site: s, haneIds: ids });
    })();
  }, [profil.site_kayit_id, profil.blok, siteGeneli]);

  const blokAd = blokParts(profil.blok).join(", ");
  const unvan = ykRol ? (SITE_YK_AD[profil.rol] || "Site Görevlisi") : (BLOK_ROL_AD[profil.rol] || "Blok Görevlisi");
  return (
    <div className="app saha">
      <header className="saha-bar">
        <div className="brand"><div className="logo"><UserCheck size={18} /></div>
          <div><div className="brand-t">{unvan} · {profil.ad_soyad || session.user.email}</div>
            <div className="brand-s">{site ? (siteGeneli ? site.ad : `${site.ad} · ${blokAd} Blok`) : "Saha Teşkilatı"}</div></div></div>
        <button className="btn cikis" onClick={() => cikisYap()}><LogOut size={14} /> Çıkış</button>
      </header>
      <main className="main"><div className="page">
        {hata ? <div className="merkez">{hata}</div>
          : haneIds === null ? <div className="merkez">Yükleniyor…</div>
            : siteGeneli ? (
              <>
                <div className="head"><div><h2 className="disp">{site?.ad || "Site"}</h2>
                  <div className="sub">{unvan} — sitenizin tüm hanelerini görüp ziyaret planı yaparsınız</div></div></div>
                <Haneler
                  birim={{ tip: "site", id: profil.site_kayit_id, kod: site?.ad || "", mahalleAd: "",
                    kapsam: `${site?.blok_sayisi ?? "?"} blok · ${site?.daire_sayisi ?? "?"} daire${site?.adres ? " · " + site.adres : ""}` }}
                  userId={session.user.id} />
              </>
            ) : (<>
              <div className="head"><div><h2 className="disp">{blokAd} Blok</h2>
                <div className="sub">{site?.ad || ""} — {blokParts(profil.blok).length > 1 ? "bloklarındaki" : "bloğundaki"} haneleri görüp ziyaret planı yaparsın</div></div></div>
              {haneIds.length === 0
                ? <div className="merkez">Bu blokta hane bulunamadı.</div>
                : <Haneler
                    birim={{ tip: "site", id: profil.site_kayit_id, kod: `${site?.ad || ""} · ${blokAd} Blok`, kapsam: `${blokAd} Blok · ${haneIds.length} hane` }}
                    userId={session.user.id} haneIds={haneIds} />}
            </>)}
      </div></main>
    </div>
  );
}

/* ===================== KOORDİNATÖR GÖRÜNÜMÜ ===================== */
