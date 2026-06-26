import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AreaReveal from "@/components/AreaReveal";
import NotificationsBell from "@/components/NotificationsBell";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Primeiro acesso (ou após reset do síndico): força troca de senha.
  const me = await prisma.apartment.findUnique({
    where: { id: session.user.aptId as string },
    select: { mustChangePassword: true },
  });
  if (me?.mustChangePassword) redirect("/trocar-senha");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="home-bg">
      <div className="container">
      <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <span className="muted">
          Olá, <strong style={{ color: "var(--text)" }}>{session.user.name}</strong>
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <NotificationsBell />
          {session.user.role === "ADMIN" && (
            <Link href="/admin" className="btn btn-2">
              Painel
            </Link>
          )}
          <Link href="/conta" className="btn btn-2">
            Minha conta
          </Link>
          <form action={logout}>
            <button className="btn-danger btn" type="submit">
              Sair
            </button>
          </form>
        </div>
      </div>
      <AreaReveal courtId="court-1" title="Quadra de Tênis" withPhoto allowMatch />
      <AreaReveal
        courtId="court-2"
        title="Mesa de Sinuca"
        withPhoto
        photoSrc="/sinuca.jpg"
        photoAlt="Mesa de sinuca do Playa del Mago"
        photoFit="contain"
        allowMatch={false}
      />
      <AreaReveal
        courtId="court-3"
        title="Sala de Pilates"
        withPhoto
        photoSrc="/pilates.jpg"
        photoAlt="Sala de pilates do Playa del Mago"
        photoFit="contain"
        allowMatch={false}
      />
      </div>
    </main>
  );
}
