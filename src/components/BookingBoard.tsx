"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Slot = {
  startAt: string;
  endAt: string;
  taken: boolean;
  bookable: boolean;
  blocked?: boolean;
  blockReason?: string | null;
  bookingId?: string;
  ownerLabel?: string | null;
  ownerName?: string | null;
  ownerUnit?: string | null;
  partnerLabel?: string | null;
  partnerName?: string | null;
  partnerUnit?: string | null;
  mine?: boolean;
  iAmPartner?: boolean;
  openMatch?: boolean;
  openMatchBy?: string | null;
  openMatchMine?: boolean;
  waitlistCount?: number;
  iAmWaiting?: boolean;
};

type MyBooking = { id: string; startAt: string; endAt: string };

function todayFrom(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function todaySP(): string {
  return todayFrom(new Date());
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00-03:00`);
  d.setDate(d.getDate() + n);
  return todayFrom(d);
}

function hhmm(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function prettyDate(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${dateStr}T12:00:00-03:00`));
}

// Tile é pequeno: mostra só o primeiro nome do morador.
function shortLabel(label: string): string {
  return (label.split(" ")[0] ?? label).slice(0, 12);
}

export default function BookingBoard({
  courtId = "court-1",
  allowMatch = true,
}: {
  courtId?: string;
  allowMatch?: boolean;
}) {
  const today = useMemo(() => todaySP(), []);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [mine, setMine] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // silent=true: atualiza em segundo plano sem mostrar "Carregando…"
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [availRes, mineRes] = await Promise.all([
          fetch(`/api/availability?date=${date}&court=${courtId}`),
          fetch(`/api/bookings?court=${courtId}`),
        ]);
        const avail = await availRes.json().catch(() => ({}));
        const mineData = await mineRes.json().catch(() => ({}));
        if (!availRes.ok) throw new Error(avail.error ?? `Falha ao carregar (${availRes.status})`);
        setSlots(avail.slots ?? []);
        setMine(mineData.bookings ?? []);
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [date, courtId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Mantém a grade "ao vivo": atualiza a cada 20s e quando a aba volta ao foco.
  useEffect(() => {
    const t = setInterval(() => load(true), 20_000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.startAt === selected) ?? null,
    [slots, selected]
  );

  async function api(url: string, method: string, body: object, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Operação falhou (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  const book = (startAt: string) =>
    api("/api/bookings", "POST", { startAt, courtId }, startAt);
  // Cancelar abre um modal de confirmação (Sim/Não) em vez do confirm() nativo.
  const cancel = (id: string) => setConfirmCancelId(id);
  const doCancel = async () => {
    const id = confirmCancelId;
    setConfirmCancelId(null);
    if (id) await api("/api/bookings", "DELETE", { id }, id);
  };
  // Jogo aberto (procurar parceiro sem reservar o horário).
  const openMatch = (startAt: string) =>
    api("/api/bookings/match", "POST", { startAt, action: "open" }, `m-${startAt}`);
  const cancelMatch = (startAt: string) =>
    api("/api/bookings/match", "DELETE", { startAt }, `m-${startAt}`);
  const joinMatch = (startAt: string) =>
    api("/api/bookings/match", "POST", { startAt, action: "join" }, `j-${startAt}`);
  const setWaitlist = (startAt: string, want: boolean) =>
    api("/api/bookings/waitlist", want ? "POST" : "DELETE", { startAt, courtId }, `wl-${startAt}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Minhas reservas */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Minhas reservas</h2>
        {mine.length === 0 ? (
          <p className="muted">Você não tem reservas futuras.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {mine.map((b) => (
              <li key={b.id} className="row row-stack" style={{ padding: "8px 0" }}>
                <span>
                  {prettyDate(todayFrom(new Date(b.startAt)))} · {hhmm(b.startAt)}–
                  {hhmm(b.endAt)}
                </span>
                <button
                  className="btn-danger btn"
                  disabled={busy === b.id}
                  onClick={() => cancel(b.id)}
                >
                  {busy === b.id ? "..." : "Cancelar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Grade do dia */}
      <section className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <button
            className="btn btn-2"
            disabled={date <= today}
            onClick={() => {
              setSelected(null);
              setDate(addDays(date, -1));
            }}
          >
            ←
          </button>
          <strong style={{ textTransform: "capitalize", textAlign: "center" }}>
            {prettyDate(date)}
          </strong>
          <button
            className="btn btn-2"
            onClick={() => {
              setSelected(null);
              setDate(addDays(date, 1));
            }}
          >
            →
          </button>
        </div>

        {loading ? (
          <p className="muted">Carregando…</p>
        ) : (
          <div className="slot-grid">
            {slots.map((s) => {
              const isSel = s.startAt === selected;
              const ring = isSel ? { outline: "2px solid #60a5fa" } : {};

              if (s.mine) {
                return (
                  <button
                    key={s.startAt}
                    className="slot slot-mine"
                    style={ring}
                    onClick={() => setSelected(s.startAt)}
                  >
                    {hhmm(s.startAt)}
                    <div style={{ fontSize: 11, fontWeight: 400 }}>
                      sua reserva {s.partnerLabel ? "· dupla 🎾" : ""}
                    </div>
                  </button>
                );
              }
              if (s.taken) {
                return (
                  <button
                    key={s.startAt}
                    className="slot slot-taken"
                    style={{ ...ring, cursor: "pointer" }}
                    onClick={() => setSelected(s.startAt)}
                  >
                    {hhmm(s.startAt)}
                    <div style={{ fontSize: 11, fontWeight: 400 }}>
                      {s.ownerName
                        ? shortLabel(s.ownerName) + (s.ownerUnit ? " " + s.ownerUnit : "")
                        : "ocupado"}
                      {s.partnerName ? " + " + shortLabel(s.partnerName) : ""}
                      {s.iAmWaiting ? " · na fila" : ""}
                    </div>
                  </button>
                );
              }
              if (s.blocked) {
                // Quadra bloqueada pelo síndico (manutenção/torneio/etc.).
                return (
                  <div key={s.startAt} className="slot slot-blocked" title={s.blockReason ?? "Indisponível"}>
                    {hhmm(s.startAt)}
                    <div style={{ fontSize: 11, fontWeight: 400 }}>
                      🔧 {s.blockReason ?? "indisponível"}
                    </div>
                  </div>
                );
              }
              if (!s.bookable) {
                // Livre, mas ainda fora da janela de reserva (abre mais perto).
                return (
                  <div key={s.startAt} className="slot slot-future" title="Abre para reserva mais perto da data">
                    {hhmm(s.startAt)}
                    <div style={{ fontSize: 11, fontWeight: 400 }}>abre depois</div>
                  </div>
                );
              }
              return (
                <button
                  key={s.startAt}
                  className="slot slot-free"
                  style={ring}
                  disabled={busy === s.startAt}
                  onClick={() => setSelected(s.startAt)}
                >
                  {hhmm(s.startAt)}
                  <div style={{ fontSize: 11, fontWeight: 400, color: s.openMatch ? "var(--accent-700)" : "var(--muted)" }}>
                    {busy === s.startAt ? "..." : s.openMatch ? "🎾 quer dupla" : "livre"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      {/* Slot livre selecionado: reservar, procurar parceiro ou entrar numa procura */}
      {selectedSlot && !selectedSlot.taken && selectedSlot.bookable && (
        <section className="card">
          <div className="row">
            <h2 style={{ marginTop: 0 }}>
              Horário {hhmm(selectedSlot.startAt)}–{hhmm(selectedSlot.endAt)}
            </h2>
            <button className="btn btn-2" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>
          <p className="muted">
            {prettyDate(date)} · das {hhmm(selectedSlot.startAt)} às {hhmm(selectedSlot.endAt)}.
            Faltar sem cancelar gera bloqueio temporário.
          </p>

          {/* Alguém já está procurando parceiro neste horário */}
          {allowMatch && selectedSlot.openMatch && !selectedSlot.openMatchMine && (
            <div style={{ marginBottom: 12, padding: "12px", background: "var(--surface-2)", borderRadius: 10 }}>
              <p style={{ margin: "0 0 8px" }}>
                🎾 <strong>{selectedSlot.openMatchBy}</strong> está procurando parceiro aqui.
                Ao entrar, o horário é <strong>reservado para vocês dois</strong>.
              </p>
              <button
                className="btn"
                disabled={busy === `j-${selectedSlot.startAt}`}
                onClick={async () => { await joinMatch(selectedSlot.startAt); setSelected(null); }}
              >
                {busy === `j-${selectedSlot.startAt}` ? "..." : "🙋 Eu quero (fechar a dupla)"}
              </button>
            </div>
          )}

          {/* Eu mesmo estou procurando parceiro neste horário */}
          {allowMatch && selectedSlot.openMatchMine && (
            <div style={{ marginBottom: 12 }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Você está procurando parceiro aqui. O horário só fecha quando alguém entrar.
              </p>
              <button
                className="btn btn-2"
                disabled={busy === `m-${selectedSlot.startAt}`}
                onClick={async () => { await cancelMatch(selectedSlot.startAt); setSelected(null); }}
              >
                {busy === `m-${selectedSlot.startAt}` ? "..." : "Cancelar procura de parceiro"}
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn"
              disabled={busy === selectedSlot.startAt}
              onClick={async () => { await book(selectedSlot.startAt); setSelected(null); }}
            >
              {busy === selectedSlot.startAt ? "Reservando..." : "✅ Reservar para mim"}
            </button>
            {allowMatch && !selectedSlot.openMatch && (
              <button
                className="btn btn-2"
                disabled={busy === `m-${selectedSlot.startAt}`}
                onClick={async () => { await openMatch(selectedSlot.startAt); setSelected(null); }}
              >
                {busy === `m-${selectedSlot.startAt}` ? "..." : "🎾 Procurar parceiro"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Detalhe do slot selecionado */}
      {selectedSlot && selectedSlot.taken && (
        <section className="card">
          <div className="row">
            <h2 style={{ marginTop: 0 }}>
              {hhmm(selectedSlot.startAt)}–{hhmm(selectedSlot.endAt)}
            </h2>
            <button className="btn btn-2" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>
          <p>
            {selectedSlot.ownerLabel ? (
              <>
                Reservado por <strong>{selectedSlot.ownerLabel}</strong>
                {selectedSlot.mine && " (você)"}
                {selectedSlot.partnerLabel && (
                  <>
                    {" "}e <strong>{selectedSlot.partnerLabel}</strong>
                    {selectedSlot.iAmPartner && " (você)"}
                  </>
                )}
              </>
            ) : (
              <>Horário <strong>ocupado</strong></>
            )}
          </p>
          {selectedSlot.partnerLabel && (
            <p className="muted" style={{ marginTop: -6 }}>Jogo em dupla. 🎾</p>
          )}

          {/* Lista de espera: quem não joga neste horário pode entrar. */}
          {!selectedSlot.mine && !selectedSlot.iAmPartner && (
            <div
              style={{
                marginTop: 12,
                borderTop: "1px solid var(--border)",
                paddingTop: 12,
              }}
            >
              <p className="muted" style={{ marginTop: 0 }}>
                Quer este horário? Entre na lista de espera: se o dono cancelar, você é
                avisado e o primeiro a reservar leva a vaga.
              </p>
              <button
                className="btn btn-2"
                disabled={busy === `wl-${selectedSlot.startAt}`}
                onClick={() =>
                  setWaitlist(selectedSlot.startAt, !selectedSlot.iAmWaiting)
                }
              >
                {busy === `wl-${selectedSlot.startAt}`
                  ? "..."
                  : selectedSlot.iAmWaiting
                    ? "Sair da lista de espera"
                    : "Entrar na lista de espera"}
              </button>
              {(selectedSlot.waitlistCount ?? 0) > 0 && (
                <p className="muted" style={{ marginTop: 8 }}>
                  {selectedSlot.waitlistCount} na fila
                  {selectedSlot.iAmWaiting ? " (incluindo você)" : ""}.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Modal de confirmação de cancelamento (Sim / Não) */}
      {confirmCancelId && (
        <div className="modal-overlay" onClick={() => setConfirmCancelId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p style={{ marginTop: 0 }}>
              Cancelar esta reserva? O horário será liberado para os outros moradores.
            </p>
            <div className="modal-actions">
              <button className="btn btn-2" onClick={() => setConfirmCancelId(null)}>
                Não
              </button>
              <button className="btn" onClick={doCancel}>
                Sim, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
