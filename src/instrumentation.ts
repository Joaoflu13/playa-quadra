// Hook nativo do Next.js 15: captura erros não tratados em route handlers,
// server actions e server components, encaminhando para o relato centralizado.
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string }
) {
  const { reportError } = await import("@/lib/observability");
  await reportError(`Erro em ${request.method} ${request.path}`, err);
}
