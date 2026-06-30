"use client";
import { Building2, Compass, Users, ShieldCheck } from "lucide-react";
import { fmt, oran } from "../../lib/format";
import { IST_ILCELER } from "../../lib/constants";
import StatCard from "./StatCard";

export default function IlGeneli({ toplam, mahalleSayisi, bolgeToplam, hazir, onBasaksehir }) {
  return (
    <div className="page">
      <div className="crumb"><span className="cur">İstanbul · İl Geneli</span></div>
      <div className="hero">
        <div className="hero-ic"><Building2 size={30} /></div>
        <div className="hero-txt">
          <div className="hero-k">AK PARTİ · İSTANBUL İL BAŞKANLIĞI</div>
          <h1 className="disp">Saha Teşkilatı Yönetim Sistemi</h1>
          <div className="hero-s">39 ilçe · mahalle · site · sokak · hane — tek sistemde</div>
        </div>
        <div className="hero-pill">İSTANBUL</div>
      </div>
      <div className="grid-stats">
        <StatCard ic={<Building2 size={15} />} lbl="Toplam İlçe" num="39" meta="1 aktif · 38 veri bekliyor" />
        <StatCard ic={<Users size={15} />} lbl="İl Geneli Seçmen" num={hazir ? fmt(toplam.kisi) : "…"} meta="kayıtlı (Başakşehir)" />
        <StatCard ic={<ShieldCheck size={15} />} lbl="Ortalama Üye Oranı" num={hazir ? "%" + oran(toplam.uye, toplam.kisi) : "…"} meta="aktif ilçe" />
        <StatCard ic={<Compass size={15} />} lbl="Aktif Saha" num="1/39" meta="ilçede çalışma başladı" />
      </div>
      <div className="panel">
        <div className="panel-h"><h3>İlçeler</h3>
          <span className="rolepill">Başakşehir örnek olarak işlendi — tıklayıp girin</span></div>
        <table className="htable il-table">
          <thead><tr>
            <th>İLÇE</th><th className="sag">KAYITLI SEÇMEN</th><th className="sag">ÜYE ORANI</th>
            <th className="sag">MAHALLE</th><th className="sag">BÖLGE</th><th>DURUM</th>
          </tr></thead>
          <tbody>
            {IST_ILCELER.map((ad) => {
              const aktif = ad === "Başakşehir";
              const vSecmen = aktif && hazir ? fmt(toplam.kisi) : "—";
              const vOran = aktif && hazir ? "%" + oran(toplam.uye, toplam.kisi) : "—";
              const vMah = aktif ? String(mahalleSayisi) : "—";
              const vBolge = aktif ? fmt(bolgeToplam) : "—";
              const bos = (v) => (v === "—" ? " bos" : "");
              return (
                <tr key={ad} className={aktif ? "aktif-row" : ""} onClick={aktif ? onBasaksehir : undefined}
                  style={{ cursor: aktif ? "pointer" : "default" }}>
                  <td><b>{ad}</b>{aktif && <span className="ornek">örnek</span>}</td>
                  <td className={"sag mono" + bos(vSecmen)} data-label="Kayıtlı Seçmen">{vSecmen}</td>
                  <td className={"sag mono" + bos(vOran)} data-label="Üye Oranı">{vOran}</td>
                  <td className={"sag mono" + bos(vMah)} data-label="Mahalle">{vMah}</td>
                  <td className={"sag mono" + bos(vBolge)} data-label="Bölge">{vBolge}</td>
                  <td className="durum-cell">{aktif ? <span className="durum aktif">Aktif</span> : <span className="durum bekle">Veri bekliyor</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== Teşkilat Gezgini ===================== */
