-- Cria a segunda área reservável: Mesa de Sinuca (court-2).
-- Rode UMA vez no Supabase (SQL Editor) ANTES de publicar.

INSERT INTO "Court" ("id", "name")
VALUES ('court-2', 'Mesa de Sinuca')
ON CONFLICT ("id") DO NOTHING;
