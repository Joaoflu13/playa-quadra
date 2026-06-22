import Link from "next/link";
import { prisma } from "@/lib/db";
import { doReset } from "./actions";

const MESSAGES: Record<string, string> = {
  short: "A nova senha precisa ter ao menos 6 caracteres.",
  mismatch: "A confirmação não bate com a nova senha.",
  invalid: "Link inválido ou expirado. Peça um novo.",
};

export default async function RedefinirPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;

  const row = token
    ? await prisma.passwordResetToken.findUnique({ where: { token } })
    : null;
  const valid = row && row.expiresAt > new Date();

  return (
    <main className="container" style={{ maxWidth: 380 }}>
      <h1 style={{ marginTop: 0 }}>Criar nova senha</h1>

      {!valid ? (
        <div className="card">
          <p className="error">{MESSAGES.invalid}</p>
          <Link href="/esqueci" className="btn btn-2">
            Pedir novo link
          </Link>
        </div>
      ) : (
        <form action={doReset} className="card">
          <input type="hidden" name="token" value={token} />
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="next">Nova senha</label>
            <input id="next" name="next" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="confirm">Confirmar nova senha</label>
            <input id="confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <button className="btn" type="submit" style={{ width: "100%" }}>
            Salvar senha
          </button>
          {status && MESSAGES[status] && <p className="error">{MESSAGES[status]}</p>}
        </form>
      )}
    </main>
  );
}
