# Playa del Mago — Reserva da Quadra de Tênis

App de reserva da quadra de tênis do condomínio **Playa del Mago** (Barra da Tijuca, RJ).
Cada morador tem login próprio (por **CPF**) e reserva horários; o síndico administra regras,
moradores e faltas. Em produção e funcionando.

- **Site (produção):** https://playa-quadra.vercel.app
- **Repositório:** https://github.com/Joaoflu13/playa-quadra
- **Hospedagem:** Vercel (Next.js) + **Supabase** (Postgres). Deploy automático a cada `git push` na `main`.

## Stack
Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL (Supabase) · NextAuth v5 (credenciais, login por CPF) · bcryptjs.

## Rodar localmente
```bash
git clone https://github.com/Joaoflu13/playa-quadra.git
cd playa-quadra
npm install
# crie o arquivo .env (veja .env.example e a seção "Variáveis" abaixo)
npx prisma generate
npm run dev            # http://localhost:3000
```
Scripts úteis: `npm run db:push` (aplica schema no banco), `npm run db:seed` (dados base),
`npm run db:seed:demo` (cenário de demonstração), `npm run build` (build de produção).

> ⚠️ O `.env` NÃO está no Git (contém segredos). Pegue os valores reais no painel da Vercel
> (Settings → Environment Variables → cada valor pode ser revelado) ou no Supabase.
> Rodar local com a `DATABASE_URL` do Supabase usa o **mesmo banco da produção** — cuidado ao
> mexer em dados. Para isolar, aponte para um Postgres local.

## Variáveis de ambiente (ver `.env.example`)
- `DATABASE_URL` — Postgres **pooled** (Supabase porta 6543, com `?pgbouncer=true`). Usado pelo app.
- `DIRECT_URL` — Postgres **direto/session** (porta 5432). Usado por `prisma db push`/seed.
- `AUTH_SECRET` — segredo da sessão (NextAuth).
- `AUTH_TRUST_HOST` — `true` (necessário na Vercel).
- `CRON_SECRET` — protege `GET /api/cron/reminders`.
- `APP_URL` — URL pública (links de e-mail). Em prod: `https://playa-quadra.vercel.app`.
- `RESEND_API_KEY` (opcional) — sem ela, e-mails ficam em fallback (logam, não enviam). `EMAIL_FROM` opcional.

## Modelo de dados (resumo)
- `Apartment` = **conta de um morador** (o nome do model é histórico). Campos-chave: `cpf` (login,
  só dígitos), `label` (nome do morador), `unit` (ex. "Bloco A - 304"), `email` (opcional),
  `role` (RESIDENT|ADMIN), `status` (ACTIVE|SUSPENDED), `blockedUntil` (bloqueio por falta),
  `mustChangePassword` (força troca no 1º acesso). FK nas reservas é `aptId`.
- `Court` (quadra única, id `court-1`; modelado p/ multi-quadra futuro).
- `Booking` (`@@unique([courtId, startAt])` impede dois no mesmo slot; `openForPlayers`; `reminderSentAt`).
- `JoinInterest` ("procuro parceiros"), `Notification` (sino in-app), `PasswordResetToken`, `RuleConfig` (singleton id=1), `Penalty`.

## Regras (editáveis no painel do síndico — RuleConfig)
8h–22h (último slot 21h) · janela de reserva de **24h** (`advanceDays=1`) · cancelar até **2h** antes ·
máx. 2 reservas ativas e 3 por 7 dias por morador · no-show ⇒ **bloqueio de 7 dias** (`noShowBlockDays`).

## Funcionalidades
Login por CPF · reserva/cancelamento · ver quem marcou (nome+unidade) · "procuro parceiros" + interesse ·
notificações in-app (sino, atualiza a cada 30s) · grade atualiza sozinha (polling 20s + foco) ·
troca de senha (`/conta`) · esqueci-minha-senha por token (`/esqueci`,`/redefinir`) ·
**primeiro acesso força troca de senha** · painel do síndico (`/admin`): regras, cadastro individual,
**import CSV em massa**, suspender/reativar, bloqueio por falta, reset de senha. Só ADMIN acessa o painel
(guard `requireAdmin` na página E em todas as server actions).

## Logins de demonstração
> ⚠️ As credenciais NÃO ficam aqui (repositório público). As contas demo existem no
> banco, mas as senhas foram rotacionadas para um valor privado — peça ao responsável.
> O `prisma/seed.ts` ainda usa uma senha provisória só para popular um banco LOCAL/novo;
> nunca rode o seed apontando para produção.
- Síndico (ADMIN): CPF `100.200.300-88`
- João Silva (A-101): `111.222.333-96`
- Maria Souza (A-304): `444.555.666-19`
- Carlos Lima (B-502): `777.888.999-41`

## Pendências / próximos passos
- **E-mail real:** setar `RESEND_API_KEY` na Vercel (conta grátis em resend.com) p/ confirmação/lembrete/reset saírem de verdade.
- Contexto de negócio: o dono vai **vender o serviço ao síndico**. Roadmap de venda: outras áreas comuns
  (churrasqueira, salão), piloto 30 dias grátis.

## Notas de ambiente
- Banco anterior era Neon, mas o **Neon free do usuário estourou cota** (projeto do "bolão"); por isso a quadra usa **Supabase** (separado).
- Cron na Vercel Hobby roda **1x/dia** (`vercel.json`: `0 11 * * *`).
- Prisma com Supabase: app usa pooled (6543, pgbouncer); migrações/seed usam direto (5432).
- Dev em Windows/PowerShell: cuidado com escape de `$` em `node -e` (use o Bash do Git pra esses comandos).
- Fotos em `public/quadra.jpg` (hero) e `public/condominio.jpg` (fundo/login) — versionadas.
