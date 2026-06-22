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
    <main className="home-bg">
      <div className="container">
      <div style={{ marginBottom: 16 }}>
        <CourtPhoto />
      </div>
      <div className="row" style={{ marginBottom: 20, flexWrap: "wrap" }}>
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
      <BookingBoard />
      </div>
    </main>
  );
}
