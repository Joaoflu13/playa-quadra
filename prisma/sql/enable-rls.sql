-- =====================================================================
-- SEGURANÇA: habilita Row-Level Security (RLS) em TODAS as tabelas.
-- =====================================================================
-- Por quê: o Supabase expõe uma API REST pública (PostgREST) com a chave
-- "anon" (pública por design). Com RLS DESLIGADO, qualquer um com essa
-- chave lê/edita/apaga tudo — incluindo CPF, hash de senha, e-mail e nome
-- dos moradores. Ligar RLS sem políticas BLOQUEIA totalmente os roles
-- públicos (anon/authenticated) nessa API.
--
-- O app NÃO é afetado: ele acessa via Prisma com o role "postgres"
-- (BYPASSRLS), que ignora RLS. Continua funcionando idêntico.
--
-- Rode UMA vez no Supabase (SQL Editor).
-- =====================================================================

-- Liga RLS em toda tabela do schema public (pega tudo, inclusive futuras
-- que você esquecer de listar). Sem CREATE POLICY = ninguém público acessa.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- Verificação: rode esta query depois. Toda linha deve ter rowsecurity = true.
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY tablename;
