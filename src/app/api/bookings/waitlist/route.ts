import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { COURT_ID, isValidCourt } from "@/lib/availability";

/**
 * POST /api/bookings/waitlist   { startAt }
 * Entra na lista de espera de um horário ocupado por OUTRO morador. Quando o
 * dono cancelar, todos da fila são avisados e o primeiro a reservar leva.
 *
 * DELETE /api/bookings/waitlist { startAt }
 * Sai da lista de espera daquele horário.
 */
async function parse(req: NextRequest): Promise<{ startAt: Date; courtId: string } | null> {
  const body = await req.json().catch(() => ({}));
  if (!body?.startAt) return null;
  const d = new Date(body.startAt);
  if (Number.isNaN(d.getTime())) return null;
  return { startAt: d, courtId: isValidCourt(body.courtId) ? body.courtId : COURT_ID };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const parsed = await parse(req);
  if (!parsed) return NextResponse.json({ error: "startAt inválido" }, { status: 400 });
  const { startAt, courtId } = parsed;

  // O slot precisa estar ocupado por outro morador para fazer sentido esperar.
  const booking = await prisma.booking.findFirst({
    where: { courtId, startAt, status: "CONFIRMED" },
    select: { aptId: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Este horário não está ocupado" }, { status: 422 });
  }
  if (booking.aptId === aptId) {
    return NextResponse.json({ error: "Este horário já é seu" }, { status: 422 });
  }

  try {
    await prisma.waitlist.create({ data: { courtId, startAt, aptId } });
  } catch (e) {
    // Já estava na fila (unique) — idempotente.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
      throw e;
    }
  }
  return NextResponse.json({ ok: true, waiting: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const parsed = await parse(req);
  if (!parsed) return NextResponse.json({ error: "startAt inválido" }, { status: 400 });
  const { startAt, courtId } = parsed;

  await prisma.waitlist.deleteMany({ where: { courtId, startAt, aptId } });
  return NextResponse.json({ ok: true, waiting: false });
}
