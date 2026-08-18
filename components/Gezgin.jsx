"use client";
import { Building2, Compass, Users, ShieldCheck, ChevronRight, Home, Map, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmt, oran } from "../../lib/format";
import StatCard from "./StatCard";

export default function Gezgin({ mahalleler, toplam, bolgeToplam, ilceAd, onSec }) {
  if (mahalleler === null) return <div className="merkez">Yükleniyor…</div>;
  const uyeOran = oran(toplam.uye, toplam.kisi);
  const pasta = [
    { ad: "Üye", deger: toplam.uye, renk: "var(--accent)" },
    { ad: "Diğer", deger: Math.max(0, toplam.kisi - toplam.uye), renk: "#e7e9ed" },
  ];
  return (
    <>
      <div className="head"><div><h2 className="disp">{ilceAd || "Başakşehir"} · Teşkilat Gezgini</h2>
        <div className="sub">{mahalleler.length} mahalle · {fmt(bolgeToplam)} bölge</div></div>
        <span className="tag"><Compass size={13} /> {ilceAd || "Aktif Saha"}</span></div>
      <div className="grid-stats">
        <StatCard ic={<Users size={15} />} lbl="Toplam Kişi" num={fmt(toplam.kisi)} meta="seçmen kaydı" />
        <StatCard ic={<Home size={15} />} lbl="Hane" num={fmt(toplam.hane)} meta="kayıtlı hane" renk="#2563eb" />
        <StatCard ic={<ShieldCheck size={15} />} lbl="AK Parti Üye" num={fmt(toplam.uye)} meta={`%${uyeOran} üyelik`} renk="#16a34a" />
        <StatCard ic={<Map size={15} />} lbl="Bölge" num={fmt(bolgeToplam)} meta="≈150 hane / bölge" renk="#9333ea" />
      </div>
      <div className="layout">
        <div className="panel">
          <div className="panel-h"><h3>Mahalleler</h3><span className="rolepill"><TrendingUp size={13} /> kişiye göre</span></div>
          <div className="cards">
            {mahalleler.map((m) => (
              <div key={m.mahalle_id} className="card" onClick={() => onSec({ id: m.mahalle_id, ad: m.ad, tip: m.tip })}>
                <div className="card-t">{m.ad} <ChevronRight size={15} /></div>
                <div style={{ marginBottom: 8 }}>
                  <span className={"tip-tag " + (m.tip === "site" ? "site" : "sokak")}>
                    {m.tip === "site" ? <Building2 size={11} /> : <Map size={11} />}
                    {m.tip === "site" ? "Site" : "Sokak"}
                  </span>
                </div>
                <div className="card-nums">
                  <div><b>{fmt(m.kisi)}</b><span>kişi</span></div>
                  <div><b>{fmt(m.hane)}</b><span>hane</span></div>
                  <div className="acc"><b>{fmt(m.uye)}</b><span>üye</span></div>
                </div>
                <div className="bar"><i style={{ width: `${oran(m.uye, m.kisi)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel pad">
          <div className="panel-h"><h3>Üyelik</h3></div>
          <div className="pie-wrap">
            <PieChart width={200} height={200}>
              <Pie data={pasta} dataKey="deger" nameKey="ad" cx="50%" cy="50%" innerRadius={55} outerRadius={85} strokeWidth={0}>
                {pasta.map((p, i) => <Cell key={i} fill={p.renk} />)}
              </Pie>
            </PieChart>
            <div className="pie-mid"><div className="pie-big">%{uyeOran}</div><div className="pie-sub">üye</div></div>
          </div>
          <div className="legend">
            <div><span className="dot" style={{ background: "var(--accent)" }} /> Üye <b>{fmt(toplam.uye)}</b></div>
            <div><span className="dot" style={{ background: "#e7e9ed" }} /> Diğer <b>{fmt(Math.max(0, toplam.kisi - toplam.uye))}</b></div>
          </div>
        </div>
      </div>

      <div className="demo-grid" style={{ marginTop: 15 }}>
        <div className="panel pad">
          <div className="panel-h2"><h3>Yaş Aralığı</h3><span className="dim">{fmt(toplam.erkek + toplam.kadin)} kişi</span></div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={toplam.yasArr} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <XAxis dataKey="ad" tick={{ fontSize: 11, fill: "#5a626c" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9097a0" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(0) + "b" : v} />
              <Tooltip cursor={{ fill: "#0000000a" }} formatter={(v) => [fmt(v), "Kişi"]} labelFormatter={(l) => "Yaş " + l} />
              <Bar dataKey="deger" fill="#cf5a26" radius={[5, 5, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel pad">
          <div className="panel-h2"><h3>Cinsiyet</h3><span className="dim">{fmt(toplam.erkek + toplam.kadin)} kişi</span></div>
          <div className="cins">
            <div className="cins-satir"><span className="cins-ad"><span className="dot" style={{ background: "#2563eb" }} /> Erkek</span><b className="mono">{fmt(toplam.erkek)}</b></div>
            <div className="bar"><i style={{ width: `${oran(toplam.erkek, toplam.erkek + toplam.kadin)}%`, background: "#2563eb" }} /></div>
            <div className="cins-satir" style={{ marginTop: 14 }}><span className="cins-ad"><span className="dot" style={{ background: "#db2777" }} /> Kadın</span><b className="mono">{fmt(toplam.kadin)}</b></div>
            <div className="bar"><i style={{ width: `${oran(toplam.kadin, toplam.erkek + toplam.kadin)}%`, background: "#db2777" }} /></div>
            <div className="cins-ozet">Erkek %{oran(toplam.erkek, toplam.erkek + toplam.kadin)} · Kadın %{oran(toplam.kadin, toplam.erkek + toplam.kadin)}</div>
          </div>
        </div>
      </div>
    </>
  );
}
