import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/notifications
 * Lista as notificações recentes do morador logado + contagem de não lidas.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.aptId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const aptId = session.user.aptId as string;

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { aptId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { aptId, read: false } }),
  ]);

  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
