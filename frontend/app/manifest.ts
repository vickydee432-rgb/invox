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
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
