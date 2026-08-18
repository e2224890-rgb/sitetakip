"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Building2, KeyRound, Mail } from "lucide-react";

export default function Login() {
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);
  async function gir(e) {
    e.preventDefault(); setHata(""); setBekle(true);
    const { error } = await supabase.auth.signInWithPassword({ email: eposta, password: sifre });
    if (error) setHata("Giriş başarısız: " + error.message);
    setBekle(false);
  }
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={gir}>
        <div className="login-top">
          <div className="logo-big"><Building2 size={26} /></div>
          <h1 className="disp">Saha Teşkilatı Yönetim Sistemi</h1>
          <p className="sub">AK Parti · İstanbul İl Başkanlığı</p>
        </div>
        <div className="fld"><label>E-posta</label>
          <div className="inp-wrap"><Mail size={15} />
            <input value={eposta} onChange={(e) => setEposta(e.target.value)} type="email" required /></div></div>
        <div className="fld"><label>Şifre</label>
          <div className="inp-wrap"><KeyRound size={15} />
            <input value={sifre} onChange={(e) => setSifre(e.target.value)} type="password" required /></div></div>
        <button className="btn primary blok" disabled={bekle}>{bekle ? "Giriş yapılıyor…" : "Giriş Yap"}</button>
        {hata && <div className="hata">{hata}</div>}
      </form>
    </div>
  );
}

/* ===================== YÖNETİM (il/ilçe) ===================== */
