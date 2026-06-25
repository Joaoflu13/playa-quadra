import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/rules";
import { COURT_ID, cleanUnit, isValidCourt, courtLabel } from "@/lib/availability";
import { reportError } from "@/lib/observability";
import { validateSlot, findBlockReason, upsertConfirmedBooking, SlotTakenError, AlreadyBookedError } from "@/lib/booking";

/**
 * "Jogo aberto" — procurar parceiro SEM reservar o horário.
 *
 *  POST   /api/bookings/match  { startAt, courtId?, action: "open" }  -> abre a procura
 *  POST   /api/bookings/match  { startAt, courtId?, action: "join" }  -> "Eu quero": fecha a
 *                                                                        dupla e reserva o horário
 *  DELETE /api/bookings/match  { startAt, courtId? }                  -> cancela a própria procura
 */

function fmtSP(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const body = await req.json().catch(() => ({}));
  const action = body?.action === "join" ? "join" : "open";
  const courtId = isValidCourt(body?.courtId) ? (body.courtId as string) : COURT_ID;
  const start = new Date(body?.startAt);
  const cfg = await getConfig();
  const err = validateSlot(start, cfg);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const end = new Date(start.getTime() + cfg.slotMinutes * 60_000);

  // Área bloqueada pelo síndico?
  const blockReason = await findBlockReason(courtId, start, end);
  if (blockReason) {
    return NextResponse.json({ error: `Área indisponível: ${blockReason}` }, { status: 422 });
  }

  const me = await prisma.apartment.findUnique({ where: { id: aptId } });
  if (!me) return NextResponse.json({ error: "Morador inexistente" }, { status: 422 });
  if (me.status === "SUSPENDED") return NextResponse.json({ error: "Cadastro suspenso" }, { status: 422 });
  if (me.blockedUntil && me.blockedUntil > new Date()) {
    return NextResponse.json({ error: "Você está bloqueado por falta" }, { status: 422 });
  }

  // ---------- ABRIR A PROCURA ----------
  if (action === "open") {
    const taken = await prisma.booking.findFirst({
      where: { courtId, startAt: start, status: "CONFIRMED" },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: "Horário já reservado" }, { status: 422 });

    // Não deixa abrir procura se já estourou o limite de reservas ativas.
    const active = await prisma.booking.count({
      where: { aptId, courtId, status: "CONFIRMED", startAt: { gt: new Date() } },
    });
    if (active >= cfg.maxActivePerApt) {
      return NextResponse.json(
        { error: `Limite de ${cfg.maxActivePerApt} reservas ativas` },
        { status: 422 }
      );
    }

    try {
      await prisma.openMatch.create({ data: { courtId, startAt: start, aptId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "Já há alguém procurando parceiro neste horário" }, { status: 409 });
      }
      throw e;
    }
    return NextResponse.json({ ok: true, open: true });
  }

  // ---------- "EU QUERO": fechar a dupla e reservar ----------
  const match = await prisma.openMatch.findUnique({
    where: { courtId_startAt: { courtId, startAt: start } },
  });
  if (!match) return NextResponse.json({ error: "Não há procura de parceiro neste horário" }, { status: 422 });
  if (match.aptId === aptId) {
    return NextResponse.json({ error: "Você abriu esta procura; aguarde alguém entrar" }, { status: 422 });
  }

  // A reserva conta no limite de quem ABRIU (match.aptId).
  const ownerActive = await prisma.booking.count({
    where: { aptId: match.aptId, courtId, status: "CONFIRMED", startAt: { gt: new Date() } },
  });
  if (ownerActive >= cfg.maxActivePerApt) {
    return NextResponse.json(
      { error: "Quem abriu a procura já atingiu o limite de reservas" },
      { status: 422 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // A reserva fica no nome de quem ABRIU a procura (match.aptId).
      const booking = await upsertConfirmedBooking(tx, {
        courtId,
        aptId: match.aptId,
        start,
        end,
      });
      // Registra o parceiro (quem clicou "Eu quero") como JoinInterest da reserva.
      await tx.joinInterest.create({ data: { bookingId: booking.id, aptId } });
      // Some a procura.
      await tx.openMatch.delete({ where: { id: match.id } });
      return booking;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Avisa quem abriu que a dupla fechou.
    const areaName = courtLabel(courtId);
    await prisma.notification.create({
      data: {
        aptId: match.aptId,
        type: "MATCH_FILLED",
        bookingId: result.id,
        message: `${me.label}${cleanUnit(me.unit) ? ` (${cleanUnit(me.unit)})` : ""} topou jogar com você — ${areaName} em ${fmtSP(start)}!`,
      },
    });
    return NextResponse.json({ ok: true, booked: true });
  } catch (e) {
    if (e instanceof SlotTakenError || e instanceof AlreadyBookedError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034")) {
      return NextResponse.json({ error: "Slot acabou de ser reservado" }, { status: 409 });
    }
    await reportError("POST /api/bookings/match (join)", e, { aptId, courtId });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;
  const body = await req.json().catch(() => ({}));
  const courtId = isValidCourt(body?.courtId) ? (body.courtId as string) : COURT_ID;
  const start = new Date(body?.startAt);
  if (Number.isNaN(start.getTime())) return NextResponse.json({ error: "startAt inválido" }, { status: 400 });

  await prisma.openMatch.deleteMany({ where: { courtId, startAt: start, aptId } });
  return NextResponse.json({ ok: true, open: false });
}
