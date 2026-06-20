// America/Sao_Paulo é UTC-3 fixo (horário de verão extinto no Brasil desde 2019).
export const TZ_OFFSET = "-03:00";

// Single court: id fixo semeado pelo seed. No V2 isto vira parâmetro.
export const COURT_ID = "court-1";

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
