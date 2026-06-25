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

/** Slot sem vaga (cheio) — corrida perdida ou capacidade esgotada. */
export class SlotTakenError extends Error {
  constructor(message = "Slot acabou de ser reservado") {
    super(message);
  }
}

/** O próprio morador já tem esse horário reservado. */
export class AlreadyBookedError extends Error {
  constructor() {
    super("Você já reservou este horário");
  }
}

/**
 * Cria (ou confirma) a reserva de um slot DENTRO de uma transação, respeitando
 * a CAPACIDADE da área (vagas por horário; default 1).
 *
 * Integridade:
 *  - Conta as reservas CONFIRMED do slot; se já atingiu a capacidade, lança
 *    SlotTakenError. Sob isolamento Serializable, duas reservas concorrentes
 *    para a última vaga geram conflito de serialização (P2034) — uma é abortada.
 *  - A trava @@unique([courtId, startAt, aptId]) vale para QUALQUER status, então
 *    uma reserva CANCELLED do próprio morador ainda ocupa a linha. Para remarcar,
 *    reaproveitamos essa linha em vez de criar outra (o que estouraria a unique).
 *
 * NÃO valida limites/janela/bloqueio — isso é responsabilidade do chamador.
 */
export async function upsertConfirmedBooking(
  tx: Prisma.TransactionClient,
  params: { courtId: string; aptId: string; start: Date; end: Date; capacity?: number }
) {
  const { courtId, aptId, start, end, capacity = 1 } = params;

  // Capacidade: quantas vagas confirmadas o slot já tem?
  const confirmed = await tx.booking.count({
    where: { courtId, startAt: start, status: "CONFIRMED" },
  });
  if (confirmed >= capacity) {
    throw new SlotTakenError(
      capacity > 1 ? "Horário lotado" : "Slot acabou de ser reservado"
    );
  }

  // Linha própria do slot (a unique é por morador). Reaproveita se cancelada.
  const mine = await tx.booking.findUnique({
    where: { courtId_startAt_aptId: { courtId, startAt: start, aptId } },
  });

  if (mine) {
    if (mine.status === "CONFIRMED") throw new AlreadyBookedError();
    await tx.joinInterest.deleteMany({ where: { bookingId: mine.id } });
    return tx.booking.update({
      where: { id: mine.id },
      data: {
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
