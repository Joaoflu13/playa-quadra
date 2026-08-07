/**
 * Provisiona um condomínio NOVO em um comando.
 *
 * Faz o mínimo necessário para o app funcionar num banco vazio:
 *  1. Cria todas as áreas (courts) a partir do src/lib/config.ts (AREAS)
 *  2. Cria o singleton de regras (RuleConfig id=1) com os defaults do schema
 *  3. Cria a conta do SÍNDICO (ADMIN) com senha provisória (troca no 1º acesso)
 *
 * Uso (aponte o .env para o banco NOVO do condomínio):
 *   npx tsx scripts/provision.ts --cpf 12345678909 --nome "Nome do Síndico" --senha "SenhaProvisoria"
 *
 * Ou por variáveis de ambiente:
 *   PROVISION_ADMIN_CPF=... PROVISION_ADMIN_NOME=... PROVISION_ADMIN_SENHA=... npx tsx scripts/provision.ts
 *
 * É idempotente: rodar de novo não duplica nada (upsert por id/cpf).
 * NÃO cria dados de demonstração — é para produção de um cliente real.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AREAS, CONDO } from "../src/lib/config";
import { isValidCpf, onlyDigits, formatCpf } from "../src/lib/cpf";

const prisma = new PrismaClient();

/** Lê uma flag --nome do argv ou o fallback de env. */
function arg(flag: string, envKey: string): string {
  const i = process.argv.indexOf(`--${flag}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env[envKey] ?? "";
}

async function main() {
  const cpfRaw = arg("cpf", "PROVISION_ADMIN_CPF");
  const nome = arg("nome", "PROVISION_ADMIN_NOME").trim();
  const senha = arg("senha", "PROVISION_ADMIN_SENHA");

  const cpf = onlyDigits(cpfRaw);
  if (!isValidCpf(cpf)) {
    throw new Error(`CPF do síndico inválido: "${cpfRaw}". Use --cpf <cpf válido>.`);
  }
  if (!nome) throw new Error(`Nome do síndico ausente. Use --nome "Nome Completo".`);
  if (!senha || senha.length < 6) {
    throw new Error(`Senha provisória ausente ou curta (mín. 6). Use --senha "...".`);
  }

  console.log(`\n▶ Provisionando "${CONDO.name}" (${CONDO.location})\n`);

  // 1. Áreas (courts) — a partir do config.ts, então bate com a home e as APIs.
  for (const area of AREAS) {
    await prisma.court.upsert({
      where: { id: area.courtId },
      update: { name: area.title },
      create: { id: area.courtId, name: area.title },
    });
    console.log(`  ✓ Área ${area.courtId.padEnd(8)} ${area.title}`);
  }

  // 2. Regras (singleton) com os defaults do schema.
  await prisma.ruleConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.log(`  ✓ Regras padrão (RuleConfig id=1)`);

  // 3. Conta do síndico (ADMIN). Nasce forçando troca de senha no 1º acesso.
  const passwordHash = await bcrypt.hash(senha, 10);
  await prisma.apartment.upsert({
    where: { cpf },
    update: { label: nome, role: "ADMIN" },
    create: {
      cpf,
      label: nome,
      unit: "Administração",
      passwordHash,
      role: "ADMIN",
      mustChangePassword: true,
      activatedAt: new Date(),
    },
  });
  console.log(`  ✓ Síndico (ADMIN)  CPF ${formatCpf(cpf)}  ${nome}`);

  console.log(
    `\n✅ Pronto. O síndico entra com o CPF e a senha provisória, e o app` +
      ` obriga a criar uma nova senha no primeiro acesso.\n` +
      `⚠️  Não esqueça de rodar prisma/sql/enable-rls.sql no Supabase.\n`
  );
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
