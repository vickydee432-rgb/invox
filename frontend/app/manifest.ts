import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Invox",
    short_name: "Invox",
    description: "Invoices, quotes, expenses, and projects in one workspace.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#f05d23",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icons/icon-256.png",
        sizes: "256x256",
        type: "image/png"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
