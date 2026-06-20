"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Slot = {
  startAt: string;
  endAt: string;
  taken: boolean;
  bookable: boolean;
  bookingId?: string;
  ownerLabel?: string;
  mine?: boolean;
  openForPlayers?: boolean;
  interestCount?: number;
  interested?: string[];
  iAmInterested?: boolean;
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

export default function BookingBoard() {
  const today = useMemo(() => todaySP(), []);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [mine, setMine] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [availRes, mineRes] = await Promise.all([
        fetch(`/api/availability?date=${date}`),
        fetch(`/api/bookings`),
      ]);
      const avail = await availRes.json();
      const mineData = await mineRes.json();
      if (!availRes.ok) throw new Error(avail.error ?? "Falha ao carregar");
      setSlots(avail.slots ?? []);
      setMine(mineData.bookings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Operação falhou");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  const book = (startAt: string) =>
    api("/api/bookings", "POST", { startAt }, startAt);
  const cancel = (id: string) => api("/api/bookings", "DELETE", { id }, id);
  const toggleOpen = (id: string, openForPlayers: boolean) =>
    api("/api/bookings", "PATCH", { id, openForPlayers }, id);
  const setInterest = (bookingId: string, want: boolean) =>
    api("/api/bookings/interest", want ? "POST" : "DELETE", { bookingId }, bookingId);

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
              <li key={b.id} className="row" style={{ padding: "8px 0" }}>
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
            className="btn"
            style={{ background: "var(--panel-2)" }}
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
            className="btn"
            style={{ background: "var(--panel-2)" }}
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
                      sua reserva {s.openForPlayers ? "· 🎾" : ""}
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
                      {shortLabel(s.ownerLabel ?? "")}
                      {s.openForPlayers ? " · 🎾 vaga" : ""}
                    </div>
                  </button>
                );
              }
              if (!s.bookable) {
                return (
                  <div key={s.startAt} className="slot slot-taken">
                    {hhmm(s.startAt)}
                  </div>
                );
              }
              return (
                <button
                  key={s.startAt}
                  className="slot slot-free"
                  disabled={busy === s.startAt}
                  onClick={() => book(s.startAt)}
                >
                  {hhmm(s.startAt)}
                  <div style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>
                    {busy === s.startAt ? "..." : "livre"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      {/* Detalhe do slot selecionado */}
      {selectedSlot && selectedSlot.taken && (
        <section className="card">
          <div className="row">
            <h2 style={{ marginTop: 0 }}>
              {hhmm(selectedSlot.startAt)}–{hhmm(selectedSlot.endAt)}
            </h2>
            <button
              className="btn"
              style={{ background: "var(--panel-2)" }}
              onClick={() => setSelected(null)}
            >
              Fechar
            </button>
          </div>
          <p>
            Reservado por <strong>{selectedSlot.ownerLabel}</strong>
            {selectedSlot.mine && " (você)"}
          </p>

          {/* Dono gerencia "procuro parceiros" */}
          {selectedSlot.mine && (
            <>
              <button
                className="btn"
                disabled={busy === selectedSlot.bookingId}
                onClick={() =>
                  toggleOpen(selectedSlot.bookingId!, !selectedSlot.openForPlayers)
                }
              >
                {selectedSlot.openForPlayers
                  ? "Fechar procura de parceiros"
                  : "🎾 Procurar parceiros"}
              </button>
              {selectedSlot.openForPlayers && (
                <div style={{ marginTop: 12 }}>
                  <strong>Interessados ({selectedSlot.interestCount}):</strong>
                  {selectedSlot.interested && selectedSlot.interested.length > 0 ? (
                    <ul>
                      {selectedSlot.interested.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Ninguém sinalizou ainda.</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Outro morador: sinaliza interesse se aberto */}
          {!selectedSlot.mine && selectedSlot.openForPlayers && (
            <>
              <p className="muted">
                Este morador procura parceiros para jogar neste horário.
              </p>
              <button
                className="btn"
                disabled={busy === selectedSlot.bookingId}
                onClick={() =>
                  setInterest(selectedSlot.bookingId!, !selectedSlot.iAmInterested)
                }
              >
                {selectedSlot.iAmInterested
                  ? "Remover meu interesse"
                  : "Tenho interesse em jogar"}
              </button>
              {selectedSlot.interestCount! > 0 && (
                <p className="muted" style={{ marginTop: 8 }}>
                  {selectedSlot.interestCount} interessado(s):{" "}
                  {selectedSlot.interested?.join(", ")}
                </p>
              )}
            </>
          )}

          {!selectedSlot.mine && !selectedSlot.openForPlayers && (
            <p className="muted">Horário fechado para parceiros.</p>
          )}
        </section>
      )}
    </div>
  );
}
