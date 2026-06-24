import type { MetadataRoute } from "next";

// Manifesto PWA: permite "instalar" o site como app (Android/Chrome) e dá
// nome/ícone na tela de início (iOS/Android). O Next serve isto em
// /manifest.webmanifest e injeta o <link rel="manifest"> automaticamente.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quadra de Tênis · Playa del Mago",
    short_name: "Quadra Playa",
    description: "Reserva da quadra de tênis do condomínio Playa del Mago.",
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
