import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendBookingReminder } from "@/lib/mail";

// Quantas horas antes do início enviamos o lembrete (janela de varredura).
const LEAD_HOURS = 12;

/**
 * GET /api/cron/reminders
 * Envia lembrete das reservas CONFIRMED que começam nas próximas LEAD_HOURS
 * e que ainda não foram lembradas. Idempotente via reminderSentAt.
 *
 * Proteção: em produção exige Authorization: Bearer ${CRON_SECRET}.
 * A Vercel Cron injeta esse header automaticamente quando CRON_SECRET existe.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const now = new Date();
  const until = new Date(now.getTime() + LEAD_HOURS * 3_600_000);

  const due = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startAt: { gt: now, lte: until },
    },
    include: { apartment: { select: { email: true, label: true } } },
  });

  let sent = 0;
  for (const b of due) {
    if (b.apartment.email) {
      await sendBookingReminder(b.apartment.email, b.apartment.label, b.startAt, b.endAt);
      sent++;
    }
    // Marca como lembrado mesmo sem e-mail, para não reprocessar toda hora.
    await prisma.booking.update({
      where: { id: b.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, sent, scanned: due.length });
}
