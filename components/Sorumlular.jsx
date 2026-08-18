"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { UserCheck, Trash2 } from "lucide-react";
import { oran } from "../../lib/format";

export default function Sorumlular({ profil }) {
  const ilceYon = profil?.rol === "ilce_yonetimi";
  const [kisiler, setKisiler] = useState(null);
  const [mahalleler, setMahalleler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [yh, setYh] = useState({ ad: "", eposta: "", sifre: "", rol: "sorumlu", telefon: "", meslek: "", tc: "", ilce_id: "" });
  const [ilceListesi, setIlceListesi] = useState([]);
  const [ekDurum, setEkDurum] = useState(null);
  const [ekleniyor, setEkleniyor] = useState(false);
  const [secMah, setSecMah] = useState("");
  const [bolgeler, setBolgeler] = useState(null);
  const [kaydedilen, setKaydedilen] = useState(null);

  async function yukle() {
    const { data: profs } = await supabase.from("profiles")
      .select("id, ad_soyad, eposta, telefon, meslek, tc_no, rol, ilce_id").in("rol", ["sorumlu", "koordinator", "ilce_yonetimi"]).order("ad_soyad");
    const { data: ilceler } = await supabase.from("ilce").select("id, ad");
    const ilceAd = {}; (ilceler || []).forEach((i) => ilceAd[i.id] = i.ad);
    const { data: bs } = await supabase.from("bolge").select("id, kod, kapsam, mahalle_id, sorumlu_id, koordinator_id");
    const { data: mh } = await supabase.from("mahalle").select("id, ad").order("ad");
    setMahalleler(mh || []);
    const mahAd = {}; (mh || []).forEach((m) => mahAd[m.id] = m.ad);
    const byPerson = {};
    (bs || []).forEach((b) => {
      if (b.sorumlu_id) (byPerson[b.sorumlu_id] ||= []).push(b);
      if (b.koordinator_id) (byPerson[b.koordinator_id] ||= []).push(b);
    });
    const zengin = await Promise.all((profs || []).map(async (p) => {
      const bls = byPerson[p.id] || [];
      const ids = bls.map((b) => b.id);
      let hane = 0, vis = 0;
      if (ids.length) {
        const [h, z] = await Promise.all([
          supabase.from("hane").select("*", { count: "exact", head: true }).in("bolge_id", ids),
          supabase.from("ziyaret").select("*", { count: "exact", head: true }).in("bolge_id", ids).eq("durum", "ziyaret_edildi"),
        ]);
        hane = h.count || 0; vis = z.count || 0;
      }
      const mahSet = [...new Set(bls.map((b) => mahAd[b.mahalle_id]).filter(Boolean))];
      const kapsam = p.rol === "ilce_yonetimi" ? (ilceAd[p.ilce_id] || "İlçe geneli")
        : bls.length === 0 ? "—"
          : bls.length === 1 ? `${mahSet[0] || ""} · ${bls[0].kapsam || bls[0].kod}`
            : `${mahSet.join(", ")} · ${bls.length} bölge`;
      return { ...p, bolgeSay: bls.length, hane, vis, ilerleme: oran(vis, hane), kapsam };
    }));
    setKisiler(zengin);
  }
  useEffect(() => { yukle(); }, []);
  useEffect(() => {
    if (ilceYon) return;
    (async () => {
      const { data } = await supabase.from("ilce").select("id, ad, prefix").order("ad");
      setIlceListesi(data || []);
      const bsk = (data || []).find((i) => i.prefix === "BSK");
      if (bsk) setYh((y) => ({ ...y, ilce_id: bsk.id }));
    })();
  }, [ilceYon]);

  async function hesapEkle() {
    setEkDurum(null);
    if (!yh.eposta || !yh.sifre) { setEkDurum({ tip: "err", mesaj: "E-posta ve şifre gerekli." }); return; }
    setEkleniyor(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/hesap-ekle", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ ad_soyad: yh.ad, eposta: yh.eposta, sifre: yh.sifre, rol: yh.rol, telefon: yh.telefon, meslek: yh.meslek, tc_no: yh.tc, ilce_id: yh.ilce_id }),
      });
      const j = await r.json();
      if (!r.ok) setEkDurum({ tip: "err", mesaj: j.error || "Hata" });
      else { setEkDurum({ tip: "ok", mesaj: `${yh.eposta} oluşturuldu` }); setYh({ ad: "", eposta: "", sifre: "", rol: yh.rol, telefon: "", meslek: "", tc: "", ilce_id: yh.ilce_id }); await yukle(); }
    } catch (e) { setEkDurum({ tip: "err", mesaj: String(e) }); }
    setEkleniyor(false);
  }

  async function hesapSil(p) {
    if (!confirm(`${p.ad_soyad || p.eposta} hesabı silinsin mi? Bölge atamaları da kaldırılır.`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/hesap-ekle", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ id: p.id }),
    });
    if (r.ok) await yukle();
  }

  async function mahalleSec(id) {
    setSecMah(id); setBolgeler(null);
    if (!id) return;
    const { data } = await supabase.from("bolge").select("id, kod, kapsam, sorumlu_id, koordinator_id").eq("mahalle_id", id).order("kod");
    setBolgeler(data || []);
  }
  async function setAlan(bolgeId, alan, value) {
    setBolgeler((prev) => prev.map((b) => b.id === bolgeId ? { ...b, [alan]: value || null } : b));
    const { error } = await supabase.from("bolge").update({ [alan]: value || null }).eq("id", bolgeId);
    if (!error) { setKaydedilen(bolgeId + alan); setTimeout(() => setKaydedilen(null), 1000); await yukle(); }
  }

  const sorumlular = useMemo(() => (kisiler || []).filter((p) => p.rol === "sorumlu"), [kisiler]);
  const koordinatorler = useMemo(() => (kisiler || []).filter((p) => p.rol === "koordinator"), [kisiler]);
  const ozet = useMemo(() => {
    const l = (kisiler || []).filter((p) => p.bolgeSay > 0);
    const ortalama = l.length ? Math.round(l.reduce((a, p) => a + p.ilerleme, 0) / l.length) : 0;
    const dusuk = l.filter((p) => p.ilerleme < 80).length;
    return { sorumlu: sorumlular.length, koord: koordinatorler.length, ortalama, dusuk };
  }, [kisiler, sorumlular, koordinatorler]);
  const ilerlemeRenk = (p) => p >= 80 ? "var(--ok)" : p >= 50 ? "var(--accent)" : "#c0392b";

  return (
    <div className="page">
      <div className="crumb"><span className="cur">Sorumlular & Koordinatörler</span></div>
      <div className="head"><div><h2 className="disp">Sorumlular & Koordinatörler</h2>
        <div className="sub">Kişi bilgileri, sorumlu olduğu sokak/site ve ilerleme. Atama bölge içinden veya aşağıdan yapılır.</div></div>
        <button className="btn primary" onClick={() => setFormAcik((v) => !v)}><UserCheck size={15} /> Yeni Kullanıcı</button></div>

      <div className="ozet-strip">
        <div><b>{ozet.sorumlu}</b><span>Sorumlu</span></div>
        <div><b>{ozet.koord}</b><span>Koordinatör</span></div>
        <div><b>%{ozet.ortalama}</b><span>Ortalama tamamlanma</span></div>
        <div><b style={{ color: "var(--accent2)" }}>{ozet.dusuk}</b><span>Hedefin altında (&lt;%80)</span></div>
      </div>

      {formAcik && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-h"><h3>Yeni Kullanıcı</h3></div>
          <div className="hesap-form">
            <div className="hf"><label>Ad Soyad</label><input className="inp2" value={yh.ad} onChange={(e) => setYh({ ...yh, ad: e.target.value })} placeholder="Ahmet Yılmaz" /></div>
            <div className="hf"><label>E-posta</label><input className="inp2" value={yh.eposta} onChange={(e) => setYh({ ...yh, eposta: e.target.value })} placeholder="ahmet@bsk.local" /></div>
            <div className="hf"><label>Şifre</label><input className="inp2" value={yh.sifre} onChange={(e) => setYh({ ...yh, sifre: e.target.value })} placeholder="en az 6 karakter" /></div>
            <div className="hf"><label>Telefon</label><input className="inp2" value={yh.telefon} onChange={(e) => setYh({ ...yh, telefon: e.target.value })} placeholder="0532 ..." /></div>
            <div className="hf"><label>TC Kimlik</label><input className="inp2" value={yh.tc} onChange={(e) => setYh({ ...yh, tc: e.target.value })} placeholder="11111111111" /></div>
            <div className="hf"><label>Meslek</label><input className="inp2" value={yh.meslek} onChange={(e) => setYh({ ...yh, meslek: e.target.value })} placeholder="Öğretmen" /></div>
            <div className="hf"><label>Rol</label>
              <select className="sel" value={yh.rol} onChange={(e) => setYh({ ...yh, rol: e.target.value })}>
                <option value="sorumlu">Sorumlu</option><option value="koordinator">Koordinatör</option>
                {!ilceYon && <option value="ilce_yonetimi">İlçe Başkanı</option>}</select></div>
            {!ilceYon && (
              <div className="hf"><label>İlçe</label>
                <select className="sel" value={yh.ilce_id} onChange={(e) => setYh({ ...yh, ilce_id: e.target.value })}>
                  {ilceListesi.map((i) => <option key={i.id} value={i.id}>{i.ad}</option>)}
                </select></div>
            )}
            <button className="btn primary" disabled={ekleniyor} onClick={hesapEkle}><UserCheck size={15} /> {ekleniyor ? "Oluşturuluyor…" : "Oluştur"}</button>
          </div>
          {ekDurum && <div className={ekDurum.tip === "ok" ? "ek-ok" : "hata"} style={{ margin: "0 16px 14px" }}>{ekDurum.mesaj}</div>}
        </div>
      )}

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-h"><h3>Kişiler</h3><span className="rolepill">{(kisiler || []).length} kayıt</span></div>
        {kisiler === null ? <div className="merkez">Yükleniyor…</div>
          : kisiler.length === 0 ? <div className="merkez">Henüz sorumlu/koordinatör yok. “Yeni Kullanıcı” ile ekleyin.</div>
            : (
              <table className="htable">
                <thead><tr><th>KİŞİ</th><th>ROL</th><th>KAPSAM</th><th className="sag">ATANAN</th><th>İLERLEME</th><th></th></tr></thead>
                <tbody>
                  {kisiler.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div><b>{p.ad_soyad || "—"}</b></div>
                        <div className="kisi-alt">{p.eposta}{p.meslek ? " · " + p.meslek : ""}{p.tc_no ? " · TC: " + p.tc_no : ""}</div>
                        {p.telefon && <div className="kisi-alt">{p.telefon}</div>}
                      </td>
                      <td><span className={"rolchip " + (p.rol === "koordinator" ? "k" : p.rol === "ilce_yonetimi" ? "i" : "s")}>{p.rol === "koordinator" ? "Koordinatör" : p.rol === "ilce_yonetimi" ? "İlçe Başkanı" : "Sorumlu"}</span></td>
                      <td className="dim">{p.kapsam}</td>
                      <td className="sag mono">{p.bolgeSay ? `${p.vis}/${p.hane}` : "—"}</td>
                      <td>
                        {p.bolgeSay ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="bar" style={{ flex: 1, maxWidth: 110 }}><i style={{ width: `${p.ilerleme}%`, background: ilerlemeRenk(p.ilerleme) }} /></div>
                            <span className="mono" style={{ color: ilerlemeRenk(p.ilerleme), fontWeight: 700, fontSize: 12 }}>%{p.ilerleme}</span>
                          </div>
                        ) : <span className="dim">atama yok</span>}
                      </td>
                      <td className="sag"><button className="sil-btn" title="Sil" onClick={() => hesapSil(p)}><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
      </div>

      <div className="panel">
        <div className="panel-h"><h3>Bölge Ataması</h3>
          <select className="sel" value={secMah} onChange={(e) => mahalleSec(e.target.value)}>
            <option value="">Mahalle seç…</option>
            {mahalleler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
          </select></div>
        {!secMah ? <div className="merkez">Bölgelere sorumlu/koordinatör atamak için mahalle seçin.</div>
          : bolgeler === null ? <div className="merkez">Yükleniyor…</div>
            : (
              <table className="htable">
                <thead><tr><th>BÖLGE</th><th>KAPSAM</th><th>SORUMLU</th><th>KOORDİNATÖR</th></tr></thead>
                <tbody>
                  {bolgeler.map((b) => (
                    <tr key={b.id}>
                      <td><b>{b.kod}</b></td>
                      <td className="dim">{b.kapsam || "—"}</td>
                      <td>
                        <select className="sel" value={b.sorumlu_id || ""} onChange={(e) => setAlan(b.id, "sorumlu_id", e.target.value)}>
                          <option value="">— atanmadı —</option>
                          {sorumlular.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad || p.eposta}</option>)}
                        </select>{kaydedilen === b.id + "sorumlu_id" && <span className="ok-mini"> ✓</span>}
                      </td>
                      <td>
                        <select className="sel" value={b.koordinator_id || ""} onChange={(e) => setAlan(b.id, "koordinator_id", e.target.value)}>
                          <option value="">— atanmadı —</option>
                          {koordinatorler.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad || p.eposta}</option>)}
                        </select>{kaydedilen === b.id + "koordinator_id" && <span className="ok-mini"> ✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
      </div>
    </div>
  );
}

/* ===================== Grup Başkanı Görünümü (giriş yapınca kendi grubu) ===================== */
