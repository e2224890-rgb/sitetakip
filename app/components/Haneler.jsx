"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { Users, FileText, Search, MapPin, CheckCircle2, Circle, Download, UserCheck, X } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {NUF_RENK, csvIndir, fmt, haneBaslik, oran, sokakAdres, yakRenk, epostaUret } from "../../lib/format";
import { yaklasimBilgi, YAKLASIM_LISTE } from "../../lib/constants";
import { cacheOku, cacheYaz } from "../../lib/cache";
import { tumSatirlar } from "../../lib/sayfali";
import GrupBaskanPanel from "./GrupBaskanPanel";
import EkipRozet from "./EkipRozet";
import SokakBolStrip from "./SokakBolStrip";
import Sorumlular from "./Sorumlular";
import ZiyaretModal from "./ZiyaretModal";
import { hataOnekli } from "../../lib/hata";

export default function Haneler({ birim, userId, yonetici, planla, onGrupSec, haneIds, grup }) {
  const isSite = birim.tip === "site";
  // Blok değeri — KEOS'tan gelen gerçek blok adı (ör. "B2") varsa onu kullan,
  // yoksa kütükteki alana düş. Filtre çipleri ile satır başlıkları böylece aynı olur.
  const blokDeger = (h) => String((h && (h.blok_ad || h.kapi_blok)) || "").trim();


  const tablo = isSite ? "site_kayit" : "bolge";
  const sorumluAlan = isSite ? "temsilci_id" : "sorumlu_id";
  const mapsHedef = (h) => {
    if (isSite) {
      const p = [h.adres, h.kapi_no ? "No " + h.kapi_no : null].filter(Boolean);
      return (p.length ? p.join(" ") : (birim.kod || "")).trim();
    }
    return sokakAdres(h.adres || h.no || "");
  };
  const mapsURL = (h) => {
    const ek = [birim.mahalleAd, birim.ilceAd].filter(Boolean).join(" ");
    const q = `${mapsHedef(h)}${ek ? " " + ek : ""} İstanbul`.replace(/\s+/g, " ").trim();
    return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q);
  };

  const [haneler, setHaneler] = useState(null);
  const [ara, setAra] = useState("");
  const [mesgul, setMesgul] = useState(null);
  const [hedefTarih, setHedefTarih] = useState("");
  const [sorumluId, setSorumluId] = useState(birim.sorumlu_id || "");
  const [koordId, setKoordId] = useState(birim.koordinator_id || "");
  const [profiller, setProfiller] = useState([]);
  const [atandi, setAtandi] = useState("");
  const [grupAd, setGrupAd] = useState(grup ? (grup.baskan_ad || "") : "");
  // --- Seçmenden Sokak Başkanı ata (hesap otomatik açılır) ---
  const [baskanMesgul, setBaskanMesgul] = useState(null); // atama sırasında kisi.id
  const [baskanModal, setBaskanModal] = useState(null);   // { asama:"onay"|"islem"|"sonuc"|"hata", ... }
  // "Başkan yap" tek tıkla giriş hesabı açıp rolü "sorumlu" yaptığı ve
  // bolge.sorumlu_id'yi değiştirdiği için SADECE il/ilçe yönetimine gösterilir.
  // Gevşek `yonetici` prop'una bağlanmaz: o prop düzenleme yetkisini temsil ediyor
  // ve başka bir ekrandan yanlışlıkla geçirilirse buton da sızardı. Rol burada
  // doğrudan okunur. (Sunucu tarafı ayrı korunmalı — bkz. sql/INCELEME C bölümü.)
  const BASKAN_ATAYAN_ROLLER = ["il_yonetimi", "ilce_yonetimi"];
  const [benimRol, setBenimRol] = useState(() => cacheOku(`profil:${userId}`)?.rol ?? null);
  useEffect(() => {
    if (!userId) return;
    let iptal = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("rol").eq("id", userId).single();
      if (!iptal) setBenimRol(data?.rol ?? null);
    })();
    return () => { iptal = true; };
  }, [userId]);
  const baskanAtayabilir = BASKAN_ATAYAN_ROLLER.includes(benimRol);
  const trSlug = (t) => (t || "").toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
  // Butondan: onay modalını aç
  function baskanYapAc(k, h) {
    const gid = grup?.id || h?.grup_id;
    if (!gid) { setBaskanModal({ asama: "hata", mesaj: "Bu kişinin hanesi bir sokak grubuna atanmamış. Önce sokağı gruplara bölün." }); return; }
    setBaskanModal({ asama: "onay", k, gid, ad: `${k.ad} ${k.soyad}`.trim() });
  }
  // Onaylandıktan sonra: hesabı aç + başkan ata
  async function baskanYapOnayla() {
    const m = baskanModal; if (!m || m.asama !== "onay") return;
    setBaskanModal({ ...m, asama: "islem" });
    try {
      const eposta = epostaUret(`${m.k.ad || ""} ${m.k.soyad || ""}`);
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/hesap-ekle", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          ad_soyad: m.ad, eposta, sifre: "saha2026", benzersizEposta: true, sifre_gecici: true,
          rol: "sorumlu", telefon: m.k.telefon || null,
          grup_id: m.gid, kisi_id: m.k.id, gorev: "baskan",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "atama başarısız");
      setGrupAd(m.ad);
      if (j.id && !grup) setSorumluId(j.id);   // bölge badge/dropdown yeni sorumluyu göstersin
      await profilleriYukle();                 // yeni sorumlu listeye girsin (ad çözülsün)
      yukle();                                 // hane/ekip verisini tazele (tam sayfa reload yok)
      setBaskanModal({ asama: "sonuc", ad: m.ad, eposta: j.eposta || eposta, sifre: "saha2026" });
    } catch (e) {
      setBaskanModal({ asama: "hata", mesaj: hataOnekli("Sokak başkanı atanamadı", e) });
    }
  }
  const [zModal, setZModal] = useState(null);
  const [digerAcik, setDigerAcik] = useState(false);
  const [nufBlok, setNufBlok] = useState("");
  const [gorunen, setGorunen] = useState(200); // aşamalı render: aynı anda kaç hane satırı çizilsin
  // "Haneler" başlığı yukarı kayınca ekranın üstünde aynı açıklama şeridini göster
  const basRef = useRef(null);
  const tabloRef = useRef(null);
  const [yapisik, setYapisik] = useState(null); // {left, width} | null
  useEffect(() => {
    function kontrol() {
      const b = basRef.current, t = tabloRef.current;
      if (!b || !t) { setYapisik(null); return; }
      const br = b.getBoundingClientRect(), tr = t.getBoundingClientRect();
      if (br.top < 4 && tr.bottom > 90) setYapisik({ left: br.left, width: br.width });
      else setYapisik(null);
    }
    kontrol();
    window.addEventListener("scroll", kontrol, true); // iç kapsayıcıların kaydırmasını da yakala
    window.addEventListener("resize", kontrol);
    return () => { window.removeEventListener("scroll", kontrol, true); window.removeEventListener("resize", kontrol); };
  }, [haneler, gorunen]);
  useEffect(() => { setGrupAd(grup ? (grup.baskan_ad || "") : ""); }, [grup ? grup.id : null]);

  useEffect(() => { setSorumluId(birim.sorumlu_id || ""); setKoordId(birim.koordinator_id || ""); }, [birim.id]);

  async function profilleriYukle() {
    const { data } = await supabase.from("profiles")
      .select("id, ad_soyad, eposta, rol").in("rol", ["sorumlu", "koordinator"]).order("ad_soyad");
    setProfiller(data || []);
  }
  useEffect(() => { profilleriYukle(); }, []);  // her görünümde yükle (mahalle başkanı sorumlu adını/ekibini görebilsin)

  const sorumlular = useMemo(() => profiller.filter((p) => p.rol === "sorumlu"), [profiller]);
  const koordinatorler = useMemo(() => profiller.filter((p) => p.rol === "koordinator"), [profiller]);
  const adById = useMemo(() => { const o = {}; profiller.forEach((p) => o[p.id] = p.ad_soyad || p.eposta); return o; }, [profiller]);

  async function ataAlan(alan, val, setter) {
    setter(val);
    const kolon = alan === "sorumlu_id" ? sorumluAlan : "koordinator_id";
    const { error } = await supabase.from(tablo).update({ [kolon]: val || null }).eq("id", birim.id);
    if (!error) { setAtandi(alan); setTimeout(() => setAtandi(""), 1200); }
  }

  async function parcaliKisi(table, sel, haneIds) {
    const chunks = [];
    for (let i = 0; i < haneIds.length; i += 200) chunks.push(haneIds.slice(i, i + 200));
    // 200 hanelik bir parça bile 1000 satırı aşabilir (5+ kişi/hane) -> her parça sayfalı çekilir.
    const res = await Promise.all(chunks.map((c) => tumSatirlar((bas, son) =>
      supabase.from(table).select(sel, { count: "exact" }).in("hane_id", c).order("id").range(bas, son))));
    return res.flat();
  }

  async function yukle() {
    // Stale-while-revalidate: aynı birimi ikinci açışta son bilinen veri ANINDA gelir, arka planda tazelenir.
    const haneCacheKey = `hane:${isSite ? "s" : "b"}:${birim.id}:${haneIds ? haneIds.length + "|" + (haneIds[0] ?? "") + "|" + (haneIds[haneIds.length - 1] ?? "") : "all"}`;
    const snap = cacheOku(haneCacheKey);
    if (snap && snap.length) setHaneler(snap); else setHaneler(null);
    try {
      // .order("no").order("id"): "no" tek başına benzersiz değil; sayfalar arasında
      // satır tekrarı/kaybı olmaması için id ile eşitlik bozulur.
      let hRows = await tumSatirlar((bas, son) => {
        const q = supabase.from("hane")
          .select("id, no, adres, kapi_no, kapi_blok, blok_ad, ilce_id, grup_id", { count: "exact" })
          .order("no").order("id").range(bas, son);
        return isSite ? q.eq("site_kayit_id", birim.id) : q.eq("bolge_id", birim.id).is("site_kayit_id", null);
      });
      if (haneIds) { const allow = new Set(haneIds); hRows = hRows.filter((h) => allow.has(h.id)); }
      const ids = (hRows || []).map((h) => h.id);
      let kRows = [], zRows = [], meta = null;
      if (isSite) {
        const [k, z, m] = await Promise.all([
          ids.length ? parcaliKisi("kisi", "id, ad, soyad, cinsiyet, telefon, uye, secmen, dogum_yili, hane_id, nufus_il", ids) : Promise.resolve([]),
          ids.length ? parcaliKisi("ziyaret", "hane_id, durum, not_, tarih, onceki_tarih, yaklasim, kapsam", ids) : Promise.resolve([]),
          supabase.from("site_kayit").select("hedef_tarih").eq("id", birim.id).single(),
        ]);
        kRows = k; zRows = z; meta = m.data;
      } else {
        const [k, z, m] = await Promise.all([
          tumSatirlar((bas, son) => supabase.from("kisi")
            .select("id, ad, soyad, cinsiyet, telefon, uye, secmen, dogum_yili, hane_id, nufus_il", { count: "exact" })
            .eq("bolge_id", birim.id).order("id").range(bas, son)),
          tumSatirlar((bas, son) => supabase.from("ziyaret")
            .select("hane_id, durum, not_, tarih, onceki_tarih, yaklasim, kapsam", { count: "exact" })
            .eq("bolge_id", birim.id).order("id").range(bas, son)),
          supabase.from("bolge").select("hedef_tarih").eq("id", birim.id).single(),
        ]);
        kRows = k; zRows = z; meta = m.data;
      }
      setHedefTarih(meta?.hedef_tarih || "");
      const kBy = {}; (kRows || []).forEach((k) => { (kBy[k.hane_id] ||= []).push(k); });
      const zBy = {}; (zRows || []).forEach((z) => { zBy[z.hane_id] = z; });
      const built = (hRows || []).map((h) => {
        const z = zBy[h.id] || {};
        return { ...h, kisiler: kBy[h.id] || [], ziyaret: z.durum === "ziyaret_edildi", not_: z.not_ || "", tarih: z.tarih || null, onceki_tarih: z.onceki_tarih || null, yaklasim: z.yaklasim || null, kapsam: z.kapsam || "" };
      });
      setHaneler(built);
      if (built.length && built.length <= 1500) cacheYaz(haneCacheKey, built); // çok büyük birimlerde localStorage'ı şişirme
    } catch (e) {
      console.error("Haneler yükleme hatası:", e);
      if (!(snap && snap.length)) setHaneler([]);   // cache yoksa sonsuz "yükleniyor"da kalmasın
    }
  }
  useEffect(() => { yukle(); }, [birim.id, birim.yenile]);

  /* SESSİZ KAYIP KAPATILDI.
     Supabase yazma çağrıları hata FIRLATMAZ, sonucun içinde { error } döndürür.
     Eski kod hem bunu okumuyor hem de `try { ... } catch {}` ile her şeyi
     yutuyordu. Sonuç: RLS engeli, ağ kesintisi veya kısıt ihlalinde saha
     görevlisi ekranda yeşil onayı görüyor ama veritabanına hiçbir şey
     yazılmıyordu — yapılan iş sessizce kayboluyordu.
     Artık hata fırlatılıyor; çağıran ekranı eski haline döndürüp kullanıcıya
     söylüyor. */
  async function ziyaretYaz(h, patch) {
    // .order("id") — birden fazla ziyaret satırı oluşursa hangisinin
    // güncelleneceği belirsiz kalmasın.
    const { data: m, error: eSec } = await supabase.from("ziyaret")
      .select("id").eq("hane_id", h.id).order("id").limit(1);
    if (eSec) throw eSec;
    const { error } = (m && m.length)
      ? await supabase.from("ziyaret").update(patch).eq("id", m[0].id)
      : await supabase.from("ziyaret").insert({ ilce_id: h.ilce_id, bolge_id: isSite ? null : birim.id, hane_id: h.id, kullanici_id: userId, ...patch });
    if (error) throw error;
  }

  // İyimser güncellemeyi geri al: satırı yazma öncesi haline döndür.
  const geriAl = (h) => setHaneler((p) => (p || []).map((x) => x.id === h.id ? h : x));

  async function kaydetZiyaret(h, { yaklasim, kapsam, not_ }) {
    if (mesgul) return;
    setMesgul(h.id);
    const now = new Date().toISOString();
    const patch = { durum: "ziyaret_edildi", tarih: now, onceki_tarih: h.tarih || h.onceki_tarih || null, yaklasim: yaklasim || null, kapsam: kapsam || null, not_: not_ ?? null };
    setHaneler((p) => p.map((x) => x.id === h.id ? { ...x, ziyaret: true, tarih: now, onceki_tarih: patch.onceki_tarih, yaklasim: patch.yaklasim, kapsam: patch.kapsam || "", not_: patch.not_ || "" } : x));
    try {
      await ziyaretYaz(h, patch);
      // ziyaret_log ikincil kayıt: burada hata olsa da asıl ziyaret yazıldı.
      // Yine de sessiz kalmasın.
      const { error: eLog } = await supabase.from("ziyaret_log").insert({
        hane_id: h.id, kullanici_id: userId, ilce_id: h.ilce_id,
        bolge_id: isSite ? null : birim.id, tarih: now,
        yaklasim: yaklasim || null, kapsam: kapsam || null, not_: not_ ?? null, durum: "ziyaret_edildi",
      });
      if (eLog) console.error("ziyaret_log yazılamadı:", eLog);
      setZModal(null);
    } catch (e) {
      geriAl(h);
      alert(hataOnekli("Ziyaret kaydedilemedi", e));
    }
    setMesgul(null);
  }

  async function sifirla(h) {
    if (mesgul) return;
    setMesgul(h.id);
    const patch = { durum: "bekliyor", onceki_tarih: h.tarih || h.onceki_tarih || null, tarih: null };
    setHaneler((p) => p.map((x) => x.id === h.id ? { ...x, ziyaret: false, onceki_tarih: patch.onceki_tarih, tarih: null } : x));
    try { await ziyaretYaz(h, patch); setZModal(null); }
    catch (e) { geriAl(h); alert(hataOnekli("Ziyaret sıfırlanamadı", e)); }
    setMesgul(null);
  }

  async function notKaydet(h) {
    const yeni = window.prompt(`${h.no} — ziyaret notu:`, h.not_ || "");
    if (yeni === null) return;
    setHaneler((p) => p.map((x) => x.id === h.id ? { ...x, not_: yeni } : x));
    try { await ziyaretYaz(h, { not_: yeni }); }
    catch (e) { geriAl(h); alert(hataOnekli("Not kaydedilemedi", e)); }
  }

  async function hedefKaydet(tarih) {
    const onceki = hedefTarih;
    setHedefTarih(tarih);
    const { error } = await supabase.from(tablo).update({ hedef_tarih: tarih || null }).eq("id", birim.id);
    if (error) { setHedefTarih(onceki); alert(hataOnekli("Hedef tarih kaydedilemedi", error)); }
  }

  const suzulmus = useMemo(() => {
    if (!haneler) return [];
    let hs = haneler;
    if (isSite && nufBlok) hs = hs.filter((h) => blokDeger(h) === nufBlok);
    const a = ara.trim().toLocaleLowerCase("tr"); if (!a) return hs;
    return hs.filter((h) => (h.no || "").toLocaleLowerCase("tr").includes(a) ||
      h.kisiler.some((k) => `${k.ad} ${k.soyad}`.toLocaleLowerCase("tr").includes(a)));
  }, [haneler, ara, nufBlok, isSite]);

  const zSay = (haneler || []).filter((h) => h.ziyaret).length;
  const tHane = (haneler || []).length;
  const yuzde = tHane ? Math.round((zSay / tHane) * 100) : 0;
  const kSay = (haneler || []).reduce((a, h) => a + h.kisiler.length, 0);

  const demografi = useMemo(() => {
    const ks = (haneler || []).flatMap((h) => h.kisiler);
    let erkek = 0, kadin = 0, uye = 0, yasTop = 0, yasSay = 0, eTop = 0, eSay = 0, kTop = 0, kSay = 0;
    const yas = { "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55-64": 0, "65+": 0 };
    ks.forEach((k) => {
      const c = String(k.cinsiyet || "").toLocaleUpperCase("tr").charAt(0);
      if (c === "E") erkek++; else if (c === "K") kadin++;
      if (k.uye) uye++;
      if (k.dogum_yili) {
        const a = 2026 - k.dogum_yili;
        yasTop += a; yasSay++;
        if (c === "E") { eTop += a; eSay++; } else if (c === "K") { kTop += a; kSay++; }
        if (a < 25) yas["18-24"]++; else if (a < 35) yas["25-34"]++; else if (a < 45) yas["35-44"]++;
        else if (a < 55) yas["45-54"]++; else if (a < 65) yas["55-64"]++; else yas["65+"]++;
      }
    });
    const ortYas = yasSay ? Math.round(yasTop / yasSay) : 0;
    const ortYasE = eSay ? Math.round(eTop / eSay) : 0;
    const ortYasK = kSay ? Math.round(kTop / kSay) : 0;
    const secmen = ks.length;
    // POTANSİYEL ÜYE: hanesinde en az 1 üye var, ama kendisi üye değil (aile bağı olan)
    let potansiyel = 0, potHane = 0;
    (haneler || []).forEach((h) => {
      const kl = h.kisiler || [];
      const uyeli = kl.some((k) => k.uye);
      if (!uyeli) return;
      const uyesiz = kl.filter((k) => !k.uye).length;
      if (uyesiz > 0) { potansiyel += uyesiz; potHane++; }
    });
    return { erkek, kadin, toplam: erkek + kadin, secmen, uye, uyeDegil: Math.max(0, secmen - uye), potansiyel, potHane, ortYas, ortYasE, ortYasK, yasArr: Object.entries(yas).map(([ad, deger]) => ({ ad, deger })) };
  }, [haneler]);

  const nufBloklar = useMemo(() => {
    if (!isSite) return [];
    const s = new Set();
    (haneler || []).forEach((h) => { const b = blokDeger(h); if (b) s.add(b); });
    return [...s].sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  }, [haneler, isSite]);

  useEffect(() => { setNufBlok(""); setDigerAcik(false); }, [birim.id, grup ? grup.id : null]);
  useEffect(() => { setGorunen(200); }, [birim.id, grup ? grup.id : null, ara, nufBlok]);

  const nufusDagilim = useMemo(() => {
    let hs = haneler || [];
    if (nufBlok) hs = hs.filter((h) => blokDeger(h) === nufBlok);
    const ks = hs.flatMap((h) => h.kisiler);
    const m = {};
    ks.forEach((k) => { const il = (k.nufus_il || "").trim() || "Bilinmiyor"; m[il] = (m[il] || 0) + 1; });
    const arr = Object.entries(m).map(([ad, deger]) => ({ ad, deger })).sort((a, b) => b.deger - a.deger);
    const N = 10;
    const top = arr.slice(0, N);
    const kalanArr = arr.slice(N);
    const kalan = kalanArr.reduce((a, x) => a + x.deger, 0);
    if (kalan > 0) top.push({ ad: "Diğer", deger: kalan, detay: kalanArr });
    return { arr: top, toplam: ks.length, ilSay: arr.length };
  }, [haneler, nufBlok]);

  const NufusTip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    const box = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12, boxShadow: "0 6px 18px rgba(0,0,0,.12)" };
    if (d.ad === "Diğer" && d.detay) {
      return (
        <div style={{ ...box }}>
          <div style={{ fontWeight: 700 }}>Diğer · {fmt(d.deger)} kişi ({d.detay.length} il)</div>
          <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>Dökümü görmek için listede tıkla</div>
        </div>
      );
    }
    return <div style={box}><b>{d.ad}</b>: {fmt(d.deger)} kişi</div>;
  };

  // Grafik başlıklarına birim adı öneki (makrodan mikroya: "Elmas Sitesi Yaş Aralığı")
  const basAd = (birim.kod || birim.mahalleAd || "").split("·")[0].trim();
  const on = basAd ? basAd + " " : "";

  // Hane başlığı — gerçek blok adı (KEOS numarataj) varsa onu kullan.
  // Kapı numarasının harfi (12D -> "D") BLOK DEĞİLDİR; kütükteki "blok" alanı
  // bazen bu harfin kopyası olduğu için o durumda blok yazmıyoruz.
  function haneAd(h) {
    const kapi = String(h.kapi_no ?? "").trim();
    const blok = String(h.kapi_blok ?? "").trim();
    const resmi = String(h.blok_ad ?? "").trim();          // KEOS'tan gelen gerçek blok (ör. "B2")
    const harf = kapi.replace(/[0-9\s]/g, "").toLocaleUpperCase("tr"); // "12D" -> "D"
    const gercekBlok = resmi || (blok && blok.toLocaleUpperCase("tr") !== harf ? blok : "");
    const daire = h.no != null && String(h.no).trim() !== "" ? String(h.no).trim() : "";

    if (isSite) {
      const p = [];
      if (gercekBlok) p.push(`${gercekBlok} Blok`);
      if (kapi) p.push(`Kapı ${kapi}`);
      if (daire) p.push(`D:${daire}`);
      return p.length ? p.join(" · ") : (haneBaslik(h, isSite) || "");
    }
    // SOKAK hanesi: adres alanı tam bilgiyi içeriyor ("21. SOKAK No:10 D:1")
    const tam = String(h.adres ?? "").trim();
    if (tam) return tam;
    const p = [];
    if (kapi) p.push(`Kapı ${kapi}`);
    if (daire) p.push(`D:${daire}`);
    return p.length ? p.join(" · ") : (haneBaslik(h, isSite) || "");
  }

  // Renk açıklaması (hem başlıkta hem yapışkan şeritte kullanılır)
  const renkAciklama = (
    <>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 800, background: "#cf5a26", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>ÜYE</span>
        <span style={{ color: "#64748b" }}>AK Parti üyesi</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 800, background: "#e0edff", color: "#1d4ed8", border: "1px solid #93c5fd", padding: "2px 8px", borderRadius: 999 }}>POTANSİYEL</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 800, background: "#e7f6ec", color: "#15803d", border: "1px solid #a7e3bd", padding: "2px 8px", borderRadius: 999 }}>ÜYE DEĞİL</span>
      </span>
      <span style={{ width: 1, height: 16, background: "#e2e8f0" }} />
      {YAKLASIM_LISTE.map((y) => (
        <span key={y.deger} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: y.bg, border: `1.5px solid ${y.kenar}`, display: "inline-block" }} />
          <b style={{ color: "#334155" }}>{y.ad}</b>
          <span style={{ color: "#64748b" }}>{y.aciklama}</span>
        </span>
      ))}
    </>
  );

  return (
    <>
      <div className="head"><div><h2 className="disp">{grup ? `${birim.kod}-${grup.no}` : birim.kod}</h2><div className="sub">{birim.kapsam || "—"}</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {grup
            ? <EkipRozet grupId={grup.id} cocuk={<span className="tag" style={{ background: grupAd ? "var(--ok-weak)" : "var(--surface2)", color: grupAd ? "var(--ok)" : "var(--ink2)", borderColor: grupAd ? "#9ccfc7" : "var(--border)" }}><UserCheck size={13} /> Sorumlu: {grupAd || "atanmadı"}</span>} />
            : <EkipRozet bolgeId={birim.id} cocuk={<span className="tag" style={{ background: sorumluId ? "var(--ok-weak)" : "var(--surface2)", color: sorumluId ? "var(--ok)" : "var(--ink2)", borderColor: sorumluId ? "#9ccfc7" : "var(--border)" }}>
            <UserCheck size={13} /> {isSite ? "AK Parti Site Temsilcisi" : "Sorumlu"}: {sorumluId ? (adById[sorumluId] || "atandı") : "atanmadı"}</span>} />}
          <span className="tag"><Users size={13} /> {fmt(tHane)} hane · {fmt(kSay)} seçmen</span>
        </div></div>

{grup && yonetici && <GrupBaskanPanel grup={grup} onAtandi={(id, ad) => setGrupAd(ad || "")} />}

      {yonetici && !grup && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="atama-strip">
            <div className="as-grup">
              <span className="as-lbl">{isSite ? "AK PARTİ SİTE TEMSİLCİSİ" : "SORUMLU (sokak/site sorumlusu)"}</span>
              <select className="sel" value={sorumluId} onChange={(e) => ataAlan("sorumlu_id", e.target.value, setSorumluId)}>
                <option value="">— atanmadı —</option>
                {sorumlular.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad || p.eposta}</option>)}
              </select>
              {atandi === "sorumlu_id" && <span className="ok-mini">✓ kaydedildi</span>}
            </div>
            <div className="as-grup">
              <span className="as-lbl">KOORDİNATÖR</span>
              <select className="sel" value={koordId} onChange={(e) => ataAlan("koordinator_id", e.target.value, setKoordId)}>
                <option value="">— atanmadı —</option>
                {koordinatorler.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad || p.eposta}</option>)}
              </select>
              {atandi === "koordinator_id" && <span className="ok-mini">✓ kaydedildi</span>}
            </div>
            {profiller.length === 0 && <span className="dim">Önce Sorumlular sayfasından hesap oluşturun.</span>}
          </div>
        </div>
      )}
      {birim.tip === "bolge" && !grup && yonetici && <SokakBolStrip bolge={birim} />}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="ilerleme">
          <div className="ilerleme-ust">
            <span><b className="mono">{zSay}</b> / {tHane} hane ziyaret edildi</span>
            <span className="mono" style={{ color: yuzde >= 66 ? "var(--ok)" : yuzde >= 33 ? "#b45309" : "var(--accent2)", fontWeight: 700 }}>%{yuzde}</span>
          </div>
          <div className="bar"><i style={{ width: `${yuzde}%`, background: yuzde >= 66 ? "var(--ok)" : "var(--accent)" }} /></div>
        </div>
      </div>

      {(planla || hedefTarih) && (() => {
        const kalan = tHane - zSay;
        const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
        let gun = 0, gunluk = 0;
        if (hedefTarih) { gun = Math.max(1, Math.ceil((new Date(hedefTarih) - bugun) / 86400000)); gunluk = Math.ceil(kalan / gun); }
        const hafta = Math.max(1, Math.ceil(gun / 7));
        const haftalik = Math.ceil(kalan / hafta);
        return (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="plan">
              <div className="plan-sol">
                <div className="plan-num"><b>{fmt(kalan)}</b><span>kalan hane</span></div>
                {hedefTarih && <div className="plan-num"><b>{fmt(gun)}</b><span>gün kaldı</span></div>}
                {hedefTarih && <div className="plan-num vurgu"><b>{fmt(gunluk)}</b><span>günlük hedef</span></div>}
                {hedefTarih && <div className="plan-num"><b>{fmt(haftalik)}</b><span>haftalık hedef</span></div>}
              </div>
              <div className="plan-sag">
                <label>Hedef tarih</label>
                {planla
                  ? <input type="date" className="inp2" value={hedefTarih || ""} onChange={(e) => hedefKaydet(e.target.value)} />
                  : <span className="mono">{hedefTarih ? new Date(hedefTarih).toLocaleDateString("tr-TR") : "belirlenmedi"}</span>}
                {planla && hedefTarih && <button className="btn" onClick={() => hedefKaydet("")} style={{ marginLeft: 8 }}>Temizle</button>}
              </div>
            </div>
            {hedefTarih && <div className="plan-not">Bu {isSite ? "siteyi" : "bölgeyi"} hedefe yetiştirmek için günde ~<b>{fmt(gunluk)}</b> hane ziyaret edilmeli.</div>}
            {!hedefTarih && planla && <div className="plan-not dim">Hedef tarih seçince sistem günlük/haftalık ziyaret hedefini otomatik hesaplar.</div>}
          </div>
        );
      })()}
      {haneler && haneler.length > 0 && (
        <div className="demo-grid">
          <div className="panel pad">
            <div className="panel-h2"><h3>{on}Yaş Aralığı</h3><span className="dim">{fmt(demografi.toplam)} seçmen{demografi.ortYas ? ` · ort. ${demografi.ortYas} yaş` : ""}</span></div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={demografi.yasArr} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <XAxis dataKey="ad" tick={{ fontSize: 11, fill: "#5a626c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9097a0" }} axisLine={false} tickLine={false} width={42} />
                <Tooltip cursor={{ fill: "#0000000a" }} formatter={(v) => [fmt(v), "Kişi"]} labelFormatter={(l) => "Yaş " + l} />
                <Bar dataKey="deger" fill="#cf5a26" radius={[5, 5, 0, 0]} maxBarSize={46} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="panel pad">
            <div className="panel-h2"><h3>{on}Cinsiyet Oranı</h3><span className="dim">{fmt(demografi.toplam)} seçmen</span></div>
            <div className="cins">
              <div className="cins-satir">
                <span className="cins-ad"><span className="dot" style={{ background: "#2563eb" }} /> Erkek</span>
                <b className="mono">{fmt(demografi.erkek)}</b></div>
              <div className="bar"><i style={{ width: `${oran(demografi.erkek, demografi.toplam)}%`, background: "#2563eb" }} /></div>
              <div className="cins-satir" style={{ marginTop: 14 }}>
                <span className="cins-ad"><span className="dot" style={{ background: "#db2777" }} /> Kadın</span>
                <b className="mono">{fmt(demografi.kadin)}</b></div>
              <div className="bar"><i style={{ width: `${oran(demografi.kadin, demografi.toplam)}%`, background: "#db2777" }} /></div>
              <div className="cins-ozet" style={{ display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", fontSize: 13.5, marginTop: 10, paddingTop: 10, borderTop: "1px solid #eef2f7" }}>
                <span style={{ color: "#1d4ed8", fontWeight: 700 }}>
                  Erkek %{oran(demografi.erkek, demografi.toplam)}
                  {demografi.ortYasE ? <span style={{ color: "#475569", fontWeight: 600 }}> · ort. <b style={{ color: "#1d4ed8" }}>{demografi.ortYasE}</b> yaş</span> : null}
                </span>
                <span style={{ color: "#be185d", fontWeight: 700 }}>
                  Kadın %{oran(demografi.kadin, demografi.toplam)}
                  {demografi.ortYasK ? <span style={{ color: "#475569", fontWeight: 600 }}> · ort. <b style={{ color: "#be185d" }}>{demografi.ortYasK}</b> yaş</span> : null}
                </span>
              </div>
            </div>
          </div>
          <div className="panel pad">
            <div className="panel-h2"><h3>{on}Üye Oranı</h3><span className="dim">{fmt(demografi.secmen)} seçmen</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
              <div style={{ position: "relative", width: 130, height: 130, flex: "0 0 auto" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ ad: "Üye", v: demografi.uye }, { ad: "Üye değil", v: demografi.uyeDegil }]} dataKey="v" nameKey="ad" cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={1} stroke="#fff" strokeWidth={1}>
                      <Cell fill="#cf5a26" /><Cell fill="#e7e9ed" />
                    </Pie>
                    <Tooltip formatter={(v, n) => [fmt(v) + " seçmen", n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#cf5a26" }}>%{oran(demografi.uye, demografi.secmen)}</div>
                  <div style={{ fontSize: 10, color: "var(--ink2)" }}>üye</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span><span className="dot" style={{ background: "#cf5a26" }} /> Üye</span><b className="mono">{fmt(demografi.uye)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span><span className="dot" style={{ background: "#e7e9ed" }} /> Üye değil</span><b className="mono">{fmt(demografi.uyeDegil)}</b></div>
                <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 2, paddingTop: 8, borderTop: "1px solid #eef2f7" }} title="Hanesinde üye bulunan ancak kendisi üye olmayan seçmenler">
                  <b style={{ color: "#cf5a26" }}>Potansiyel üye: {fmt(demografi.potansiyel)}</b> · üyeli {fmt(demografi.potHane)} hanede henüz üye olmayan seçmen
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {haneler && haneler.length > 0 && nufusDagilim.ilSay > 0 && (
        <div className="panel pad" style={{ marginBottom: 14 }}>
          <div className="panel-h2"><h3>{on}Nüfus İl Dağılımı{nufBlok ? ` · ${nufBlok} blok` : ""}</h3><span className="dim">{fmt(nufusDagilim.ilSay)} il · {fmt(nufusDagilim.toplam)} seçmen</span></div>
          {isSite && nufBloklar.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "2px 0 10px" }}>
              <button onClick={() => { setNufBlok(""); setDigerAcik(false); }}
                style={{ padding: "3px 11px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: "1px solid " + (nufBlok === "" ? "#2563eb" : "#d7dce2"), background: nufBlok === "" ? "#2563eb" : "#fff", color: nufBlok === "" ? "#fff" : "#475569", fontWeight: nufBlok === "" ? 600 : 400 }}>
                Tüm site
              </button>
              {nufBloklar.map((b) => (
                <button key={b} onClick={() => { setNufBlok(b); setDigerAcik(false); }}
                  style={{ padding: "3px 11px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: "1px solid " + (nufBlok === b ? "#2563eb" : "#d7dce2"), background: nufBlok === b ? "#2563eb" : "#fff", color: nufBlok === b ? "#fff" : "#475569", fontWeight: nufBlok === b ? 600 : 400 }}>
                  {b}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 6 }}>
            <div style={{ width: 210, height: 210, flex: "0 0 auto" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={nufusDagilim.arr} dataKey="deger" nameKey="ad" cx="50%" cy="50%" innerRadius={54} outerRadius={92} paddingAngle={1} stroke="#fff" strokeWidth={1}>
                    {nufusDagilim.arr.map((e, i) => <Cell key={i} fill={e.ad === "Diğer" ? "#94a3b8" : NUF_RENK[i % NUF_RENK.length]} />)}
                  </Pie>
                  <Tooltip content={<NufusTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: "1 1 200px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "5px 16px", minWidth: 180 }}>
              {nufusDagilim.arr.map((e, i) => {
                const diger = e.ad === "Diğer";
                return (
                  <div key={i} onClick={diger ? () => setDigerAcik((v) => !v) : undefined}
                    style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: diger ? "pointer" : "default" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: diger ? "#94a3b8" : NUF_RENK[i % NUF_RENK.length], flex: "0 0 auto" }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: diger ? "underline dotted" : "none" }}>
                      {e.ad}{diger ? ` (${e.detay.length} il ▾)` : ""}
                    </span>
                    <b className="mono">{fmt(e.deger)}</b>
                  </div>
                );
              })}
            </div>
          </div>
          {digerAcik && (() => {
            const dg = nufusDagilim.arr.find((x) => x.ad === "Diğer");
            if (!dg) return null;
            return (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eef1f4" }}>
                <div className="dim" style={{ fontSize: 12, marginBottom: 8 }}>"Diğer" içindeki iller ({dg.detay.length} il · {fmt(dg.deger)} kişi)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "4px 16px" }}>
                  {dg.detay.map((x, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.ad}</span>
                      <b className="mono">{fmt(x.deger)}</b>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="panel">
        <div ref={basRef} className="panel-h" style={{ flexWrap: "wrap", rowGap: 8 }}>
          <h3 style={{ whiteSpace: "nowrap" }}>Haneler{isSite && nufBlok ? ` · ${nufBlok} blok` : ""}</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, flex: 1, minWidth: 0, marginLeft: 14 }}>{renkAciklama}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isSite && nufBlok && (
              <button onClick={() => setNufBlok("")} title="Blok filtresini kaldır"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb" }}>
                {nufBlok} blok <X size={13} />
              </button>
            )}
            <button className="btn" onClick={() => csvIndir({ kod: birim.kod }, suzulmus)}><Download size={14} /> CSV</button>
            <div className="searchbox"><Search size={13} />
              <input placeholder="Hane / seçmen ara…" value={ara} onChange={(e) => setAra(e.target.value)} /></div>
          </div></div>
        {haneler === null ? <div className="merkez">Yükleniyor…</div>
          : suzulmus.length === 0 ? <div className="merkez">Kayıt yok.</div> : (
            <table ref={tabloRef} className="htable hane-table">
              <thead><tr><th>Hane</th><th>Kişiler</th><th className="sag">Seçmen</th><th className="sag">Üye</th><th className="sag">Ziyaret</th></tr></thead>
              <tbody>
                {suzulmus.slice(0, gorunen).map((h, hIdx) => {
                  const sec = h.kisiler.filter((k) => k.secmen).length;
                  const uye = h.kisiler.filter((k) => k.uye).length;
                  const pot = uye > 0 ? h.kisiler.filter((k) => !k.uye).length : 0; // üyeli hanede üye olmayanlar
                  const satir = (
                    <tr key={h.id} className={h.ziyaret ? "done" : ""}
                      style={h.ziyaret ? { background: "#d3f5e0", boxShadow: "inset 4px 0 0 #16a34a" } : undefined}>
                      <td>
                        <b>{haneAd(h) || "—"}</b>
                        {isSite && h.adres && <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400, marginTop: 2 }}>{h.adres}{h.kapi_no ? ` No ${h.kapi_no}` : ""}</div>}
                        {(uye > 0 || pot > 0) && (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                            {uye > 0 && <span style={{ fontSize: 11, fontWeight: 800, background: "#cf5a26", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>{uye} ÜYE</span>}
                            {pot > 0 && <span style={{ fontSize: 11, fontWeight: 800, background: "#e0edff", color: "#1d4ed8", border: "1px solid #93c5fd", padding: "2px 8px", borderRadius: 999 }}>{pot} POTANSİYEL</span>}
                          </div>
                        )}
                        {mapsHedef(h) && (
                          <a href={mapsURL(h)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 4, fontSize: 11.5, color: "#2563eb", textDecoration: "none", marginTop: 4, fontWeight: 600 }}>
                            <MapPin size={12} /> Haritada aç
                          </a>
                        )}
                      </td>
                      <td>{h.kisiler.map((k) => {
                        const potK = !k.uye && uye > 0; // hanede üye var, bu kişi değil
                        return (
                          <span key={k.id} className="kisi-row">
                            <span className="dot" style={{ background: k.uye ? "#cf5a26" : potK ? "#2563eb" : k.secmen ? "var(--ok)" : "#cbd0d6" }} />
                            <b>{k.ad} {k.soyad}</b>
                            <span className="kisi-meta">· {k.cinsiyet?.[0] || "-"} · {k.dogum_yili ? (2026 - k.dogum_yili) : "-"}{k.telefon ? " · " + k.telefon : ""}</span>
                            {k.uye
                              ? <span style={{ fontSize: 10.5, fontWeight: 800, background: "#cf5a26", color: "#fff", padding: "1px 7px", borderRadius: 999, marginLeft: 5 }}>ÜYE</span>
                              : potK
                                ? <span style={{ fontSize: 10.5, fontWeight: 800, background: "#e0edff", color: "#1d4ed8", border: "1px solid #93c5fd", padding: "1px 7px", borderRadius: 999, marginLeft: 5 }}>POTANSİYEL</span>
                                : <span style={{ fontSize: 10.5, fontWeight: 800, background: "#e7f6ec", color: "#15803d", border: "1px solid #a7e3bd", padding: "1px 7px", borderRadius: 999, marginLeft: 5 }}>ÜYE DEĞİL</span>}
                            {baskanAtayabilir && <button onClick={(e) => { e.stopPropagation(); baskanYapAc(k, h); }}
                              title="Sokak başkanı yap" style={{ marginLeft: 6, border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, cursor: "pointer", color: "#92400e", fontWeight: 700 }}>
                              👑 Başkan yap</button>}
                          </span>
                        );
                      })}{h.kisiler.length === 0 && <span className="dim">—</span>}</td>
                      <td className="sag mono" data-label="Seçmen">{sec}</td>
                      <td className="sag mono" data-label="Üye">{uye}</td>
                      <td className="sag">
                        <div className="ziyaret-aksiyon">
                          <button className={"vbtn" + (h.ziyaret ? " on" : "")} disabled={mesgul === h.id} onClick={() => setZModal({ id: h.id })}>
                            {h.ziyaret ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                            {h.ziyaret ? "Ziyaret edildi" : "Bekliyor"}
                          </button>
                          <button className={"not-btn" + (h.not_ ? " dolu" : "")} title={h.not_ ? "Not: " + h.not_ : "Not ekle"} onClick={() => setZModal({ id: h.id })}>
                            <FileText size={14} />
                          </button>
                        </div>
                        {(h.tarih || h.yaklasim || h.kapsam) && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 4, fontSize: 11, color: "#64748b" }}>
                            {h.tarih && <span>{new Date(h.tarih).toLocaleDateString("tr-TR")}</span>}
                            {h.yaklasim && (() => { const y = yaklasimBilgi(h.yaklasim); return (
                              <span title={y.aciklama} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 999, padding: "3px 9px 3px 4px" }}>
                                <span style={{ width: 18, height: 18, borderRadius: 5, background: y.bg, border: `1.5px solid ${y.kenar}`, display: "inline-block", flex: "0 0 auto" }} />
                                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                                  <b style={{ fontSize: 12, color: "#1f2937" }}>{y.ad}</b>
                                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{y.aciklama}</span>
                                </span>
                              </span>); })()}
                            {h.kapsam && <span style={{ background: "#f1f5f9", padding: "1px 7px", borderRadius: 10 }}>{h.kapsam}</span>}
                          </div>
                        )}
                        {h.not_ && <div className="hane-not">{h.not_}</div>}
                      </td>
                    </tr>
                  );
                  return satir;
                })}
              </tbody>
            </table>
          )}
        {suzulmus.length > gorunen && (
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
            <button className="btn" onClick={() => setGorunen((n) => n + 300)}>
              Daha fazla göster ({fmt(gorunen)} / {fmt(suzulmus.length)})
            </button>
          </div>
        )}
      </div>
      {zModal && (() => {
        const h = (haneler || []).find((x) => x.id === zModal.id);
        if (!h) return null;
        return <ZiyaretModal hane={h} isSite={isSite} mapsHref={mapsHedef(h) ? mapsURL(h) : null} mesgul={mesgul === h.id} onKaydet={kaydetZiyaret} onSifirla={sifirla} onKapat={() => setZModal(null)} />;
      })()}
      {/* Başlık yukarı kayınca ekranın üstünde beliren aynı açıklama şeridi */}
      {yapisik && (
        <div style={{
          position: "fixed", top: 0, left: yapisik.left, width: yapisik.width, zIndex: 40,
          background: "rgba(255,255,255,0.98)", borderBottom: "1px solid #dbe3ee",
          boxShadow: "0 3px 12px rgba(15,23,42,0.08)", borderRadius: "0 0 10px 10px",
          padding: "9px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 11.5,
        }}>
          <b style={{ fontSize: 13, color: "#0f172a", whiteSpace: "nowrap" }}>Haneler</b>
          {renkAciklama}
        </div>
      )}
      {baskanModal && (() => {
        const M = baskanModal;
        const kap = () => setBaskanModal(null);
        const kopyala = (t) => { try { navigator.clipboard?.writeText(t); } catch (_) {} };
        const ov = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
        const kart = { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.25)", overflow: "hidden", fontFamily: "inherit" };
        const bas = { padding: "18px 20px 0" };
        const govde = { padding: "14px 20px 20px" };
        const btnBirincil = { flex: 1, padding: "11px", border: "none", borderRadius: 10, background: "#cf5a26", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" };
        const btnIkincil = { flex: 1, padding: "11px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer" };
        const satir = { display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", marginTop: 8 };
        const kopyaBtn = { marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" };

        return (
          <div style={ov} onClick={kap}>
            <div style={kart} onClick={(e) => e.stopPropagation()}>
              {(M.asama === "onay" || M.asama === "islem") && (
                <>
                  <div style={bas}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 10 }}>👑</div>
                    <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Sokak Başkanı ata</h3>
                    <p style={{ margin: "6px 0 0", fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
                      <b style={{ color: "#0f172a" }}>{M.ad}</b> bu grubun sokak başkanı olsun mu?
                    </p>
                  </div>
                  <div style={govde}>
                    <div style={{ fontSize: 12.5, color: "#64748b", background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 10, padding: "10px 12px", marginBottom: 14, lineHeight: 1.5 }}>
                      Giriş hesabı otomatik açılır. Geçici şifre <b>saha2026</b>; kişi ilk girişte kendi şifresini belirler.
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button style={btnIkincil} onClick={kap} disabled={M.asama === "islem"}>İptal</button>
                      <button style={{ ...btnBirincil, opacity: M.asama === "islem" ? 0.7 : 1 }} onClick={baskanYapOnayla} disabled={M.asama === "islem"}>
                        {M.asama === "islem" ? "Atanıyor…" : "Onayla ve ata"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {M.asama === "sonuc" && (
                <>
                  <div style={bas}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 10 }}>✓</div>
                    <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{M.ad} atandı</h3>
                    <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#475569" }}>Giriş bilgisini kişiye ilet:</p>
                  </div>
                  <div style={govde}>
                    <div style={satir}>
                      <span style={{ fontSize: 11, color: "#94a3b8", width: 54 }}>E-posta</span>
                      <b style={{ fontSize: 13, color: "#0f172a", wordBreak: "break-all" }}>{M.eposta}</b>
                      <button style={kopyaBtn} onClick={() => kopyala(M.eposta)}>Kopyala</button>
                    </div>
                    <div style={satir}>
                      <span style={{ fontSize: 11, color: "#94a3b8", width: 54 }}>Şifre</span>
                      <b style={{ fontSize: 13, color: "#0f172a" }}>{M.sifre}</b>
                      <button style={kopyaBtn} onClick={() => kopyala(M.sifre)}>Kopyala</button>
                    </div>
                    <div style={{ fontSize: 12, color: "#047857", marginTop: 10 }}>Kişi ilk girişte kendi şifresini belirleyecek.</div>
                    <button style={{ ...btnBirincil, width: "100%", marginTop: 16, background: "#0f172a" }} onClick={kap}>Tamam</button>
                  </div>
                </>
              )}

              {M.asama === "hata" && (
                <>
                  <div style={bas}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 10 }}>!</div>
                    <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Olmadı</h3>
                    <p style={{ margin: "8px 0 0", fontSize: 14, color: "#b91c1c", lineHeight: 1.5 }}>{M.mesaj}</p>
                  </div>
                  <div style={govde}>
                    <button style={{ ...btnBirincil, width: "100%" }} onClick={kap}>Kapat</button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
/* ===================== Ekip / Blok Atama ===================== */
