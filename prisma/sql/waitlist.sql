-- Cria a tabela da lista de espera (modelo Waitlist do schema.prisma).
-- Rode UMA vez no Supabase (SQL Editor) ANTES de publicar o código que a usa.
-- Equivale ao que `prisma db push` faria; nomes batem com o Prisma Client.

CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "aptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Waitlist_courtId_startAt_aptId_key"
    ON "Waitlist"("courtId", "startAt", "aptId");
CREATE INDEX "Waitlist_courtId_startAt_idx" ON "Waitlist"("courtId", "startAt");
CREATE INDEX "Waitlist_aptId_idx" ON "Waitlist"("aptId");

ALTER TABLE "Waitlist"
    ADD CONSTRAINT "Waitlist_aptId_fkey"
    FOREIGN KEY ("aptId") REFERENCES "Apartment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
