import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error, reset } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        cpf: formData.get("cpf"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw e; // redirect() lança internamente; deixe propagar.
    }
  }

  return (
    <main className="login-split">
      <div className="login-split__photo">
        <div className="brand">
          <div className="eyebrow">Playa del Mago · Barra da Tijuca</div>
          <div className="name">Quadra de Tênis</div>
        </div>
      </div>
      <div className="login-split__form">
        <div className="inner">
          <h1 style={{ marginTop: 0 }}>Entrar</h1>
          <p className="muted">Acesse com o CPF e a senha do seu cadastro.</p>
          <form action={login} className="card" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 14 }}>
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
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <button className="btn" type="submit" style={{ width: "100%" }}>
          Entrar
        </button>
            {error && <p className="error">CPF ou senha inválidos.</p>}
            {reset && <p className="ok">Senha alterada! Entre com a nova senha.</p>}
            <p style={{ marginTop: 12, marginBottom: 0, textAlign: "center" }}>
              <Link href="/esqueci">Esqueci minha senha</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
