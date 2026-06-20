import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quadra de Tênis · Playa del Mago",
  description: "Agendamento da quadra de tênis — Condomínio Playa del Mago, Barra da Tijuca",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
