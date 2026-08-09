"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { UserCheck, UserPlus, Trash2, Search, Crown, X } from "lucide-react";

/*
  SokakEkip — bir sokak grubunun ekibini yönetir.
  Kural: 1 başkan + en az 2 üye = "tam".
  Üye kaynağı: seçmen listesi (kisi) VEYA sistem kullanıcısı (profiles) VEYA elle giriş.
  props: grup { id, no, hane, kisi }, mahalleId (seçmen aramasını daraltmak için), onChanged?
*/
export default function SokakEkip({ grup, mahalleId, onChanged }) {
  const [ekip, setEkip] = useState(null);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [hedefGorev, setHedefGorev] = useState("uye");   // eklenecek kişinin görevi
  const [kaynak, setKaynak] = useState("secmen");         // 'secmen' | 'kullanici' | 'elle'
  const [ara, setAra] = useState("");
  const [sonuc, setSonuc] = useState([]);
  const [araniyor, setAraniyor] = useState(false);
  const [elle, setElle] = useState({ ad: "", tel: "" });
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(async () => {
    const { data } = await supabase.from("sokak_ekip")
      .select("id, gorev, kisi_id, profil_id, ad_soyad, telefon")
      .eq("grup_id", grup.id)
      .order("gorev", { ascending: true });   // baskan < uye alfabetik değil ama sıralamayı altta düzeltiriz
    setEkip(data || []);
  }, [grup.id]);

  useEffect(() => { yukle(); }, [yukle]);

  const baskan = (ekip || []).find((e) => e.gorev === "baskan") || null;
  const uyeler = (ekip || []).filter((e) => e.gorev === "uye");
  const durum = baskan && uyeler.length >= 2 ? "tam" : (ekip && ekip.length ? "yarim" : "bos");
  const durumRenk = { tam: "#16a34a", yarim: "#ea580c", bos: "#94a3b8" }[durum];
  const durumMetin = { tam: "Tam ekip", yarim: "Eksik ekip", bos: "Atanmadı" }[durum];

  // Seçmen / kullanıcı araması
  useEffect(() => {
    if (!ekleAcik || kaynak === "elle") return;
    const q = ara.trim();
    if (q.length < 2) { setSonuc([]); return; }
    let iptal = false;
    setAraniyor(true);
    (async () => {
      if (kaynak === "secmen") {
        let sorgu = supabase.from("kisi").select("id, ad, soyad, telefon").limit(20);
        if (mahalleId) sorgu = sorgu.eq("mahalle_id", mahalleId);
        // ad veya soyad eşleşmesi
        sorgu = sorgu.or(`ad.ilike.%${q}%,soyad.ilike.%${q}%`);
        const { data } = await sorgu;
        if (!iptal) setSonuc((data || []).map((k) => ({ tip: "secmen", id: k.id, ad: `${k.ad} ${k.soyad}`.trim(), tel: k.telefon || "" })));
      } else {
        const { data } = await supabase.from("profiles").select("id, ad_soyad, eposta, telefon").ilike("ad_soyad", `%${q}%`).limit(20);
        if (!iptal) setSonuc((data || []).map((p) => ({ tip: "kullanici", id: p.id, ad: p.ad_soyad || p.eposta, tel: p.telefon || "" })));
      }
      if (!iptal) setAraniyor(false);
    })();
    return () => { iptal = true; };
  }, [ara, kaynak, ekleAcik, mahalleId]);

  async function ekle(kayit) {
    if (mesgul) return;
    setMesgul(true);
    const satir = {
      grup_id: grup.id,
      gorev: hedefGorev,
      kisi_id: kayit.tip === "secmen" ? kayit.id : null,
      profil_id: kayit.tip === "kullanici" ? kayit.id : null,
      ad_soyad: kayit.ad,
      telefon: kayit.tel || null,
    };
    const { error } = await supabase.from("sokak_ekip").insert(satir);
    setMesgul(false);
    if (error) { alert("Eklenemedi: " + error.message); return; }
    setAra(""); setSonuc([]); setElle({ ad: "", tel: "" });
    if (hedefGorev === "baskan") setEkleAcik(false);   // başkan eklendiyse paneli kapat
    await yukle(); if (onChanged) onChanged();
  }

  async function elleEkle() {
    if (!elle.ad.trim()) { alert("İsim gerekli."); return; }
    await ekle({ tip: "elle", id: null, ad: elle.ad.trim(), tel: elle.tel.trim() });
  }

  async function sil(id) {
    if (!confirm("Bu kişi ekipten çıkarılsın mı?")) return;
    await supabase.from("sokak_ekip").delete().eq("id", id);
    await yukle(); if (onChanged) onChanged();
  }

  function panelAc(gorev) {
    setHedefGorev(gorev); setEkleAcik(true); setAra(""); setSonuc([]); setKaynak("secmen");
  }

  if (ekip === null) return <div style={{ fontSize: 12, color: "#94a3b8", padding: 8 }}>Ekip yükleniyor…</div>;

  const kisiSatir = (e) => (
    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", background: "#fff", border: "1px solid #eef2f7", borderRadius: 8 }}>
      {e.gorev === "baskan"
        ? <Crown size={15} color="#ca8a04" style={{ flex: "0 0 auto" }} />
        : <UserCheck size={15} color="#2563eb" style={{ flex: "0 0 auto" }} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{e.ad_soyad || "—"}</div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {e.gorev === "baskan" ? "Sokak Başkanı" : "Ekip Üyesi"}
          {e.profil_id ? " · giriş yetkili" : e.kisi_id ? " · seçmen" : ""}
          {e.telefon ? ` · ${e.telefon}` : ""}
        </div>
      </div>
      <button onClick={() => sil(e.id)} title="Çıkar" style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 4 }}><Trash2 size={15} /></button>
    </div>
  );

  return (
    <div style={{ border: "1px solid #e5eaf2", borderRadius: 10, padding: "11px 13px", background: "#f9fafb" }}>
      {/* başlık + durum */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <b style={{ fontSize: 13.5 }}>Grup {grup.no} ekibi</b>
        <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{grup.hane} hane</span>
        <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "#fff", background: durumRenk, padding: "2px 10px", borderRadius: 999 }}>{durumMetin}</span>
      </div>

      {/* başkan */}
      <div style={{ marginBottom: 8 }}>
        {baskan ? kisiSatir(baskan) : (
          <button onClick={() => panelAc("baskan")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px", background: "#fffbeb", border: "1px dashed #fcd34d", borderRadius: 8, color: "#a16207", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Crown size={15} /> Sokak Başkanı Ata
          </button>
        )}
      </div>

      {/* üyeler */}
      <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
        {uyeler.map(kisiSatir)}
      </div>

      {/* üye ekle butonu */}
      {!ekleAcik && (
        <button onClick={() => panelAc("uye")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "8px", background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 8, color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <UserPlus size={15} /> Üye Ekle {uyeler.length < 2 ? `(en az ${2 - uyeler.length} daha)` : ""}
        </button>
      )}

      {/* ekleme paneli */}
      {ekleAcik && (
        <div style={{ border: "1px solid #dbeafe", borderRadius: 8, padding: 10, background: "#fff", marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <b style={{ fontSize: 12.5 }}>{hedefGorev === "baskan" ? "Başkan" : "Üye"} ekle</b>
            <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
              {[["secmen", "Seçmenden"], ["kullanici", "Kullanıcıdan"], ["elle", "Elle"]].map(([k, l]) => (
                <button key={k} onClick={() => { setKaynak(k); setAra(""); setSonuc([]); }}
                  style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 7, cursor: "pointer", fontWeight: 600,
                    background: kaynak === k ? "#2563eb" : "#f1f5f9", color: kaynak === k ? "#fff" : "#475569", border: "none" }}>{l}</button>
              ))}
            </div>
            <button onClick={() => setEkleAcik(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}><X size={16} /></button>
          </div>

          {kaynak === "elle" ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input value={elle.ad} onChange={(e) => setElle((s) => ({ ...s, ad: e.target.value }))} placeholder="Ad Soyad"
                style={{ flex: 2, padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13 }} />
              <input value={elle.tel} onChange={(e) => setElle((s) => ({ ...s, tel: e.target.value }))} placeholder="Telefon"
                style={{ flex: 1, padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13 }} />
              <button onClick={elleEkle} disabled={mesgul} style={{ padding: "7px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ekle</button>
            </div>
          ) : (
            <>
              <div style={{ position: "relative", marginBottom: 6 }}>
                <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "#94a3b8" }} />
                <input value={ara} onChange={(e) => setAra(e.target.value)} autoFocus
                  placeholder={kaynak === "secmen" ? "Seçmen adı ara…" : "Kullanıcı adı ara…"}
                  style={{ width: "100%", padding: "7px 10px 7px 30px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13 }} />
              </div>
              <div style={{ maxHeight: 190, overflowY: "auto", display: "grid", gap: 4 }}>
                {araniyor && <div style={{ fontSize: 12, color: "#94a3b8", padding: 6 }}>Aranıyor…</div>}
                {!araniyor && ara.trim().length >= 2 && sonuc.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", padding: 6 }}>Sonuç yok.</div>}
                {sonuc.map((s) => (
                  <button key={s.id} onClick={() => ekle(s)} disabled={mesgul}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 7, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{s.ad}</div>
                      {s.tel ? <div style={{ fontSize: 11, color: "#64748b" }}>{s.tel}</div> : null}
                    </div>
                    <UserPlus size={14} color="#2563eb" />
                  </button>
                ))}
              </div>
              {kaynak === "secmen" && (
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 6 }}>
                  Not: Seçmenden eklenen kişi sadece listede görünür. Giriş yapabilmesi için ayrıca profil açılması gerekir.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
