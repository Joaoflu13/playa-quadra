-- Antecedência de reserva em HORAS (substitui o antigo "advanceDays" em dias).
-- Rode UMA vez no Supabase (SQL Editor) ANTES de publicar.
-- A linha de regras existente recebe 24 (= os antigos 24h / 1 dia).

ALTER TABLE "RuleConfig" ADD COLUMN "advanceHours" INTEGER NOT NULL DEFAULT 24;
