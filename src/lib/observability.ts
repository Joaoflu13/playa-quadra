// Relato centralizado de erros. Sempre loga estruturado; se ERROR_WEBHOOK_URL
// estiver configurada (Discord, Slack ou um endpoint próprio), dispara um alerta.
//
// Mesma filosofia do e-mail: a env var é OPCIONAL. Sem ela, os erros continuam
// indo para os logs da Vercel (fallback), sem quebrar nada. Com ela, você recebe
// um ping na hora em que algo quebra em produção — sem precisar instalar SDK.

type Context = Record<string, unknown>;

/** Monta uma mensagem curta legível em chat (Discord/Slack aceitam { content }). */
function toAlert(message: string, err: unknown, ctx?: Context): string {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const where = ctx && Object.keys(ctx).length ? ` | ${JSON.stringify(ctx)}` : "";
  return `🚨 [playa-quadra] ${message} — ${detail}${where}`;
}

/**
 * Registra um erro. `message` descreve o ponto ("POST /api/bookings"),
 * `err` é o erro capturado, `ctx` são dados úteis (ex.: { aptId, courtId }).
 * Nunca lança — observabilidade não pode derrubar o fluxo que a chamou.
 */
export async function reportError(message: string, err: unknown, ctx?: Context): Promise<void> {
  // 1) Log estruturado (sempre) — aparece nos logs da Vercel.
  console.error(
    JSON.stringify({
      level: "error",
      message,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
      ...ctx,
      at: new Date().toISOString(),
    })
  );

  // 2) Alerta opcional via webhook (Discord/Slack/genérico).
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: toAlert(message, err, ctx) }),
    });
  } catch {
    // Falha do webhook não pode propagar; o log acima já registrou o erro original.
  }
}
