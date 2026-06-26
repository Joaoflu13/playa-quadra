"use client";

import { useState } from "react";
import BookingBoard from "./BookingBoard";
import CourtPhoto from "./CourtPhoto";

/**
 * Cabeçalho clicável de uma área comum que revela a grade de horários dela.
 * - `withPhoto`: usa uma foto (hero) como cabeçalho. `photoSrc`/`photoAlt`/
 *   `photoObjectPosition` escolhem a imagem (default = foto da quadra de tênis).
 * - sem foto: mostra uma barra com o nome da área (ex.: 🧘 Sala de Pilates).
 * - `allowMatch`: liga/desliga o "procurar parceiro" (só o tênis usa).
 */
export default function AreaReveal({
  courtId,
  title,
  emoji,
  withPhoto = false,
  photoSrc,
  photoAlt,
  photoTall,
  photoObjectPosition,
  allowMatch = true,
}: {
  courtId: string;
  title: string;
  emoji?: string;
  withPhoto?: boolean;
  photoSrc?: string;
  photoAlt?: string;
  photoTall?: boolean;
  photoObjectPosition?: string;
  allowMatch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);

  return (
    <section style={{ marginBottom: 24 }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        style={{ cursor: "pointer" }}
      >
        {withPhoto ? (
          <CourtPhoto
            src={photoSrc}
            alt={photoAlt}
            title={photoSrc ? title : undefined}
            tall={photoTall}
            objectPosition={photoObjectPosition}
            hint={open ? "Toque para recolher ▴" : "Toque para ver os horários ▾"}
          />
        ) : (
          <div className="area-header">
            <span className="area-header__title">
              {emoji ? `${emoji} ` : ""}
              {title}
            </span>
            <span className="area-cta">{open ? "Recolher ▴" : "Ver horários ▾"}</span>
          </div>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 16 }}>
          <BookingBoard courtId={courtId} allowMatch={allowMatch} />
        </div>
      )}
    </section>
  );
}
