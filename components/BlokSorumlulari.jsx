"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { blokParts, fmt, normBlok } from "../../lib/format";
import { BLOK_ROL_LISTE } from "../../lib/constants";
import BlokSlot from "./BlokSlot";

export default function BlokSorumlulari({ site }) {
  const [bloklar, setBloklar] = useState(null);
  const [hesaplar, setHesaplar] = useState({});
  const [tumHesap, setTumHesap] = useState([]);
  const [acik, setAcik] = useState(null);
  const [ara, setAra] = useState("");
  async function yukle() {
    const [{ data: bl }, { data: pr }] = await Promise.all([
      supabase.from("v_site_blok").select("kapi_blok,hane,kisi").eq("site_kayit_id", site.id),
      supabase.from("profiles").select("id, eposta, ad_soyad, blok, rol").eq("site_kayit_id", site.id).in("rol", BLOK_ROL_LISTE.map((r) => r[0])),
    ]);
    // Aynı bloğun farklı yazımlarını (A01/A1/A1 BLOK) tek normalize anahtarda topla
    const g = {};
    (bl || []).forEach((b) => {
      const key = normBlok(b.kapi_blok);
      if (!g[key]) g[key] = { blok: key, hane: 0, kisi: 0 };
      g[key].hane += b.hane || 0; g[key].kisi += b.kisi || 0;
    });
    const list = Object.values(g).sort((a, b) => String(a.blok).localeCompare(String(b.blok), "tr", { numeric: true }));
    setBloklar(list);
    const m = {}; (pr || []).forEach((p) => { blokParts(p.blok).forEach((bk) => { m[`${bk}|${p.rol}`] = p; }); });
    setHesaplar(m); setTumHesap(pr || []);
  }
  useEffect(() => { setAcik(null); setBloklar(null); yukle(); }, [site.id]);
  if (bloklar === null) return <div style={{ padding: 16, color: "#94a3b8" }}>Bloklar yükleniyor…</div>;
  const inp = { padding: "6px 9px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 };
  const filt = bloklar.filter((b) => !ara || String(b.blok).toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr")));
  const N = BLOK_ROL_LISTE.length;
  const blokSay = bloklar.length;
  const roleCount = {}; BLOK_ROL_LISTE.forEach(([r]) => { roleCount[r] = bloklar.filter((b) => hesaplar[`${b.blok}|${r}`]).length; });
  const bsAtandi = roleCount.blok_sorumlu || 0;
  const bsPct = blokSay ? Math.round((bsAtandi / blokSay) * 100) : 0;
  const bsData = [{ name: "Atandı", value: bsAtandi }, { name: "Kalan", value: Math.max(0, blokSay - bsAtandi) }];
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <b>Blok Görevlileri</b>
        <span style={{ color: "#64748b", fontSize: 13 }}>{bloklar.length} blok · her bloğa {N} rol (sorumlu + kademeler) — her biri giriş yapıp yalnız kendi bloğunu görür</span>
        {bloklar.length > 8 && <input placeholder="Blok ara…" value={ara} onChange={(e) => setAra(e.target.value)} style={{ ...inp, width: 130, marginLeft: "auto" }} />}
      </div>
      {blokSay > 0 && (
        <div style={{ display: "flex", gap: 18, alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #eef2f7", flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 128, height: 128, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bsData} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={2} stroke="none">
                  <Cell fill="#16a34a" /><Cell fill="#e5e9f0" />
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>%{bsPct}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>blok sor.</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 13, color: "#334155", marginBottom: 10 }}>
              <b>{blokSay}</b> blok → <b>{blokSay}</b> blok sorumlusu gerekli · <b style={{ color: "#16a34a" }}>{bsAtandi}</b> atandı · <b style={{ color: "#d97706" }}>{blokSay - bsAtandi}</b> kalan
            </div>
            {BLOK_ROL_LISTE.map(([r, et]) => {
              const c = roleCount[r] || 0; const pct = blokSay ? Math.round((c / blokSay) * 100) : 0;
              return (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 112, fontSize: 12, color: "#475569" }}>{et}</span>
                  <div style={{ flex: 1, height: 7, background: "#eef2f7", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: r === "blok_sorumlu" ? "#16a34a" : "#2563eb" }} /></div>
                  <span style={{ width: 56, textAlign: "right", fontSize: 12, fontWeight: 600 }}>{c}/{blokSay}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {bloklar.length === 0 && <div style={{ padding: 16, color: "#94a3b8", fontSize: 13 }}>Bu sitede blok bilgisi yok.</div>}
      <div style={{ display: "grid", gap: 6, padding: 12 }}>
        {filt.map((b) => {
          const atanmis = BLOK_ROL_LISTE.filter(([r]) => hesaplar[`${b.blok}|${r}`]).length;
          const open = acik === b.blok;
          return (
            <div key={b.blok} style={{ border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <div onClick={() => setAcik(open ? null : b.blok)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer" }}>
                <b style={{ minWidth: 64 }}>{b.blok} Blok</b>
                <span style={{ color: "#64748b", fontSize: 12 }}>{b.hane} hane · {b.kisi} kişi</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: atanmis === N ? "#16a34a" : atanmis > 0 ? "#d97706" : "#94a3b8", fontWeight: 600 }}>{atanmis}/{N} hesap</span>
              </div>
              {open && BLOK_ROL_LISTE.map(([r, et]) => (
                <BlokSlot key={r} site={site} blok={b.blok} rol={r} rolEtiket={et} mevcut={hesaplar[`${b.blok}|${r}`]}
                  digerHesaplar={tumHesap.filter((p) => p.rol === r && !blokParts(p.blok).includes(b.blok))} onChanged={yukle} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
