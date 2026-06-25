"use client";

import { useState } from "react";

/**
 * Banner (hero) com a foto de uma área e a marca sobreposta.
 * Por padrão usa a foto da quadra de tênis; aceita `src`/`alt`/`title` para
 * reutilizar em outras áreas (ex.: Mesa de Sinuca em public/sinuca.jpg).
 * Enquanto o arquivo não existir, mostra um fundo degradê no lugar da foto.
 * `hint` (opcional) mostra uma chamada de ação no canto.
 */
export default function CourtPhoto({
  src = "/quadra.jpg",
  alt = "Quadra de tênis do Playa del Mago",
  title,
  hint,
  objectPosition = "center 82%",
}: {
  src?: string;
  alt?: string;
  title?: string;
  hint?: string;
  objectPosition?: string;
}) {
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
        <img src={src} alt={alt} style={{ objectPosition }} onError={() => setFailed(true)} />
      )}
      <div className="hero-overlay">
        <span className="eyebrow">Playa del Mago · Barra da Tijuca</span>
        {title && <span className="title">{title}</span>}
        {hint && <span className="hero-hint">{hint}</span>}
        {failed && (
          <span style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
            Dica: salve a foto em <code>public{src}</code> para aparecer aqui.
          </span>
        )}
      </div>
    </div>
  );
}
