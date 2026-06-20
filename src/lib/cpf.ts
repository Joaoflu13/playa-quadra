/** Mantém apenas os dígitos do CPF (remove pontos, traços, espaços). */
export function onlyDigits(cpf: string): string {
  return (cpf ?? "").replace(/\D/g, "");
}

/** Valida CPF (11 dígitos + dígitos verificadores). */
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += Number(cpf[i]) * (slice + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/** Formata para exibição: 000.000.000-00 */
export function formatCpf(input: string): string {
  const c = onlyDigits(input).padStart(11, "0").slice(0, 11);
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}
