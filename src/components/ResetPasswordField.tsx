"use client";

import { useState } from "react";

// Gera uma senha provisória legível e fácil de ditar ao morador,
// ex.: "quadra-4827". Sempre >= 6 caracteres (atende a validação do server).
const WORDS = ["quadra", "tenis", "saque", "rede", "raquete", "game", "set", "ace"];
function gen(): string {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  const n = Math.floor(1000 + Math.random() * 9000); // 4 dígitos
  return `${w}-${n}`;
}

/**
 * Campo de redefinição de senha do morador (painel do síndico).
 * O síndico clica em "Gerar", vê a senha na tela, redefine e entrega ao morador.
 * Não depende de e-mail — resolve a recuperação de senha de forma offline.
 */
export default function ResetPasswordField() {
  const [pwd, setPwd] = useState("");

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, maxWidth: 360, flexWrap: "wrap" }}>
      <input
        name="newPassword"
        type="text"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        placeholder="nova senha provisória"
        minLength={6}
        autoComplete="off"
      />
      <button
        type="button"
        className="btn btn-2"
        onClick={() => setPwd(gen())}
        style={{ whiteSpace: "nowrap" }}
      >
        Gerar
      </button>
      <button className="btn btn-2" type="submit" style={{ whiteSpace: "nowrap" }}>
        Redefinir senha
      </button>
      {pwd && (
        <p className="muted" style={{ width: "100%", margin: "4px 0 0" }}>
          Entregue esta senha ao morador: <strong>{pwd}</strong> (ele troca no 1º acesso).
        </p>
      )}
    </div>
  );
}
