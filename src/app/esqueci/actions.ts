"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { onlyDigits } from "@/lib/cpf";
import { sendPasswordReset } from "@/lib/mail";

/**
 * Pedido de redefinição de senha. Por segurança, sempre responde de forma
 * genérica (não revela se o CPF existe ou se há e-mail cadastrado).
 */
export async function requestReset(form: FormData) {
  const cpf = onlyDigits(String(form.get("cpf") ?? ""));
  if (cpf) {
    const apt = await prisma.apartment.findUnique({ where: { cpf } });
    if (apt?.email) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await prisma.passwordResetToken.create({ data: { token, aptId: apt.id, expiresAt } });

      const base = process.env.APP_URL ?? "http://localhost:3000";
      await sendPasswordReset(apt.email, apt.label, `${base}/redefinir?token=${token}`);
    }
  }
  redirect("/esqueci?sent=1");
}
