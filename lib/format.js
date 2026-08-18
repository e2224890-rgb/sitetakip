// Saf yardımcı fonksiyonlar (UI/Supabase bağımsız) — test edilebilir, tek yerde.

export const fmt = (n) => (n ?? 0).toLocaleString("tr-TR");
export const oran = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Renk paleti (nüfus il chart vb.)
export const NUF_RENK = ["#2563eb", "#cf5a26", "#16a34a", "#db2777", "#9333ea", "#0891b2", "#ca8a04", "#dc2626", "#4f46e5", "#0d9488"];

// "GÜL SOKAK No:11 D:5" gibi adresten yalnızca "GÜL SOKAK No:11" kısmını al
export function sokakAdres(s) {
  const t = String(s || "").trim();
  const m = t.match(/^(.*?\bNo[:.\s]*\d+\w?)\b/i);
  return (m ? m[1] : t).replace(/\s+/g, " ").trim();
}

// Hane başlığı: site -> "A Blok · Kapı 5 · D:12"; sokak -> "ADIM SOKAK No:11" (çoklanmayı önler)
export function haneBaslik(h, isSite) {
  if (isSite) {
    return [h.kapi_blok ? `${h.kapi_blok} Blok` : null, h.kapi_no ? `Kapı ${h.kapi_no}` : null, h.no ? `D:${h.no}` : null].filter(Boolean).join(" · ") || h.adres || "";
  }
  const base = sokakAdres(h.adres || "");
  const hasNo = /\bNo[:.\s]*\d/i.test(base);
  const daireOk = h.no != null && /^\d+[a-zA-Z]?$/.test(String(h.no).trim());
  const parts = [];
  if (base) parts.push(base);
  if (!hasNo && h.kapi_no) parts.push(`No:${h.kapi_no}`);
  if (daireOk) parts.push(`D:${h.no}`);
  return parts.join(" ");
}

// Bölge/hane listesini CSV indir
export function csvIndir(bolge, haneler) {
  if (!haneler || !haneler.length) return;
  const yil = new Date().getFullYear();
  const satirlar = [];
  haneler.forEach((h) => h.kisiler.forEach((k) => satirlar.push({
    bolge: bolge.kod, hane: h.no, ad: k.ad, soyad: k.soyad,
    cinsiyet: k.cinsiyet || "", yas: k.dogum_yili ? yil - k.dogum_yili : "",
    telefon: k.telefon || "", uye: k.uye ? "Üye" : "", ziyaret: h.ziyaret ? "Edildi" : "Bekliyor",
  })));
  if (!satirlar.length) return;
  const b = Object.keys(satirlar[0]);
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [b.join(";")].concat(satirlar.map((r) => b.map((h) => esc(r[h])).join(";"))).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${bolge.kod}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function yakRenk(n) { return ["#dc2626", "#f97316", "#eab308", "#84cc16", "#16a34a"][Math.max(0, Math.min(4, (n || 1) - 1))]; }

export function normBlok(s) {
  let x = String(s || "").toLocaleUpperCase("tr").trim();
  x = x.replace(/\bBLOK\b/g, " ").replace(/\bBLOCK\b/g, " ");
  x = x.replace(/(\d+)/g, (m) => String(parseInt(m, 10)));  // 01 → 1
  x = x.replace(/\s+/g, "");                                  // boşlukları at → "A1"
  return x || "—";
}
// Bir hesabın blok alanı "A1,A2" gibi olabilir → normalize edilmiş dizi

export function blokParts(s) { return [...new Set(String(s || "").split(",").map((x) => normBlok(x)).filter((x) => x && x !== "—"))]; }
