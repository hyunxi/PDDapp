import type { Metadata, Viewport } from "next";
import PwaSetup from "@/components/PwaSetup";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDDapp — Pinduoduo Price Monitor",
  description: "Watch Pinduoduo products and get alerted when prices drop below a threshold.",
  applicationName: "PDDapp",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PDDapp", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#e02e24",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a href="/" className="brand">
            🛒 PDDapp
          </a>
          <span className="tagline">Pinduoduo price-threshold monitor</span>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          Installable PWA · push alerts · Supabase + cron
        </footer>
        <PwaSetup />
      </body>
    </html>
  );
}
