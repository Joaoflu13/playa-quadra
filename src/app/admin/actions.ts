"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getConfig } from "@/lib/rules";
import { onlyDigits, isValidCpf } from "@/lib/cpf";

function int(form: FormData, key: string, fallback: number): number {
  const n = Number(form.get(key));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
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
    data: { cpf, label, unit, email, passwordHash, role: "RESIDENT" },
  });
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
  await prisma.apartment.update({ where: { id: aptId }, data: { passwordHash } });
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
