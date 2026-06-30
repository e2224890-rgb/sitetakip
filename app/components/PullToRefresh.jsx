"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Mobilde sayfa en üstündeyken aşağı çekince yenileme (pull-to-refresh).
// Bağımsız: dokunmatik olmayan cihazlarda hiçbir şey yapmaz.
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);     // anlık çekme mesafesi (px)
  const [snap, setSnap] = useState(false); // bırakınca yumuşak dönüş
  const [busy, setBusy] = useState(false); // yenileniyor
  const TH = 70;                           // tetik eşiği

  useEffect(() => {
    let sy = null, cur = 0, refreshing = false;
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onStart = (e) => {
      if (refreshing || !atTop()) { sy = null; return; }
      sy = e.touches[0].clientY; cur = 0;
    };
    const onMove = (e) => {
      if (sy == null || refreshing) return;
      const dy = e.touches[0].clientY - sy;
      if (dy <= 0 || !atTop()) { cur = 0; setPull(0); return; }
      cur = Math.min(dy * 0.5, 110);   // dirençli çekme
      setSnap(false);
      setPull(cur);
      if (cur > 4 && e.cancelable) e.preventDefault();  // sayfanın kaymasını engelle
    };
    const onEnd = () => {
      if (sy == null) return;
      sy = null;
      setSnap(true);
      if (cur >= TH) {
        refreshing = true; setBusy(true); setPull(TH);
        setTimeout(() => window.location.reload(), 450);
      } else {
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const hazir = pull >= TH;
  return (
    <div aria-hidden style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 3000,
      display: "flex", justifyContent: "center", pointerEvents: "none",
      transform: `translateY(${(busy ? TH : pull) - 46}px)`,
      transition: snap ? "transform .28s ease" : "none",
      opacity: pull > 0 || busy ? 1 : 0,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: "50%", background: "#fff",
        boxShadow: "0 3px 12px rgba(0,0,0,.18)", display: "grid", placeItems: "center",
      }}>
        <RefreshCw size={19} color="#cf5a26" style={{
          transform: `rotate(${busy ? 0 : pull * 3}deg)`,
          animation: busy ? "ptr-spin .8s linear infinite" : "none",
          opacity: hazir || busy ? 1 : 0.55,
        }} />
      </div>
    </div>
  );
}
