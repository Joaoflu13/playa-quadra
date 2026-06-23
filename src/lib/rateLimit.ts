// Limitador de tentativas de login por CPF (anti força-bruta).
//
// Implementação em memória: simples e sem dependências. Em serverless (Vercel)
// o estado vive por instância — num condomínio pequeno (1 instância) já é um
// freio eficaz. Para escala maior, trocar por Upstash/Redis mantendo esta API.

type Bucket = { fails: number; firstAt: number; lockedUntil?: number };

const WINDOW_MS = 10 * 60_000; // janela de contagem: 10 min
const MAX_FAILS = 8; // tentativas erradas antes de bloquear
const LOCK_MS = 2 * 60_000; // bloqueio após estourar: 2 min

const buckets = new Map<string, Bucket>();

/** true se o CPF está temporariamente bloqueado por excesso de tentativas. */
export function isLocked(key: string): boolean {
  const b = buckets.get(key);
  if (!b?.lockedUntil) return false;
  if (Date.now() < b.lockedUntil) return true;
  buckets.delete(key); // expirou o bloqueio
  return false;
}

/** Registra uma tentativa que falhou; bloqueia ao atingir o limite. */
export function registerFailure(key: string): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.firstAt > WINDOW_MS) {
    buckets.set(key, { fails: 1, firstAt: now });
    return;
  }
  b.fails += 1;
  if (b.fails >= MAX_FAILS) b.lockedUntil = now + LOCK_MS;
}

/** Login bem-sucedido: zera o contador do CPF. */
export function clearFailures(key: string): void {
  buckets.delete(key);
}
