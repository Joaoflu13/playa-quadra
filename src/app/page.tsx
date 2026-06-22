import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import BookingBoard from "@/components/BookingBoard";
import CourtPhoto from "@/components/CourtPhoto";
import NotificationsBell from "@/components/NotificationsBell";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="container">
      <div className="row" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Quadra de Tênis</h1>
          <span className="muted">Playa del Mago · {session.user.name}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <NotificationsBell />
          {session.user.role === "ADMIN" && (
            <Link href="/admin" className="btn" style={{ background: "var(--panel-2)" }}>
              Painel
            </Link>
          )}
          <Link href="/conta" className="btn" style={{ background: "var(--panel-2)" }}>
            Minha conta
          </Link>
          <form action={logout}>
            <button className="btn-danger btn" type="submit">
              Sair
            </button>
          </form>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <CourtPhoto />
      </div>
      <BookingBoard />
    </main>
  );
}
