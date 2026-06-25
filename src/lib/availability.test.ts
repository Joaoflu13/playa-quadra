import { describe, it, expect } from "vitest";
import { cleanUnit, courtLabel, isValidCourt, slotStartsForDate, COURT_ID } from "./availability";

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
  });
  it("usa fallback para id desconhecido", () => {
    expect(courtLabel("court-999")).toBe("Área comum");
  });
});

describe("isValidCourt", () => {
  it("aceita áreas conhecidas e rejeita o resto", () => {
    expect(isValidCourt("court-1")).toBe(true);
    expect(isValidCourt("court-2")).toBe(true);
    expect(isValidCourt("court-3")).toBe(false);
    expect(isValidCourt(null)).toBe(false);
    expect(isValidCourt(undefined)).toBe(false);
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
  it("COURT_ID padrão é a quadra de tênis", () => {
    expect(COURT_ID).toBe("court-1");
  });
});
