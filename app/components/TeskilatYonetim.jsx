"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

/* Teşkilat Yönetimi — SADECE ilçe/il yönetimi kullanır (RLS de zorunlu kılar).
   Mahalle seçilir → ünvanlara kişi eklenir/çıkarılır. İstenirse giriş hesabı açılır
   (rol=mahalle_baskani + o mahalle; şifre saha2026, ilk girişte değiştirilir). */

const UNVANLAR = [
  { key: "baskan", label: "Mahalle Başkanı", coklu: false },
  { key: "yurutme", label: "İlçe Yürütme Kurulu Üyesi", coklu: false },
  { key: "yk", label: "İlçe Yönetim Kurulu Üyeleri", coklu: true },
  { key: "meclis", label: "Belediye Meclis Üyeleri", coklu: true },
  { key: "bby", label: "Belediye Başkan Yardımcısı", coklu: false },
];

const trSlug = (t) => (t || "").toLocaleLowerCase("tr")
  .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
  .replace(/[^a-z0-9]/g, "");

export default function TeskilatYonetim({ session, sabitMahId, onKapat, onDegisti }) {
  const [mahalleler, setMahalleler] = useState([]);
  const [mahId, setMahId] = useState(sabitMahId || "");
  const [kayitlar, setKayitlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  // ekleme formu (ünvan bazlı)
  const [form, setForm] = useState({}); // { [unvan]: { ad, tel, kadin, hesap } }
  const [mesgul, setMesgul] = useState(false);
  const [sonuc, setSonuc] = useState(null); // { ad, eposta, sifre }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("mahalle").select("id, ad").order("ad");
      setMahalleler(data || []);
    })();
  }, []);

  async function yukle() {
    if (!mahId) { setKayitlar([]); return; }
    setYukleniyor(true);
    const { data } = await supabase.from("teskilat")
      .select("id, unvan, ad_soyad, telefon, kadin, sira, profil_id").eq("mahalle_id", mahId).order("sira");
    setKayitlar(data || []);
    setYukleniyor(false);
  }
  useEffect(() => { yukle(); }, [mahId]);

  const f = (u) => form[u] || { ad: "", tel: "", kadin: false, hesap: false };
  const setF = (u, v) => setForm((s) => ({ ...s, [u]: { ...f(u), ...v } }));

  async function ekle(unvan) {
    const d = f(unvan);
    if (!d.ad.trim() || mesgul) return;
    setMesgul(true); setSonuc(null);
    try {
      let profil_id = null;
      if (d.hesap) {
        // giriş hesabı aç (mahalle başkanı olarak o mahalleye bağlı)
        const eposta = `${trSlug(d.ad) || "uye"}.${Math.random().toString(36).slice(-4)}@akpartibasaksehir.com`;
        const { data: { session: s } } = await supabase.auth.getSession();
        const r = await fetch("/api/hesap-ekle", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${s.access_token}` },
          body: JSON.stringify({ ad_soyad: d.ad.trim(), eposta, sifre: "saha2026", benzersizEposta: true, sifre_gecici: true, rol: "mahalle_baskani", mahalle_id: mahId, telefon: d.tel.trim() || null }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "hesap açılamadı");
        profil_id = j.id;
        setSonuc({ ad: d.ad.trim(), eposta: j.eposta || eposta, sifre: "saha2026" });
      }
      const sira = kayitlar.filter((k) => k.unvan === unvan).length;
      const { error } = await supabase.from("teskilat").insert({
        mahalle_id: mahId, unvan, ad_soyad: d.ad.trim(), telefon: d.tel.trim() || null, kadin: !!d.kadin, sira, profil_id,
      });
      if (error) throw error;
      setForm((s) => ({ ...s, [unvan]: { ad: "", tel: "", kadin: false, hesap: false } }));
      await yukle(); if (onDegisti) onDegisti();
    } catch (e) {
      alert("Eklenemedi: " + (e?.message || e));
    }
    setMesgul(false);
  }

  async function sil(row) {
    if (!confirm(`${row.ad_soyad} silinsin mi?`)) return;
    await supabase.from("teskilat").delete().eq("id", row.id);
    await yukle(); if (onDegisti) onDegisti();
  }

  const inp = { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 };
  const mahAd = mahalleler.find((m) => m.id === mahId)?.ad || "";

  return (
    <div className="page">
      <div className="head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div><h2 className="disp">Teşkilat Yönetimi{mahAd ? ` · ${mahAd}` : ""}</h2>
          <div className="sub">Ünvanlara kişi ekleyin/çıkarın. İsterseniz giriş hesabı da açılır.</div></div>
        {onKapat && <button onClick={onKapat} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>Kapat</button>}
      </div>

      {!sabitMahId && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>MAHALLE</label>
          <select className="sel" value={mahId} onChange={(e) => setMahId(e.target.value)} style={{ ...inp, minWidth: 240 }}>
            <option value="">— mahalle seçin —</option>
            {mahalleler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
          </select>
        </div>
      )}

      {sonuc && (
        <div className="panel" style={{ marginBottom: 14, background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
          <b style={{ color: "#065f46" }}>✓ {sonuc.ad} için giriş hesabı açıldı — kişiye ilet:</b>
          <div style={{ marginTop: 6, fontFamily: "monospace" }}>E-posta: {sonuc.eposta}</div>
          <div style={{ fontFamily: "monospace" }}>Şifre: {sonuc.sifre}</div>
          <div style={{ fontSize: 12, color: "#047857", marginTop: 4 }}>İlk girişte kendi şifresini belirleyecek.</div>
          <button onClick={() => setSonuc(null)} style={{ marginTop: 8, fontSize: 12, background: "#fff", border: "1px solid #a7f3d0", borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: "#065f46" }}>Kapat</button>
        </div>
      )}

      {mahId && (yukleniyor ? <div className="merkez">Yükleniyor…</div> : (
        <div style={{ display: "grid", gap: 14 }}>
          {UNVANLAR.map(({ key, label, coklu }) => {
            const list = kayitlar.filter((k) => k.unvan === key);
            const tekDolu = !coklu && list.length >= 1;
            const d = f(key);
            return (
              <div key={key} className="panel">
                <b style={{ fontSize: 14 }}>{label}</b>
                <div style={{ display: "grid", gap: 6, margin: "10px 0" }}>
                  {list.length === 0 && <div className="dim" style={{ fontSize: 13 }}>Henüz eklenmedi.</div>}
                  {list.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: r.kadin ? "#ec4899" : "#2563eb", flex: "0 0 auto" }} />
                      <b style={{ fontSize: 13 }}>{r.ad_soyad}</b>
                      {r.telefon && <span style={{ fontSize: 12, color: "#64748b" }}>· {r.telefon}</span>}
                      {r.profil_id && <span style={{ fontSize: 11, color: "#15803d" }}>· girişli</span>}
                      <button onClick={() => sil(r)} style={{ marginLeft: "auto", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Sil</button>
                    </div>
                  ))}
                </div>
                {!tekDolu && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <input placeholder="Ad Soyad" value={d.ad} onChange={(e) => setF(key, { ad: e.target.value })} style={{ ...inp, flex: 1, minWidth: 160 }} />
                    <input placeholder="Telefon" value={d.tel} onChange={(e) => setF(key, { tel: e.target.value })} style={{ ...inp, width: 130 }} />
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#475569" }}>
                      <input type="checkbox" checked={d.kadin} onChange={(e) => setF(key, { kadin: e.target.checked })} /> kadın
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#475569" }}>
                      <input type="checkbox" checked={d.hesap} onChange={(e) => setF(key, { hesap: e.target.checked })} /> giriş hesabı aç
                    </label>
                    <button onClick={() => ekle(key)} disabled={mesgul} style={{ padding: "8px 14px", background: mesgul ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ekle</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
