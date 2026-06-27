import { AREAS } from "./config";

// America/Sao_Paulo é UTC-3 fixo (horário de verão extinto no Brasil desde 2019).
export const TZ_OFFSET = "-03:00";

// Single court: id fixo semeado pelo seed. No V2 isto vira parâmetro.
export const COURT_ID = "court-1";

export type CourtDef = {
  id: string;
  name: string;
  capacity?: number;
  openHour?: number;
  closeHour?: number;
};

/** Derivado de AREAS em config.ts — edite lá para adicionar/remover áreas. */
export const COURTS: CourtDef[] = AREAS.map((a) => ({
  id: a.courtId,
  name: a.title,
  capacity: a.capacity,
  openHour: a.openHour,
  closeHour: a.closeHour,
}));

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
