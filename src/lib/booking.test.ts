import { describe, it, expect } from "vitest";
import { validateSlot, hourSP } from "./booking";
import type { Config } from "./rules";

const cfg: Config = {
  slotMinutes: 60,
  openHour: 8,
  closeHour: 22,
  advanceHours: 24,
  maxActivePerApt: 2,
  maxWeeklyPerApt: 3,
  cancelMinNoticeMin: 120,
  noShowBlockDays: 7,
};

// "Agora" fixo para tornar os testes determinísticos: 26/06/2026 10:00 BRT.
const now = new Date("2026-06-26T10:00:00-03:00");

describe("hourSP", () => {
  it("retorna a hora local de São Paulo (UTC-3)", () => {
    expect(hourSP(new Date("2026-06-26T19:00:00-03:00"))).toBe(19);
    // 02:00 UTC = 23:00 BRT do dia anterior — confere o ajuste de fuso.
    expect(hourSP(new Date("2026-06-26T02:00:00Z"))).toBe(23);
  });
});

describe("validateSlot", () => {
  it("aceita um slot válido dentro da janela", () => {
    expect(validateSlot(new Date("2026-06-26T19:00:00-03:00"), cfg, now)).toBeNull();
  });

  it("rejeita data inválida", () => {
    expect(validateSlot(new Date("xxx"), cfg, now)).toBe("startAt inválido");
  });

  it("rejeita slot fora da hora cheia", () => {
    expect(validateSlot(new Date("2026-06-26T19:30:00-03:00"), cfg, now)).toBe(
      "Slots começam na hora cheia"
    );
  });

  it("rejeita horário antes da abertura", () => {
    expect(validateSlot(new Date("2026-06-27T07:00:00-03:00"), cfg, now)).toBe(
      "Fora da janela operacional"
    );
  });

  it("rejeita horário no fechamento (closeHour é exclusivo)", () => {
    expect(validateSlot(new Date("2026-06-26T22:00:00-03:00"), cfg, now)).toBe(
      "Fora da janela operacional"
    );
  });

  it("rejeita slot no passado", () => {
    expect(validateSlot(new Date("2026-06-26T09:00:00-03:00"), cfg, now)).toBe(
      "Slot no passado"
    );
  });

  it("rejeita além da antecedência máxima", () => {
    // now + 24h = 27/06 10:00; um slot em 28/06 19:00 está fora.
    expect(validateSlot(new Date("2026-06-28T19:00:00-03:00"), cfg, now)).toBe(
      "Antecedência máxima de 24 horas"
    );
  });

  it("aceita o limite exato da janela de antecedência", () => {
    // Exatamente 24h à frente e dentro do horário comercial.
    expect(validateSlot(new Date("2026-06-27T10:00:00-03:00"), cfg, now)).toBeNull();
  });
});
