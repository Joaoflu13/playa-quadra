// Limitador de tentativas de login/ativação por CPF, persistido no Postgres.
//
// Substitui a implementação in-memory anterior, que não sobrevivia a cold starts
// e não era compartilhada entre instâncias serverless. A API pública é idêntica
// para não exigir mudanças nos chamadores (login/page.tsx, ativar/actions.ts, auth.ts).
//
// Comportamento: 8 falhas numa janela de 10 min → trava por 2 min.
// Registro expirado é recriado na primeira falha após a janela (limpeza lazy).

import { prisma } from "@/lib/db";

const WINDOW_MS = 10 * 60_000; // janela de contagem: 10 min
const MAX_FAILS = 8;            // tentativas antes de bloquear
const LOCK_MS   = 2 * 60_000;  // duração do bloqueio: 2 min

/** true se a chave está temporariamente bloqueada. */
export async function isLocked(key: string): Promise<boolean> {
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    if (!row?.lockedUntil) return false;
    if (row.lockedUntil > new Date()) return true;
    // Bloqueio expirou: limpa.
    await prisma.rateLimit.delete({ where: { key } }).catch(() => {});
    return false;
  } catch {
    return false; // falha no banco não bloqueia o fluxo
  }
}

/** Registra uma tentativa que falhou; bloqueia ao atingir o limite. */
export async function registerFailure(key: string): Promise<void> {
  try {
    const now = new Date();
    const row = await prisma.rateLimit.findUnique({ where: { key } });

    if (!row || now.getTime() - row.firstAt.getTime() > WINDOW_MS) {
      // Janela nova (ou registro inexistente).
      await prisma.rateLimit.upsert({
        where: { key },
        update: { fails: 1, firstAt: now, lockedUntil: null },
        create: { key, fails: 1, firstAt: now },
      });
      return;
    }

    const newFails = row.fails + 1;
    await prisma.rateLimit.update({
      where: { key },
      data: {
        fails: newFails,
        lockedUntil: newFails >= MAX_FAILS ? new Date(now.getTime() + LOCK_MS) : null,
      },
    });
  } catch {
    // Falha silenciosa: não derruba o fluxo de autenticação.
  }
}

/** Login/ativação bem-sucedido: zera o contador. */
export async function clearFailures(key: string): Promise<void> {
  try {
    await prisma.rateLimit.delete({ where: { key } });
  } catch {
    // Linha pode não existir se nunca houve falha — ignorar.
  }
}
