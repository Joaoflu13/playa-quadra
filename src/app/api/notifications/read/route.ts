import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * POST /api/notifications/read
 * Marca todas as notificações não lidas do morador como lidas.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const { count } = await prisma.notification.updateMany({
    where: { aptId, read: false },
    data: { read: true },
  });
  return NextResponse.json({ ok: true, marked: count });
}
