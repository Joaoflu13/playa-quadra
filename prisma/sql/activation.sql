-- Auto-cadastro (Opção B): coluna activatedAt no Apartment.
-- Rode UMA vez no Supabase (SQL Editor) ANTES de publicar o código que a usa.
--
-- null         = pré-autorizado, ainda NÃO ativado pelo morador (claimable em /ativar)
-- preenchido   = conta ativada (já tem senha; não pode ser "ativada" por terceiros)
--
-- O UPDATE backfill marca TODAS as contas existentes como ativadas, para que
-- ninguém consiga "ativar" (resetar) a conta de um vizinho já cadastrado.

ALTER TABLE "Apartment" ADD COLUMN "activatedAt" TIMESTAMP(3);
UPDATE "Apartment" SET "activatedAt" = "createdAt" WHERE "activatedAt" IS NULL;
