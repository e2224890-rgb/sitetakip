"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../../lib/supabase";
import { cacheOku, cacheYaz } from "../../lib/cache";
import { LogOut, UserCheck } from "lucide-react";
import { blokParts, normBlok } from "../../lib/format";
import { BLOK_ROL_AD } from "../../lib/constants";
const Haneler = dynamic(() => import("./Haneler"), { ssr: false, loading: () => <div className="merkez">Yükleniyor…</div> });

export default function BlokSorumluGorunum({ session, profil }) {
  const [site, setSite] = useState(null);
  const [haneIds, setHaneIds] = useState(null);
  const [hata, setHata] = useState(null);
  useEffect(() => {
    const snapAnahtar = `bloksorumlu:${session.user.id}`;
    const snap = cacheOku(snapAnahtar);
    if (snap) { setSite(snap.site || null); setHaneIds(snap.haneIds || []); } // ANINDA
    (async () => {
      if (!profil.site_kayit_id || !profil.blok) {
        setHata("Hesabınıza henüz bir site/blok bağlanmamış. Yönetim sizi bir bloğa atadığında haneler burada görünecek.");
        setHaneIds([]); return;
      }
      const [{ data: s }, { data: hs }] = await Promise.all([
        supabase.from("site_kayit").select("*").eq("id", profil.site_kayit_id).single(),
        supabase.from("hane").select("id, kapi_blok").eq("site_kayit_id", profil.site_kayit_id),
      ]);
      const want = blokParts(profil.blok);
      const ids = (hs || []).filter((h) => want.includes(normBlok(h.kapi_blok))).map((h) => h.id);
      setSite(s); setHaneIds(ids); setHata(null);
      cacheYaz(snapAnahtar, { site: s, haneIds: ids });
    })();
  }, [profil.site_kayit_id, profil.blok]);

  const blokAd = blokParts(profil.blok).join(", ");
  return (
    <div className="app saha">
      <header className="saha-bar">
        <div className="brand"><div className="logo"><UserCheck size={18} /></div>
          <div><div className="brand-t">{BLOK_ROL_AD[profil.rol] || "Blok Görevlisi"} · {profil.ad_soyad || session.user.email}</div>
            <div className="brand-s">{site ? `${site.ad} · ${blokAd} Blok` : "Saha Teşkilatı"}</div></div></div>
        <button className="btn cikis" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> Çıkış</button>
      </header>
      <main className="main"><div className="page">
        {hata ? <div className="merkez">{hata}</div>
          : haneIds === null ? <div className="merkez">Yükleniyor…</div>
            : (<>
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
