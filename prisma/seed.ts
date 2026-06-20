import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Gera um CPF válido a partir de uma base de 9 dígitos (calcula os 2 dígitos
// verificadores). Usado só para popular dados de teste.
function cpfFromBase(base9: string): string {
  const calc = (slice: number, digits: string) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += Number(digits[i]) * (slice + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = calc(9, base9);
  const d2 = calc(10, base9 + d1);
  return base9 + String(d1) + String(d2);
}

async function main() {
  await prisma.court.upsert({
    where: { id: "court-1" },
    update: {},
    create: { id: "court-1", name: "Quadra de Tênis" },
  });

  // Config singleton (usa os defaults atuais do schema: 8h–22h, 24h, etc.).
  await prisma.ruleConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const hash = await bcrypt.hash("trocar123", 10);

  const people = [
    { base: "100200300", label: "Síndico", unit: "Administração", role: "ADMIN" as const },
    { base: "111222333", label: "João Silva", unit: "Bloco A - 101", role: "RESIDENT" as const },
    { base: "444555666", label: "Maria Souza", unit: "Bloco A - 304", role: "RESIDENT" as const },
    { base: "777888999", label: "Carlos Lima", unit: "Bloco B - 502", role: "RESIDENT" as const },
  ];

  for (const p of people) {
    const cpf = cpfFromBase(p.base);
    const email =
      p.label.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/\.$/, "") + "@playadelmago.com";
    await prisma.apartment.upsert({
      where: { cpf },
      update: {},
      create: { cpf, label: p.label, unit: p.unit, email, passwordHash: hash, role: p.role },
    });
    console.log(`  ${p.role.padEnd(8)} CPF ${cpf}  ${p.label}`);
  }

  console.log("Seed concluído. Senha inicial de todos: trocar123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
