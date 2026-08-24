"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { hataMetni, hataOnekli } from "../../lib/hata";

export default function EkipAtama({ site }) {
  const BLOK_ROLLER = [["ana_kademe", "Ana Kademe Temsilci"], ["kadin_kollari", "Kadın Temsilci"], ["genclik_kollari", "Gençlik Temsilci"]];
  const [bloklar, setBloklar] = useState(null);
  const [gorevliler, setGorevliler] = useState([]);
  const [acik, setAcik] = useState(null);
  const [ara, setAra] = useState("");
  const [yeniAd, setYeniAd] = useState(""); const [yeniUnvan, setYeniUnvan] = useState(""); const [yeniTel, setYeniTel] = useState("");

  async function yukle() {
    const [{ data: bl }, { data: gr }] = await Promise.all([
      supabase.from("v_site_blok").select("kapi_blok,hane,kisi").eq("site_kayit_id", site.id),
      supabase.from("gorevli").select("*").eq("site_kayit_id", site.id),
    ]);
    setBloklar((bl || []).sort((a, b) => String(a.kapi_blok || "").localeCompare(String(b.kapi_blok || ""), "tr", { numeric: true })));
    setGorevliler(gr || []);
  }
  useEffect(() => { setAcik(null); setBloklar(null); yukle(); }, [site.id]);

  const gKey = {}; gorevliler.forEach((g) => { if (g.blok != null) gKey[`${g.blok}|${g.rol}`] = g; });
  const siteEkip = gorevliler.filter((g) => g.blok == null);

  async function blokKaydet(blok, rol, ad, tel) {
    const m = gKey[`${blok}|${rol}`];
    if (!ad) { if (m) await supabase.from("gorevli").delete().eq("id", m.id); }
    else if (m) await supabase.from("gorevli").update({ ad_soyad: ad, telefon: tel || null }).eq("id", m.id);
    else await supabase.from("gorevli").insert({ site_kayit_id: site.id, blok, rol, ad_soyad: ad, telefon: tel || null });
    await yukle();
  }
  async function ekipEkle() {
    if (!yeniAd.trim()) return;
    await supabase.from("gorevli").insert({ site_kayit_id: site.id, blok: null, rol: yeniUnvan.trim() || "Üye", ad_soyad: yeniAd.trim(), telefon: yeniTel.trim() || null });
    setYeniAd(""); setYeniUnvan(""); setYeniTel(""); await yukle();
  }
  async function ekipSil(id) { await supabase.from("gorevli").delete().eq("id", id); await yukle(); }

  const inp = { padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 };
  if (bloklar === null) return <div style={{ marginTop: 18, padding: 16, color: "#94a3b8" }}>Ekip bilgisi yükleniyor…</div>;
  const blokFiltre = bloklar.filter((b) => !ara || String(b.kapi_blok).toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr")));
  const atanan = bloklar.filter((b) => BLOK_ROLLER.some(([r]) => gKey[`${b.kapi_blok}|${r}`])).length;

  return (
    <div style={{ marginTop: 18, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>
        Site Ekibi (sekreterya)
        <span style={{ fontWeight: 400, color: "#64748b", fontSize: 13, marginLeft: 8 }}>blok bazlı görevliler artık "Blok Görevlileri" sekmesinde</span>
      </div>

      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Site Ekibi (sekreterya)</div>
        {siteEkip.map((g) => (
          <div key={g.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5, fontSize: 13 }}>
            <span style={{ background: "#eef2ff", color: "#3730a3", padding: "2px 8px", borderRadius: 20, fontSize: 12 }}>{g.rol}</span>
            <b>{g.ad_soyad}</b>{g.telefon && <span style={{ color: "#64748b" }}>· {g.telefon}</span>}
            <button onClick={() => ekipSil(g.id)} style={{ marginLeft: "auto", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Sil</button>
          </div>
        ))}
        {siteEkip.length === 0 && <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Henüz site ekibi girilmedi.</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <input placeholder="Unvan (örn. Sekreter)" value={yeniUnvan} onChange={(e) => setYeniUnvan(e.target.value)} style={{ ...inp, width: 150 }} />
          <input placeholder="Ad Soyad" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} style={{ ...inp, flex: 1, minWidth: 140 }} />
          <input placeholder="Telefon" value={yeniTel} onChange={(e) => setYeniTel(e.target.value)} style={{ ...inp, width: 120 }} />
          <button onClick={ekipEkle} style={{ padding: "6px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>Ekle</button>
        </div>
      </div>

    </div>
  );
}
/* Ortak bölme: bölgeyi kapı/daire sırasına göre ~hedef'lik gruplara böler.
   Birim = EV (hane); hiçbir ev bölünmez. Normal binalar bütün kalır (160'lık bina tek grup),
   ama tek başına çok büyük bina (ör. 410) ev bazında ~hedef'e bölünür. Grup sayısını döner. */
export async function sokakGrupBol(bolgeId, hedef) {
  const H = Math.max(1, hedef || 150);
  const TOL = Math.round(H * 0.15); // bina kuyruğu bu kadarı geçmiyorsa bütün bırak (~160 tek kalır)
  // Supabase varsayılan 1000 satır sınırını aşmak için sayfalı oku (büyük sokaklar eksik gelmesin)
  async function tumSayfalar(tablo, kolonlar, ekle) {
    const hepsi = []; const ADIM = 1000;
    for (let bas = 0; ; bas += ADIM) {
      let q = supabase.from(tablo).select(kolonlar).eq("bolge_id", bolgeId);
      if (ekle) q = ekle(q);
      const { data, error } = await q.range(bas, bas + ADIM - 1);
      if (error) throw new Error(`${tablo} okunamadı: ${hataMetni(error)}`);
      hepsi.push(...(data || []));
      if (!data || data.length < ADIM) break;
    }
    return hepsi;
  }
  const [ks, hrows] = await Promise.all([
    tumSayfalar("kisi", "hane_id,uye"),
    tumSayfalar("hane", "id,kapi_no,kapi_blok,no,adres", (q) => q.is("site_kayit_id", null)),
  ]);
  const kisiMap = {}, uyeMap = {};
  (ks || []).forEach((k) => { if (!k.hane_id) return; kisiMap[k.hane_id] = (kisiMap[k.hane_id] || 0) + 1; if (k.uye) uyeMap[k.hane_id] = (uyeMap[k.hane_id] || 0) + 1; });
  // hane'leri kapı no → blok → daire no sırasına diz
  const H2 = (hrows || []).map((h) => ({
    id: h.id, kapi: h.kapi_no, blok: h.kapi_blok, no: h.no,
    bkey: (h.kapi_no != null && String(h.kapi_no) !== "") ? `K${h.kapi_no}` : `H${h.id}`,
    kisi: kisiMap[h.id] || 0, uye: uyeMap[h.id] || 0,
  })).sort((a, b) =>
    ((parseInt(a.kapi) || 0) - (parseInt(b.kapi) || 0)) ||
    String(a.blok || "").localeCompare(String(b.blok || ""), "tr", { numeric: true }) ||
    ((parseInt(a.no) || 0) - (parseInt(b.no) || 0)));
  // bina toplamları (kuyruk hesabı için) — HANE sayısıyla
  const binaTop = {}; H2.forEach((h) => binaTop[h.bkey] = (binaTop[h.bkey] || 0) + 1);
  const binaTuk = {};
  // SOKAK BÜTÜNLÜĞÜ: sokağın tamamı hedefe yakınsa (ör. hedef 150, sokak 160 hane) tek grup bırak
  const SOKAK_TOL = Math.round(H * 0.25); // 150 için +37 → 187 haneye kadar tek grup
  const toplamHane = H2.length;
  // doldur: ev bazında, bina sınırını tercih et; bina tek başına büyükse ortadan böl
  const chunks = []; let cur = null;
  const yeni = () => ({ ids: [], kisi: 0, uye: 0, kb: null, ks2: null, db: null, ds: null });
  if (toplamHane > 0 && toplamHane <= H + SOKAK_TOL) {
    // tek grup: sokağın tamamı
    const tek = yeni();
    H2.forEach((h) => { if (tek.kb == null) { tek.kb = h.kapi; tek.db = h.no; } tek.ks2 = h.kapi; tek.ds = h.no; tek.ids.push(h.id); tek.kisi += h.kisi; tek.uye += h.uye; });
    chunks.push(tek);
  } else {
  for (let i = 0; i < H2.length; i++) {
    const h = H2[i];
    if (!cur) cur = yeni();
    if (cur.kb == null) { cur.kb = h.kapi; cur.db = h.no; }
    cur.ks2 = h.kapi; cur.ds = h.no;
    cur.ids.push(h.id); cur.kisi += h.kisi; cur.uye += h.uye;
    binaTuk[h.bkey] = (binaTuk[h.bkey] || 0) + 1;
    const next = H2[i + 1];
    const ayniBinaSonraki = next && next.bkey === h.bkey;
    const kalanToplam = H2.length - (i + 1); // bu gruptan sonra kaç hane kalıyor
    if (cur.ids.length >= H) {                                    // HANE sayısına göre kapat
      let kapat = false;
      if (!ayniBinaSonraki) kapat = true;                          // bina sınırı → kapat
      else {
        const kuyruk = (binaTop[h.bkey] || 0) - (binaTuk[h.bkey] || 0); // bu binadan kalan hane
        if (kuyruk > TOL) kapat = true;                            // kalan çoksa orta yerde kapat
      }
      if (kalanToplam > 0 && kalanToplam <= TOL) kapat = false;     // az kaldıysa bu gruba kat (160 tek kalsın)
      if (kapat) { chunks.push(cur); cur = null; }
    }
  }
  if (cur && cur.ids.length) chunks.push(cur);
  }
  // küçük son grubu önceki gruba kat — yarım hedeften azsa boşuna ayrı grup olmasın
  if (chunks.length >= 2) {
    const son = chunks[chunks.length - 1];
    if (son.ids.length < H * 0.5) {
      const onceki = chunks[chunks.length - 2];
      onceki.ids.push(...son.ids); onceki.kisi += son.kisi; onceki.uye += son.uye;
      onceki.ks2 = son.ks2; onceki.ds = son.ds;
      chunks.pop();
    }
  }
  if (chunks.length === 0) return 0;
  /* SİL–SONRA–YAZ RİSKİ. Burada işlem (transaction) yok: silme başarılı olup
     ekleme başarısız olursa bölgenin TÜM grupları yok olur ve yerine hiçbir şey
     gelmez. Silmenin hatası eskiden hiç okunmuyordu; en azından silme
     başarısızsa devam etmiyoruz ve ekleme hatası zaten aşağıda fırlatılıyor. */
  const { error: silErr } = await supabase.from("sokak_grup").delete().eq("bolge_id", bolgeId);
  if (silErr) throw new Error(hataOnekli("Eski gruplar silinemedi, bölme iptal edildi", silErr));
  const rows = chunks.map((c, i) => ({
    bolge_id: bolgeId, no: i + 1, kisi: c.kisi, uye: c.uye, hane: c.ids.length,
    kapi_bas: String(c.kb ?? ""), kapi_son: String(c.ks2 ?? ""),
  }));
  const { data: ins, error: insErr } = await supabase.from("sokak_grup").insert(rows).select("id");
  if (insErr) throw new Error(hataOnekli("Grup kaydı oluşturulamadı", insErr));
  if (!ins || ins.length !== chunks.length) throw new Error("Grup kaydı eksik döndü (sokak_grup SELECT/RLS?).");
  let updErr = null, yazilan = 0, beklenen = 0;
  for (let i = 0; i < chunks.length; i++) {
    const gid = ins[i]?.id; if (!gid) continue;
    const ids = chunks[i].ids; beklenen += ids.length;
    for (let j = 0; j < ids.length; j += 200) {
      const { data: upd, error } = await supabase.from("hane").update({ grup_id: gid }).in("id", ids.slice(j, j + 200)).select("id");
      if (error) updErr = error; else yazilan += (upd?.length || 0);
    }
  }
  if (updErr) throw new Error("hane.grup_id yazılamadı — 11_hane_grup.sql çalıştı mı? (" + hataMetni(updErr) + ")");
  if (beklenen > 0 && yazilan === 0) throw new Error("hane.grup_id'ye 0 satır yazıldı. Sebep: ya grup_id kolonu yok (11_hane_grup.sql çalıştır), ya da RLS hane UPDATE'i engelliyor.");
  return chunks.length;
}

/* ===================== Sokağı kapı no'ya göre ~150'lik gruplara böl (kompakt şerit) ===================== */
