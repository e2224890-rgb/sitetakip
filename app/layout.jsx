import "./globals.css";
import PWARegister from "./components/PWARegister";
import PullToRefresh from "./components/PullToRefresh";

export const metadata = {
  title: "Saha Teşkilatı Yönetim Sistemi",
  description: "İstanbul İl Başkanlığı saha organizasyon takip",
  applicationName: "Saha Takip",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Saha Takip",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#cf5a26",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PullToRefresh />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
