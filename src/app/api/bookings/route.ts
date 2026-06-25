import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/rules";
import { COURT_ID, TZ_OFFSET, isValidCourt, courtLabel } from "@/lib/availability";
import { sendBookingConfirmation } from "@/lib/mail";
import { reportError } from "@/lib/observability";
import { validateSlot, findBlockReason, upsertConfirmedBooking, SlotTakenError } from "@/lib/booking";

/**
 * GET /api/bookings
 * Reservas futuras (CONFIRMED) do próprio apartamento — usado pela UI para
 * marcar os slots "meus" e habilitar o cancelamento.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;
  const courtParam = req.nextUrl.searchParams.get("court");
  const courtId = isValidCourt(courtParam) ? (courtParam as string) : COURT_ID;

  const bookings = await prisma.booking.findMany({
    where: { aptId, courtId, status: "CONFIRMED", startAt: { gt: new Date() } },
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

  let body: { startAt?: string; courtId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.startAt) {
    return NextResponse.json({ error: "startAt é obrigatório" }, { status: 400 });
  }
  const courtId = isValidCourt(body.courtId) ? (body.courtId as string) : COURT_ID;

  const cfg = await getConfig();
  const start = new Date(body.startAt);
  const now = new Date();

  // Validação de slot (alinhamento, janela operacional, antecedência).
  const slotErr = validateSlot(start, cfg, now);
  if (slotErr) {
    const status = slotErr === "startAt inválido" ? 400 : 422;
    return NextResponse.json({ error: slotErr }, { status });
  }

  const end = new Date(start.getTime() + cfg.slotMinutes * 60_000);

  // Área bloqueada pelo síndico (manutenção/torneio) neste intervalo?
  const blockReason = await findBlockReason(courtId, start, end);
  if (blockReason) {
    return NextResponse.json({ error: `Área indisponível: ${blockReason}` }, { status: 422 });
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
        where: { aptId, courtId, status: "CONFIRMED", startAt: { gt: now } },
      });
      if (active >= cfg.maxActivePerApt) {
        throw new RuleError("MAX_ACTIVE", `Limite de ${cfg.maxActivePerApt} reservas ativas`);
      }

      const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
      const weekly = await tx.booking.count({
        where: { aptId, courtId, status: "CONFIRMED", startAt: { gte: now, lt: weekAhead } },
      });
      if (weekly >= cfg.maxWeeklyPerApt) {
        throw new RuleError("MAX_WEEKLY", `Limite de ${cfg.maxWeeklyPerApt} reservas em 7 dias`);
      }

      // Cria a reserva (reaproveitando a linha cancelada do slot, se houver).
      return upsertConfirmedBooking(tx, { courtId, aptId, start, end });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Confirmação por e-mail (só se o morador tiver e-mail cadastrado). Não
    // bloqueia a resposta; falha de e-mail não derruba a reserva já gravada.
    if (aptEmail) {
      void sendBookingConfirmation(aptEmail, aptLabel, start, end).catch(() => {});
    }

    // Reservou sozinho um horário que tinha "jogo aberto"? A procura cai e quem
    // a abriu é avisado (o horário ficou livre pra todos — quem reservar leva).
    const openMatch = await prisma.openMatch
      .findUnique({ where: { courtId_startAt: { courtId, startAt: start } } })
      .catch(() => null);
    if (openMatch) {
      await prisma.openMatch.delete({ where: { id: openMatch.id } }).catch(() => {});
      if (openMatch.aptId !== aptId) {
        const quando = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        }).format(start);
        await prisma.notification.create({
          data: {
            aptId: openMatch.aptId,
            type: "MATCH_TAKEN",
            message: `O horário de ${quando} que você procurava parceiro foi reservado por outro morador.`,
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (e) {
    // Slot já confirmado (detectado dentro da transação pelo upsert).
    if (e instanceof SlotTakenError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
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
    await reportError("POST /api/bookings", e, { aptId, courtId });
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
        message: `Vaga liberada — ${courtLabel(booking.courtId)} às ${quando}. Entre no app e reserve antes que acabe.`,
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
