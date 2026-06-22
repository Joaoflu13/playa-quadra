"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Troca a senha do próprio apartamento. Exige a senha atual.
 * Comunica resultado via redirect com ?status=... (a página exibe a mensagem).
 */
export async function changePassword(form: FormData) {
  const session = await auth();
  if (!session?.user?.aptId) redirect("/login");
  const aptId = session.user.aptId as string;

  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (next.length < 6) redirect("/conta?status=short");
  if (next !== confirm) redirect("/conta?status=mismatch");

  const apt = await prisma.apartment.findUnique({ where: { id: aptId } });
  if (!apt) redirect("/login");

  const ok = await bcrypt.compare(current, apt.passwordHash);
  if (!ok) redirect("/conta?status=wrong");

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.apartment.update({
    where: { id: aptId },
    data: { passwordHash, mustChangePassword: false },
  });

  redirect("/conta?status=ok");
}
