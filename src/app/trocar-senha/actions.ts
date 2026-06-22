"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Define a senha no primeiro acesso (ou após reset do síndico) e libera o app.
 * O morador já está autenticado; não pede a senha atual.
 */
export async function changeInitialPassword(form: FormData) {
  const session = await auth();
  if (!session?.user?.aptId) redirect("/login");
  const aptId = session.user.aptId as string;

  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (next.length < 6) redirect("/trocar-senha?status=short");
  if (next !== confirm) redirect("/trocar-senha?status=mismatch");

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.apartment.update({
    where: { id: aptId },
    data: { passwordHash, mustChangePassword: false },
  });

  redirect("/");
}
