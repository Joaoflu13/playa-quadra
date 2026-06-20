"use client";

import { useState } from "react";

/**
 * Mostra a foto da quadra (public/quadra.jpg). Enquanto o arquivo não existir,
 * exibe um placeholder. É só colocar o arquivo em public/quadra.jpg.
 */
export default function CourtPhoto() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        style={{
          height: 160,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#166534,#16a34a)",
          color: "white",
          fontWeight: 600,
          textAlign: "center",
          border: "1px solid var(--border)",
        }}
      >
        🎾 Coloque a foto em <code style={{ margin: "0 6px" }}>public/quadra.jpg</code>
      </div>
    );
  }

  return (
    <img
      src="/quadra.jpg"
      alt="Quadra de tênis do condomínio"
      onError={() => setFailed(true)}
      style={{
        width: "100%",
        height: 200,
        objectFit: "cover",
        borderRadius: 12,
        border: "1px solid var(--border)",
        display: "block",
      }}
    />
  );
}
