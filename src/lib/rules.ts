import { prisma } from "@/lib/db";

export type Config = {
  slotMinutes: number;
  openHour: number;
  closeHour: number;
  advanceHours: number;
  maxActivePerApt: number;
  maxWeeklyPerApt: number;
  cancelMinNoticeMin: number;
  noShowBlockDays: number;
};

export const DEFAULTS: Config = {
  slotMinutes: 60,
  openHour: 8, // abre 8h
  closeHour: 22, // fecha 22h (último slot 21h–22h)
  advanceHours: 24, // janela de reserva de 24h (em horas)
  maxActivePerApt: 2,
  maxWeeklyPerApt: 3,
  cancelMinNoticeMin: 120, // cancelar até 2h antes
  noShowBlockDays: 7, // bloqueio de 7 dias por falta
};

/** Lê o singleton RuleConfig (id=1); se ausente, devolve DEFAULTS. */
export async function getConfig(): Promise<Config> {
  const row = await prisma.ruleConfig.findUnique({ where: { id: 1 } });
  return row ?? DEFAULTS;
}
