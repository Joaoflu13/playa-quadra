import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { changePassword } from "./actions";

const MESSAGES: Record<string, { text: string; ok: boolean }> = {
  ok: { text: "Senha alterada com sucesso.", ok: true },
  wrong: { text: "Senha atual incorreta.", ok: false },
  mismatch: { text: "A confirmação não bate com a nova senha.", ok: false },
  short: { text: "A nova senha precisa ter ao menos 6 caracteres.", ok: false },
};

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { status } = await searchParams;
  const msg = status ? MESSAGES[status] : undefined;

  return (
    <main className="container" style={{ maxWidth: 420 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Minha conta</h1>
        <Link href="/" className="btn" style={{ background: "var(--panel-2)" }}>
          ← Reservas
        </Link>
      </div>

      <section className="card">
        <div style={{ marginBottom: 16 }}>
          <span className="muted">Morador</span>
          <div>
            <strong>{session.user.name}</strong>
          </div>
          {session.user.email && <div className="muted">{session.user.email}</div>}
        </div>

        <h2 style={{ fontSize: 18 }}>Trocar senha</h2>
        <form action={changePassword}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="current">Senha atual</label>
            <input id="current" name="current" type="password" required autoComplete="current-password" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="next">Nova senha</label>
            <input id="next" name="next" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="confirm">Confirmar nova senha</label>
            <input id="confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <button className="btn" type="submit" style={{ width: "100%" }}>
            Salvar nova senha
          </button>
        </form>
        {msg && (
          <p className={msg.ok ? "" : "error"} style={msg.ok ? { color: "#4ade80" } : undefined}>
            {msg.text}
          </p>
        )}
      </section>
    </main>
  );
}
