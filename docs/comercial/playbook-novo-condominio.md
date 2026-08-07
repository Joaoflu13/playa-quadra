# Playbook — colocar um NOVO condomínio no ar

Processo de replicação do produto para um novo cliente. Meta: um condomínio
novo no ar em **menos de 1 hora**, sem tocar na lógica do app — só configuração.

Tudo que muda por cliente está em **`src/lib/config.ts`** (nome, localização,
áreas) e nas **fotos** em `public/`. O resto é infraestrutura (banco + deploy).

---

## Visão geral (o que é isolado por cliente)

| Item | Onde | Isolado? |
|---|---|---|
| Nome, localização, áreas | `src/lib/config.ts` | por deploy |
| Fotos (áreas, fundo, ícones) | `public/` | por deploy |
| Banco de dados | Supabase (projeto próprio) | **sim, 100%** |
| Domínio/URL | Vercel (projeto próprio) | sim |
| Regras (horários, limites) | painel do síndico (RuleConfig) | em runtime |

> Modelo atual: **uma instância por condomínio** (banco + deploy próprios).
> Isolamento total de dados. Quando a carteira crescer (5+ clientes), avaliar
> multi-tenant — ver seção "Quando migrar para multi-tenant".

---

## Passo a passo

### 1. Preparar o código do cliente
1. Duplicar o repositório (ou criar um branch/fork por cliente).
2. Editar **`src/lib/config.ts`**:
   - `CONDO`: `name`, `location`, `shortName`.
   - `AREAS`: as áreas do condomínio (título, foto, capacidade, horários).
3. Trocar as fotos em `public/` (mesmos nomes referenciados em `AREAS`, +
   `condominio.jpg` do fundo/login). Otimizar antes (largura ~1200px).
4. `npm run build` local para garantir que compila.

### 2. Criar o banco (Supabase)
1. Novo projeto no Supabase (região São Paulo).
2. Copiar as connection strings: **pooled** (6543, `?pgbouncer=true`) e
   **direta** (5432).
3. No `.env` local, apontar `DATABASE_URL` (pooled) e `DIRECT_URL` (direta)
   para o banco NOVO.
4. Criar as tabelas: `npm run db:push`.
5. **Segurança (obrigatório):** rodar `prisma/sql/enable-rls.sql` no SQL Editor
   do Supabase. Conferir no Security Advisor que os alertas sumiram.

### 3. Provisionar dados iniciais (1 comando)
Com o `.env` apontando para o banco do cliente:

```bash
npm run provision -- --cpf <CPF_DO_SINDICO> --nome "Nome do Síndico" --senha "SenhaProvisoria"
```

Isso cria, de forma idempotente:
- todas as áreas do `config.ts`;
- as regras padrão (RuleConfig);
- a conta ADMIN do síndico (troca de senha forçada no 1º acesso).

### 4. Deploy (Vercel)
1. Novo projeto na Vercel apontando para o repositório do cliente.
2. Variáveis de ambiente (Settings → Environment Variables):
   - `DATABASE_URL`, `DIRECT_URL` (do Supabase do cliente)
   - `AUTH_SECRET` (gerar um novo por cliente), `AUTH_TRUST_HOST=true`
   - `APP_URL` (a URL pública da Vercel do cliente)
   - `CRON_SECRET` (novo por cliente)
   - `RESEND_API_KEY` / `EMAIL_FROM` — opcional (só se for ligar e-mail)
3. Deploy. Conferir a home com as áreas e a foto certas.

### 5. Lembrete automático (opcional)
Cron externo (cron-job.org) batendo em `…/api/cron/reminders` de hora em hora,
com header `Authorization: Bearer <CRON_SECRET>` do cliente.

### 6. Onboarding dos moradores
Seguir `docs/comercial/onboarding-lancamento.md`: import CSV + comunicado.

---

## Checklist de go-live (por cliente)

- [ ] `config.ts` e fotos do cliente
- [ ] `npm run build` local OK
- [ ] Banco Supabase criado + `db:push`
- [ ] **`enable-rls.sql` rodado** e Security Advisor limpo
- [ ] `npm run provision` executado (áreas + regras + síndico)
- [ ] Deploy Vercel com todas as env vars
- [ ] Backup do banco configurado (Supabase Pro ou pg_dump agendado)
- [ ] Login do síndico testado em produção
- [ ] Moradores importados (CSV) + comunicado enviado

---

## Quando migrar para multi-tenant

O modelo "uma instância por cliente" é o certo para os primeiros clientes:
simples, isolado, sem risco. Considere reprojetar para multi-tenant (um banco,
subdomínios, painel de gestão de condomínios) quando:
- passar de ~5 clientes ativos, **ou**
- o tempo de manter N deploys/bancos virar gargalo, **ou**
- quiser um autoatendimento (cliente se cadastra sozinho).

Até lá, este playbook entrega escala suficiente sem reengenharia.
