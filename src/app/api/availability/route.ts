import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/rules";
import { slotStartsForDate, COURT_ID, TZ_OFFSET } from "@/lib/availability";

/**
 * GET /api/availability?date=YYYY-MM-DD
 * Grade de slots do dia. Para slots ocupados, informa quem marcou e o estado
 * de "procuro parceiros". O viewer logado recebe também: se a reserva é dele,
 * o id da reserva e se já sinalizou interesse.
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parâmetro date=YYYY-MM-DD obrigatório" }, { status: 400 });
  }

  // Exige sessão: a grade revela nome/unidade dos moradores (PII/LGPD).
  // Alinha com GET /api/bookings, que também exige autenticação.
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const viewerAptId = session.user.aptId as string;
  const viewerIsAdmin = session.user.role === "ADMIN";

  const cfg = await getConfig();
  const slots = slotStartsForDate(date, cfg.openHour, cfg.closeHour);

  const dayStart = new Date(`${date}T00:00:00${TZ_OFFSET}`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const booked = await prisma.booking.findMany({
    where: {
      courtId: COURT_ID,
      status: "CONFIRMED",
      startAt: { gte: dayStart, lt: dayEnd },
    },
    select: {
      id: true,
      startAt: true,
      aptId: true,
      openForPlayers: true,
      apartment: { select: { label: true, unit: true } },
      interests: {
        select: { aptId: true, apartment: { select: { label: true, unit: true } } },
      },
    },
  });
  const byStart = new Map(booked.map((b) => [b.startAt.getTime(), b]));

  const now = new Date();
  const maxDate = new Date(now.getTime() + cfg.advanceDays * 86_400_000);

  const grid = slots.map((start) => {
    const end = new Date(start.getTime() + cfg.slotMinutes * 60_000);
    const b = byStart.get(start.getTime());
    const taken = !!b;
    const bookable = !taken && start > now && start <= maxDate;

    if (!b) {
      return { startAt: start.toISOString(), endAt: end.toISOString(), taken, bookable };
    }

    const withUnit = (label: string, unit: string) =>
      unit ? `${label} (${unit})` : label;
    const mine = viewerAptId === b.aptId;

    // LGPD: o nome de quem reservou só é revelado quando há base para isso —
    // é a sua reserva, você é o síndico, ou o dono abriu "procuro parceiros"
    // (consentiu aparecer). Caso contrário, o slot é apenas "Ocupado".
    const canSeeOwner = mine || viewerIsAdmin || b.openForPlayers;

    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      taken,
      bookable,
      bookingId: b.id,
      ownerLabel: canSeeOwner ? withUnit(b.apartment.label, b.apartment.unit) : null,
      mine,
      openForPlayers: b.openForPlayers,
      interestCount: b.interests.length,
      // Lista de interessados só para o dono e o síndico (quem precisa decidir).
      interested:
        mine || viewerIsAdmin
          ? b.interests.map((i) => withUnit(i.apartment.label, i.apartment.unit))
          : [],
      iAmInterested: !!viewerAptId && b.interests.some((i) => i.aptId === viewerAptId),
    };
  });

  return NextResponse.json({ date, slotMinutes: cfg.slotMinutes, slots: grid });
}
