# Checklist — apresentação ao síndico (essa semana)

> Diagnóstico: **o app já está pronto para demonstrar.** O que falta NÃO é funcionalidade,
> é **preparação operacional**. Recomendação: não adicionar features novas nesta semana
> (risco de quebrar um demo que funciona) e focar nos itens abaixo.

## 🔴 Bloqueante (sem isso a demo trava)

- [ ] **Login de síndico funcionando em produção.**
      Use sua conta CPF `122.588.097-11` com a senha que você definiu.
      Esqueceu? Rode: `npx tsx scripts/reset-password.ts 12258809711 NovaSenha123 --admin`
      (precisa do `.env` com a `DATABASE_URL` de produção).

- [ ] **Dados na grade para o demo não ficar vazio.**
      ⚠️ **CUIDADO:** `npm run db:seed:demo` **apaga TODAS as reservas futuras e TODAS as
      notificações** do banco apontado. **NÃO rode na produção** se já houver uso real.
      Opções seguras:
      1. Criar 2–3 reservas à mão na hora do demo (mostra o fluxo ao vivo — melhor narrativa).
      2. Usar um **banco de demonstração separado** e rodar `db:seed` + `db:seed:demo` nele.

## 🟡 Importante (fortalece a venda, mas não trava o demo)

- [ ] **Cron externo do lembrete** (cron-job.org): para o "lembrete automático" funcionar
      de fato. URL `…/api/cron/reminders`, a cada hora, header
      `Authorization: Bearer <CRON_SECRET>` (mesmo valor na Vercel e no cron-job.org; redeploy).
- [ ] **Domínio verificado na Resend**: hoje o e-mail só chega no endereço da própria conta
      (modo teste). Com domínio, chega a qualquer morador. Setar `EMAIL_FROM` e redeploy.

## 🟢 Opcional (pode ficar para o piloto)

- [ ] **Auto-cadastro do morador** com lista pré-autorizada de CPFs.
- [ ] **Tutorial de 1 página** para o morador (entra no onboarding do piloto).

## Roteiro do dia
Ver `docs/comercial/roteiro-venda.md`. Leve a `proposta-comercial.md` impressa/PDF.
Tenha o app aberto no celular logado como **morador** e como **síndico**.
