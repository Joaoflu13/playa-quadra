import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Garante que o usuário logado é ADMIN. Redireciona caso contrário. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  return session;
}
