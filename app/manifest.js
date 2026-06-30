export default function manifest() {
  return {
    name: "Saha Teşkilatı Yönetim Sistemi",
    short_name: "Saha Takip",
    description: "Site / Sokak sorumlusu ve hane ziyaret takip sistemi",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#cf5a26",
    lang: "tr",
    dir: "ltr",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
