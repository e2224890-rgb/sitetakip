"use client";


export default function KapsamSokaklar({ kapsam }) {
  const parts = (kapsam || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return <div className="card-kapsam">{kapsam || "—"}</div>;
  return (
    <div style={{ margin: "6px 0" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".3px" }}>{parts.length} sokak</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {parts.map((p, i) => (
          <span key={i} style={{ background: "#eef2ff", color: "#4f46e5", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{p}</span>
        ))}
      </div>
    </div>
  );
}
