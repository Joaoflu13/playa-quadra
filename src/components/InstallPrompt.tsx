"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "installPromptDismissed";

// Tipo mínimo do evento beforeinstallprompt (não tipado pelo TS por padrão).
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/**
 * Convite para instalar o app (PWA):
 * - iPhone (Safari não tem instalação automática): mostra a instrução
 *   "Compartilhar → Adicionar à Tela de Início".
 * - Android/Chrome: captura o beforeinstallprompt e mostra um botão "Instalar".
 * Some quando já está instalado (standalone) ou após o morador dispensar.
 */
export default function InstallPrompt() {
  const [mode, setMode] = useState<null | "ios" | "android">(null);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    // Registra o service worker (necessário para instalar no Android).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (localStorage.getItem(DISMISS_KEY)) return;

    // Já instalado? Não incomoda.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) {
      setMode("ios");
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setMode(null);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="install-banner" role="dialog" aria-label="Instalar aplicativo">
      <span className="install-text">
        {mode === "ios" ? (
          <>
            📲 Instale como app: toque em <strong>Compartilhar</strong> e depois em{" "}
            <strong>“Adicionar à Tela de Início”</strong>.
          </>
        ) : (
          <>📲 Instale a quadra como aplicativo no seu celular.</>
        )}
      </span>
      <div className="install-actions">
        {mode === "android" && (
          <button className="btn" onClick={install}>
            Instalar
          </button>
        )}
        <button className="btn btn-2" onClick={dismiss}>
          {mode === "ios" ? "Entendi" : "Agora não"}
        </button>
      </div>
    </div>
  );
}
