import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error } = await searchParams;

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
    <main className="container" style={{ maxWidth: 380 }}>
      <h1>Quadra de Tênis</h1>
      <p className="muted">Playa del Mago — entre para reservar.</p>
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
      </form>
    </main>
  );
}
