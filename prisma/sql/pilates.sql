-- Adiciona a Sala de Pilates (court-3) e ajusta a trava de unicidade das
-- reservas para permitir CAPACIDADE > 1 por horário (Pilates = 2 moradores).
-- Rode UMA vez no Supabase (SQL Editor) ANTES de publicar.

-- 1) Cria a área.
INSERT INTO "Court" ("id", "name")
VALUES ('court-3', 'Sala de Pilates')
ON CONFLICT ("id") DO NOTHING;

-- 2) Troca a trava única [courtId, startAt] -> [courtId, startAt, aptId].
--    Assim, dois moradores diferentes podem reservar o MESMO horário (até a
--    capacidade da área); o limite de vagas é validado na transação do app.
--    Os dados existentes (no máximo 1 reserva por slot) seguem compatíveis.
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_courtId_startAt_key";
DROP INDEX IF EXISTS "Booking_courtId_startAt_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_courtId_startAt_aptId_key"
  ON "Booking" ("courtId", "startAt", "aptId");

-- 3) Índice auxiliar para contar ocupação de um slot rapidamente.
CREATE INDEX IF NOT EXISTS "Booking_courtId_startAt_idx"
  ON "Booking" ("courtId", "startAt");
