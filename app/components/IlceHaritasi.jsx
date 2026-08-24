"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { hataMetni } from "../../lib/hata";
import { fmt } from "../../lib/format";
import { tumSatirlar } from "../../lib/sayfali";

/* İlçe sınırı + mahalle bazlı ziyaret ısı haritası.

   Sınırlar public/harita/<ilce>-sinir.json dosyasından gelir (OpenStreetMap,
   ODbL). Harita kütüphanesi KULLANILMAZ: GeoJSON doğrudan SVG path'e çevrilir.
   Böylece tile sunucusu, API anahtarı ve ek bağımlılık gerekmez; PWA çevrimdışı
   açıldığında da çalışır.

   Renk = o mahallede ziyaret edilen hane oranı. Veri v_rapor_sokak'tan gelir
   (sokak başına toplam/edilen) ve mahalle bazında toplanır.

   NOT: ilçe/sokak/bina bazlı GERÇEK nokta ısı haritası için hane koordinatı
   gerekiyor; veritabanında henüz yok (sokak.lat/lng 1012 satırın 0'ında dolu,
   kapi_nokta tablosu boş). Bu yüzden şimdilik mahalle poligonu boyanıyor. */

// Oran (%) → renk. İlk kademe "hiç ziyaret yok" için ayrı tutulur ki
// tek bir ziyaret bile haritada görünsün.
const KADEMELER = [
  { alt: 50, renk: "#9a3412", etiket: "%50 ve üzeri" },
  { alt: 30, renk: "#c2410c", etiket: "%30 – 50" },
  { alt: 15, renk: "#ea580c", etiket: "%15 – 30" },
  { alt: 5, renk: "#f59e0b", etiket: "%5 – 15" },
  { alt: 1, renk: "#fbbf24", etiket: "%1 – 5" },
  { alt: 0.0001, renk: "#fde68a", etiket: "%1'in altı" },
  { alt: -1, renk: "#eef2f7", etiket: "ziyaret yok" },
];
const VERI_YOK = "#f8fafc";

const renkBul = (oran) => (KADEMELER.find((k) => oran > k.alt) || KADEMELER[KADEMELER.length - 1]).renk;

/* ---- GeoJSON → SVG ---- */

function sinirKutusu(geoler) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const gez = (c) => {
    if (typeof c[0] === "number") {
      if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
      if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
      return;
    }
    c.forEach(gez);
  };
  geoler.forEach((g) => gez(g.coordinates));
  return [x0, y0, x1, y1];
}

// Enlem-boylam düzlemsel izdüşüm. İlçe ölçeğinde (~15 km) sapma göz ardı
// edilebilir; boylam ekseni cos(enlem) ile daraltılır ki şekil yassılmasın.
function izdusumKur(kutu, en, boy, pay) {
  const [x0, y0, x1, y1] = kutu;
  const kx = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const genislik = (x1 - x0) * kx || 1;
  const yukseklik = (y1 - y0) || 1;
  const olcek = Math.min((en - 2 * pay) / genislik, (boy - 2 * pay) / yukseklik);
  const kaydirX = pay + (en - 2 * pay - genislik * olcek) / 2;
  const kaydirY = pay + (boy - 2 * pay - yukseklik * olcek) / 2;
  return ([lon, lat]) => [
    kaydirX + (lon - x0) * kx * olcek,
    kaydirY + (y1 - lat) * olcek, // SVG'de y aşağı doğru artar
  ];
}

function halkaYolu(halka, izdusum) {
  let d = "";
  for (let i = 0; i < halka.length; i++) {
    const [x, y] = izdusum(halka[i]);
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d + "Z";
}

function geometriYolu(geo, izdusum) {
  const poligonlar = geo.type === "MultiPolygon" ? geo.coordinates : [geo.coordinates];
  return poligonlar.map((p) => p.map((halka) => halkaYolu(halka, izdusum)).join("")).join("");
}

// Etiket için: en büyük halkanın ağırlık merkezi
function etiketNoktasi(geo, izdusum) {
  const poligonlar = geo.type === "MultiPolygon" ? geo.coordinates : [geo.coordinates];
  let enBuyuk = null, enCok = -1;
  poligonlar.forEach((p) => { if (p[0].length > enCok) { enCok = p[0].length; enBuyuk = p[0]; } });
  if (!enBuyuk) return null;
  let sx = 0, sy = 0;
  enBuyuk.forEach((n) => { const [x, y] = izdusum(n); sx += x; sy += y; });
  return [sx / enBuyuk.length, sy / enBuyuk.length];
}

const EN = 900, BOY = 620, PAY = 16;

export default function IlceHaritasi({ ilceId, ilceAd, dosya = "/harita/basaksehir-sinir.json", onMahalleSec, konutsuzGoster = false }) {
  const [sinir, setSinir] = useState(null);   // { ilce, mahalleler, lisans }
  const [istatistik, setIstatistik] = useState(null); // { [mahalleAdı]: { id, hane, edilen } }
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [uzerinde, setUzerinde] = useState(null); // { ad, hane, edilen, oran, x, y }
  const kapsayici = useRef(null);

  // 1) Sınır dosyası
  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const r = await fetch(dosya);
        if (!r.ok) throw new Error(`Sınır dosyası bulunamadı (${r.status}).`);
        const j = await r.json();
        if (!iptal) setSinir(j);
      } catch (e) {
        if (!iptal) setHata(hataMetni(e, "Harita sınırları yüklenemedi."));
      }
    })();
    return () => { iptal = true; };
  }, [dosya]);

  // 2) Mahalle bazlı hane sayısı + ziyaret sayısı
  //
  // Buradaki kaynak seçimi bilinçli. İlk sürüm v_rapor_sokak kullanıyordu ve
  // açılış ~1,2 saniye sürüyordu: o view her çağrıda 125.662 hanenin tamamını
  // sıralayıp sokak bazında grupluyor, sıralama belleğe sığmadığı için 11 MB'ı
  // diske yazıyor — hepsi 10 sayı üretmek için. Yerine:
  //   · hane sayısı  → mv_mahalle_ozet (materialized, ~0,7 ms)
  //   · ziyaret      → ziyaret tablosundan hane'ye pk index'iyle (~28 ms)
  // Ölçüldü: ~1.240 ms → ~29 ms.
  //
  // Ziyaret sorgusu ziyaret başına bir satır döndürür; bugün 18 satır. Satır
  // sayısı on binleri bulursa mahalle bazında hazır özet (materialized view)
  // gerekir — o zamana kadar sayfalı çekmek yeterli. tumSatirlar() şart:
  // PostgREST 1000 satırda HATA VERMEDEN keser, bu projede aynı tuzağa daha
  // önce düşülmüş (bkz. lib/sayfali.js).
  useEffect(() => {
    if (!ilceId) return;
    let iptal = false;
    setYukleniyor(true);
    (async () => {
      try {
        const [mR, ziyaretler] = await Promise.all([
          supabase.from("mv_mahalle_ozet").select("mahalle_id, ad, hane").eq("ilce_id", ilceId),
          tumSatirlar((bas, son) =>
            supabase.from("ziyaret").select("hane_id, hane!inner(mahalle_id)", { count: "exact" })
              .eq("ilce_id", ilceId).eq("durum", "ziyaret_edildi").order("id").range(bas, son)),
        ]);
        if (mR.error) throw mR.error;

        // Aynı haneye birden fazla ziyaret olabilir; hane bazında tekilleştir.
        const edilenHane = {};
        (ziyaretler || []).forEach((z) => {
          const mid = z.hane?.mahalle_id;
          if (!mid || !z.hane_id) return;
          (edilenHane[mid] ||= new Set()).add(z.hane_id);
        });

        // Ada göre anahtarlanır (sınır dosyasıyla eşleşsin diye) ama mahalle_id
        // de saklanır: tıklamada id geri verilir, çağıran taraf adı aramaz.
        const toplu = {};
        (mR.data || []).forEach((m) => {
          toplu[m.ad] = { id: m.mahalle_id, hane: Number(m.hane) || 0, edilen: edilenHane[m.mahalle_id]?.size || 0 };
        });
        if (!iptal) { setIstatistik(toplu); setYukleniyor(false); }
      } catch (e) {
        if (!iptal) { setHata(hataMetni(e, "Ziyaret verisi yüklenemedi.")); setYukleniyor(false); }
      }
    })();
    return () => { iptal = true; };
  }, [ilceId]);

  const cizim = useMemo(() => {
    if (!sinir) return null;
    const kutu = sinirKutusu([sinir.ilce.geometry]);
    const izdusum = izdusumKur(kutu, EN, BOY, PAY);
    return {
      ilceYolu: geometriYolu(sinir.ilce.geometry, izdusum),
      mahalleler: sinir.mahalleler.features.map((f) => ({
        ad: f.properties.ad,
        // Konutsuz alanlar (organize sanayi bölgesi gibi) taralı çizilir; boş
        // beyaz bırakılırsa "ziyaret edilmemiş" gibi okunuyor.
        konut: f.properties.konut !== false,
        aciklama: f.properties.aciklama || null,
        yol: geometriYolu(f.geometry, izdusum),
        etiket: etiketNoktasi(f.geometry, izdusum),
      })),
    };
  }, [sinir]);

  const toplamlar = useMemo(() => {
    if (!istatistik) return null;
    return Object.values(istatistik).reduce((a, v) => ({ hane: a.hane + v.hane, edilen: a.edilen + v.edilen }), { hane: 0, edilen: 0 });
  }, [istatistik]);

  if (hata) return <div className="panel" style={{ color: "#b91c1c", fontSize: 13 }}>{hata}</div>;
  if (!cizim) return <div className="panel merkez" style={{ minHeight: 200 }}>Harita yükleniyor…</div>;

  // Konutsuz alanlar (organize sanayi bölgesi, askeri alan vb.) varsayılan
  // olarak çizilmez: seçmen yaşamadığı için ziyaret oranı anlamsız ve boş
  // renk "ihmal edilmiş bölge" gibi okunuyor. Zemin ilçe dolgusu kapatıyor.
  const gorunenler = konutsuzGoster ? cizim.mahalleler : cizim.mahalleler.filter((m) => m.konut);
  const gizlenenler = cizim.mahalleler.filter((m) => !m.konut);

  const oranHesap = (ad) => {
    const s = istatistik?.[ad];
    if (!s || !s.hane) return null;
    return (100 * s.edilen) / s.hane;
  };

  function uzerineGel(e, ad) {
    const kutu = kapsayici.current?.getBoundingClientRect();
    const s = istatistik?.[ad];
    const m = cizim.mahalleler.find((x) => x.ad === ad);
    setUzerinde({
      ad, hane: s?.hane ?? 0, edilen: s?.edilen ?? 0, oran: oranHesap(ad),
      aciklama: m?.aciklama || null,
      x: e.clientX - (kutu?.left || 0), y: e.clientY - (kutu?.top || 0),
    });
  }

  return (
    <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <b style={{ fontSize: 15 }}>{ilceAd || sinir.ilce.properties.ad} · Ziyaret Yoğunluğu</b>
          <div className="sub" style={{ fontSize: 12.5 }}>
            {toplamlar
              ? <>Mahalleler ziyaret edilen hane oranına göre renklendirildi · {fmt(toplamlar.edilen)} / {fmt(toplamlar.hane)} hane</>
              : "Ziyaret verisi yükleniyor…"}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {KADEMELER.slice().reverse().map((k) => (
            <span key={k.etiket} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569" }}>
              <span style={{ width: 13, height: 13, borderRadius: 3, background: k.renk, border: "1px solid #cbd5e1" }} />
              {k.etiket}
            </span>
          ))}
          {konutsuzGoster && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569" }}>
              <span style={{ width: 13, height: 13, borderRadius: 3, border: "1px solid #cbd5e1", background: "repeating-linear-gradient(45deg,#f1f5f9 0 3px,#dbe2ea 3px 6px)" }} />
              konut yok
            </span>
          )}
        </div>
      </div>

      <div ref={kapsayici} style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${EN} ${BOY}`} style={{ width: "100%", height: "auto", display: "block", background: "#fbfdff", borderRadius: 10 }}
          role="img" aria-label={`${ilceAd || ""} mahalle bazlı ziyaret yoğunluğu haritası`}>
          <defs>
            <pattern id="konutsuz" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="#f1f5f9" />
              <rect width="3.5" height="8" fill="#dbe2ea" />
            </pattern>
          </defs>
          {/* İlçe zemini: konutsuz alanlar çizilmediğinde ilçe sınırı içinde
              boşluk kalmasın diye önce tüm ilçe nötr bir zeminle doldurulur. */}
          <path d={cizim.ilceYolu} fill="#f4f7fa" stroke="none" pointerEvents="none" />
          {/* mahalleler */}
          {gorunenler.map((m) => {
            const oran = oranHesap(m.ad);
            const veriVar = istatistik && istatistik[m.ad];
            const secili = uzerinde?.ad === m.ad;
            return (
              <path key={m.ad} d={m.yol}
                fill={yukleniyor ? "#e5eaf0" : !m.konut ? "url(#konutsuz)" : veriVar ? renkBul(oran ?? 0) : VERI_YOK}
                stroke={secili ? "#0f172a" : "#94a3b8"} strokeWidth={secili ? 2 : 0.8}
                style={{ cursor: onMahalleSec && veriVar ? "pointer" : "default", transition: "fill .15s" }}
                onMouseMove={(e) => uzerineGel(e, m.ad)}
                onMouseLeave={() => setUzerinde(null)}
                onClick={() => veriVar && onMahalleSec && onMahalleSec(veriVar.id, m.ad)}>
                <title>{m.ad}{m.aciklama ? ` — ${m.aciklama}` : ""}</title>
              </path>
            );
          })}
          {/* ilçe sınırı en üstte */}
          <path d={cizim.ilceYolu} fill="none" stroke="#1e293b" strokeWidth="2.2" strokeLinejoin="round" pointerEvents="none" />
          {/* mahalle adları */}
          {gorunenler.map((m) => m.etiket && (
            <text key={"t" + m.ad} x={m.etiket[0]} y={m.etiket[1]} textAnchor="middle" pointerEvents="none"
              style={{ fontSize: 12, fontWeight: 700, fill: "#0f172a", paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3, strokeLinejoin: "round" }}>
              {m.ad}
            </text>
          ))}
        </svg>

        {uzerinde && (
          <div style={{
            position: "absolute", left: Math.min(uzerinde.x + 14, (kapsayici.current?.clientWidth || 600) - 190), top: uzerinde.y + 14,
            background: "#0f172a", color: "#fff", padding: "8px 11px", borderRadius: 8, fontSize: 12.5,
            pointerEvents: "none", minWidth: 170, boxShadow: "0 6px 20px rgba(15,23,42,.25)",
          }}>
            <b>{uzerinde.ad}</b>
            {yukleniyor
              ? <div style={{ opacity: .75, marginTop: 3 }}>Ziyaret verisi yükleniyor…</div>
              : uzerinde.oran === null
              ? <div style={{ opacity: .75, marginTop: 3 }}>{uzerinde.aciklama || "Bu mahallede hane verisi yok"}</div>
              : <div style={{ marginTop: 3, opacity: .9, lineHeight: 1.5 }}>
                  {fmt(uzerinde.hane)} hane<br />
                  {fmt(uzerinde.edilen)} ziyaret · <b>%{uzerinde.oran.toFixed(1)}</b>
                </div>}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 10.5, color: "#94a3b8", marginTop: 8 }}>
        <span>{!konutsuzGoster && gizlenenler.length > 0
          && `${gizlenenler.map((m) => m.ad).join(", ")} konut bulunmadığı için haritada gösterilmiyor.`}</span>
        <span>Sınır verisi © OpenStreetMap katkıcıları · ODbL 1.0</span>
      </div>
    </div>
  );
}
