"use client";

import { useEffect, useRef } from "react";

export default function HomeSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        width: 700,
        height: 700,
        transform: "translate(-50%, -50%)",
        background:
          "radial-gradient(circle, rgba(46,125,91,0.07) 0%, transparent 65%)",
        pointerEvents: "none",
        zIndex: 0,
        transition: "left 0.18s ease, top 0.18s ease",
      }}
    />
  );
}
