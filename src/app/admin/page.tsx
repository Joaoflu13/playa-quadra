import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/rules";
import { formatCpf } from "@/lib/cpf";
import {
  updateRules,
  createApartment,
  importResidents,
  setAptStatus,
  resetPassword,
  markNoShow,
  unblock,
  clearPenalties,
  addBlock,
  removeBlock,
  addRecurring,
  removeRecurring,
} from "./actions";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function dayHour(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

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

  // === Relatório de uso (últimos 30 dias) ===
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const recent = await prisma.booking.findMany({
    where: { startAt: { gte: since, lt: now } },
    select: { status: true, aptId: true, apartment: { select: { label: true, unit: true } } },
  });
  const confirmed = recent.filter((b) => b.status === "CONFIRMED").length;
  const cancelled = recent.filter((b) => b.status === "CANCELLED").length;
  const noShow = recent.filter((b) => b.status === "NO_SHOW").length;
  const slotsPerDay = Math.max(0, cfg.closeHour - cfg.openHour);
  const capacity = slotsPerDay * 30;
  const occupancy = capacity > 0 ? Math.round((confirmed / capacity) * 100) : 0;
  // Ranking de moradores por reservas efetivas (exclui canceladas).
  const byApt = new Map<string, { label: string; unit: string; count: number }>();
  for (const b of recent) {
    if (b.status === "CANCELLED") continue;
    const cur = byApt.get(b.aptId) ?? { label: b.apartment.label, unit: b.apartment.unit, count: 0 };
    cur.count += 1;
    byApt.set(b.aptId, cur);
  }
  const topApts = [...byApt.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  // Bloqueios futuros e reservas fixas (para as seções de gestão).
  const blocks = await prisma.courtBlock.findMany({
    where: { endAt: { gt: now } },
    orderBy: { startAt: "asc" },
  });
  const recurrings = await prisma.recurringBooking.findMany({
    include: { apartment: { select: { label: true, unit: true } } },
    orderBy: [{ weekday: "asc" }, { hour: "asc" }],
  });
  const stats = [
    { label: "Taxa de ocupação", value: `${occupancy}%`, hint: "reservas ÷ horários disponíveis" },
    { label: "Reservas", value: confirmed, hint: "confirmadas (30 dias)" },
    { label: "Cancelamentos", value: cancelled, hint: "no período" },
    { label: "Faltas", value: noShow, hint: "no-show marcado" },
  ];

  return (
    <main className="home-bg">
      <div className="container">
      <div className="row" style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Painel do Síndico</h1>
        <Link href="/" className="btn btn-2">
          ← Reservas
        </Link>
      </div>

      {/* === Relatório de uso === */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Relatório de uso (últimos 30 dias)</h2>
        <div className="slot-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))" }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 12px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--primary-700)" }}>
                {s.value}
              </div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</div>
              <div className="muted" style={{ fontSize: 11 }}>{s.hint}</div>
            </div>
          ))}
        </div>
        {topApts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <strong>Moradores que mais usam</strong>
            <ol style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {topApts.map((a) => (
                <li key={a.label + a.unit}>
                  {a.label}
                  {a.unit ? ` (${a.unit})` : ""} — <strong>{a.count}</strong> reserva(s)
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

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

      {/* === Bloquear a quadra (#8) === */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Bloquear a quadra</h2>
        <p className="muted">
          Manutenção, torneio, evento ou chuva: ninguém reserva no intervalo bloqueado.
        </p>
        <form action={addBlock}>
          <div className="slot-grid" style={grid3}>
            <div>
              <label htmlFor="bdate">Dia</label>
              <input id="bdate" name="date" type="date" required />
            </div>
            <div>
              <label htmlFor="startHour">Das (hora)</label>
              <input id="startHour" name="startHour" type="number" min={0} max={23} defaultValue={8} required />
            </div>
            <div>
              <label htmlFor="endHour">Até (hora)</label>
              <input id="endHour" name="endHour" type="number" min={1} max={24} defaultValue={22} required />
            </div>
            <div>
              <label htmlFor="reason">Motivo</label>
              <input id="reason" name="reason" placeholder="Manutenção" />
            </div>
          </div>
          <button className="btn" type="submit" style={{ marginTop: 16 }}>
            Bloquear horário
          </button>
        </form>
        {blocks.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
            {blocks.map((bl) => (
              <li key={bl.id} className="row row-stack" style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                <span>
                  ⛔ {dayHour(bl.startAt)} → {dayHour(bl.endAt)} · <strong>{bl.reason}</strong>
                </span>
                <form action={removeBlock.bind(null, bl.id)}>
                  <button className="btn btn-2" type="submit">Remover</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* === Reservas fixas / recorrentes (#10) === */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Reservas fixas (semanais)</h2>
        <p className="muted">
          Ex.: aula de tênis no mesmo horário toda semana. Gera as reservas das próximas
          8 semanas automaticamente (pula horários já ocupados ou bloqueados).
        </p>
        <form action={addRecurring}>
          <div className="slot-grid" style={grid3}>
            <div>
              <label htmlFor="rcpf">CPF do morador</label>
              <input id="rcpf" name="cpf" inputMode="numeric" placeholder="000.000.000-00" required />
            </div>
            <div>
              <label htmlFor="weekday">Dia da semana</label>
              <select id="weekday" name="weekday" required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 15 }}>
                {WEEKDAYS.map((w, i) => (
                  <option key={w} value={i}>{w}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rhour">Hora de início</label>
              <input id="rhour" name="hour" type="number" min={cfg.openHour} max={cfg.closeHour - 1} defaultValue={cfg.openHour} required />
            </div>
          </div>
          <button className="btn" type="submit" style={{ marginTop: 16 }}>
            Criar reserva fixa
          </button>
        </form>
        {recurrings.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
            {recurrings.map((r) => (
              <li key={r.id} className="row row-stack" style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                <span>
                  🎾 <strong>{WEEKDAYS[r.weekday]}</strong> às {String(r.hour).padStart(2, "0")}h ·{" "}
                  {r.apartment.label}{r.apartment.unit ? ` (${r.apartment.unit})` : ""}
                </span>
                <form action={removeRecurring.bind(null, r.id)}>
                  <button className="btn btn-2" type="submit">Encerrar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
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

      {/* === Importar em massa (CSV) === */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Importar moradores (em massa)</h2>
        <p className="muted">
          Uma linha por morador, no formato: <code>CPF, Nome, Unidade, E-mail</code> (e-mail
          opcional). Ex.: <code>123.456.789-09, Ana Lima, Bloco C 201, ana@email.com</code>
        </p>
        <form action={importResidents}>
          <textarea
            name="csv"
            rows={6}
            placeholder={"111.111.111-11, Fulano, Bloco A 101\n222.222.222-22, Beltrano, Bloco A 102, beltrano@email.com"}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              fontFamily: "monospace",
              fontSize: 14,
              resize: "vertical",
            }}
          />
          <div style={{ marginTop: 12, maxWidth: 280 }}>
            <label htmlFor="defaultPassword">Senha provisória (para todos)</label>
            <input id="defaultPassword" name="defaultPassword" required minLength={6} defaultValue="playa123" />
          </div>
          <button className="btn" type="submit" style={{ marginTop: 12 }}>
            Importar lista
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
                          <button className="btn btn-2" type="submit">
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
                    <button className="btn btn-2" type="submit" style={{ whiteSpace: "nowrap" }}>
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
      </div>
    </main>
  );
}
