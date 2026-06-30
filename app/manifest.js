export default function manifest() {
  return {
    name: "Saha Teşkilatı Yönetim Sistemi",
    short_name: "Saha Takip",
    description: "Site / Sokak sorumlusu ve hane ziyaret takip sistemi",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#cf5a26",
    lang: "tr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
