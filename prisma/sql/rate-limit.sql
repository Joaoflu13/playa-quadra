-- Persiste o rate-limiter de login/ativação no banco (substitui Map in-memory).
-- Rode UMA vez no Supabase (SQL Editor) ANTES de publicar.

CREATE TABLE IF NOT EXISTS "RateLimit" (
  "key"         TEXT        PRIMARY KEY,
  "fails"       INTEGER     NOT NULL DEFAULT 0,
  "firstAt"     TIMESTAMPTZ NOT NULL,
  "lockedUntil" TIMESTAMPTZ
);
