"use client";

import { useState } from "react";

/**
 * Banner (hero) com a foto da quadra (public/quadra.jpg) e a marca sobreposta.
 * Enquanto o arquivo não existir, mostra um fundo degradê no lugar da foto.
 * `hint` (opcional) mostra uma chamada de ação no canto (ex.: "Toque para ver os horários").
 */
export default function CourtPhoto({ hint }: { hint?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="hero">
      {failed ? (
        <div
          style={{
            height: 220,
            background: "linear-gradient(135deg, var(--primary), var(--accent))",
          }}
        />
      ) : (
        <img src="/quadra.jpg" alt="Quadra de tênis do Playa del Mago" onError={() => setFailed(true)} />
      )}
      <div className="hero-overlay">
        <span className="eyebrow">Playa del Mago · Barra da Tijuca</span>
        <span className="title">Quadra de Tênis</span>
        {hint && <span className="hero-hint">{hint}</span>}
        {failed && (
          <span style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
            Dica: salve a foto em <code>public/quadra.jpg</code> para aparecer aqui.
          </span>
        )}
      </div>
    </div>
  );
}
