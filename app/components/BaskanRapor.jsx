"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { fmt, oran, yakRenk, normBlok, blokParts } from "../../lib/format";
import { yaklasimBilgi, ILCE_BASKANI, MAHALLE_TESKILAT, MAHALLE_NUFUS } from "../../lib/constants";
import TeskilatYonetim from "./TeskilatYonetim";
import EkipRozet from "./EkipRozet";
import Talepler from "./Talepler";
import { StickyNote, ClipboardCheck, Boxes, UserCheck, Search, LayoutDashboard, TrendingUp, Network, AlertTriangle, Users, Home, ShieldCheck, MapPin } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

const ROL_ET = { blok_sorumlu: "Blok Sorumlusu", ana_kademe: "Ana Kademe Temsilci", kadin_kollari: "Kadın Temsilci", genclik_kollari: "Gençlik Temsilci" };
const BLOK_ROLLER = Object.keys(ROL_ET);

// Not/ziyaret girenin rolünü okunur etikete çevir (site bağlamında sorumlu = Site Başkanı)
function rolEtiket(rol, isSite) {
  if (ROL_ET[rol]) return ROL_ET[rol];
  if (rol === "sorumlu") return isSite ? "Site Temsilcisi" : "Sorumlu";
  if (rol === "koordinator") return "Koordinatör";
  if (rol === "grup_baskani") return "Grup Başkanı";
  if (rol === "il_yonetimi" || rol === "ilce_yonetimi") return "Yönetim";
  return "Görevli";
}
function rolRenk(rol) {
  return rol === "kadin_kollari" ? { bg: "#fce7f3", fg: "#9d174d" }
    : rol === "genclik_kollari" ? { bg: "#dcfce7", fg: "#166534" }
      : rol === "ana_kademe" ? { bg: "#e0e7ff", fg: "#3730a3" }
        : rol === "sorumlu" ? { bg: "#ffedd5", fg: "#9a3412" }
          : rol === "blok_sorumlu" ? { bg: "#e0f2fe", fg: "#0369a1" }
            : { bg: "#f1f5f9", fg: "#475569" };
}

// id listesini parçalayıp .in ile çek (uzun IN sorgularını böler)
async function parcaliIn(tablo, kolon, idler, key = "id") {
  const uniq = [...new Set((idler || []).filter(Boolean))];
  const out = [];
  for (let i = 0; i < uniq.length; i += 150) {
    const { data } = await supabase.from(tablo).select(kolon).in(key, uniq.slice(i, i + 150));
    if (data) out.push(...data);
  }
  return out;
}

function haneEtiket(h) {
  if (!h) return "—";
  if (h.site_kayit_id) {
    return [h.kapi_blok ? `${h.kapi_blok} Blok` : null, h.kapi_no ? `Kapı ${h.kapi_no}` : null, h.no ? `D:${h.no}` : null].filter(Boolean).join(" · ") || h.adres || "Hane";
  }
  return [h.adres, h.kapi_no ? `No ${h.kapi_no}` : null].filter(Boolean).join(" ") || "Hane";
}

export default function BaskanRapor({ profil }) {
  const [ilceId, setIlceId] = useState(null);
  const [tab, setTab] = useState("ozet");
  const [ara, setAra] = useState("");
  const [mahFiltre, setMahFiltre] = useState(""); // "" = tüm ilçe, yoksa mahalle_id
  const [yuk, setYuk] = useState({});      // { tab: true } -> yüklendi
  const [mesgul, setMesgul] = useState(false);
  // Teşkilat: DB tablosundan (statik MAHALLE_TESKILAT yerine) + düzenleme
  const [teskilatMah, setTeskilatMah] = useState(null); // [{ mahalle_id, ad, baskan, yurutme, yk[], meclis[], bby }]
  const [sokakSor, setSokakSor] = useState(null); // sokak sorumlusu/ekip durumu
  const [yonetimler, setYonetimler] = useState(null); // tüm gruplar + ekip (başkan+üyeler)
  const [secmenRapor, setSecmenRapor] = useState(null); // { 1:[], 3:[], 5:[] } renk -> kişiler
  const [renkSec, setRenkSec] = useState(5); // 1 siyah, 3 gri, 5 beyaz
  async function secmenRaporYukle() {
    const { data: zs } = await supabase.from("ziyaret").select("hane_id, yaklasim").in("yaklasim", [1, 3, 5]);
    const haneRenk = {}; (zs || []).forEach((z) => { if (z.hane_id) haneRenk[z.hane_id] = z.yaklasim; });
    const haneIds = Object.keys(haneRenk);
    if (!haneIds.length) { setSecmenRapor({ 1: [], 3: [], 5: [] }); return; }
    const haneler = await parcaliIn("hane", "id, adres, kapi_no, no, site_kayit_id", haneIds, "id");
    const haneAdres = {}; const haneSite = {};
    (haneler || []).forEach((h) => { haneAdres[h.id] = [h.adres || h.no || "", h.kapi_no ? "No " + h.kapi_no : ""].filter(Boolean).join(" ").trim(); if (h.site_kayit_id) haneSite[h.id] = h.site_kayit_id; });
    const siteIds = [...new Set(Object.values(haneSite))];
    const siteAd = {};
    if (siteIds.length) { const sk = await parcaliIn("site_kayit", "id, ad", siteIds, "id"); (sk || []).forEach((s2) => { siteAd[s2.id] = s2.ad || ""; }); }
    const kisiler = await parcaliIn("kisi", "id, ad, soyad, telefon, hane_id, mahalle_id, secmen", haneIds, "hane_id");
    const grup = { 1: [], 3: [], 5: [] };
    (kisiler || []).forEach((k) => { const renk = haneRenk[k.hane_id]; if (grup[renk]) grup[renk].push({ ad: k.ad, soyad: k.soyad, telefon: k.telefon || "", mahalle_id: k.mahalle_id, adres: haneAdres[k.hane_id] || "", site: siteAd[haneSite[k.hane_id]] || "" }); });
    setSecmenRapor(grup);
  }
  function secmenDisaAktar() {
    if (!secmenRapor) return;
    const renkAd = renkSec === 1 ? "Siyah - Başka Parti" : renkSec === 3 ? "Gri - Kararsız" : "Beyaz - AK Parti";
    const q = (ara || "").toLocaleLowerCase("tr").trim();
    let liste = (secmenRapor[renkSec] || []).filter((k) => !mahFiltre || k.mahalle_id === mahFiltre);
    if (q) liste = liste.filter((k) => `${k.ad} ${k.soyad}`.toLocaleLowerCase("tr").includes(q));
    if (!liste.length) { alert("Aktarılacak kayıt yok."); return; }
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, "\"\"")}"`;
    const baslik = ["Ad", "Soyad", "Mahalle", "Site", "Adres", "Telefon", "Yaklaşım"];
    const satir = liste.map((k) => [k.ad, k.soyad, mahAd[k.mahalle_id] || "", k.site || "", k.adres || "", k.telefon || "", renkAd].map(esc).join(";"));
    const csv = "\uFEFF" + [baslik.map(esc).join(";"), ...satir].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const renkDosya = renkSec === 1 ? "siyah" : renkSec === 3 ? "gri" : "beyaz";
    const mahDosya = mahFiltre ? "_" + (mahAd[mahFiltre] || "").replace(/\s+/g, "_") : "";
    a.href = url; a.download = `secmen_${renkDosya}${mahDosya}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  async function yonetimlerYukle() {
    const [gr, bo, ek] = await Promise.all([
      supabase.from("sokak_grup").select("id, no, bolge_id, baskan_id, baskan_ad"),
      supabase.from("bolge").select("id, kod, mahalle_id"),
      supabase.from("sokak_ekip").select("grup_id, gorev, ad_soyad, telefon"),
    ]);
    const bMap = {}; (bo.data || []).forEach((b) => bMap[b.id] = b);
    const byGrup = {}; (ek.data || []).forEach((e) => { (byGrup[e.grup_id] = byGrup[e.grup_id] || []).push(e); });
    const liste = (gr.data || []).map((g) => {
      const b = bMap[g.bolge_id] || {};
      const rows = byGrup[g.id] || [];
      const baskan = rows.find((r) => r.gorev === "baskan") || (g.baskan_ad ? { ad_soyad: g.baskan_ad, telefon: null } : null);
      const uyeler = rows.filter((r) => r.gorev !== "baskan");
      return { id: g.id, kod: `${b.kod || "?"}-${g.no}`, mahalle_id: b.mahalle_id, atanmis: !!g.baskan_id, baskan, uyeler, kisi: (baskan ? 1 : 0) + uyeler.length };
    });
    setYonetimler(liste);
  }
  async function sokakSorYukle() {
    const [gr, bo, ek] = await Promise.all([
      supabase.from("sokak_grup").select("id, no, bolge_id, baskan_id, baskan_ad"),
      supabase.from("bolge").select("id, kod, mahalle_id"),
      supabase.from("sokak_ekip").select("grup_id, gorev"),
    ]);
    const bMap = {}; (bo.data || []).forEach((b) => bMap[b.id] = b);
    const uye = {}; (ek.data || []).forEach((e) => { if (e.gorev === "uye") uye[e.grup_id] = (uye[e.grup_id] || 0) + 1; });
    const liste = (gr.data || []).map((g) => {
      const b = bMap[g.bolge_id] || {};
      return { id: g.id, kod: `${b.kod || "?"}-${g.no}`, mahalle_id: b.mahalle_id, atanmis: !!g.baskan_id, sorumlu: g.baskan_ad || "", uye: uye[g.id] || 0 };
    });
    setSokakSor(liste);
  }
  const [duzenleMah, setDuzenleMah] = useState(null);   // { mahalle_id, ad }
  const yonetici = ["ilce_yonetimi", "il_yonetimi"].includes(profil?.rol);
  const ilYonetici = profil?.rol === "il_yonetimi";
  const [ilceBaskan, setIlceBaskan] = useState(null);
  const [ibForm, setIbForm] = useState(null); // { ad, tel, hesap, mesgul?, sonuc? }
  const [ilSorumlular, setIlSorumlular] = useState([]);
  const [ilSorForm, setIlSorForm] = useState(null); // { ad, gorev, tel }
  async function ilceBaskanYukle() {
    if (!ilceId) { setIlceBaskan(null); return; }
    const { data } = await supabase.from("teskilat").select("id, ad_soyad, telefon, profil_id").eq("unvan", "ilce_baskani").eq("ilce_id", ilceId).maybeSingle();
    setIlceBaskan(data || null);
  }
  async function ilceBaskanKaydet() {
    if (!ibForm.ad.trim()) return;
    setIbForm((f) => ({ ...f, mesgul: true }));
    try {
      let profil_id = ilceBaskan?.profil_id || null; let sonuc = null;
      if (ibForm.hesap) {
        const slug = (t) => (t || "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]/g, "");
        const eposta = `${slug(ibForm.ad) || "ilcebaskan"}@akpartibasaksehir.com`;
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch("/api/hesap-ekle", { method: "POST", headers: { "Content-Type": "application/json", authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ ad_soyad: ibForm.ad.trim(), eposta, sifre: "saha2026", benzersizEposta: true, sifre_gecici: true, rol: "ilce_yonetimi", ilce_id: ilceId, telefon: ibForm.tel.trim() || null }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || "hesap açılamadı");
        profil_id = j.id; sonuc = { eposta: j.eposta || eposta, sifre: "saha2026" };
      }
      await supabase.from("teskilat").delete().eq("unvan", "ilce_baskani").eq("ilce_id", ilceId);
      await supabase.from("teskilat").insert({ ilce_id: ilceId, mahalle_id: null, unvan: "ilce_baskani", ad_soyad: ibForm.ad.trim(), telefon: ibForm.tel.trim() || null, sira: 0, profil_id });
      await ilceBaskanYukle();
      if (sonuc) setIbForm((f) => ({ ...f, mesgul: false, sonuc })); else setIbForm(null);
    } catch (e) { alert("Kaydedilemedi: " + (e?.message || e)); setIbForm((f) => ({ ...f, mesgul: false })); }
  }
  async function ilSorumluYukle() {
    if (!ilceId) { setIlSorumlular([]); return; }
    const { data } = await supabase.from("teskilat").select("id, ad_soyad, telefon, gorev_metin, sira").eq("ilce_id", ilceId).eq("unvan", "il_sorumlu").order("sira");
    setIlSorumlular(data || []);
  }
  async function ilSorumluEkle() {
    const d = ilSorForm; if (!d || !d.ad.trim()) return;
    try {
      const { error } = await supabase.from("teskilat").insert({ ilce_id: ilceId, mahalle_id: null, unvan: "il_sorumlu", ad_soyad: d.ad.trim(), gorev_metin: (d.gorev || "").trim() || "İl Sorumlusu", telefon: (d.tel || "").trim() || null, sira: ilSorumlular.length });
      if (error) throw error;
      setIlSorForm(null); await ilSorumluYukle();
    } catch (e) { alert("Eklenemedi: " + (e?.message || e)); }
  }
  async function ilSorumluSil(row) {
    if (!confirm(`${row.ad_soyad} il sorumlularından çıkarılsın mı?`)) return;
    await supabase.from("teskilat").delete().eq("id", row.id); await ilSorumluYukle();
  }
  async function teskilatYukle() {
    const { data: mahs } = await supabase.from("mahalle").select("id, ad").order("ad");
    const { data: rows } = await supabase.from("teskilat").select("mahalle_id, unvan, ad_soyad, telefon, kadin, sira").order("sira");
    const byMah = {};
    (mahs || []).forEach((m) => { byMah[m.id] = { mahalle_id: m.id, ad: m.ad, baskan: null, yurutme: null, yk: [], meclis: [], bby: null }; });
    (rows || []).forEach((r) => {
      const g = byMah[r.mahalle_id]; if (!g) return;
      const k = { ad: r.ad_soyad, tel: r.telefon || "", k: !!r.kadin };
      if (r.unvan === "baskan") g.baskan = k; else if (r.unvan === "yurutme") g.yurutme = k;
      else if (r.unvan === "yk") g.yk.push(k); else if (r.unvan === "meclis") g.meclis.push(k); else if (r.unvan === "bby") g.bby = k;
    });
    // sadece en az bir kaydı olan mahalleleri göster
    setTeskilatMah(Object.values(byMah).filter((g) => g.baskan || g.yurutme || g.yk.length || g.meclis.length || g.bby));
  }

  const [mahAd, setMahAd] = useState({});  // mahalle_id -> ad
  const [d, setD] = useState({ notlar: [], sokak: [], site: [], bloklar: [], siteSor: [] });

  useEffect(() => { (async () => {
    let id = profil.rol === "ilce_yonetimi" ? profil.ilce_id : null;
    if (!id) { const { data } = await supabase.from("ilce").select("id").eq("prefix", "BSK").single(); id = data?.id || null; }
    setIlceId(id);
    const { data: mah } = await supabase.from("mahalle").select("id, ad").eq("ilce_id", id);
    const m = {}; (mah || []).forEach((x) => { m[x.id] = x.ad; }); setMahAd(m);
  })(); }, []);

  useEffect(() => { if (ilceId && !yuk[tab]) yukle(tab); }, [ilceId, tab]);
  useEffect(() => { if (tab === "teskilat") { if (teskilatMah === null) teskilatYukle(); ilceBaskanYukle(); ilSorumluYukle(); } }, [tab, ilceId]);
  useEffect(() => { if (tab === "yonetimler" && yonetimler === null) yonetimlerYukle(); }, [tab]);
  useEffect(() => { if (tab === "secmen" && secmenRapor === null) secmenRaporYukle(); }, [tab]);
  // Eksikler sekmesi blok + site sorumlusu verisine dayanır — ikisini de yükle
  useEffect(() => { if (ilceId && tab === "eksik") { if (!yuk["bloklar"]) yukle("bloklar"); if (!yuk["siteSor"]) yukle("siteSor"); if (sokakSor === null) sokakSorYukle(); } }, [ilceId, tab]);

  async function yukle(t) {
    setMesgul(true);
    try {
      if (t === "ozet" || t === "ilerleme" || t === "eksik") {
        // Ziyaret/hane: rapor view'larından (kolonlar: toplam, edilen, mahalle_id)
        // Seçmen/üye: mv_mahalle_ozet'ten (mahalle bazında hazır)
        const [sk, st, mo, mahL] = await Promise.all([
          supabase.from("v_rapor_sokak").select("*").eq("ilce_id", ilceId),
          supabase.from("v_rapor_site").select("*").eq("ilce_id", ilceId),
          supabase.from("mv_mahalle_ozet").select("mahalle_id, kisi, hane, uye"),
          supabase.from("mahalle").select("id, ad").eq("ilce_id", ilceId),
        ]);
        const adOf = {}; (mahL.data || []).forEach((m) => { adOf[m.id] = m.ad; });
        const mm = {};
        const g = (id) => (mm[id] ||= { mahalle_id: id, ad: adOf[id] || mahAd[id] || "—", hane: 0, kisi: 0, uye: 0, ziyaret: 0, site: 0, sokak: 0 });
        // ziyaret + hane (rapor view'larından)
        (sk.data || []).forEach((r) => { if (!r.mahalle_id) return; const x = g(r.mahalle_id); x.ziyaret += r.edilen || 0; x.sokak += 1; });
        (st.data || []).forEach((r) => { if (!r.mahalle_id) return; const x = g(r.mahalle_id); x.ziyaret += r.edilen || 0; x.site += 1; });
        // seçmen/üye/hane (mv_mahalle_ozet — asıl kaynak)
        (mo.data || []).forEach((r) => { if (!r.mahalle_id) return; const x = g(r.mahalle_id); x.kisi = r.kisi || 0; x.uye = r.uye || 0; x.hane = r.hane || 0; });
        const mahOzet = Object.values(mm).filter((x) => x.kisi || x.hane).sort((a, b) => b.kisi - a.kisi);
        const toplam = mahOzet.reduce((a, x) => ({
          hane: a.hane + x.hane, kisi: a.kisi + x.kisi, uye: a.uye + x.uye, ziyaret: a.ziyaret + x.ziyaret,
        }), { hane: 0, kisi: 0, uye: 0, ziyaret: 0 });
        setD((s) => ({ ...s, mahOzet, genelToplam: toplam }));
      } else if (t === "notlar") {
        let q = supabase.from("ziyaret").select("hane_id, not_, tarih, yaklasim, kapsam, kullanici_id")
          .not("not_", "is", null).neq("not_", "").order("tarih", { ascending: false }).limit(500);
        if (ilceId) q = q.eq("ilce_id", ilceId);
        const { data: nt } = await q;
        const notlar = nt || [];
        const haneler = await parcaliIn("hane", "id, adres, kapi_no, kapi_blok, no, site_kayit_id, mahalle_id", notlar.map((n) => n.hane_id));
        const hBy = {}; haneler.forEach((h) => { hBy[h.id] = h; });
        // hanelerin site adları
        const siteIds = [...new Set(haneler.map((h) => h.site_kayit_id).filter(Boolean))];
        const sitAd = {};
        if (siteIds.length) { const st = await parcaliIn("site_kayit", "id, ad", siteIds); st.forEach((s) => { sitAd[s.id] = s.ad; }); }
        const uids = [...new Set(notlar.map((n) => n.kullanici_id).filter(Boolean))];
        let profBy = {};
        if (uids.length) { const { data: pr } = await supabase.from("profiles").select("id, ad_soyad, eposta, rol").in("id", uids); (pr || []).forEach((p) => { profBy[p.id] = p; }); }
        setD((s) => ({ ...s, notlar: notlar.map((n) => ({ ...n, hane: hBy[n.hane_id], siteAd: sitAd[hBy[n.hane_id]?.site_kayit_id], kisi: profBy[n.kullanici_id] })) }));
      } else if (t === "ziyaret") {
        const [sk, st, toplamR, edilenR] = await Promise.all([
          supabase.from("v_rapor_sokak").select("*").eq("ilce_id", ilceId),
          supabase.from("v_rapor_site").select("*").eq("ilce_id", ilceId),
          // Gerçek hane (çift saymadan): her hane 1 kez
          supabase.from("hane").select("*", { count: "exact", head: true }).eq("ilce_id", ilceId),
          // Ziyaret edilen benzersiz hane
          supabase.from("ziyaret").select("hane_id", { count: "exact", head: true }).eq("ilce_id", ilceId).eq("durum", "ziyaret_edildi"),
        ]);
        setD((s) => ({ ...s, sokak: sk.data || [], site: st.data || [], gercekToplam: toplamR.count || 0, gercekEdilen: edilenR.count || 0 }));
      } else if (t === "bloklar") {
        const { data: bg } = await supabase.from("profiles")
          .select("id, ad_soyad, eposta, telefon, meslek, rol, blok, site_kayit_id")
          .in("rol", BLOK_ROLLER).not("site_kayit_id", "is", null);
        const bloklar = bg || [];
        const siteIdSet = [...new Set(bloklar.map((b) => b.site_kayit_id).filter(Boolean))];
        const siteler = await parcaliIn("site_kayit", "id, ad, mahalle_id", siteIdSet);
        const sBy = {}; siteler.forEach((s) => { sBy[s.id] = s; });
        // Görevlisi olan sitelerin TÜM bloklarını çek -> atanmamış blokları bulmak için
        let vblok = [];
        if (siteIdSet.length) vblok = await parcaliIn("v_site_blok", "site_kayit_id, kapi_blok, hane, kisi", siteIdSet, "site_kayit_id");
        // site -> normalize blok kümesi (tüm bloklar)
        const siteBloklar = {}; // site_kayit_id -> Set(normBlok)
        vblok.forEach((v) => { const k = normBlok(v.kapi_blok); if (!k) return; (siteBloklar[v.site_kayit_id] ||= new Set()).add(k); });
        // site -> atanmış blok kümesi (blok_sorumlu rolü olan bloklar)
        const atanmisBlok = {}; // site_kayit_id -> Set(normBlok)
        bloklar.forEach((b) => {
          if (b.rol !== "blok_sorumlu" || !b.site_kayit_id) return;
          blokParts(b.blok).forEach((bk) => { (atanmisBlok[b.site_kayit_id] ||= new Set()).add(normBlok(bk)); });
        });
        // her site için: toplam blok, atanmış blok, boş blok
        const bosBloklar = []; // {siteAd, mahalle_id, bloklar:[...]}
        Object.entries(siteBloklar).forEach(([sid, set]) => {
          const atanmis = atanmisBlok[sid] || new Set();
          const bos = [...set].filter((bk) => !atanmis.has(bk)).sort((a, b) => String(a).localeCompare(String(b), "tr", { numeric: true }));
          if (bos.length) bosBloklar.push({ site_kayit_id: sid, ad: sBy[sid]?.ad || "—", mahalle_id: sBy[sid]?.mahalle_id, bloklar: bos, toplam: set.size, atanan: [...set].length - bos.length });
        });
        bosBloklar.sort((a, b) => b.bloklar.length - a.bloklar.length);
        const toplamBlok = Object.values(siteBloklar).reduce((a, s) => a + s.size, 0);
        const atananBlok = toplamBlok - bosBloklar.reduce((a, x) => a + x.bloklar.length, 0);
        setD((s) => ({ ...s, bloklar: bloklar.map((b) => ({ ...b, site: sBy[b.site_kayit_id] })), bosBloklar, blokOzet: { toplamBlok, atananBlok, bosBlok: toplamBlok - atananBlok } }));
      } else if (t === "siteSor") {
        const mahIds = Object.keys(mahAd);
        let siteler = [];
        if (mahIds.length) siteler = await parcaliIn("site_kayit", "id, ad, mahalle_id, temsilci_id", mahIds, "mahalle_id");
        const temIds = [...new Set(siteler.map((s) => s.temsilci_id).filter(Boolean))];
        let temBy = {};
        if (temIds.length) { const { data: pr } = await supabase.from("profiles").select("id, ad_soyad, eposta, telefon").in("id", temIds); (pr || []).forEach((p) => { temBy[p.id] = p; }); }
        // ilerleme için site özetini (varsa) kullan
        const { data: so } = await supabase.from("v_rapor_site").select("site_kayit_id, toplam, edilen").eq("ilce_id", ilceId);
        const ilBy = {}; (so || []).forEach((x) => { ilBy[x.site_kayit_id] = x; });
        setD((s) => ({ ...s, siteSor: siteler.map((si) => ({ ...si, temsilci: temBy[si.temsilci_id], ilerleme: ilBy[si.id] })) }));
      }
      setYuk((y) => ({ ...y, [t]: true }));
    } catch (e) { /* sessiz */ }
    setMesgul(false);
  }

  const TABS = [
    ["ozet", "Genel Özet", <LayoutDashboard size={15} key="z" />],
    ["ilerleme", "Saha İlerleme", <TrendingUp size={15} key="e" />],
    ["notlar", "Notlar & Yaklaşım", <StickyNote size={15} key="a" />],
    ["teskilat", "Teşkilat", <Network size={15} key="f" />],
    ["yonetimler", "Yönetimler", <Users size={15} key="y" />],
    ["secmen", "Seçmen Raporu", <ClipboardCheck size={15} key="s" />],
    ["talepler", "Talepler", <StickyNote size={15} key="t" />],
    ["eksik", "Eksikler & Uyarılar", <AlertTriangle size={15} key="g" />],
  ];
  const [siteFiltre, setSiteFiltre] = useState("hepsi"); // hepsi | atanan | atanmayan
  const [blokFiltre, setBlokFiltre] = useState("hepsi"); // hepsi | blok_sorumlu | ana_kademe | kadin_kollari | genclik_kollari
  const [acikMah, setAcikMah] = useState(() => new Set()); // ziyaret kırılımında açık mahalleler
  const f = ara.trim().toLocaleLowerCase("tr");
  // Mahalle filtresi — seçiliyse tüm veriyi o mahalleye indir
  const mahOzetF = mahFiltre ? (d.mahOzet || []).filter((m) => m.mahalle_id === mahFiltre) : (d.mahOzet || []);
  const notlarF = mahFiltre ? (d.notlar || []).filter((n) => n.hane?.mahalle_id === mahFiltre) : (d.notlar || []);
  const bosBloklarF = mahFiltre ? (d.bosBloklar || []).filter((b) => b.mahalle_id === mahFiltre) : (d.bosBloklar || []);
  const siteSorF = mahFiltre ? (d.siteSor || []).filter((s) => s.mahalle_id === mahFiltre) : (d.siteSor || []);
  const dF = { ...d, mahOzet: mahOzetF, notlar: notlarF, bosBloklar: bosBloklarF, siteSor: siteSorF };
  const mahAdiSecili = mahFiltre ? (mahAd[mahFiltre] || "") : "";
  const mahToggle = (k) => setAcikMah((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="page">
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px" }}>Başkan Paneli</h1>
        <div style={{ fontSize: 13, color: "#64748b" }}>Tüm saha verilerine tek yerden bakış — notlar, ziyaret durumu, bloklar ve sorumlular</div>
      </div>

      {/* sekmeler */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map(([id, et, ic]) => (
          <button key={id} onClick={() => { setTab(id); setAra(""); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: "1px solid " + (tab === id ? "#c2410c" : "#e2e8f0"), background: tab === id ? "#c2410c" : "#fff", color: tab === id ? "#fff" : "#334155" }}>
            {ic}{et}
          </button>
        ))}
      </div>

      {/* mahalle seçici */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Kapsam:</span>
        <select value={mahFiltre} onChange={(e) => setMahFiltre(e.target.value)}
          style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 9, fontSize: 13.5, fontWeight: 600, background: "#fff", color: "#0f172a", cursor: "pointer", minWidth: 200 }}>
          <option value="">Tüm İlçe (Başakşehir)</option>
          {Object.entries(mahAd)
            .filter(([, ad]) => MAHALLE_NUFUS[String(ad).trim()] != null) // sadece tanımlı 10 mahalle
            .sort((a, b) => a[1].localeCompare(b[1], "tr")).map(([id, ad]) => (
            <option key={id} value={id}>{ad}</option>
          ))}
        </select>
        {mahFiltre && (
          <button onClick={() => setMahFiltre("")} style={{ fontSize: 12.5, color: "#c2410c", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontWeight: 600 }}>
            Tüm ilçeye dön
          </button>
        )}
      </div>

      {/* arama */}
      <div style={{ position: "relative", marginBottom: 12, maxWidth: 420 }}>
        <Search size={15} style={{ position: "absolute", left: 11, top: 10, color: "#94a3b8" }} />
        <input value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Ara…"
          style={{ width: "100%", padding: "8px 10px 8px 32px", border: "1px solid #d1d5db", borderRadius: 9, fontSize: 14 }} />
      </div>

      {mesgul && <div style={{ color: "#64748b", fontSize: 13, padding: 8 }}>Yükleniyor…</div>}

      {/* ---- GENEL ÖZET ---- */}
      {tab === "ozet" && !mesgul && (() => {
        const t = mahFiltre
          ? (mahOzetF[0] || { hane: 0, kisi: 0, uye: 0, ziyaret: 0 })
          : (dF.genelToplam || { hane: 0, kisi: 0, uye: 0, ziyaret: 0 });
        const uyeOran = oran(t.uye, t.kisi), ziyOran = oran(t.ziyaret, t.hane);
        const kart = (ikon, etiket, deger, alt, renk) => (
          <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px", flex: "1 1 170px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: renk, marginBottom: 6 }}>{ikon}<span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{etiket}</span></div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{deger}</div>
            {alt && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{alt}</div>}
          </div>
        );
        return (
          <div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {kart(<Users size={16} />, "Toplam Seçmen", fmt(t.kisi), `${fmt((dF.mahOzet || []).length)} mahalle`, "#2563eb")}
              {kart(<Home size={16} />, "Hane", fmt(t.hane), null, "#7c3aed")}
              {kart(<ShieldCheck size={16} />, "AK Parti Üye", fmt(t.uye), `%${uyeOran} üyelik`, "#16a34a")}
              {kart(<ClipboardCheck size={16} />, "Ziyaret Edilen", fmt(t.ziyaret), `%${ziyOran} hane`, "#ea580c")}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Seçmen ve Üye — mahalle bazında</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={(dF.mahOzet || []).map((m) => ({ ad: m.ad.length > 10 ? m.ad.slice(0, 9) + "…" : m.ad, tamAd: m.ad, secmen: m.kisi, uye: m.uye }))} margin={{ top: 5, right: 8, left: 4, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="ad" tick={{ fontSize: 11, fill: "#64748b" }} angle={-35} textAnchor="end" height={50} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(0) + "b" : v} />
                  <Tooltip formatter={(v, n) => [fmt(v), n === "secmen" ? "Seçmen" : "Üye"]} labelFormatter={(l, p) => p?.[0]?.payload?.tamAd || l} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === "secmen" ? "Seçmen" : "Üye"} />
                  <Bar dataKey="secmen" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="uye" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "11px 15px", borderBottom: "1px solid #eef2f7", fontWeight: 800, fontSize: 14 }}>Mahalle Kırılımı</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 620 }}>
                  <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "right" }}>
                    <th style={{ textAlign: "left", padding: "9px 15px" }}>Mahalle</th>
                    <th style={{ padding: "9px 10px" }}>Seçmen</th><th style={{ padding: "9px 10px" }}>Hane</th>
                    <th style={{ padding: "9px 10px" }}>Üye</th><th style={{ padding: "9px 10px" }}>Üyelik %</th>
                    <th style={{ padding: "9px 10px" }}>Ziyaret</th><th style={{ padding: "9px 15px" }}>Ziyaret %</th>
                  </tr></thead>
                  <tbody>
                    {(dF.mahOzet || []).map((m) => {
                      const uo = oran(m.uye, m.kisi), zo = oran(m.ziyaret, m.hane);
                      return (
                        <tr key={m.mahalle_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "9px 15px", fontWeight: 700 }}>{m.ad}</td>
                          <td style={{ padding: "9px 10px", textAlign: "right" }}>{fmt(m.kisi)}</td>
                          <td style={{ padding: "9px 10px", textAlign: "right" }}>{fmt(m.hane)}</td>
                          <td style={{ padding: "9px 10px", textAlign: "right", color: "#16a34a", fontWeight: 700 }}>{fmt(m.uye)}</td>
                          <td style={{ padding: "9px 10px", textAlign: "right" }}>%{uo}</td>
                          <td style={{ padding: "9px 10px", textAlign: "right" }}>{fmt(m.ziyaret)}</td>
                          <td style={{ padding: "9px 15px", textAlign: "right" }}>
                            <span style={{ display: "inline-block", minWidth: 42, padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 12,
                              background: zo >= 50 ? "#dcfce7" : zo >= 20 ? "#fef9c3" : "#fee2e2",
                              color: zo >= 50 ? "#166534" : zo >= 20 ? "#854d0e" : "#991b1b" }}>%{zo}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---- SAHA İLERLEME ---- */}
      {tab === "ilerleme" && !mesgul && (() => {
        const rows = (dF.mahOzet || []).slice().sort((a, b) => oran(b.ziyaret, b.hane) - oran(a.ziyaret, a.hane));
        const grafik = rows.map((m) => ({
          ad: m.ad.length > 10 ? m.ad.slice(0, 9) + "…" : m.ad, tamAd: m.ad,
          ziyaret: oran(m.ziyaret, m.hane), uyelik: oran(m.uye, m.kisi),
          uye: m.uye, kisi: m.kisi,
        }));
        const RENK = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04", "#db2777", "#059669", "#4f46e5"];
        const uyePasta = rows.map((m, i) => ({ ad: m.ad, deger: m.uye, renk: RENK[i % RENK.length] }));
        const bar = (deger, renk) => (
          <div style={{ background: "#f1f5f9", borderRadius: 999, height: 10, overflow: "hidden", flex: 1 }}>
            <div style={{ width: `${Math.min(100, deger)}%`, height: "100%", background: renk, borderRadius: 999 }} />
          </div>
        );
        return (
          <div style={{ display: "grid", gap: 12 }}>
            {/* Grafik 1: Ziyaret + Üyelik oranı bar chart */}
            <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Ziyaret & Üyelik Oranı (%) — mahalle bazında</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={grafik} margin={{ top: 5, right: 8, left: -18, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="ad" tick={{ fontSize: 11, fill: "#64748b" }} angle={-35} textAnchor="end" height={50} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip formatter={(v, n) => [`%${v}`, n === "ziyaret" ? "Ziyaret" : "Üyelik"]} labelFormatter={(l, p) => p?.[0]?.payload?.tamAd || l} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === "ziyaret" ? "Ziyaret %" : "Üyelik %"} />
                  <Bar dataKey="ziyaret" fill="#ea580c" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="uyelik" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Grafik 2: Üye dağılımı pasta */}
            <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Üye Dağılımı — mahalleye göre</div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={uyePasta} dataKey="deger" nameKey="ad" cx="50%" cy="50%" outerRadius={95} innerRadius={45}
                    label={(e) => `${e.ad}: ${fmt(e.deger)}`} labelLine={false} style={{ fontSize: 11 }}>
                    {uyePasta.map((e, i) => <Cell key={i} fill={e.renk} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [fmt(v) + " üye", ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Detay bar listeleri */}
            {["Ziyaret Tamamlanma", "Üyelik Oranı"].map((baslik, gi) => (
              <div key={gi} style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "13px 16px" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>{baslik} — sıralı</div>
                <div style={{ display: "grid", gap: 9 }}>
                  {rows.map((m) => {
                    const deger = gi === 0 ? oran(m.ziyaret, m.hane) : oran(m.uye, m.kisi);
                    const renk = gi === 0 ? "#ea580c" : "#16a34a";
                    return (
                      <div key={m.mahalle_id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <div style={{ width: 130, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.ad}</div>
                        {bar(deger, renk)}
                        <div style={{ width: 46, textAlign: "right", fontWeight: 700, color: renk }}>%{deger}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ---- TEŞKİLAT ŞEMASI ---- */}
      {tab === "secmen" && !mesgul && (() => {
        if (secmenRapor === null) return <div className="merkez">Yükleniyor…</div>;
        const renkler = [
          { d: 5, ad: "Beyaz — AK Parti", bg: "#ffffff", kenar: "#cbd5e1" },
          { d: 3, ad: "Gri — Kararsız seçmen", bg: "#9ca3af", kenar: "#6b7280" },
          { d: 1, ad: "Siyah — Başka Parti", bg: "#1f2937", kenar: "#111827" },
        ];
        const q = (ara || "").toLocaleLowerCase("tr").trim();
        let liste = (secmenRapor[renkSec] || []).filter((k) => !mahFiltre || k.mahalle_id === mahFiltre);
        if (q) liste = liste.filter((k) => `${k.ad} ${k.soyad}`.toLocaleLowerCase("tr").includes(q));
        return (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {renkler.map((r) => (
                <button key={r.d} onClick={() => setRenkSec(r.d)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, border: renkSec === r.d ? "2px solid #0f172a" : "1px solid #e5eaf2", background: "#fff", cursor: "pointer", flex: "1 1 180px" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, background: r.bg, border: `1px solid ${r.kenar}` }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{r.ad}</span>
                  <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{fmt((secmenRapor[r.d] || []).length)}</span>
                </button>
              ))}
            </div>
            {(() => {
              const barRenk = renkSec === 1 ? "#1f2937" : renkSec === 3 ? "#9ca3af" : "#16a34a";
              const dag = {};
              (secmenRapor[renkSec] || []).forEach((k) => { const m = mahAd[k.mahalle_id] || "—"; dag[m] = (dag[m] || 0) + 1; });
              const bar = Object.entries(dag).map(([ad, adet]) => ({ ad: ad.length > 12 ? ad.slice(0, 11) + "…" : ad, tamAd: ad, adet })).sort((a, b) => b.adet - a.adet);
              if (!bar.length) return null;
              return (
                <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Mahalleye göre dağılım <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12 }}>· tıkla → o mahalleye filtrele</span></div>
                  <ResponsiveContainer width="100%" height={Math.max(160, bar.length * 32)}>
                    <BarChart data={bar} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="ad" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip formatter={(v) => [fmt(v) + " kişi", ""]} labelFormatter={(l, pl) => pl?.[0]?.payload?.tamAd || l} />
                      <Bar dataKey="adet" fill={barRenk} radius={[0, 4, 4, 0]} maxBarSize={22}
                        onClick={(d) => { const mid = Object.keys(mahAd).find((k) => mahAd[k] === (d?.tamAd)); if (mid) setMahFiltre(mahFiltre === mid ? "" : mid); }}
                        style={{ cursor: "pointer" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>{fmt(liste.length)} kişi{mahFiltre ? " · " + (mahAd[mahFiltre] || "") : ""}{q ? ` · "${ara}"` : ""}</div>
              <button onClick={secmenDisaAktar} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>⬇ Excel'e indir</button>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {liste.slice(0, 300).map((k, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "6px 10px", background: "#fff", border: "1px solid #eef2f7", borderRadius: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{k.ad} {k.soyad}{k.telefon ? <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12 }}> · {k.telefon}</span> : null}</div>
                    {(k.site || k.adres) && <div style={{ fontSize: 11.5, color: "#94a3b8" }}>{k.site && <span style={{ color: "#7c3aed", fontWeight: 600 }}>🏢 {k.site}</span>}{k.site && k.adres ? " · " : ""}{k.adres}</div>}
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: 12, whiteSpace: "nowrap" }}>{mahAd[k.mahalle_id] || ""}</span>
                </div>
              ))}
              {liste.length > 300 && <div style={{ fontSize: 12, color: "#94a3b8", padding: 8 }}>+{fmt(liste.length - 300)} kişi daha… (arama/mahalle filtresiyle daralt)</div>}
              {liste.length === 0 && <div style={{ color: "#94a3b8", padding: 24, textAlign: "center" }}>Bu renkte kayıt yok.</div>}
            </div>
          </div>
        );
      })()}

      {tab === "talepler" && <Talepler profil={profil} />}

      {tab === "yonetimler" && !mesgul && (() => {
        if (yonetimler === null) return <div className="merkez">Yükleniyor…</div>;
        const q = (ara || "").toLocaleLowerCase("tr").trim();
        let liste = yonetimler.filter((x) => !mahFiltre || x.mahalle_id === mahFiltre);
        if (q) liste = liste.filter((x) => (x.kod || "").toLocaleLowerCase("tr").includes(q) || (x.baskan?.ad_soyad || "").toLocaleLowerCase("tr").includes(q) || x.uyeler.some((u) => (u.ad_soyad || "").toLocaleLowerCase("tr").includes(q)));
        const byMah = {};
        liste.forEach((x) => { const m = mahAd[x.mahalle_id] || "—"; (byMah[m] = byMah[m] || []).push(x); });
        const mahlar = Object.keys(byMah).sort((a, b) => a.localeCompare(b, "tr"));
        const tamSay = liste.filter((x) => x.uyeler.length >= 3).length;
        const eksikSay = liste.filter((x) => x.atanmis && x.uyeler.length < 3).length;
        const sorumsuz = liste.filter((x) => !x.atanmis).length;
        return (
          <div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
              Toplam <b>{liste.length}</b> sokak grubu · <b style={{ color: "#16a34a" }}>{tamSay}</b> tam · <b style={{ color: "#ea580c" }}>{eksikSay}</b> eksik · <b style={{ color: "#dc2626" }}>{sorumsuz}</b> sorumlusuz
            </div>
            {mahlar.map((m) => (
              <div key={m} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>{m} <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12 }}>({byMah[m].length})</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {byMah[m].map((x) => {
                    const tam = x.uyeler.length >= 3;
                    const renk = !x.atanmis ? "#dc2626" : (tam ? "#16a34a" : "#ea580c");
                    const metin = !x.atanmis ? "Sorumlusuz" : (tam ? "Tam" : "Eksik");
                    return (
                      <div key={x.id} style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <b style={{ fontSize: 13.5 }}>{x.kod}</b>
                          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#fff", background: renk, padding: "1px 9px", borderRadius: 999 }}>{metin} · {x.uyeler.length}/3 üye</span>
                        </div>
                        {x.baskan ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 5 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: 999 }}>👑</span>
                            <b>{x.baskan.ad_soyad}</b>{x.baskan.telefon && <span style={{ color: "#64748b", fontSize: 12 }}>· {x.baskan.telefon}</span>}
                          </div>
                        ) : <div style={{ fontSize: 12.5, color: "#dc2626", marginBottom: 5 }}>Sorumlu atanmamış</div>}
                        {x.uyeler.map((u, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginBottom: 3, color: "#334155" }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, background: "#eef2ff", color: "#3730a3", padding: "1px 6px", borderRadius: 999 }}>ÜYE</span>
                            {u.ad_soyad}{u.telefon && <span style={{ color: "#94a3b8", fontSize: 11 }}>· {u.telefon}</span>}
                          </div>
                        ))}
                        {x.atanmis && x.uyeler.length < 3 && <div style={{ fontSize: 11.5, color: "#ea580c", marginTop: 4 }}>{3 - x.uyeler.length} üye daha gerekli</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {liste.length === 0 && <div style={{ color: "#94a3b8", padding: 24, textAlign: "center" }}>Kayıt yok.</div>}
          </div>
        );
      })()}

      {tab === "teskilat" && !mesgul && (() => {
        const bas = (ad) => String(ad || "").trim().split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toLocaleUpperCase("tr");
        const kisiSatir = (kisi, gorev) => {
          const kadin = !!(kisi && kisi.k);
          const renk = kadin ? { bg: "#fce7f3", fg: "#9d174d" } : { bg: "#e0edff", fg: "#1e40af" };
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", flex: "0 0 auto", background: kisi ? renk.bg : "#e5e7eb", color: kisi ? renk.fg : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{kisi ? bas(kisi.ad) : "—"}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: kisi ? "#0f172a" : "#94a3b8" }}>{kisi ? kisi.ad : "— atanmadı —"}</div>
                <div style={{ fontSize: 10.5, color: "#64748b" }}>{gorev}{kisi && kisi.unvan ? ` · ${kisi.unvan}` : ""}</div>
              </div>
            </div>
          );
        };
        return (
          <div>
            <div style={{ background: "#0b2a5b", color: "#fff", borderRadius: 12, padding: "14px 18px", marginBottom: 14, textAlign: "center", position: "relative" }}>
              <div style={{ fontSize: 12, color: "#cadcfc", marginBottom: 3 }}>İlçe Başkanı</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{ilceBaskan?.ad_soyad || "—"}</div>
              {ilceBaskan?.telefon && <div style={{ fontSize: 12, color: "#cadcfc", marginTop: 2 }}>{ilceBaskan.telefon}</div>}
              {ilYonetici && <button onClick={() => setIbForm({ ad: ilceBaskan?.ad_soyad || "", tel: ilceBaskan?.telefon || "", hesap: false })} style={{ position: "absolute", top: 12, right: 12, fontSize: 11.5, fontWeight: 700, background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>Düzenle</button>}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>İl Sorumluları</b>
                {ilYonetici && <button onClick={() => setIlSorForm({ ad: "", gorev: "", tel: "" })} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>+ Ekle</button>}
              </div>
              {ilSorumlular.length === 0 && <div className="dim" style={{ fontSize: 13, marginBottom: 6 }}>İl sorumlusu eklenmemiş.</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                {ilSorumlular.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 9, padding: "8px 10px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{r.ad_soyad}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{r.gorev_metin}{r.telefon ? " · " + r.telefon : ""}</div>
                    </div>
                    {ilYonetici && <button onClick={() => ilSorumluSil(r)} style={{ marginLeft: "auto", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Sil</button>}
                  </div>
                ))}
              </div>
              {ilYonetici && ilSorForm && (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <input placeholder="Ad Soyad" value={ilSorForm.ad} onChange={(e) => setIlSorForm((s) => ({ ...s, ad: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, flex: 1, minWidth: 140 }} />
                  <input placeholder="Görev (Sorumlu İl YK Üyesi…)" value={ilSorForm.gorev} onChange={(e) => setIlSorForm((s) => ({ ...s, gorev: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, flex: 1, minWidth: 180 }} />
                  <input placeholder="Telefon" value={ilSorForm.tel} onChange={(e) => setIlSorForm((s) => ({ ...s, tel: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, width: 120 }} />
                  <button onClick={ilSorumluEkle} style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ekle</button>
                  <button onClick={() => setIlSorForm(null)} style={{ padding: "8px 12px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>İptal</button>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {(teskilatMah || []).map((t) => (
                <div key={t.mahalle_id} style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #eef2f7" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{t.ad}</div>
                    {yonetici && <button onClick={() => setDuzenleMah({ mahalle_id: t.mahalle_id, ad: t.ad })} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "#c2410c", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 7, padding: "3px 10px", cursor: "pointer" }}>Düzenle</button>}
                  </div>
                  <div style={{ display: "grid", gap: 9 }}>
                    {kisiSatir(t.baskan, "Mahalle Başkanı")}
                    {kisiSatir(t.yurutme, "İlçe Yürütme Kurulu Üyesi")}
                    {(t.yk && t.yk.length ? t.yk : [null]).map((p, i) => <div key={"y" + i}>{kisiSatir(p, "İlçe Yönetim Kurulu Üyesi")}</div>)}
                    {(t.meclis && t.meclis.length ? t.meclis : [null]).map((p, i) => <div key={"m" + i}>{kisiSatir(p, "Belediye Meclis Üyesi")}</div>)}
                    {t.bby ? <div>{kisiSatir(t.bby, "Belediye Başkan Yardımcısı")}</div> : null}
                  </div>
                </div>
              ))}
              {yonetici && (
                <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <button onClick={() => setDuzenleMah({ mahalle_id: "", ad: "" })} style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>+ Mahalle teşkilatı ekle/düzenle</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {ibForm && (
        <div onClick={() => setIbForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 14, padding: 18 }}>
            <h3 style={{ margin: "0 0 12px" }}>İlçe Başkanı</h3>
            <input placeholder="Ad Soyad" value={ibForm.ad} onChange={(e) => setIbForm({ ...ibForm, ad: e.target.value })} style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, marginBottom: 10, boxSizing: "border-box" }} />
            <input placeholder="Telefon" value={ibForm.tel} onChange={(e) => setIbForm({ ...ibForm, tel: e.target.value })} style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, marginBottom: 10, boxSizing: "border-box" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 14 }}>
              <input type="checkbox" checked={ibForm.hesap} onChange={(e) => setIbForm({ ...ibForm, hesap: e.target.checked })} /> giriş hesabı aç (ilçe yönetimi)
            </label>
            {ibForm.sonuc && <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}><b style={{ color: "#065f46" }}>Hesap açıldı:</b><div style={{ fontFamily: "monospace", marginTop: 4 }}>{ibForm.sonuc.eposta}</div><div style={{ fontFamily: "monospace" }}>{ibForm.sonuc.sifre}</div></div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setIbForm(null)} style={{ flex: 1, padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Kapat</button>
              <button onClick={ilceBaskanKaydet} disabled={ibForm.mesgul} style={{ flex: 1, padding: 10, border: "none", borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{ibForm.mesgul ? "Kaydediliyor…" : "Kaydet"}</button>
            </div>
          </div>
        </div>
      )}

      {duzenleMah && (
        <div onClick={() => setDuzenleMah(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, background: "#fff", borderRadius: 14, marginTop: 20, overflow: "hidden" }}>
            <TeskilatYonetim session={null} sabitMahId={duzenleMah.mahalle_id || undefined}
              onKapat={() => setDuzenleMah(null)} onDegisti={teskilatYukle} />
          </div>
        </div>
      )}

      {/* ---- EKSİKLER & UYARILAR ---- */}
      {tab === "eksik" && !mesgul && (() => {
        const bos = dF.bosBloklar || [];
        const bosGorevMah = (dF.mahOzet || []).filter((m) => !m.uye && !m.ziyaret);
        const dusukZiyaret = (dF.mahOzet || []).filter((m) => oran(m.ziyaret, m.hane) < 10);
        const siteler = dF.siteSor || [];
        const atanmamisSite = siteler.filter((s) => !s.temsilci_id);
        const atananSite = siteler.length - atanmamisSite.length;
        const bosBlokSay = bos.reduce((a, x) => a + x.bloklar.length, 0);
        // Mahalle seçiliyse o mahallenin blok toplamını filtrelenmiş listeden türet
        const toplamBlok = mahFiltre ? bos.reduce((a, x) => a + (x.toplam || 0), 0) : (d.blokOzet?.toplamBlok || 0);
        const atananBlok = mahFiltre ? Math.max(0, toplamBlok - bosBlokSay) : (d.blokOzet?.atananBlok || 0);

        // Atanmamış siteleri mahalleye göre grupla (bar chart)
        const siteMah = {};
        atanmamisSite.forEach((s) => { const m = mahAd[s.mahalle_id] || "—"; siteMah[m] = (siteMah[m] || 0) + 1; });
        const siteMahBar = Object.entries(siteMah).map(([ad, s]) => ({ ad: ad.length > 10 ? ad.slice(0, 9) + "…" : ad, tamAd: ad, adet: s })).sort((a, b) => b.adet - a.adet);
        // Atanmamış blokları mahalleye göre grupla
        const blokMah = {};
        bos.forEach((b) => { const m = mahAd[b.mahalle_id] || "—"; blokMah[m] = (blokMah[m] || 0) + b.bloklar.length; });
        const blokMahBar = Object.entries(blokMah).map(([ad, s]) => ({ ad: ad.length > 10 ? ad.slice(0, 9) + "…" : ad, tamAd: ad, adet: s })).sort((a, b) => b.adet - a.adet);

        const donut = (baslik, atanan, bosSay, renkBos) => {
          const veri = [{ ad: "Atanan", deger: atanan, renk: "#16a34a" }, { ad: "Eksik", deger: bosSay, renk: renkBos }].filter((x) => x.deger > 0);
          const tam = atanan + bosSay;
          return (
            <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{baslik}</div>
              {tam ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={veri} dataKey="deger" nameKey="ad" cx="50%" cy="50%" outerRadius={80} innerRadius={48} label={(e) => `${e.ad}: ${fmt(e.deger)}`} labelLine={false} style={{ fontSize: 11 }}>
                      {veri.map((e, i) => <Cell key={i} fill={e.renk} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [fmt(v), ""]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ color: "#94a3b8", fontSize: 13, padding: 24, textAlign: "center" }}>Veri yok</div>}
              <div style={{ textAlign: "center", fontSize: 12, color: "#64748b", marginTop: 4 }}>
                <b style={{ color: bosSay ? renkBos : "#16a34a", fontSize: 15 }}>%{oran(atanan, tam)}</b> tamamlandı
              </div>
            </div>
          );
        };

        const kutu = (renk, ikon, baslik, adet, ic) => (
          <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ padding: "11px 15px", borderBottom: "1px solid #eef2f7", display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 14, color: renk }}>
              {ikon}{baslik}<span style={{ marginLeft: "auto", background: renk, color: "#fff", fontSize: 12, padding: "1px 9px", borderRadius: 999 }}>{adet}</span>
            </div>
            <div style={{ padding: "6px 15px 12px" }}>{ic}</div>
          </div>
        );

        return (
          <div>
            {/* Tamamlanma donutları */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 14 }}>
              {donut("Site Sorumlusu Atama", atananSite, atanmamisSite.length, "#dc2626")}
              {donut("Blok Sorumlusu Atama", atananBlok, bosBlokSay, "#ea580c")}
            </div>

            {/* Mahalleye göre eksik dağılımı */}
            {(siteMahBar.length > 0 || blokMahBar.length > 0) && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginBottom: 14 }}>
                {siteMahBar.length > 0 && (
                  <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Atanmamış Site — mahalleye göre</div>
                    <ResponsiveContainer width="100%" height={Math.max(160, siteMahBar.length * 34)}>
                      <BarChart data={siteMahBar} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="ad" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={90} />
                        <Tooltip formatter={(v) => [fmt(v) + " site", ""]} labelFormatter={(l, p) => p?.[0]?.payload?.tamAd || l} />
                        <Bar dataKey="adet" fill="#dc2626" radius={[0, 4, 4, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {blokMahBar.length > 0 && (
                  <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Atanmamış Blok — mahalleye göre</div>
                    <ResponsiveContainer width="100%" height={Math.max(160, blokMahBar.length * 34)}>
                      <BarChart data={blokMahBar} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="ad" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={90} />
                        <Tooltip formatter={(v) => [fmt(v) + " blok", ""]} labelFormatter={(l, p) => p?.[0]?.payload?.tamAd || l} />
                        <Bar dataKey="adet" fill="#ea580c" radius={[0, 4, 4, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Detay listeleri */}
            {kutu("#dc2626", <UserCheck size={15} />, "Sorumlusu Atanmamış Siteler", atanmamisSite.length,
              atanmamisSite.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {atanmamisSite.slice(0, 50).map((s, i) => (
                    <div key={s.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i ? "1px solid #f8fafc" : "none" }}>
                      <span style={{ fontWeight: 600 }}>{s.ad}</span>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>{mahAd[s.mahalle_id] || ""}</span>
                    </div>
                  ))}
                  {atanmamisSite.length > 50 && <div style={{ fontSize: 12, color: "#94a3b8" }}>+{atanmamisSite.length - 50} site daha…</div>}
                </div>
              ) : <div style={{ fontSize: 13, color: "#16a34a" }}>Tüm sitelere temsilci atanmış ✓</div>)}

            {kutu("#ea580c", <Boxes size={15} />, "Sorumlusu Atanmamış Bloklar", bosBlokSay,
              bos.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {bos.slice(0, 40).map((b, i) => (
                    <div key={i} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i ? "1px solid #f8fafc" : "none" }}>
                      <span style={{ fontWeight: 600 }}>{b.ad}<span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12 }}> · {mahAd[b.mahalle_id] || ""}</span></span>
                      <span style={{ color: "#ea580c", fontWeight: 700 }}>{b.bloklar.length} blok boş</span>
                    </div>
                  ))}
                  {bos.length > 40 && <div style={{ fontSize: 12, color: "#94a3b8" }}>+{bos.length - 40} site daha…</div>}
                </div>
              ) : <div style={{ fontSize: 13, color: "#16a34a" }}>Tüm bloklara sorumlu atanmış ✓</div>)}

            {kutu("#7c3aed", <MapPin size={15} />, "Ziyaret İlerlemesi Düşük Mahalleler (%10 altı)", dusukZiyaret.length,
              dusukZiyaret.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {dusukZiyaret.map((m) => (
                    <div key={m.mahalle_id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                      <span style={{ fontWeight: 600 }}>{m.ad}</span>
                      <span style={{ color: "#7c3aed", fontWeight: 700 }}>%{oran(m.ziyaret, m.hane)} · {fmt(m.ziyaret)}/{fmt(m.hane)}</span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 13, color: "#16a34a" }}>Tüm mahalleler %10 üzeri ✓</div>)}

            {kutu("#0891b2", <AlertTriangle size={15} />, "Hiç Aktivite Olmayan Mahalleler", bosGorevMah.length,
              bosGorevMah.length ? (
                <div style={{ fontSize: 13, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {bosGorevMah.map((m) => <span key={m.mahalle_id} style={{ background: "#cffafe", color: "#155e75", padding: "3px 10px", borderRadius: 999, fontWeight: 600 }}>{m.ad}</span>)}
                </div>
              ) : <div style={{ fontSize: 13, color: "#16a34a" }}>Her mahallede üye/ziyaret aktivitesi var ✓</div>)}

            {(() => {
              const sok = (sokakSor || []).filter((x) => !mahFiltre || x.mahalle_id === mahFiltre);
              const sokAtanan = sok.filter((x) => x.atanmis);
              const sokAtanmayan = sok.filter((x) => !x.atanmis);
              const sokEkipTam = sokAtanan.filter((x) => x.uye >= 3);   // başkan hariç ≥3 üye
              const sokYonetimEksik = sokAtanan.filter((x) => x.uye < 3);
              return (
                <>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", margin: "22px 0 10px" }}>Sokak Sorumluları</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 14 }}>
                    {donut("Sokak Sorumlusu Atama", sokAtanan.length, sokAtanmayan.length, "#dc2626")}
                    {donut("Sokak Yönetimi (başkan hariç 3 üye) Kurulumu", sokEkipTam.length, sokYonetimEksik.length, "#ea580c")}
                  </div>
                  {kutu("#dc2626", <UserCheck size={15} />, "Sokak Sorumlusu Atanmamış Sokaklar", sokAtanmayan.length,
                    sokAtanmayan.length ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {sokAtanmayan.slice(0, 60).map((x, i) => (
                          <div key={x.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i ? "1px solid #f8fafc" : "none" }}>
                            <span style={{ fontWeight: 600 }}>{x.kod}</span>
                            <span style={{ color: "#94a3b8", fontSize: 12 }}>{mahAd[x.mahalle_id] || ""}</span>
                          </div>
                        ))}
                        {sokAtanmayan.length > 60 && <div style={{ fontSize: 12, color: "#94a3b8" }}>+{sokAtanmayan.length - 60} sokak daha…</div>}
                      </div>
                    ) : <div style={{ fontSize: 13, color: "#16a34a" }}>Tüm sokaklara sorumlu atanmış ✓</div>)}
                  {kutu("#ea580c", <Users size={15} />, "Yönetimi Kurulmamış Sokaklar (başkan hariç 3 üye)", sokYonetimEksik.length,
                    sokYonetimEksik.length ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {sokYonetimEksik.slice(0, 60).map((x, i) => (
                          <EkipRozet key={x.id} grupId={x.id} cocuk={
                            <div style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i ? "1px solid #f8fafc" : "none", cursor: "pointer", width: "100%" }}>
                              <span style={{ fontWeight: 600 }}>{x.kod}<span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12 }}> · {mahAd[x.mahalle_id] || ""}{x.sorumlu ? " · " + x.sorumlu : ""}</span></span>
                              <span style={{ color: "#ea580c", fontWeight: 700 }}>{x.uye}/3 üye</span>
                            </div>
                          } />
                        ))}
                        {sokYonetimEksik.length > 60 && <div style={{ fontSize: 12, color: "#94a3b8" }}>+{sokYonetimEksik.length - 60} sokak daha…</div>}
                      </div>
                    ) : <div style={{ fontSize: 13, color: "#16a34a" }}>Atanan tüm sokaklarda ekip kurulmuş ✓</div>)}
                </>
              );
            })()}
          </div>
        );
      })()}

      {/* ---- NOTLAR ---- */}
      {tab === "notlar" && !mesgul && (() => {
        const notlar = dF.notlar || [];
        // Yaklaşım dağılımı (siyah/gri/beyaz)
        const yakSay = { Siyah: 0, Gri: 0, Beyaz: 0, "Belirtilmemiş": 0 };
        notlar.forEach((n) => { const y = yaklasimBilgi(n.yaklasim); yakSay[y ? y.ad : "Belirtilmemiş"]++; });
        const yakPasta = [
          { ad: "Siyah", deger: yakSay.Siyah, renk: "#1f2937" },
          { ad: "Gri", deger: yakSay.Gri, renk: "#9ca3af" },
          { ad: "Beyaz", deger: yakSay.Beyaz, renk: "#e5e7eb" },
          { ad: "Belirtilmemiş", deger: yakSay["Belirtilmemiş"], renk: "#c7d2fe" },
        ].filter((x) => x.deger > 0);
        // En aktif sorumlular
        const kisiSay = {};
        notlar.forEach((n) => { const ad = n.kisi?.ad_soyad || n.kisi?.eposta || "Bilinmiyor"; kisiSay[ad] = (kisiSay[ad] || 0) + 1; });
        const kisiBar = Object.entries(kisiSay).map(([ad, s]) => ({ ad: ad.length > 14 ? ad.slice(0, 13) + "…" : ad, tamAd: ad, not: s })).sort((a, b) => b.not - a.not).slice(0, 10);
        // Günlük giriş
        const gunSay = {};
        notlar.forEach((n) => { if (!n.tarih) return; const g = new Date(n.tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }); gunSay[g] = (gunSay[g] || 0) + 1; });
        const gunBar = Object.entries(gunSay).map(([g, s]) => ({ gun: g, not: s })).slice(-14);
        // Haftalık kırılım: ISO hafta anahtarı
        const haftaAnahtar = (tarih) => {
          const dt = new Date(tarih); const g = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
          const gun = g.getUTCDay() || 7; g.setUTCDate(g.getUTCDate() + 4 - gun);
          const yilBas = new Date(Date.UTC(g.getUTCFullYear(), 0, 1));
          const hafta = Math.ceil((((g - yilBas) / 86400000) + 1) / 7);
          return { key: `${g.getUTCFullYear()}-H${String(hafta).padStart(2, "0")}`, etiket: `${hafta}. hf` };
        };
        const haftaSay = {};
        notlar.forEach((n) => { if (!n.tarih) return; const h = haftaAnahtar(n.tarih); (haftaSay[h.key] ||= { et: h.etiket, not: 0 }).not++; });
        const haftaBar = Object.entries(haftaSay).sort((a, b) => a[0].localeCompare(b[0])).slice(-10).map(([, v]) => ({ hafta: v.et, not: v.not }));
        // Kişi × hafta aktivite matrisi (son 6 hafta) — kim ne yapıyor
        const sonHaftalar = [...new Set(notlar.filter((n) => n.tarih).map((n) => haftaAnahtar(n.tarih).key))].sort().slice(-6);
        const kisiHafta = {};
        notlar.forEach((n) => {
          if (!n.tarih) return;
          const ad = n.kisi?.ad_soyad || n.kisi?.eposta || "Bilinmiyor";
          const hk = haftaAnahtar(n.tarih).key;
          if (!sonHaftalar.includes(hk)) return;
          (kisiHafta[ad] ||= {})[hk] = ((kisiHafta[ad] || {})[hk] || 0) + 1;
        });
        const haftaEtiket = {}; notlar.forEach((n) => { if (n.tarih) { const h = haftaAnahtar(n.tarih); haftaEtiket[h.key] = h.etiket; } });
        const kisiHaftaList = Object.entries(kisiHafta).map(([ad, hf]) => ({ ad, hf, toplam: Object.values(hf).reduce((a, b) => a + b, 0) })).sort((a, b) => b.toplam - a.toplam);
        return (
          <div>
            {/* Özet kartları */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              {[["Toplam Not", notlar.length, "#2563eb"], ["Beyaz (olumlu)", yakSay.Beyaz, "#16a34a"], ["Gri (kararsız)", yakSay.Gri, "#6b7280"], ["Siyah (olumsuz)", yakSay.Siyah, "#1f2937"]].map(([et, sy, rk], i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "13px 16px", flex: "1 1 150px" }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 5 }}>{et}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: rk }}>{fmt(sy)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginBottom: 14 }}>
              {/* Yaklaşım donut */}
              <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Yaklaşım Dağılımı</div>
                {yakPasta.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={yakPasta} dataKey="deger" nameKey="ad" cx="50%" cy="50%" outerRadius={90} innerRadius={45} label={(e) => `${e.ad}: ${e.deger}`} labelLine={false} style={{ fontSize: 11 }}>
                        {yakPasta.map((e, i) => <Cell key={i} fill={e.renk} stroke="#cbd5e1" />)}
                      </Pie>
                      <Tooltip formatter={(v) => [fmt(v) + " not", ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" }}>Veri yok</div>}
              </div>
              {/* En aktif sorumlular */}
              <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>En Aktif Sorumlular (not girişi)</div>
                {kisiBar.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={kisiBar} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="ad" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={95} />
                      <Tooltip formatter={(v) => [fmt(v) + " not", ""]} labelFormatter={(l, p) => p?.[0]?.payload?.tamAd || l} />
                      <Bar dataKey="not" fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" }}>Veri yok</div>}
              </div>
            </div>
            {/* Günlük giriş trendi */}
            {gunBar.length > 1 && (
              <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Günlük Not Girişi (son 14 gün)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={gunBar} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="gun" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip formatter={(v) => [fmt(v) + " not", ""]} />
                    <Bar dataKey="not" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Haftalık not girişi */}
            {haftaBar.length > 1 && (
              <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Haftalık Not Girişi</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={haftaBar} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="hafta" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip formatter={(v) => [fmt(v) + " not", ""]} />
                    <Bar dataKey="not" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Kim ne yapıyor — kişi × hafta aktivite matrisi */}
            {kisiHaftaList.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #e5eaf2", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ padding: "11px 15px", borderBottom: "1px solid #eef2f7", fontWeight: 800, fontSize: 14 }}>Kim Ne Yapıyor — haftalık aktivite (son 6 hafta)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", color: "#475569" }}>
                        <th style={{ textAlign: "left", padding: "9px 15px" }}>Sorumlu</th>
                        {sonHaftalar.map((hk) => <th key={hk} style={{ padding: "9px 8px", textAlign: "center", fontSize: 12 }}>{haftaEtiket[hk] || hk}</th>)}
                        <th style={{ padding: "9px 15px", textAlign: "right" }}>Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kisiHaftaList.map((k) => (
                        <tr key={k.ad} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 15px", fontWeight: 700, whiteSpace: "nowrap" }}>{k.ad}</td>
                          {sonHaftalar.map((hk) => {
                            const v = k.hf[hk] || 0;
                            return (
                              <td key={hk} style={{ padding: "6px 8px", textAlign: "center" }}>
                                {v ? (
                                  <span style={{ display: "inline-block", minWidth: 26, padding: "3px 8px", borderRadius: 7, fontWeight: 700, fontSize: 12,
                                    background: v >= 10 ? "#16a34a" : v >= 3 ? "#86efac" : "#dcfce7",
                                    color: v >= 10 ? "#fff" : "#166534" }}>{v}</span>
                                ) : <span style={{ color: "#e2e8f0" }}>·</span>}
                              </td>
                            );
                          })}
                          <td style={{ padding: "8px 15px", textAlign: "right", fontWeight: 800, color: "#0f172a" }}>{k.toplam}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "8px 15px", fontSize: 11.5, color: "#94a3b8", borderTop: "1px solid #f1f5f9" }}>
                  Renk koyulaştıkça o hafta daha çok not/ziyaret girilmiş. Boş (·) = o hafta hiç aktivite yok.
                </div>
              </div>
            )}

            {/* Not listesi */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", margin: "4px 0 8px" }}>Not Detayları ({notlar.length})</div>
            {notlar.filter((n) => !f || (n.not_ || "").toLocaleLowerCase("tr").includes(f) || haneEtiket(n.hane).toLocaleLowerCase("tr").includes(f)).map((n, i) => (
              <div key={i} style={{ border: "1px solid #eef2f7", borderRadius: 10, padding: "10px 13px", marginBottom: 8, background: "#fff" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <b style={{ fontSize: 13.5 }}>{haneEtiket(n.hane)}</b>
                  {n.siteAd ? <span style={{ fontSize: 12, background: "#f5f3ff", color: "#6d28d9", padding: "1px 8px", borderRadius: 6, fontWeight: 600 }}>{n.siteAd}</span> : null}
                  {n.yaklasim ? (() => { const y = yaklasimBilgi(n.yaklasim); return <span style={{ fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: y.bg, border: `1px solid ${y.kenar}`, display: "inline-block" }} />{y.ad}</span>; })() : null}
                  {n.kapsam ? <span style={{ fontSize: 12, background: "#eef2ff", color: "#3730a3", padding: "1px 8px", borderRadius: 6 }}>{n.kapsam}</span> : null}
                  {n.kisi ? (() => { const rk = rolRenk(n.kisi.rol); return <span style={{ fontSize: 12, background: rk.bg, color: rk.fg, padding: "1px 8px", borderRadius: 6, fontWeight: 600 }}>{n.kisi.ad_soyad || n.kisi.eposta} · {rolEtiket(n.kisi.rol, !!n.hane?.site_kayit_id)}</span>; })() : null}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{n.tarih ? new Date(n.tarih).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                </div>
                <div style={{ fontSize: 13.5, color: "#334155" }}>{n.not_}</div>
              </div>
            ))}
            {notlar.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, padding: 12 }}>Henüz not girilmemiş.</div>}
          </div>
        );
      })()}
    </div>
  );
}
