import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/rules";
import { COURT_ID, TZ_OFFSET } from "@/lib/availability";
import { sendBookingConfirmation } from "@/lib/mail";

/**
 * GET /api/bookings
 * Reservas futuras (CONFIRMED) do próprio apartamento — usado pela UI para
 * marcar os slots "meus" e habilitar o cancelamento.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const bookings = await prisma.booking.findMany({
    where: { aptId, status: "CONFIRMED", startAt: { gt: new Date() } },
    select: { id: true, startAt: true, endAt: true },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
    })),
  });
}

/**
 * POST /api/bookings  { startAt: "2026-06-22T19:00:00-03:00" }
 * Cria uma reserva. Garantias de integridade:
 *  1) @@unique([courtId, startAt]) no Postgres -> impossível duas unidades
 *     no mesmo slot. O 2º insert estoura P2002 e devolvemos 409.
 *  2) Transação que revalida limites do apartamento antes do insert.
 *
 * Concorrência: a transação roda em isolamento Serializable, então a corrida
 * entre o count de limites e o create é detectada pelo Postgres, que aborta
 * uma das transações concorrentes (Prisma P2034). Tratamos como 409.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  let body: { startAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.startAt) {
    return NextResponse.json({ error: "startAt é obrigatório" }, { status: 400 });
  }

  const cfg = await getConfig();
  const start = new Date(body.startAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "startAt inválido" }, { status: 400 });
  }

  // --- Validações de janela/alinhamento (em horário local de SP) ---
  const local = new Date(start.getTime()); // start já carrega offset -03:00
  const minutes = local.getUTCMinutes();
  const hourLocal = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo",
    }).format(start)
  );

  if (minutes !== 0) {
    return NextResponse.json({ error: "Slots começam na hora cheia" }, { status: 422 });
  }
  if (hourLocal < cfg.openHour || hourLocal >= cfg.closeHour) {
    return NextResponse.json({ error: "Fora da janela operacional" }, { status: 422 });
  }

  const now = new Date();
  if (start <= now) {
    return NextResponse.json({ error: "Slot no passado" }, { status: 422 });
  }
  const maxDate = new Date(now.getTime() + cfg.advanceDays * 86_400_000);
  if (start > maxDate) {
    return NextResponse.json(
      { error: `Antecedência máxima de ${cfg.advanceDays} dias` },
      { status: 422 }
    );
  }

  const end = new Date(start.getTime() + cfg.slotMinutes * 60_000);

  // Quadra bloqueada pelo síndico (manutenção/torneio) neste intervalo?
  const block = await prisma.courtBlock.findFirst({
    where: { courtId: COURT_ID, startAt: { lt: end }, endAt: { gt: start } },
    select: { reason: true },
  });
  if (block) {
    return NextResponse.json(
      { error: `Quadra indisponível: ${block.reason}` },
      { status: 422 }
    );
  }

  try {
    let aptEmail: string | null = null;
    let aptLabel = "";
    const booking = await prisma.$transaction(async (tx) => {
      const apt = await tx.apartment.findUnique({ where: { id: aptId } });
      if (!apt) throw new RuleError("APT_NOT_FOUND", "Morador inexistente");
      if (apt.status === "SUSPENDED") {
        throw new RuleError("SUSPENDED", "Cadastro suspenso");
      }
      if (apt.blockedUntil && apt.blockedUntil > now) {
        const ate = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(apt.blockedUntil);
        throw new RuleError("BLOCKED", `Bloqueado por falta até ${ate}`);
      }
      aptEmail = apt.email;
      aptLabel = apt.label;

      const active = await tx.booking.count({
        where: { aptId, status: "CONFIRMED", startAt: { gt: now } },
      });
      if (active >= cfg.maxActivePerApt) {
        throw new RuleError("MAX_ACTIVE", `Limite de ${cfg.maxActivePerApt} reservas ativas`);
      }

      const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
      const weekly = await tx.booking.count({
        where: { aptId, status: "CONFIRMED", startAt: { gte: now, lt: weekAhead } },
      });
      if (weekly >= cfg.maxWeeklyPerApt) {
        throw new RuleError("MAX_WEEKLY", `Limite de ${cfg.maxWeeklyPerApt} reservas em 7 dias`);
      }

      // A trava @@unique([courtId, startAt]) vale para QUALQUER status, então uma
      // reserva CANCELLED ainda ocupa o slot no banco. Para permitir remarcar um
      // horário cancelado, reaproveitamos a linha existente em vez de criar outra.
      const existing = await tx.booking.findUnique({
        where: { courtId_startAt: { courtId: COURT_ID, startAt: start } },
      });
      if (existing) {
        if (existing.status === "CONFIRMED") {
          throw new RuleError("SLOT_TAKEN", "Slot acabou de ser reservado");
        }
        // Limpa "procuro parceiros" antigo que ficou preso na linha cancelada.
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
        data: { courtId: COURT_ID, aptId, startAt: start, endAt: end, status: "CONFIRMED" },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Confirmação por e-mail (só se o morador tiver e-mail cadastrado). Não
    // bloqueia a resposta; falha de e-mail não derruba a reserva já gravada.
    if (aptEmail) {
      void sendBookingConfirmation(aptEmail, aptLabel, start, end).catch(() => {});
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (e) {
    // Slot tomado por outra unidade entre a checagem e o insert
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Slot acabou de ser reservado" }, { status: 409 });
    }
    // P2034: conflito de serialização (duas reservas concorrentes). Peça retry.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return NextResponse.json(
        { error: "Conflito ao reservar, tente novamente" },
        { status: 409 }
      );
    }
    if (e instanceof RuleError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 422 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/bookings  { id, openForPlayers: boolean }
 * Liga/desliga o "procuro parceiros" de uma reserva própria.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const body = await req.json().catch(() => ({}));
  const id = body?.id as string | undefined;
  const openForPlayers = Boolean(body?.openForPlayers);
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Reserva não encontrada" }, { status: 404 });
  }
  if (booking.aptId !== aptId) {
    return NextResponse.json({ error: "Reserva de outro apartamento" }, { status: 403 });
  }

  await prisma.booking.update({ where: { id }, data: { openForPlayers } });
  return NextResponse.json({ ok: true, openForPlayers });
}

/**
 * DELETE /api/bookings  { id: "..." }
 * Cancela uma reserva própria, respeitando a antecedência mínima.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const { id } = await req.json().catch(() => ({ id: undefined }));
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const cfg = await getConfig();
  const booking = await prisma.booking.findUnique({ where: { id } });

  if (!booking || booking.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Reserva não encontrada" }, { status: 404 });
  }
  if (booking.aptId !== aptId) {
    return NextResponse.json({ error: "Reserva de outro apartamento" }, { status: 403 });
  }

  const minNotice = new Date(Date.now() + cfg.cancelMinNoticeMin * 60_000);
  if (booking.startAt <= minNotice) {
    return NextResponse.json(
      { error: `Cancelamento exige ${cfg.cancelMinNoticeMin} min de antecedência` },
      { status: 422 }
    );
  }

  await prisma.booking.update({ where: { id }, data: { status: "CANCELLED" } });

  // Lista de espera: avisa todos que aguardavam este horário e limpa a fila
  // (a vaga vira uma corrida — o primeiro a reservar leva).
  const waiters = await prisma.waitlist.findMany({
    where: { courtId: booking.courtId, startAt: booking.startAt },
    select: { aptId: true },
  });
  if (waiters.length > 0) {
    const quando = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(booking.startAt);
    await prisma.notification.createMany({
      data: waiters.map((w) => ({
        aptId: w.aptId,
        type: "WAITLIST_OPEN",
        message: `A vaga da quadra de ${quando} liberou! Entre no app e reserve antes que acabe.`,
      })),
    });
    await prisma.waitlist.deleteMany({
      where: { courtId: booking.courtId, startAt: booking.startAt },
    });
  }

  return NextResponse.json({ ok: true });
}

class RuleError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

// Mantém TZ_OFFSET importado em uso para futuras validações de borda.
void TZ_OFFSET;
