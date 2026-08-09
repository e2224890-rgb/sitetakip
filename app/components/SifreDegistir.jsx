"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

/* İlk girişte zorunlu şifre değiştirme.
   RolDagitici: profil.sifre_gecici === true ise rol dağıtımından ÖNCE bunu gösterir. */
export default function SifreDegistir({ session, onBitti }) {
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState("");

  async function kaydet() {
    setHata("");
    if (s1.length < 6) { setHata("Şifre en az 6 karakter olmalı."); return; }
    if (s1 !== s2) { setHata("Şifreler eşleşmiyor."); return; }
    setMesgul(true);
    const { error } = await supabase.auth.updateUser({ password: s1 });
    if (error) { setHata("Kaydedilemedi: " + error.message); setMesgul(false); return; }
    await supabase.from("profiles").update({ sifre_gecici: false }).eq("id", session.user.id);
    setMesgul(false);
    if (onBitti) onBitti();
  }

  const inp = { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: "border-box" };
  const btn = { width: "100%", padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" };

  return (
    <div className="app saha"><main className="main"><div className="page">
      <div className="panel" style={{ maxWidth: 420, margin: "48px auto" }}>
        <h2 className="disp" style={{ marginTop: 0 }}>Yeni şifre belirle</h2>
        <p className="sub" style={{ marginBottom: 16 }}>Geçici şifreyle giriş yaptınız. Devam etmek için kendi şifrenizi belirleyin.</p>
        <input type="password" placeholder="Yeni şifre (en az 6 karakter)" value={s1} onChange={(e) => setS1(e.target.value)} style={inp} />
        <input type="password" placeholder="Yeni şifre (tekrar)" value={s2} onChange={(e) => setS2(e.target.value)} style={inp} />
        {hata && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{hata}</div>}
        <button onClick={kaydet} disabled={mesgul} style={btn}>{mesgul ? "Kaydediliyor…" : "Kaydet ve devam et"}</button>
        <button onClick={() => supabase.auth.signOut()} style={{ ...btn, background: "#fff", color: "#64748b", border: "1px solid #e5e7eb", marginTop: 8 }}>Çıkış</button>
      </div>
    </div></main></div>
  );
}
