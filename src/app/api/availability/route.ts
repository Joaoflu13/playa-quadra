import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/rules";
import { slotStartsForDate, COURT_ID, TZ_OFFSET, cleanUnit, isValidCourt, courtSettings } from "@/lib/availability";
import { reportError } from "@/lib/observability";

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

  const courtParam = req.nextUrl.searchParams.get("court");
  const courtId = isValidCourt(courtParam) ? (courtParam as string) : COURT_ID;

  const cfg = await getConfig();
  const settings = courtSettings(courtId, cfg);
  const slots = slotStartsForDate(date, settings.openHour, settings.closeHour);

  const dayStart = new Date(`${date}T00:00:00${TZ_OFFSET}`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const booked = await prisma.booking.findMany({
    where: {
      courtId,
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
  // Agrupa por horário: áreas com capacidade > 1 (Pilates) têm várias reservas
  // no mesmo slot. Áreas de capacidade 1 (tênis/sinuca) têm no máximo uma.
  type Booked = (typeof booked)[number];
  const groupByStart = new Map<number, Booked[]>();
  for (const b of booked) {
    const k = b.startAt.getTime();
    const arr = groupByStart.get(k) ?? [];
    arr.push(b);
    groupByStart.set(k, arr);
  }

  // Lista de espera do dia, agregada por horário (contagem + se o viewer está nela).
  const waits = await prisma.waitlist.findMany({
    where: { courtId, startAt: { gte: dayStart, lt: dayEnd } },
    select: { startAt: true, aptId: true },
  });
  const waitByStart = new Map<number, { count: number; mine: boolean }>();
  for (const w of waits) {
    const k = w.startAt.getTime();
    const cur = waitByStart.get(k) ?? { count: 0, mine: false };
    cur.count += 1;
    if (w.aptId === viewerAptId) cur.mine = true;
    waitByStart.set(k, cur);
  }

  // Jogos abertos do dia (procurando parceiro, sem reserva firme).
  let openMatches: { startAt: Date; aptId: string; apartment: { label: string; unit: string } }[] = [];
  try {
    openMatches = await prisma.openMatch.findMany({
      where: { courtId, startAt: { gte: dayStart, lt: dayEnd } },
      select: { startAt: true, aptId: true, apartment: { select: { label: true, unit: true } } },
    });
  } catch (e) {
    // Tabela ainda não migrada? Não derruba a grade.
    void reportError("availability: OpenMatch indisponível", e, { courtId, date });
  }
  const matchByStart = new Map(openMatches.map((m) => [m.startAt.getTime(), m]));

  // Bloqueios da quadra que tocam o dia (manutenção, torneio, etc.).
  const blocks = await prisma.courtBlock.findMany({
    where: { courtId, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
    select: { startAt: true, endAt: true, reason: true },
  });
  const blockFor = (s: Date, e: Date) =>
    blocks.find((bl) => bl.startAt < e && bl.endAt > s) ?? null;

  const now = new Date();
  const maxDate = new Date(now.getTime() + cfg.advanceHours * 3_600_000);

  const withUnit = (label: string, unit: string) => {
    const u = cleanUnit(unit);
    return u ? `${label} (${u})` : label;
  };

  const capacity = settings.capacity;

  const grid = slots.map((start) => {
    const end = new Date(start.getTime() + cfg.slotMinutes * 60_000);
    const group = groupByStart.get(start.getTime()) ?? [];

    // ---------- ÁREAS COM CAPACIDADE > 1 (ex.: Sala de Pilates) ----------
    if (capacity > 1) {
      const confirmedCount = group.length;
      const full = confirmedCount >= capacity;
      const mineBooking = group.find((b) => b.aptId === viewerAptId);
      const mine = !!mineBooking;
      const block = group.length === 0 ? blockFor(start, end) : null;
      const bookable = !mine && !full && !block && start > now && start <= maxDate;

      return {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        taken: full,
        bookable,
        blocked: !!block,
        blockReason: block?.reason ?? null,
        capacity,
        confirmedCount,
        spotsLeft: Math.max(0, capacity - confirmedCount),
        mine,
        bookingId: mineBooking?.id,
        // Quem já ocupa o horário (visível aos moradores logados, como nas demais áreas).
        occupants: group.map((b) => withUnit(b.apartment.label, b.apartment.unit)),
        waitlistCount: waitByStart.get(start.getTime())?.count ?? 0,
        iAmWaiting: waitByStart.get(start.getTime())?.mine ?? false,
      };
    }

    // ---------- ÁREAS COM CAPACIDADE 1 (tênis, sinuca) ----------
    const b = group[0];
    const taken = !!b;
    const block = !b ? blockFor(start, end) : null;
    const bookable = !taken && !block && start > now && start <= maxDate;

    // Slot livre: pode ter um "jogo aberto" (alguém procurando parceiro).
    if (!b) {
      const om = matchByStart.get(start.getTime());
      return {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        taken,
        bookable,
        blocked: !!block,
        blockReason: block?.reason ?? null,
        openMatch: !!om,
        openMatchBy: om ? withUnit(om.apartment.label, om.apartment.unit) : null,
        openMatchMine: !!om && om.aptId === viewerAptId,
        waitlistCount: waitByStart.get(start.getTime())?.count ?? 0,
        iAmWaiting: waitByStart.get(start.getTime())?.mine ?? false,
      };
    }

    const mine = viewerAptId === b.aptId;
    // No novo "jogo aberto", o parceiro fica registrado como JoinInterest da reserva.
    const partner = b.interests[0];
    const hasPartner = !!partner;
    const iAmPartner = !!viewerAptId && b.interests.some((i) => i.aptId === viewerAptId);

    // Nome + unidade de quem reservou ficam visíveis a todos os moradores logados
    // (ex.: "João (Bloco A - 304)"), para o horário travado mostrar quem marcou.
    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      taken,
      bookable,
      bookingId: b.id,
      ownerName: b.apartment.label,
      ownerUnit: cleanUnit(b.apartment.unit),
      ownerLabel: withUnit(b.apartment.label, b.apartment.unit),
      partnerName: hasPartner ? partner.apartment.label : null,
      partnerUnit: hasPartner ? cleanUnit(partner.apartment.unit) : null,
      partnerLabel: hasPartner ? withUnit(partner.apartment.label, partner.apartment.unit) : null,
      mine,
      iAmPartner,
      waitlistCount: waitByStart.get(start.getTime())?.count ?? 0,
      iAmWaiting: waitByStart.get(start.getTime())?.mine ?? false,
    };
  });

  return NextResponse.json({ date, slotMinutes: cfg.slotMinutes, slots: grid });
}
