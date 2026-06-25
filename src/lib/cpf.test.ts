import { describe, it, expect } from "vitest";
import { onlyDigits, isValidCpf, formatCpf } from "./cpf";

describe("onlyDigits", () => {
  it("remove pontuação e espaços", () => {
    expect(onlyDigits("123.456.789-09")).toBe("12345678909");
    expect(onlyDigits(" 111 222 333 96 ")).toBe("11122233396");
  });
  it("tolera entrada vazia/nula", () => {
    expect(onlyDigits("")).toBe("");
    // @ts-expect-error proposital: garante o fallback ?? ""
    expect(onlyDigits(null)).toBe("");
  });
});

describe("isValidCpf", () => {
  it("aceita CPFs com dígitos verificadores corretos", () => {
    expect(isValidCpf("111.222.333-96")).toBe(true);
    expect(isValidCpf("11122233396")).toBe(true);
  });
  it("rejeita comprimento errado", () => {
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("123456789012")).toBe(false);
  });
  it("rejeita todos os dígitos iguais", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
  it("rejeita dígito verificador inválido", () => {
    expect(isValidCpf("11122233397")).toBe(false);
    expect(isValidCpf("12345678900")).toBe(false);
  });
});

describe("formatCpf", () => {
  it("formata 11 dígitos no padrão 000.000.000-00", () => {
    expect(formatCpf("12345678909")).toBe("123.456.789-09");
  });
  it("preserva o formato quando já vem pontuado", () => {
    expect(formatCpf("111.222.333-96")).toBe("111.222.333-96");
  });
});
