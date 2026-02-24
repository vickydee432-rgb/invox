import "./globals.css";
import type { Metadata } from "next";
import { Sora, Prata } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

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
  description: "Invoices, quotes, expenses, and projects in one workspace.",
  manifest: "/manifest.webmanifest",
  themeColor: "#f05d23",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Invox"
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
      { url: "/icons/apple-touch-icon-167.png", sizes: "167x167" },
      { url: "/icons/apple-touch-icon-152.png", sizes: "152x152" },
      { url: "/icons/apple-touch-icon-120.png", sizes: "120x120" }
    ]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${prata.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
