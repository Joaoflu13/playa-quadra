// America/Sao_Paulo é UTC-3 fixo (horário de verão extinto no Brasil desde 2019).
export const TZ_OFFSET = "-03:00";

// Single court: id fixo semeado pelo seed. No V2 isto vira parâmetro.
export const COURT_ID = "court-1";

/**
 * Áreas reserváveis (cada uma é um "court" no banco).
 * Campos opcionais sobrescrevem a regra global (RuleConfig) só para aquela área:
 *  - `capacity`: vagas por horário (default 1). A Sala de Pilates aceita 2 moradores.
 *  - `openHour`/`closeHour`: janela de funcionamento própria (default = RuleConfig).
 */
export type CourtDef = {
  id: string;
  name: string;
  capacity?: number;
  openHour?: number;
  closeHour?: number;
};

export const COURTS: CourtDef[] = [
  { id: "court-1", name: "Quadra de Tênis" },
  { id: "court-2", name: "Mesa de Sinuca" },
  { id: "court-3", name: "Sala de Pilates", capacity: 2, openHour: 5, closeHour: 24 },
];

/** true se o id é uma área conhecida. */
export function isValidCourt(id: string | null | undefined): boolean {
  return COURTS.some((c) => c.id === id);
}

/** Retorna o nome legível de uma área pelo id (ex.: "court-2" → "Mesa de Sinuca"). */
export function courtLabel(id: string): string {
  return COURTS.find((c) => c.id === id)?.name ?? "Área comum";
}

/**
 * Configuração efetiva de uma área: capacidade e janela de funcionamento,
 * usando os overrides da área quando houver, senão a regra global (RuleConfig).
 */
export function courtSettings(
  courtId: string,
  global: { openHour: number; closeHour: number }
): { capacity: number; openHour: number; closeHour: number } {
  const c = COURTS.find((x) => x.id === courtId);
  return {
    capacity: c?.capacity ?? 1,
    openHour: c?.openHour ?? global.openHour,
    closeHour: c?.closeHour ?? global.closeHour,
  };
}

/**
 * Remove o prefixo "Bloco X - " da unidade (o Playa del Mago só tem um bloco).
 * "Bloco A - 304" -> "304" · "Bloco A 101" -> "101" · "304" -> "304".
 */
export function cleanUnit(unit: string | null | undefined): string {
  return (unit ?? "").replace(/^\s*bloco\s*[a-z]?\s*[-–—]?\s*/i, "").trim();
}

/**
 * Gera os horários de início dos slots de um dia (hora local de SP),
 * de openHour (inclusive) até closeHour (exclusivo).
 * Ex.: open=6, close=22 -> 06:00 ... 21:00 (último slot 21:00–22:00).
 */
export function slotStartsForDate(
  dateStr: string,
  openHour: number,
  closeHour: number
): Date[] {
  const out: Date[] = [];
  for (let h = openHour; h < closeHour; h++) {
    const hh = String(h).padStart(2, "0");
    out.push(new Date(`${dateStr}T${hh}:00:00${TZ_OFFSET}`));
  }
  return out;
}
