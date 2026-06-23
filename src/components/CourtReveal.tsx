"use client";

import { useState } from "react";
import CourtPhoto from "./CourtPhoto";
import BookingBoard from "./BookingBoard";

/**
 * Tela inicial do morador: mostra primeiro a foto da quadra (hero) e só revela
 * a grade de horários (calendário) quando o morador toca na foto. Mantém a
 * primeira impressão limpa e convida ao clique.
 */
export default function CourtReveal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={{ cursor: "pointer", marginBottom: 16 }}
      >
        <CourtPhoto hint={open ? "Toque para recolher ▴" : "Toque para ver os horários ▾"} />
      </div>
      {open && <BookingBoard />}
    </>
  );
}
