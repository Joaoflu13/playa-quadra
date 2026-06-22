import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * POST /api/bookings/interest  { bookingId }
 * Morador sinaliza interesse em jogar numa reserva aberta ("procuro parceiros").
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const { bookingId } = await req.json().catch(() => ({ bookingId: undefined }));
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId é obrigatório" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Reserva não encontrada" }, { status: 404 });
  }
  if (!booking.openForPlayers) {
    return NextResponse.json({ error: "Esta reserva não está aberta" }, { status: 422 });
  }
  if (booking.aptId === aptId) {
    return NextResponse.json({ error: "Você é o dono da reserva" }, { status: 422 });
  }

  try {
    await prisma.joinInterest.create({ data: { bookingId, aptId } });
  } catch (e) {
    // Já havia sinalizado interesse — idempotente.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ ok: true, already: true });
    }
    throw e;
  }

  // Notifica o dono da reserva (in-app).
  const me = await prisma.apartment.findUnique({
    where: { id: aptId },
    select: { label: true, unit: true },
  });
  const quando = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(booking.startAt);
  const quem = me ? (me.unit ? `${me.label} (${me.unit})` : me.label) : "Um morador";
  await prisma.notification.create({
    data: {
      aptId: booking.aptId,
      type: "INTEREST",
      bookingId,
      message: `${quem} tem interesse em jogar no seu horário de ${quando}.`,
    },
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/bookings/interest  { bookingId }
 * Morador retira o próprio interesse.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const { bookingId } = await req.json().catch(() => ({ bookingId: undefined }));
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId é obrigatório" }, { status: 400 });
  }

  await prisma.joinInterest.deleteMany({ where: { bookingId, aptId } });
  return NextResponse.json({ ok: true });
}
