"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { hataOnekli } from "../../lib/hata";

/* ANAHTARLAR VERİTABANI ENUM'UNA UYMAK ZORUNDA.
   talep.durum kolonu `talep_durum` enum'u ve yalnızca şu değerleri kabul ediyor:
     yeni · inceleniyor · havale · cozuldu · reddedildi
   Burada eskiden "incelemede", "yonlendirildi", "kapandi" yazıyordu; bunlar
   enum'da yok, dolayısıyla o üç duruma geçiş denemesi
     22P02: invalid input syntax for type talep_durum
   ile düşüyordu — yani süreç yalnızca "Yeni" ve "Çözüldü" arasında
   ilerletilebiliyordu. Ekranda görünen Türkçe etiketler (ad) aynı kaldı,
   yalnızca veritabanına giden anahtar (k) düzeltildi. */
const DURUMLAR = [
  { k: "yeni", ad: "Yeni", renk: "#2563eb" },
  { k: "inceleniyor", ad: "İncelemede", renk: "#ea580c" },
  { k: "havale", ad: "Yönlendirildi", renk: "#7c3aed" },
  { k: "cozuldu", ad: "Çözüldü", renk: "#16a34a" },
  { k: "reddedildi", ad: "Reddedildi", renk: "#64748b" },
];
const durumBilgi = (k) => DURUMLAR.find((d) => d.k === k) || { ad: k, renk: "#94a3b8" };
const oncelikBilgi = { dusuk: { ad: "Düşük", renk: "#94a3b8" }, normal: { ad: "Normal", renk: "#2563eb" }, yuksek: { ad: "Yüksek", renk: "#dc2626" } };
const tarihFmt = (t) => t ? new Date(t).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export default function Talepler({ profil }) {
  const [liste, setListe] = useState(null);
  const [durumF, setDurumF] = useState("");
  const [ara, setAra] = useState("");
  const [sec, setSec] = useState(null);
  const [gecmis, setGecmis] = useState([]);
  const [yeniDurum, setYeniDurum] = useState("");
  const [yeniNot, setYeniNot] = useState("");
  const [mesgul, setMesgul] = useState(false);

  async function yukle() {
    const { data } = await supabase.from("talep").select("*").order("created_at", { ascending: false });
    setListe(data || []);
  }
  useEffect(() => { yukle(); }, []);

  async function detayAc(t) {
    setSec(t); setYeniDurum(t.durum); setYeniNot("");
    const { data } = await supabase.from("talep_log").select("*").eq("talep_id", t.id).order("tarih", { ascending: false });
    setGecmis(data || []);
  }

  async function durumGuncelle() {
    if (!sec || mesgul) return;
    setMesgul(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Supabase hata fırlatmaz, { error } döndürür — bu yüzden aşağıdaki catch
      // eskiden hiç çalışmıyor, RLS engelinde kullanıcı "güncellendi" sanıyordu.
      const { error: eUpd, count } = await supabase.from("talep")
        .update({ durum: yeniDurum, updated_at: new Date().toISOString() }, { count: "exact" }).eq("id", sec.id);
      if (eUpd) throw eUpd;
      if (count === 0) throw new Error("Bu talebi güncelleme yetkiniz yok.");

      /* SÜREÇ KAYDINI TRIGGER YAZIYOR.
         talep_log_tg, talep üzerindeki her durum değişiminde islem='durum' ile
         satırı kendisi ekliyor. Burada ayrıca insert yapmak çift kayıt demekti;
         üstelik talep_log.islem NOT NULL olduğu ve gönderilmediği için bu
         insert zaten her seferinde 23502 ile düşüyordu (sessizce yutuluyordu).
         Yalnızca kullanıcı not yazdıysa ek bir satır ekliyoruz. */
      const not = yeniNot.trim();
      if (not) {
        const { error: eLog } = await supabase.from("talep_log").insert({
          talep_id: sec.id, durum: yeniDurum, islem: "not",
          not_: not, kullanici_id: session?.user?.id || null,
        });
        if (eLog) throw eLog;
      }
      const guncel = { ...sec, durum: yeniDurum };
      await yukle(); await detayAc(guncel); setYeniNot("");
    } catch (e) { alert(hataOnekli("Güncellenemedi", e)); }
    setMesgul(false);
  }

  const q = (ara || "").toLocaleLowerCase("tr").trim();
  let f = (liste || []).filter((t) => !durumF || t.durum === durumF);
  if (q) f = f.filter((t) => `${t.baslik} ${t.ad_soyad || ""} ${t.kategori || ""}`.toLocaleLowerCase("tr").includes(q));
  const say = {}; (liste || []).forEach((t) => { say[t.durum] = (say[t.durum] || 0) + 1; });

  if (liste === null) return <div className="merkez">Yükleniyor…</div>;

  const cip = (renk, aktif, onClick, ic) => (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: aktif ? `2px solid ${renk}` : "1px solid #e5eaf2", background: aktif ? renk + "14" : "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#334155" }}>{ic}</button>
  );

  return (
    <div className="page">
      <div className="head"><div><h2 className="disp">Talepler</h2>
        <div className="sub">Vatandaş talepleri ve süreç takibi</div></div></div>

      {/* Durum filtreleri */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {cip("#0f172a", durumF === "", () => setDurumF(""), <>Tümü <b>{liste.length}</b></>)}
        {DURUMLAR.map((d) => cip(d.renk, durumF === d.k, () => setDurumF(durumF === d.k ? "" : d.k),
          <><span style={{ width: 9, height: 9, borderRadius: "50%", background: d.renk }} />{d.ad} <b>{say[d.k] || 0}</b></>))}
      </div>

      <input value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Başlık / kişi / kategori ara…" style={{ width: "100%", maxWidth: 360, padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 9, fontSize: 14, marginBottom: 14 }} />

      {/* Liste */}
      <div style={{ display: "grid", gap: 8 }}>
        {f.length === 0 && <div style={{ color: "#94a3b8", padding: 24, textAlign: "center" }}>Talep yok.</div>}
        {f.map((t) => {
          const d = durumBilgi(t.durum); const o = oncelikBilgi[t.oncelik] || oncelikBilgi.normal;
          return (
            <div key={t.id} onClick={() => detayAc(t)} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #e5eaf2", borderRadius: 11, padding: "12px 14px", cursor: "pointer" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{t.baslik}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {t.ad_soyad || "—"}{t.telefon ? " · " + t.telefon : ""}{t.kategori ? " · " + t.kategori : ""} · {tarihFmt(t.created_at)}
                </div>
              </div>
              {t.oncelik === "yuksek" && <span style={{ fontSize: 10.5, fontWeight: 700, color: o.renk, background: o.renk + "14", padding: "2px 8px", borderRadius: 999 }}>{o.ad}</span>}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: d.renk, padding: "3px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>{d.ad}</span>
            </div>
          );
        })}
      </div>

      {/* Detay modalı */}
      {sec && (() => {
        const d = durumBilgi(sec.durum);
        return (
          <div onClick={() => setSec(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 14, marginTop: 20, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>{sec.baslik}</h3>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{sec.ad_soyad || "—"}{sec.telefon ? " · " + sec.telefon : ""}{sec.kategori ? " · " + sec.kategori : ""}</div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: d.renk, padding: "3px 11px", borderRadius: 999 }}>{d.ad}</span>
                <button onClick={() => setSec(null)} style={{ border: "none", background: "#f1f5f9", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16, color: "#475569" }}>×</button>
              </div>
              {sec.aciklama && <div style={{ fontSize: 14, color: "#334155", marginTop: 12, whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 9, padding: "10px 12px" }}>{sec.aciklama}</div>}

              {/* Durum değiştir */}
              <div style={{ marginTop: 16, borderTop: "1px solid #eef2f7", paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>SÜRECİ İLERLET</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={yeniDurum} onChange={(e) => setYeniDurum(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
                    {DURUMLAR.map((x) => <option key={x.k} value={x.k}>{x.ad}</option>)}
                  </select>
                  <input value={yeniNot} onChange={(e) => setYeniNot(e.target.value)} placeholder="Süreç notu (opsiyonel)" style={{ flex: 1, minWidth: 160, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                  <button onClick={durumGuncelle} disabled={mesgul} style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{mesgul ? "…" : "Güncelle"}</button>
                </div>
              </div>

              {/* Süreç geçmişi */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>SÜREÇ GEÇMİŞİ</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {gecmis.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8" }}>Kayıt yok.</div>}
                  {gecmis.map((g) => {
                    const gd = durumBilgi(g.durum);
                    return (
                      <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: gd.renk, marginTop: 5, flex: "0 0 auto" }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div><b style={{ color: gd.renk }}>{gd.ad}</b> <span style={{ color: "#94a3b8", fontSize: 11.5 }}>· {tarihFmt(g.tarih)}</span></div>
                          {g.not_ && <div style={{ color: "#64748b", fontSize: 12.5 }}>{g.not_}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
