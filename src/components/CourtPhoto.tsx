"use client";

import { useState } from "react";

/**
 * Banner (hero) com a foto de uma área e a marca sobreposta.
 * Por padrão usa a foto da quadra de tênis; aceita `src`/`alt`/`title` para
 * reutilizar em outras áreas (ex.: Mesa de Sinuca, Sala de Pilates).
 *
 * `fit`:
 *  - "cover" (default): a foto preenche o banner (pode recortar). Ideal p/ fotos
 *    horizontais como a da quadra.
 *  - "contain": mostra a foto INTEIRA (sem recorte), com um fundo desfocado da
 *    própria imagem preenchendo as laterais. Ideal p/ fotos verticais.
 *
 * Enquanto o arquivo não existir, mostra um fundo degradê no lugar da foto.
 * `hint` (opcional) mostra uma chamada de ação no canto.
 */
export default function CourtPhoto({
  src = "/quadra.jpg",
  alt = "Quadra de tênis do Playa del Mago",
  title,
  hint,
  fit = "cover",
  objectPosition = "center 82%",
}: {
  src?: string;
  alt?: string;
  title?: string;
  hint?: string;
  fit?: "cover" | "contain";
  objectPosition?: string;
}) {
  const [failed, setFailed] = useState(false);
  const contain = fit === "contain";

  return (
    <div className={`hero${contain ? " hero--contain" : ""}`}>
      {failed ? (
        <div
          style={{
            height: 220,
            background: "linear-gradient(135deg, var(--primary), var(--accent))",
          }}
        />
      ) : (
        <>
          {contain && (
            // Fundo desfocado da própria foto, preenche as laterais sem tarjas.
            <div className="hero-blur" style={{ backgroundImage: `url(${src})` }} aria-hidden />
          )}
          <img
            src={src}
            alt={alt}
            style={contain ? { objectFit: "contain", objectPosition: "center" } : { objectPosition }}
            onError={() => setFailed(true)}
          />
        </>
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
