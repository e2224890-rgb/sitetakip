"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

const SABIT_SIFRE = "saha2026"; // statik geçici şifre — kişi ilk girişte değiştirir

/* SOKAK YÖNETİMİ paneli
   - Grubun SORUMLUSU kendi ekibini (alt yönetim) kurar: üye ekler + giriş hesabı açar.
   - Üye giriş yapınca SADECE bu grubu görür (rol=grup_baskani + sokak_ekip.profil_id;
     GrupBaskaniGorunum genişletmesi bunu sağlıyor).
   - "en az 2 üye" (+sorumlu = 3) kuralı gösterilir.
   Props:
     grup     : { id, baskan_id, baskan_ad, no }  (sokak_grup)
     userId   : oturumdaki kullanıcı
     duzenle  : yönetebilir mi (varsayılan: grubun sorumlusuysa). Yönetici ekranında true verebilirsin.
*/
export default function SokakYonetim({ grup, userId, duzenle }) {
  const yonetebilir = duzenle != null ? duzenle : (grup?.baskan_id === userId);
  const [uyeler, setUyeler] = useState(null);
  const [ad, setAd] = useState("");
  const [tel, setTel] = useState("");
  const [hesapAc, setHesapAc] = useState(true);
  const [mesgul, setMesgul] = useState(false);
  const [sonuc, setSonuc] = useState(null); // { eposta, sifre }

  async function yukle() {
    const { data } = await supabase.from("sokak_ekip")
      .select("id, gorev, ad_soyad, telefon, profil_id")
      .eq("grup_id", grup.id).eq("gorev", "uye");
    setUyeler(data || []);
  }
  useEffect(() => { setSonuc(null); yukle(); }, [grup.id]);

  async function ekle() {
    if (!ad.trim() || mesgul) return;
    setMesgul(true); setSonuc(null);
    try {
      if (hesapAc) {
        const slug = (t) => t.toLocaleLowerCase("tr").replace(/[^a-z0-9]/g, "");
        const eposta = `${slug(ad) || "uye"}.${Math.random().toString(36).slice(-4)}@saha.local`;
        const sifre = SABIT_SIFRE;
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch("/api/hesap-ekle", {
          method: "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            ad_soyad: ad.trim(), eposta, sifre, rol: "grup_baskani",
            telefon: tel.trim() || null, grup_id: grup.id, gorev: "uye", sifre_gecici: true,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "hesap açılamadı");
        setSonuc({ eposta, sifre });
      } else {
        const { error } = await supabase.from("sokak_ekip")
          .insert({ grup_id: grup.id, gorev: "uye", ad_soyad: ad.trim(), telefon: tel.trim() || null });
        if (error) throw error;
      }
      setAd(""); setTel(""); await yukle();
    } catch (e) {
      alert("Eklenemedi: " + (e?.message || e));
    }
    setMesgul(false);
  }

  async function sil(row) {
    if (!confirm(`${row.ad_soyad} ekipten çıkarılsın mı?`)) return;
    await supabase.from("sokak_ekip").delete().eq("id", row.id);
    await yukle();
  }

  const inp = { padding: "7px 9px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13 };
  const yeterli = (uyeler?.length || 0) >= 2;

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <b style={{ fontSize: 15 }}>Sokak Yönetimi</b>
        <span style={{ fontSize: 12, color: yeterli ? "#15803d" : "#b45309", background: yeterli ? "#e7f6ec" : "#fef3c7", border: `1px solid ${yeterli ? "#a7e3bd" : "#fde68a"}`, padding: "2px 9px", borderRadius: 999, fontWeight: 700 }}>
          {uyeler == null ? "…" : `${uyeler.length} üye`}{!yeterli && " · en az 2 gerekli"}
        </span>
        <span style={{ fontSize: 12, color: "#64748b" }}>Sorumlu{grup.baskan_ad ? `: ${grup.baskan_ad}` : ""}</span>
      </div>

      {uyeler == null ? <div className="dim" style={{ fontSize: 13 }}>Yükleniyor…</div> : (
        uyeler.length === 0
          ? <div className="dim" style={{ fontSize: 13, marginBottom: 8 }}>Henüz ekip üyesi eklenmedi.</div>
          : uyeler.map((u) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 5 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, background: "#eef2ff", color: "#3730a3", padding: "1px 7px", borderRadius: 999 }}>ÜYE</span>
              <b>{u.ad_soyad || "—"}</b>
              {u.telefon && <span style={{ color: "#64748b" }}>· {u.telefon}</span>}
              {u.profil_id && <span style={{ fontSize: 10.5, color: "#15803d" }}>· girişli</span>}
              {yonetebilir && <button onClick={() => sil(u)} style={{ marginLeft: "auto", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Çıkar</button>}
            </div>
          ))
      )}

      {yonetebilir && (
        <div style={{ marginTop: 12, borderTop: "1px solid #eef2f7", paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Ad Soyad" value={ad} onChange={(e) => setAd(e.target.value)} style={{ ...inp, flex: 1, minWidth: 150 }} />
            <input placeholder="Telefon" value={tel} onChange={(e) => setTel(e.target.value)} style={{ ...inp, width: 130 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#475569" }}>
              <input type="checkbox" checked={hesapAc} onChange={(e) => setHesapAc(e.target.checked)} /> giriş hesabı da aç
            </label>
            <button onClick={ekle} disabled={mesgul} style={{ padding: "7px 14px", background: mesgul ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: mesgul ? "default" : "pointer" }}>
              {mesgul ? "Ekleniyor…" : "Üye ekle"}
            </button>
          </div>
          {!hesapAc && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6 }}>Hesap açılmazsa kişi sadece listede görünür, giriş yapamaz.</div>}
          {sonuc && (
            <div style={{ marginTop: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
              <b style={{ color: "#065f46" }}>Giriş hesabı açıldı — bu bilgiyi kişiye ilet:</b>
              <div style={{ marginTop: 6, fontFamily: "monospace" }}>E-posta: {sonuc.eposta}</div>
              <div style={{ fontFamily: "monospace" }}>Şifre: {sonuc.sifre}</div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "#047857" }}>Kişi ilk girişte kendi şifresini belirleyecek.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
