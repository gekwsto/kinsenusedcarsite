import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Providers } from "@/app/providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "greek"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
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
