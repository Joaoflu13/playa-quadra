"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { onlyDigits, isValidCpf } from "@/lib/cpf";
import { cleanUnit } from "@/lib/availability";

/**
 * Normaliza unidade para comparação tolerante: remove "Bloco X", acentos,
 * espaços e pontuação. "Bloco A - 304" == "bloco a 304" == "304".
 */
function norm(s: string): string {
  return cleanUnit(s)
    .normalize("NFD") // separa acentos (ã -> a + diacrítico)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // mantém só letras/números (tira acento, espaço, pontuação)
}

/**
 * Auto-ativação (Opção B): o morador pré-autorizado cria a própria senha.
 * Só ativa contas que existem (CPF na lista do síndico) e que ainda NÃO foram
 * ativadas (activatedAt == null). Identidade conferida por CPF + unidade.
 */
export async function activateAccount(form: FormData) {
  const cpf = onlyDigits(String(form.get("cpf") ?? ""));
  const unit = String(form.get("unit") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (!isValidCpf(cpf)) redirect("/ativar?status=invalid");
  if (next.length < 6) redirect("/ativar?status=short");
  if (next !== confirm) redirect("/ativar?status=mismatch");

  const apt = await prisma.apartment.findUnique({ where: { cpf } });

  // Anti-enumeração: CPF inexistente e unidade errada dão a mesma mensagem.
  if (!apt || norm(apt.unit) !== norm(unit)) {
    redirect("/ativar?status=nomatch");
  }
  // Já ativada: não deixa um terceiro "reativar" (resetar) a conta.
  if (apt.activatedAt) {
    redirect("/ativar?status=already");
  }

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.apartment.update({
    where: { id: apt.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      activatedAt: new Date(),
      status: "ACTIVE",
    },
  });

  redirect("/login?activated=1");
}
