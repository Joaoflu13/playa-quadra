import type { MetadataRoute } from "next";
import { CONDO } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${CONDO.shortName} · ${CONDO.name}`,
    short_name: CONDO.shortName,
    description: `Reserva de áreas comuns do condomínio ${CONDO.name}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111418",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
