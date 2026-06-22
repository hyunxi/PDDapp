import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDDapp — Pinduoduo Price Monitor",
  description: "Watch Pinduoduo products and get alerted when prices drop below a threshold.",
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
          Pluggable fetchers · Supabase + cron · email &amp; webhook alerts
        </footer>
      </body>
    </html>
  );
}
