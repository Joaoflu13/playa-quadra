import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { changeInitialPassword } from "./actions";

const MESSAGES: Record<string, string> = {
  short: "A senha precisa ter ao menos 6 caracteres.",
  mismatch: "A confirmação não bate com a nova senha.",
};

export default async function TrocarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.aptId) redirect("/login");

  // Se já trocou, não precisa estar aqui.
  const apt = await prisma.apartment.findUnique({
    where: { id: session.user.aptId as string },
    select: { mustChangePassword: true },
  });
  if (apt && !apt.mustChangePassword) redirect("/");

  const { status } = await searchParams;

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="container" style={{ maxWidth: 400 }}>
      <h1 style={{ marginTop: 0 }}>Bem-vindo(a)! 🎾</h1>
      <p className="muted">
        Este é seu primeiro acesso. Por segurança, crie uma senha pessoal antes de
        continuar.
      </p>
      <form action={changeInitialPassword} className="card" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="next">Nova senha</label>
          <input id="next" name="next" type="password" required minLength={6} autoComplete="new-password" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="confirm">Confirmar nova senha</label>
          <input id="confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" />
        </div>
        <button className="btn" type="submit" style={{ width: "100%" }}>
          Salvar e entrar
        </button>
        {status && MESSAGES[status] && <p className="error">{MESSAGES[status]}</p>}
      </form>
      <form action={logout} style={{ marginTop: 12, textAlign: "center" }}>
        <button className="btn btn-2" type="submit">
          Sair
        </button>
      </form>
    </main>
  );
}
