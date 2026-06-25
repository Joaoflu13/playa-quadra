import { describe, it, expect } from "vitest";
import { cleanUnit, courtLabel, isValidCourt, slotStartsForDate, courtSettings, COURT_ID } from "./availability";

describe("cleanUnit", () => {
  it('remove o prefixo "Bloco X -"', () => {
    expect(cleanUnit("Bloco A - 304")).toBe("304");
    expect(cleanUnit("Bloco B 502")).toBe("502");
    expect(cleanUnit("bloco a - 101")).toBe("101");
  });
  it("preserva unidades sem prefixo", () => {
    expect(cleanUnit("304")).toBe("304");
  });
  it("tolera null/undefined/vazio", () => {
    expect(cleanUnit(null)).toBe("");
    expect(cleanUnit(undefined)).toBe("");
    expect(cleanUnit("")).toBe("");
  });
});

describe("courtLabel", () => {
  it("mapeia ids conhecidos para o nome", () => {
    expect(courtLabel("court-1")).toBe("Quadra de Tênis");
    expect(courtLabel("court-2")).toBe("Mesa de Sinuca");
    expect(courtLabel("court-3")).toBe("Sala de Pilates");
  });
  it("usa fallback para id desconhecido", () => {
    expect(courtLabel("court-999")).toBe("Área comum");
  });
});

describe("isValidCourt", () => {
  it("aceita áreas conhecidas e rejeita o resto", () => {
    expect(isValidCourt("court-1")).toBe(true);
    expect(isValidCourt("court-2")).toBe(true);
    expect(isValidCourt("court-3")).toBe(true);
    expect(isValidCourt("court-4")).toBe(false);
    expect(isValidCourt(null)).toBe(false);
    expect(isValidCourt(undefined)).toBe(false);
  });
});

describe("courtSettings", () => {
  const global = { openHour: 8, closeHour: 22 };

  it("tênis/sinuca herdam a regra global e têm capacidade 1", () => {
    expect(courtSettings("court-1", global)).toEqual({ capacity: 1, openHour: 8, closeHour: 22 });
    expect(courtSettings("court-2", global)).toEqual({ capacity: 1, openHour: 8, closeHour: 22 });
  });

  it("Pilates tem capacidade 2 e janela própria 5h–00h", () => {
    expect(courtSettings("court-3", global)).toEqual({ capacity: 2, openHour: 5, closeHour: 24 });
  });

  it("área desconhecida cai no default (capacidade 1, regra global)", () => {
    expect(courtSettings("court-999", global)).toEqual({ capacity: 1, openHour: 8, closeHour: 22 });
  });
});

describe("slotStartsForDate", () => {
  it("gera um slot por hora, de open (incl.) a close (excl.)", () => {
    const slots = slotStartsForDate("2026-06-26", 8, 22);
    expect(slots).toHaveLength(14); // 8h..21h
    // Primeiro slot às 08:00 no horário de São Paulo (UTC-3 → 11:00Z).
    expect(slots[0].toISOString()).toBe("2026-06-26T11:00:00.000Z");
    // Último slot às 21:00 SP → 00:00Z do dia seguinte.
    expect(slots[13].toISOString()).toBe("2026-06-27T00:00:00.000Z");
  });
  it("gera a janela 5h–00h do Pilates (último slot 23h)", () => {
    const slots = slotStartsForDate("2026-06-26", 5, 24);
    expect(slots).toHaveLength(19); // 5h..23h
    expect(slots[0].toISOString()).toBe("2026-06-26T08:00:00.000Z"); // 05:00 SP
    expect(slots[18].toISOString()).toBe("2026-06-27T02:00:00.000Z"); // 23:00 SP
  });

  it("COURT_ID padrão é a quadra de tênis", () => {
    expect(COURT_ID).toBe("court-1");
  });
});
