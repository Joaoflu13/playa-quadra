import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/rules";
import { formatCpf } from "@/lib/cpf";
import {
  updateRules,
  createApartment,
  setAptStatus,
  resetPassword,
  markNoShow,
  unblock,
  clearPenalties,
} from "./actions";

function hhmm(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

const RULE_FIELDS: { key: string; label: string }[] = [
  { key: "slotMinutes", label: "Duração do slot (min)" },
  { key: "openHour", label: "Abre (hora)" },
  { key: "closeHour", label: "Fecha (hora)" },
  { key: "advanceDays", label: "Antecedência máx. (dias)" },
  { key: "maxActivePerApt", label: "Reservas ativas por morador" },
  { key: "maxWeeklyPerApt", label: "Reservas por 7 dias" },
  { key: "cancelMinNoticeMin", label: "Antecedência p/ cancelar (min)" },
  { key: "noShowBlockDays", label: "Dias de bloqueio por falta" },
];

const grid3 = { gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" };

export default async function AdminPage() {
  await requireAdmin();

  const cfg = await getConfig();
  const apartments = await prisma.apartment.findMany({
    orderBy: { label: "asc" },
    include: { _count: { select: { penalties: true } } },
  });
  const pastBookings = await prisma.booking.findMany({
    where: { status: "CONFIRMED", startAt: { lt: new Date() } },
    orderBy: { startAt: "desc" },
    take: 30,
    include: { apartment: { select: { label: true, unit: true } } },
  });

  const now = new Date();

  return (
    <main className="container">
      <div className="row" style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Painel do Síndico</h1>
        <Link href="/" className="btn" style={{ background: "var(--panel-2)" }}>
          ← Reservas
        </Link>
      </div>

      {/* === Regras === */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Regras de reserva</h2>
        <form action={updateRules}>
          <div className="slot-grid" style={grid3}>
            {RULE_FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={f.key}>{f.label}</label>
                <input
                  id={f.key}
                  name={f.key}
                  type="number"
                  defaultValue={(cfg as unknown as Record<string, number>)[f.key]}
                />
              </div>
            ))}
          </div>
          <button className="btn" type="submit" style={{ marginTop: 16 }}>
            Salvar regras
          </button>
        </form>
      </section>

      {/* === Novo morador === */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Cadastrar morador</h2>
        <form action={createApartment}>
          <div className="slot-grid" style={grid3}>
            <div>
              <label htmlFor="cpf">CPF (login)</label>
              <input id="cpf" name="cpf" inputMode="numeric" placeholder="000.000.000-00" required />
            </div>
            <div>
              <label htmlFor="label">Nome do morador</label>
              <input id="label" name="label" placeholder="João Silva" required />
            </div>
            <div>
              <label htmlFor="unit">Unidade</label>
              <input id="unit" name="unit" placeholder="Bloco A - 304" />
            </div>
            <div>
              <label htmlFor="email">E-mail (opcional)</label>
              <input id="email" name="email" type="email" placeholder="joao@..." />
            </div>
            <div>
              <label htmlFor="password">Senha provisória</label>
              <input id="password" name="password" required minLength={6} />
            </div>
          </div>
          <button className="btn" type="submit" style={{ marginTop: 16 }}>
            Cadastrar
          </button>
        </form>
      </section>

      {/* === Moradores === */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Moradores ({apartments.length})</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {apartments.map((a) => {
            const blocked = a.blockedUntil && a.blockedUntil > now;
            return (
              <li
                key={a.id}
                style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}
              >
                <div className="row">
                  <div>
                    <strong>{a.label}</strong>{" "}
                    {a.role === "ADMIN" && <span className="muted">(admin)</span>}
                    <div className="muted">
                      {formatCpf(a.cpf)}
                      {a.unit ? ` · ${a.unit}` : ""} ·{" "}
                      {a.status === "SUSPENDED" ? "🔴 suspenso" : "🟢 ativo"}
                      {blocked && ` · ⛔ bloqueado até ${hhmm(a.blockedUntil!)}`} · faltas:{" "}
                      {a._count.penalties}
                    </div>
                  </div>
                  {a.role !== "ADMIN" && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {blocked && (
                        <form action={unblock.bind(null, a.id)}>
                          <button className="btn" type="submit">Desbloquear</button>
                        </form>
                      )}
                      {a.status === "SUSPENDED" ? (
                        <form action={setAptStatus.bind(null, a.id, "ACTIVE")}>
                          <button className="btn" type="submit">Reativar</button>
                        </form>
                      ) : (
                        <form action={setAptStatus.bind(null, a.id, "SUSPENDED")}>
                          <button className="btn-danger btn" type="submit">Suspender</button>
                        </form>
                      )}
                      {a._count.penalties > 0 && (
                        <form action={clearPenalties.bind(null, a.id)}>
                          <button className="btn" type="submit" style={{ background: "var(--panel-2)" }}>
                            Zerar faltas
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
                {a.role !== "ADMIN" && (
                  <form
                    action={resetPassword.bind(null, a.id)}
                    style={{ display: "flex", gap: 8, marginTop: 8, maxWidth: 360 }}
                  >
                    <input name="newPassword" placeholder="nova senha provisória" minLength={6} />
                    <button className="btn" type="submit" style={{ background: "var(--panel-2)", whiteSpace: "nowrap" }}>
                      Redefinir senha
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* === Faltas (no-show) === */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Reservas passadas — marcar falta</h2>
        <p className="muted">
          Marcar falta bloqueia o morador por {cfg.noShowBlockDays} dias.
        </p>
        {pastBookings.length === 0 ? (
          <p className="muted">Nenhuma reserva passada pendente.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pastBookings.map((b) => (
              <li key={b.id} className="row" style={{ padding: "8px 0" }}>
                <span>
                  {hhmm(b.startAt)} · {b.apartment.label}
                  {b.apartment.unit ? ` (${b.apartment.unit})` : ""}
                </span>
                <form action={markNoShow.bind(null, b.id)}>
                  <button className="btn-danger btn" type="submit">
                    Marcar falta
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
