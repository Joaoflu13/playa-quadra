import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCpf } from "@/lib/cpf";
import { cleanUnit, courtLabel } from "@/lib/availability";

/**
 * GET /api/admin/export?type=residents|bookings
 *
 * Exportação de dados em CSV (LGPD — Cláusula 6.4 do contrato: o condomínio
 * pode levar seus dados a qualquer momento, em formato legível). Só ADMIN.
 */

/** Escapa um campo para CSV (RFC 4180): aspas em volta + duplica aspas internas. */
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(","));
  // BOM para o Excel reconhecer UTF-8 (acentos) corretamente.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

function fmtSP(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

const STATUS_PT: Record<string, string> = {
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  NO_SHOW: "Falta",
  DONE: "Concluída",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type");
  const today = new Date().toISOString().slice(0, 10);

  let filename: string;
  let csv: string;

  if (type === "bookings") {
    const bookings = await prisma.booking.findMany({
      orderBy: { startAt: "desc" },
      include: { apartment: { select: { label: true, unit: true, cpf: true } } },
    });
    csv = toCsv(
      ["Área", "Início", "Fim", "Status", "Morador", "Unidade", "CPF", "Criada em"],
      bookings.map((b) => [
        courtLabel(b.courtId),
        fmtSP(b.startAt),
        fmtSP(b.endAt),
        STATUS_PT[b.status] ?? b.status,
        b.apartment.label,
        cleanUnit(b.apartment.unit),
        formatCpf(b.apartment.cpf),
        fmtSP(b.createdAt),
      ])
    );
    filename = `reservas-${today}.csv`;
  } else if (type === "residents") {
    const residents = await prisma.apartment.findMany({
      orderBy: { label: "asc" },
      include: { _count: { select: { penalties: true } } },
    });
    csv = toCsv(
      ["Nome", "CPF", "Unidade", "E-mail", "Perfil", "Status", "Ativada em", "Faltas"],
      residents.map((a) => [
        a.label,
        formatCpf(a.cpf),
        cleanUnit(a.unit),
        a.email ?? "",
        a.role === "ADMIN" ? "Síndico" : "Morador",
        a.status === "SUSPENDED" ? "Suspenso" : "Ativo",
        a.activatedAt ? fmtSP(a.activatedAt) : "Pendente",
        a._count.penalties,
      ])
    );
    filename = `moradores-${today}.csv`;
  } else {
    return NextResponse.json(
      { error: "type deve ser 'residents' ou 'bookings'" },
      { status: 400 }
    );
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
