import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";
import { CONDO } from "@/lib/config";

export const metadata: Metadata = {
  title: `${CONDO.shortName} · ${CONDO.name}`,
  description: `Agendamento de áreas comuns — Condomínio ${CONDO.name}, ${CONDO.location}`,
  applicationName: CONDO.shortName,
  appleWebApp: { capable: true, title: CONDO.shortName, statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
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
