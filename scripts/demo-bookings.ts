/**
 * Popula a grade com reservas de demonstração SEM apagar nada.
 * (Diferente de `db:seed:demo`, que apaga TODAS as reservas futuras e notificações.)
 *
 * Cria, para AMANHÃ (horário de São Paulo):
 *   - Maria  19h  (horário ocupado comum)
 *   - João   20h  (aberto: "procuro parceiros")
 *   - Carlos sinaliza interesse no horário do João -> gera notificação p/ o João
 *
 * Uso:
 *   npx tsx scripts/demo-bookings.ts            # cria as reservas de demo
 *   npx tsx scripts/demo-bookings.ts --undo     # remove SOMENTE essas reservas de demo
 *
 * Se algum horário já estiver ocupado, ele pula (não sobrescreve reserva real).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// CPFs dos moradores demo (já com dígitos verificadores). Ajuste se quiser outros.
const MARIA = "44455566619";
const JOAO = "11122233396";
const CARLOS = "77788899941";

function tomorrowSP(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

async function main() {
  const undo = process.argv.includes("--undo");
  const dia = tomorrowSP();
  const at = (h: number) => new Date(`${dia}T${String(h).padStart(2, "0")}:00:00-03:00`);

  const [maria, joao, carlos] = await Promise.all([
    prisma.apartment.findUnique({ where: { cpf: MARIA } }),
    prisma.apartment.findUnique({ where: { cpf: JOAO } }),
    prisma.apartment.findUnique({ where: { cpf: CARLOS } }),
  ]);
  if (!maria || !joao || !carlos) {
    console.error("Moradores demo não encontrados. Rode antes: npm run db:seed (em banco de demo).");
    process.exit(1);
  }

  if (undo) {
    // Remove só as reservas demo desses horários/donos.
    await prisma.booking.deleteMany({
      where: {
        courtId: "court-1",
        startAt: { in: [at(19), at(20)] },
        aptId: { in: [maria.id, joao.id] },
      },
    });
    console.log(`Reservas de demo removidas (${dia} 19h/20h).`);
    return;
  }

  // 1) Maria 19h — pula se o slot já estiver ocupado.
  const slot19 = await prisma.booking.findFirst({
    where: { courtId: "court-1", startAt: at(19), status: "CONFIRMED" },
  });
  if (!slot19) {
    await prisma.booking.create({
      data: { courtId: "court-1", aptId: maria.id, startAt: at(19), endAt: at(20) },
    });
  }

  // 2) João 20h aberto p/ parceiros — pula se já ocupado.
  let joaoBk = await prisma.booking.findFirst({
    where: { courtId: "court-1", startAt: at(20), status: "CONFIRMED" },
  });
  if (!joaoBk) {
    joaoBk = await prisma.booking.create({
      data: {
        courtId: "court-1",
        aptId: joao.id,
        startAt: at(20),
        endAt: at(21),
        openForPlayers: true,
      },
    });
    // 3) Carlos demonstra interesse + notificação p/ João.
    await prisma.joinInterest.create({ data: { bookingId: joaoBk.id, aptId: carlos.id } });
    await prisma.notification.create({
      data: {
        aptId: joao.id,
        type: "INTEREST",
        bookingId: joaoBk.id,
        message: `${carlos.label} (${carlos.unit}) tem interesse em jogar no seu horário de ${fmt(at(20))}.`,
      },
    });
  }

  console.log(`Demo criado para ${dia}: Maria 19h, João 20h (aberto) + interesse do Carlos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
