"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Define a nova senha a partir de um token válido e não expirado.
 * Consome o token (apaga) após o uso.
 */
export async function doReset(form: FormData) {
  const token = String(form.get("token") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (!token) redirect("/esqueci");
  if (next.length < 6) redirect(`/redefinir?token=${token}&status=short`);
  if (next !== confirm) redirect(`/redefinir?token=${token}&status=mismatch`);

  const row = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!row || row.expiresAt < new Date()) {
    redirect("/redefinir?status=invalid");
  }

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.$transaction([
    prisma.apartment.update({ where: { id: row.aptId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { aptId: row.aptId } }),
  ]);

  redirect("/login?reset=1");
}
