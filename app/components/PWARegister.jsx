"use client";
import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // GELİŞTİRMEDE (localhost) service worker KAYDETME.
    // Sebep: dev'de SW eski bundle'ı cache'leyip F5'te bayat kod servis ediyor,
    // cache temizlenince de sayfa "Yükleniyor…"da takılıyor.
    // Ayrıca daha önce dev'de kaydolmuş SW'yi ve cache'leri otomatik temizle -> kendini onarır.
    const dev = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (dev) {
      navigator.serviceWorker.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister()));
      if (window.caches?.keys) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
      return;
    }

    let reloaded = false;
    // Yeni service worker devralınca sayfayı bir kez yenile -> güncel arayüz anında gelir
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");

        // Bekleyen yeni sürüm varsa hemen devralmasını iste
        if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");

        // Yeni sürüm bulununca, kurulum bittiğinde devral
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              reg.waiting?.postMessage("SKIP_WAITING");
            }
          });
        });

        // Uygulama her öne geldiğinde güncelleme kontrolü yap (iOS standalone için kritik)
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update();
        });
        reg.update();
      } catch (_) { /* sessiz geç */ }
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
