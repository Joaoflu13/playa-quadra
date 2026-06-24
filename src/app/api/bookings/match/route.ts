import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/rules";
import { COURT_ID } from "@/lib/availability";

/**
 * "Jogo aberto" — procurar parceiro SEM reservar o horário.
 *
 *  POST   /api/bookings/match  { startAt, action: "open" }  -> abre a procura
 *  POST   /api/bookings/match  { startAt, action: "join" }  -> "Eu quero": fecha a
 *                                                              dupla e reserva o horário
 *  DELETE /api/bookings/match  { startAt }                  -> cancela a própria procura
 */

type Cfg = Awaited<ReturnType<typeof getConfig>>;

function hourSP(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(d)
  );
}

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

/** Valida que o horário é um slot operacional e dentro da janela de reserva. */
function validateSlot(start: Date, cfg: Cfg): string | null {
  if (Number.isNaN(start.getTime())) return "startAt inválido";
  if (start.getUTCMinutes() !== 0) return "Slots começam na hora cheia";
  const h = hourSP(start);
  if (h < cfg.openHour || h >= cfg.closeHour) return "Fora da janela operacional";
  const now = new Date();
  if (start <= now) return "Slot no passado";
  const maxDate = new Date(now.getTime() + cfg.advanceHours * 3_600_000);
  if (start > maxDate) return `Antecedência máxima de ${cfg.advanceHours} horas`;
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const body = await req.json().catch(() => ({}));
  const action = body?.action === "join" ? "join" : "open";
  const start = new Date(body?.startAt);
  const cfg = await getConfig();
  const err = validateSlot(start, cfg);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const end = new Date(start.getTime() + cfg.slotMinutes * 60_000);

  // Quadra bloqueada pelo síndico?
  const block = await prisma.courtBlock.findFirst({
    where: { courtId: COURT_ID, startAt: { lt: end }, endAt: { gt: start } },
    select: { reason: true },
  });
  if (block) {
    return NextResponse.json({ error: `Quadra indisponível: ${block.reason}` }, { status: 422 });
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
      where: { courtId: COURT_ID, startAt: start, status: "CONFIRMED" },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: "Horário já reservado" }, { status: 422 });

    // Não deixa abrir procura se já estourou o limite de reservas ativas.
    const active = await prisma.booking.count({
      where: { aptId, status: "CONFIRMED", startAt: { gt: new Date() } },
    });
    if (active >= cfg.maxActivePerApt) {
      return NextResponse.json(
        { error: `Limite de ${cfg.maxActivePerApt} reservas ativas` },
        { status: 422 }
      );
    }

    try {
      await prisma.openMatch.create({ data: { courtId: COURT_ID, startAt: start, aptId } });
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
    where: { courtId_startAt: { courtId: COURT_ID, startAt: start } },
  });
  if (!match) return NextResponse.json({ error: "Não há procura de parceiro neste horário" }, { status: 422 });
  if (match.aptId === aptId) {
    return NextResponse.json({ error: "Você abriu esta procura; aguarde alguém entrar" }, { status: 422 });
  }

  // A reserva conta no limite de quem ABRIU (match.aptId).
  const ownerActive = await prisma.booking.count({
    where: { aptId: match.aptId, status: "CONFIRMED", startAt: { gt: new Date() } },
  });
  if (ownerActive >= cfg.maxActivePerApt) {
    return NextResponse.json(
      { error: "Quem abriu a procura já atingiu o limite de reservas" },
      { status: 422 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Reaproveita linha cancelada do mesmo slot, se houver (a unique impede 2 linhas).
      const existing = await tx.booking.findUnique({
        where: { courtId_startAt: { courtId: COURT_ID, startAt: start } },
      });
      let booking;
      if (existing) {
        if (existing.status === "CONFIRMED") throw new RuleError("Slot acabou de ser reservado");
        await tx.joinInterest.deleteMany({ where: { bookingId: existing.id } });
        booking = await tx.booking.update({
          where: { id: existing.id },
          data: { aptId: match.aptId, endAt: end, status: "CONFIRMED", openForPlayers: false, reminderSentAt: null, createdAt: new Date() },
        });
      } else {
        booking = await tx.booking.create({
          data: { courtId: COURT_ID, aptId: match.aptId, startAt: start, endAt: end, status: "CONFIRMED" },
        });
      }
      // Registra o parceiro (quem clicou "Eu quero") como JoinInterest da reserva.
      await tx.joinInterest.create({ data: { bookingId: booking.id, aptId } });
      // Some a procura.
      await tx.openMatch.delete({ where: { id: match.id } });
      return booking;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Avisa quem abriu que a dupla fechou.
    await prisma.notification.create({
      data: {
        aptId: match.aptId,
        type: "MATCH_FILLED",
        bookingId: result.id,
        message: `${me.label}${me.unit ? ` (${me.unit})` : ""} topou jogar com você. Quadra reservada para ${fmtSP(start)}!`,
      },
    });
    return NextResponse.json({ ok: true, booked: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034")) {
      return NextResponse.json({ error: "Slot acabou de ser reservado" }, { status: 409 });
    }
    if (e instanceof RuleError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error(e);
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
  const start = new Date(body?.startAt);
  if (Number.isNaN(start.getTime())) return NextResponse.json({ error: "startAt inválido" }, { status: 400 });

  await prisma.openMatch.deleteMany({ where: { courtId: COURT_ID, startAt: start, aptId } });
  return NextResponse.json({ ok: true, open: false });
}

class RuleError extends Error {}
