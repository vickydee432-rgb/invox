import "./globals.css";
import type { Metadata } from "next";
import { Sora, Prata } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

const prata = Prata({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Invox",
  description: "Invoices, quotes, expenses, and projects in one workspace."
};

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${prata.variable}`}>
      <body>{children}</body>
    </html>
  );
}
