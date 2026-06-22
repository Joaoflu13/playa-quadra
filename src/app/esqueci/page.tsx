import Link from "next/link";
import { requestReset } from "./actions";

export default async function EsqueciPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="container" style={{ maxWidth: 380 }}>
      <h1 style={{ marginTop: 0 }}>Esqueci minha senha</h1>
      {sent ? (
        <div className="card">
          <p>
            Se houver uma conta com e-mail cadastrado para esse CPF, enviamos um link
            para criar uma nova senha. Verifique sua caixa de entrada.
          </p>
          <p className="muted">
            Sem e-mail cadastrado? Peça ao síndico para redefinir sua senha.
          </p>
          <Link href="/login" className="btn btn-2">
            Voltar ao login
          </Link>
        </div>
      ) : (
        <>
          <p className="muted">Informe seu CPF. Enviaremos um link de redefinição ao e-mail cadastrado.</p>
          <form action={requestReset} className="card" style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="cpf">CPF</label>
              <input id="cpf" name="cpf" inputMode="numeric" placeholder="000.000.000-00" required />
            </div>
            <button className="btn" type="submit" style={{ width: "100%" }}>
              Enviar link
            </button>
            <p style={{ marginTop: 12, marginBottom: 0 }}>
              <Link href="/login">Voltar ao login</Link>
            </p>
          </form>
        </>
      )}
    </main>
  );
}
