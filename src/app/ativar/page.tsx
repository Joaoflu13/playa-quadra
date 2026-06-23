import Link from "next/link";
import { activateAccount } from "./actions";

const MESSAGES: Record<string, string> = {
  invalid: "CPF inválido. Confira os números.",
  short: "A senha precisa ter ao menos 6 caracteres.",
  mismatch: "A confirmação não bate com a senha.",
  nomatch:
    "Dados não conferem. Confira o CPF e a unidade exatamente como cadastrados, ou fale com o síndico.",
  already:
    "Esta conta já foi ativada. Use Entrar ou, se esqueceu a senha, Esqueci minha senha.",
};

export default async function AtivarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <main className="container" style={{ maxWidth: 400 }}>
      <h1 style={{ marginTop: 0 }}>Ativar minha conta</h1>
      <p className="muted">
        Primeiro acesso? Confirme seus dados e crie sua senha. Seu CPF precisa estar na
        lista de moradores cadastrada pelo síndico.
      </p>
      <form action={activateAccount} className="card" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="cpf">CPF</label>
          <input
            id="cpf"
            name="cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            required
            autoComplete="username"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="unit">Unidade</label>
          <input
            id="unit"
            name="unit"
            placeholder="ex.: Bloco A - 304"
            required
            autoComplete="off"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="next">Criar senha</label>
          <input id="next" name="next" type="password" required minLength={6} autoComplete="new-password" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="confirm">Confirmar senha</label>
          <input id="confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" />
        </div>
        <button className="btn" type="submit" style={{ width: "100%" }}>
          Ativar e criar senha
        </button>
        {status && MESSAGES[status] && <p className="error">{MESSAGES[status]}</p>}
        <p style={{ marginTop: 12, marginBottom: 0, textAlign: "center" }}>
          <Link href="/login">Já tenho conta — Entrar</Link>
        </p>
      </form>
    </main>
  );
}
