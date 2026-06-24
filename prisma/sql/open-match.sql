-- "Jogo aberto" (procurar parceiro sem reservar o horário).
-- Rode UMA vez no Supabase (SQL Editor) ANTES de publicar.

CREATE TABLE "OpenMatch" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "aptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpenMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpenMatch_courtId_startAt_key" ON "OpenMatch"("courtId", "startAt");
CREATE INDEX "OpenMatch_aptId_idx" ON "OpenMatch"("aptId");

ALTER TABLE "OpenMatch"
    ADD CONSTRAINT "OpenMatch_aptId_fkey"
    FOREIGN KEY ("aptId") REFERENCES "Apartment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
