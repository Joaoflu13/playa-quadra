/**
 * Reseta a senha de uma conta (morador ou síndico) pelo CPF.
 *
 * Uso (precisa do .env com DATABASE_URL / DIRECT_URL apontando para o banco):
 *   npx tsx scripts/reset-password.ts <cpf> <novaSenha>
 *
 * Exemplo (síndico/dono):
 *   npx tsx scripts/reset-password.ts 12258809711 MinhaSenhaForte123
 *
 * Observações:
 * - Aceita CPF com ou sem pontuação (mantém só os dígitos).
 * - Marca mustChangePassword=false para a conta entrar direto (útil em demo).
 * - Garante role=ADMIN se você passar a flag --admin.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [, , cpfArg, senha, ...flags] = process.argv;
  if (!cpfArg || !senha) {
    console.error("Uso: npx tsx scripts/reset-password.ts <cpf> <novaSenha> [--admin]");
    process.exit(1);
  }
  const cpf = cpfArg.replace(/\D/g, "");
  const makeAdmin = flags.includes("--admin");

  const apt = await prisma.apartment.findUnique({ where: { cpf } });
  if (!apt) {
    console.error(`Nenhuma conta com CPF ${cpf}. Confira os dígitos.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(senha, 10);
  const updated = await prisma.apartment.update({
    where: { cpf },
    data: {
      passwordHash,
      mustChangePassword: false,
      ...(makeAdmin ? { role: "ADMIN" as const } : {}),
    },
  });

  console.log(`OK: senha redefinida para ${updated.label} (CPF ${cpf}, role ${updated.role}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
