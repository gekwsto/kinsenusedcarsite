import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/app/providers";
import "./globals.css";

// Official Marketing-supplied font package (see src/assets/fonts/manrope/README.txt
// and OFL.txt for provenance/license) — a first-party, self-hosted variable
// font, never fetched from Google Fonts or any external CDN. The variable
// font's own wght axis (200–800) covers every weight this app actually
// uses (300/400/500/600/700), same as the previous next/font/google config.
const manrope = localFont({
  src: "../assets/fonts/manrope/Manrope-VariableFont_wght.ttf",
  variable: "--font-sans",
  display: "swap",
  weight: "200 800",
  style: "normal",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Kinsen Used Cars | Μεταχειρισμένα Οχήματα & Leasing",
    template: "%s | Kinsen",
  },
  description: "Μεταχειρισμένα αυτοκίνητα με leasing από την Kinsen Hellas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el" className={manrope.variable} data-scroll-behavior="smooth">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
