"use client";


export default function StatCard({ ic, lbl, num, meta, renk, onClick }) {
  return (
    <div className="stat" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className="stat-ic" style={{ background: (renk || "var(--accent)") + "1e", color: renk || "var(--accent)" }}>{ic}</div>
      <div><div className="stat-num">{num}</div><div className="stat-lbl">{lbl}</div>
        {meta && <div className="stat-meta">{meta}</div>}</div>
    </div>
  );
}
