"use client";

import { useState } from "react";
import BookingBoard from "./BookingBoard";
import CourtPhoto from "./CourtPhoto";

/**
 * Painel de áreas comuns do condomínio. À esquerda, a foto do prédio; à direita,
 * a lista de áreas reserváveis. Hoje só a Quadra de Tênis tem agenda; as demais
 * ficam como "Em breve" — basta marcar `available: true` (e ligar a agenda) para
 * habilitar churrasqueira, futsal, cinema etc. sem mexer no layout.
 */
type Area = { id: string; name: string; emoji: string; available: boolean };

const AREAS: Area[] = [
  { id: "tenis", name: "Quadra de Tênis", emoji: "🎾", available: true },
  { id: "churrasqueira", name: "Churrasqueira", emoji: "🍖", available: false },
  { id: "futsal", name: "Quadra de Futsal", emoji: "⚽", available: false },
  { id: "cinema", name: "Sala de Cinema", emoji: "🎬", available: false },
];

export default function AreasBoard() {
  const [selected, setSelected] = useState<string | null>(null);
  const area = AREAS.find((a) => a.id === selected);

  return (
    <>
      <div className="areas-split">
        {/* Esquerda: foto do prédio (imagem aplicada via CSS, /condominio.jpg). */}
        <div className="areas-photo" aria-hidden="true" />

        {/* Direita: áreas reserváveis. */}
        <div className="areas-list">
          <h2 style={{ margin: "0 0 4px" }}>Áreas comuns</h2>
          <p className="muted" style={{ margin: "0 0 8px" }}>
            Escolha uma área para reservar.
          </p>
          {AREAS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={
                "area-card" +
                (selected === a.id ? " area-card--active" : "") +
                (!a.available ? " area-card--soon" : "")
              }
              disabled={!a.available}
              aria-expanded={a.available ? selected === a.id : undefined}
              onClick={() =>
                a.available && setSelected((s) => (s === a.id ? null : a.id))
              }
            >
              <span className="area-emoji">{a.emoji}</span>
              <span className="area-name">{a.name}</span>
              {a.available ? (
                <span className="area-cta">{selected === a.id ? "Fechar ▴" : "Reservar ▾"}</span>
              ) : (
                <span className="area-badge">Em breve</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Agenda da área selecionada (hoje, apenas a quadra de tênis). */}
      {area?.available && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <CourtPhoto />
          </div>
          <BookingBoard />
        </div>
      )}
    </>
  );
}
