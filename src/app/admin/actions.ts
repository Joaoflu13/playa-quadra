"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getConfig } from "@/lib/rules";
import { onlyDigits, isValidCpf } from "@/lib/cpf";
import { COURT_ID, TZ_OFFSET } from "@/lib/availability";

function int(form: FormData, key: string, fallback: number): number {
  const n = Number(form.get(key));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** Data YYYY-MM-DD em horário local de São Paulo. */
function spDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
/** Dia da semana (0=domingo) de uma data-calendário YYYY-MM-DD. */
function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}
/** Hora local (SP) de início de um instante. */
function spHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(d)
  );
}
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00${TZ_OFFSET}`);
  d.setDate(d.getDate() + n);
  return spDateStr(d);
}

/** Atualiza o singleton RuleConfig (id=1). */
export async function updateRules(form: FormData) {
  await requireAdmin();
  const data = {
    slotMinutes: int(form, "slotMinutes", 60),
    openHour: int(form, "openHour", 8),
    closeHour: int(form, "closeHour", 22),
    advanceDays: int(form, "advanceDays", 1),
    maxActivePerApt: int(form, "maxActivePerApt", 2),
    maxWeeklyPerApt: int(form, "maxWeeklyPerApt", 3),
    cancelMinNoticeMin: int(form, "cancelMinNoticeMin", 120),
    noShowBlockDays: int(form, "noShowBlockDays", 7),
  };
  await prisma.ruleConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  revalidatePath("/admin");
}

/** Cadastra um novo morador (login por CPF) com senha provisória. */
export async function createApartment(form: FormData) {
  await requireAdmin();
  const cpf = onlyDigits(String(form.get("cpf") ?? ""));
  const label = String(form.get("label") ?? "").trim(); // nome do morador
  const unit = String(form.get("unit") ?? "").trim();
  const emailRaw = String(form.get("email") ?? "").toLowerCase().trim();
  const email = emailRaw || null;
  const password = String(form.get("password") ?? "").trim();
  if (!isValidCpf(cpf) || !label || !password || password.length < 6) return;

  const exists = await prisma.apartment.findFirst({
    where: { OR: [{ cpf }, ...(email ? [{ email }] : [])] },
  });
  if (exists) return; // silencioso: a UI lista os existentes

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.apartment.create({
    // Criada pelo síndico já com senha => conta ativada (não pode ser ativada por terceiros).
    data: { cpf, label, unit, email, passwordHash, role: "RESIDENT", activatedAt: new Date() },
  });
  revalidatePath("/admin");
}

/**
 * Importa moradores em massa a partir de texto colado (uma linha por morador):
 *   cpf, nome, unidade, email(opcional)
 * Separador vírgula ou ponto-e-vírgula. Usa uma senha provisória única para todos.
 * Ignora linhas com CPF inválido ou já cadastrado.
 */
export async function importResidents(form: FormData) {
  await requireAdmin();
  const raw = String(form.get("csv") ?? "");
  const defaultPassword = String(form.get("defaultPassword") ?? "").trim();

  // Senha em branco = PRÉ-AUTORIZAR: cria contas sem senha utilizável; o morador
  // ativa depois em /ativar (auto-cadastro). Com senha = cria contas já ativadas.
  const preauthorize = defaultPassword.length === 0;
  if (!preauthorize && defaultPassword.length < 6) return;

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const parts = line.split(/[;,]/).map((p) => p.trim());
    const cpf = onlyDigits(parts[0] ?? "");
    const label = parts[1] ?? "";
    const unit = parts[2] ?? "";
    const email = (parts[3] ?? "").toLowerCase() || null;
    if (!isValidCpf(cpf) || !label) continue;

    const exists = await prisma.apartment.findFirst({
      where: { OR: [{ cpf }, ...(email ? [{ email }] : [])] },
    });
    if (exists) continue;

    // Pré-autorizadas recebem uma senha aleatória inutilizável (login bloqueado
    // até o morador ativar). As com senha do síndico nascem ativadas.
    const passwordHash = await bcrypt.hash(
      preauthorize ? randomBytes(24).toString("hex") : defaultPassword,
      10
    );
    await prisma.apartment.create({
      data: {
        cpf,
        label,
        unit,
        email,
        passwordHash,
        role: "RESIDENT",
        activatedAt: preauthorize ? null : new Date(),
      },
    });
  }
  revalidatePath("/admin");
}

/** Suspende ou reativa um morador. */
export async function setAptStatus(aptId: string, status: "ACTIVE" | "SUSPENDED") {
  await requireAdmin();
  await prisma.apartment.update({ where: { id: aptId }, data: { status } });
  revalidatePath("/admin");
}

/** Redefine a senha de um morador para uma provisória. */
export async function resetPassword(aptId: string, form: FormData) {
  await requireAdmin();
  const pwd = String(form.get("newPassword") ?? "").trim();
  if (pwd.length < 6) return;
  const passwordHash = await bcrypt.hash(pwd, 10);
  // Reset do síndico = senha provisória; força o morador a trocar no próximo acesso.
  await prisma.apartment.update({
    where: { id: aptId },
    data: { passwordHash, mustChangePassword: true },
  });
  revalidatePath("/admin");
}

/**
 * Marca uma reserva passada como falta (NO_SHOW): registra a penalidade e
 * bloqueia o morador por noShowBlockDays dias a partir de agora.
 */
export async function markNoShow(bookingId: string) {
  await requireAdmin();
  const cfg = await getConfig();
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status !== "CONFIRMED") return;

    await tx.booking.update({ where: { id: bookingId }, data: { status: "NO_SHOW" } });
    await tx.penalty.create({ data: { aptId: booking.aptId, reason: "NO_SHOW" } });

    const blockedUntil = new Date(Date.now() + cfg.noShowBlockDays * 86_400_000);
    await tx.apartment.update({
      where: { id: booking.aptId },
      data: { blockedUntil },
    });
  });
  revalidatePath("/admin");
}

/** Remove o bloqueio temporário de um morador (perdão do síndico). */
export async function unblock(aptId: string) {
  await requireAdmin();
  await prisma.apartment.update({ where: { id: aptId }, data: { blockedUntil: null } });
  revalidatePath("/admin");
}

/** Zera as penalidades (histórico) de um morador. */
export async function clearPenalties(aptId: string) {
  await requireAdmin();
  await prisma.penalty.deleteMany({ where: { aptId } });
  revalidatePath("/admin");
}

/* ===================== #8 Bloqueio da quadra ===================== */

/** Bloqueia a quadra num intervalo de horas de um dia (manutenção/torneio). */
export async function addBlock(form: FormData) {
  await requireAdmin();
  const date = String(form.get("date") ?? "").trim();
  const startHour = int(form, "startHour", -1);
  const endHour = int(form, "endHour", -1);
  const reason = String(form.get("reason") ?? "").trim() || "Indisponível";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  if (startHour < 0 || endHour <= startHour || endHour > 24) return;

  const startAt = new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00${TZ_OFFSET}`);
  const endAt = new Date(`${date}T${String(endHour).padStart(2, "0")}:00:00${TZ_OFFSET}`);
  await prisma.courtBlock.create({ data: { courtId: COURT_ID, startAt, endAt, reason } });
  revalidatePath("/admin");
}

/** Remove um bloqueio. */
export async function removeBlock(id: string) {
  await requireAdmin();
  await prisma.courtBlock.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin");
}

/* ===================== #10 Reserva recorrente ===================== */

/**
 * Cria uma reserva fixa (mesmo dia da semana + hora) e materializa as reservas
 * concretas das próximas 8 semanas, pulando slots já ocupados ou bloqueados.
 */
export async function addRecurring(form: FormData) {
  await requireAdmin();
  const cpf = onlyDigits(String(form.get("cpf") ?? ""));
  const weekday = int(form, "weekday", -1);
  const hour = int(form, "hour", -1);
  if (!isValidCpf(cpf) || weekday < 0 || weekday > 6 || hour < 0 || hour > 23) return;

  const apt = await prisma.apartment.findUnique({ where: { cpf } });
  if (!apt) return;
  const cfg = await getConfig();
  if (hour < cfg.openHour || hour >= cfg.closeHour) return;

  // Regra (única por courtId+weekday+hour). Se já existe, não duplica.
  try {
    await prisma.recurringBooking.create({
      data: { courtId: COURT_ID, aptId: apt.id, weekday, hour },
    });
  } catch {
    revalidatePath("/admin");
    return;
  }

  // Materializa próximas 8 semanas.
  const now = new Date();
  const today = spDateStr(now);
  const hh = String(hour).padStart(2, "0");
  for (let i = 0; i < 56; i++) {
    const ds = addDaysStr(today, i);
    if (weekdayOf(ds) !== weekday) continue;
    const start = new Date(`${ds}T${hh}:00:00${TZ_OFFSET}`);
    const end = new Date(start.getTime() + cfg.slotMinutes * 60_000);
    if (start <= now) continue;

    // Não materializa sobre bloqueio da quadra.
    const blocked = await prisma.courtBlock.findFirst({
      where: { courtId: COURT_ID, startAt: { lt: end }, endAt: { gt: start } },
      select: { id: true },
    });
    if (blocked) continue;

    // Cria; se o slot já está reservado, o unique([courtId,startAt]) pula.
    await prisma.booking
      .create({
        data: { courtId: COURT_ID, aptId: apt.id, startAt: start, endAt: end, status: "CONFIRMED" },
      })
      .catch(() => {});
  }
  revalidatePath("/admin");
}

/** Remove a regra recorrente e cancela as reservas futuras dela. */
export async function removeRecurring(id: string) {
  await requireAdmin();
  const rec = await prisma.recurringBooking.findUnique({ where: { id } });
  if (!rec) return;
  await prisma.recurringBooking.delete({ where: { id } });

  const now = new Date();
  const future = await prisma.booking.findMany({
    where: { aptId: rec.aptId, courtId: rec.courtId, status: "CONFIRMED", startAt: { gt: now } },
    select: { id: true, startAt: true },
  });
  const ids = future
    .filter((b) => weekdayOf(spDateStr(b.startAt)) === rec.weekday && spHour(b.startAt) === rec.hour)
    .map((b) => b.id);
  if (ids.length) {
    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED" } });
  }
  revalidatePath("/admin");
}
