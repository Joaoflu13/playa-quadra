import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "Quadra de Tênis · Playa del Mago",
  description: "Agendamento da quadra de tênis — Condomínio Playa del Mago, Barra da Tijuca",
  applicationName: "Quadra Playa",
  appleWebApp: { capable: true, title: "Quadra Playa", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111418",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
