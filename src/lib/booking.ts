// Núcleo compartilhado de reservas. Concentra a lógica que estava duplicada
// (e podia divergir) entre POST /api/bookings e o "Eu quero" de /api/bookings/match:
//   - validação de slot (alinhamento, janela operacional, antecedência);
//   - checagem de bloqueio da área (manutenção/torneio);
//   - criação da reserva reaproveitando a linha CANCELLED do mesmo slot.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Config } from "@/lib/rules";

/** Hora local de São Paulo (0–23) de um instante. */
export function hourSP(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(d)
  );
}

/**
 * Valida que `start` é um slot operacional dentro da janela de reserva.
 * Retorna uma mensagem de erro (pt-BR) ou null se estiver tudo certo.
 */
export function validateSlot(start: Date, cfg: Config, now: Date = new Date()): string | null {
  if (Number.isNaN(start.getTime())) return "startAt inválido";
  if (start.getUTCMinutes() !== 0) return "Slots começam na hora cheia";
  const h = hourSP(start);
  if (h < cfg.openHour || h >= cfg.closeHour) return "Fora da janela operacional";
  if (start <= now) return "Slot no passado";
  const maxDate = new Date(now.getTime() + cfg.advanceHours * 3_600_000);
  if (start > maxDate) return `Antecedência máxima de ${cfg.advanceHours} horas`;
  return null;
}

/**
 * Há bloqueio da área (CourtBlock) tocando o intervalo [start, end)?
 * Retorna o motivo do bloqueio, ou null se livre.
 */
export async function findBlockReason(
  courtId: string,
  start: Date,
  end: Date
): Promise<string | null> {
  const block = await prisma.courtBlock.findFirst({
    where: { courtId, startAt: { lt: end }, endAt: { gt: start } },
    select: { reason: true },
  });
  return block?.reason ?? null;
}

/** Sinaliza que o slot já está confirmado por outra reserva (corrida perdida). */
export class SlotTakenError extends Error {
  constructor() {
    super("Slot acabou de ser reservado");
  }
}

/**
 * Cria (ou confirma) a reserva de um slot DENTRO de uma transação.
 *
 * A trava @@unique([courtId, startAt]) vale para QUALQUER status, então uma
 * reserva CANCELLED ainda ocupa a linha do slot. Para permitir remarcar um
 * horário cancelado, reaproveitamos a linha existente em vez de criar outra
 * (o que estouraria a unique). Se a linha já está CONFIRMED, lança SlotTakenError.
 *
 * NÃO valida limites/janela/bloqueio — isso é responsabilidade do chamador,
 * que conhece as regras específicas do seu fluxo (quem conta o limite, etc.).
 */
export async function upsertConfirmedBooking(
  tx: Prisma.TransactionClient,
  params: { courtId: string; aptId: string; start: Date; end: Date }
) {
  const { courtId, aptId, start, end } = params;

  const existing = await tx.booking.findUnique({
    where: { courtId_startAt: { courtId, startAt: start } },
  });

  if (existing) {
    if (existing.status === "CONFIRMED") throw new SlotTakenError();
    // Limpa "procuro parceiros" antigo preso na linha cancelada.
    await tx.joinInterest.deleteMany({ where: { bookingId: existing.id } });
    return tx.booking.update({
      where: { id: existing.id },
      data: {
        aptId,
        endAt: end,
        status: "CONFIRMED",
        openForPlayers: false,
        reminderSentAt: null,
        createdAt: new Date(),
      },
    });
  }

  return tx.booking.create({
    data: { courtId, aptId, startAt: start, endAt: end, status: "CONFIRMED" },
  });
}
