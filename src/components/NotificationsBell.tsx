"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: string; message: string; read: boolean; createdAt: string };

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

export default function NotificationsBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* silencioso */
    }
  }, []);

  // Carrega ao montar e a cada 30s.
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Abrir = marcar como lidas.
      setUnread(0);
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      try {
        await fetch("/api/notifications/read", { method: "POST" });
      } catch {
        /* silencioso */
      }
    }
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button
        className="btn btn-2"
        style={{ position: "relative" }}
        onClick={toggle}
        aria-label="Notificações"
      >
        🔔
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "var(--red)",
              color: "white",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              minWidth: 18,
              height: 18,
              lineHeight: "18px",
              textAlign: "center",
              padding: "0 4px",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 320,
            maxHeight: 380,
            overflowY: "auto",
            zIndex: 20,
            padding: 12,
          }}
        >
          <strong>Notificações</strong>
          {items.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Nada por aqui ainda.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
              {items.map((n) => (
                <li
                  key={n.id}
                  style={{
                    padding: "8px 0",
                    borderTop: "1px solid var(--border)",
                    fontSize: 14,
                  }}
                >
                  <div>{n.message}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {ago(n.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
