import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// CPFs dos moradores semeados em seed.ts (já com dígitos verificadores).
const JOAO = "11122233396";
const MARIA = "44455566619";
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
  const [joao, maria, carlos] = await Promise.all([
    prisma.apartment.findUnique({ where: { cpf: JOAO } }),
    prisma.apartment.findUnique({ where: { cpf: MARIA } }),
    prisma.apartment.findUnique({ where: { cpf: CARLOS } }),
  ]);
  if (!joao || !maria || !carlos) {
    console.error("Rode antes: npm run db:seed");
    process.exit(1);
  }

  const dia = tomorrowSP();
  const at = (h: number) => new Date(`${dia}T${String(h).padStart(2, "0")}:00:00-03:00`);

  // Limpa reservas futuras para o demo ficar previsível.
  await prisma.booking.deleteMany({ where: { startAt: { gt: new Date() } } });
  await prisma.notification.deleteMany({});

  // Maria reservou 19h (horário ocupado comum).
  await prisma.booking.create({
    data: { courtId: "court-1", aptId: maria.id, startAt: at(19), endAt: at(20) },
  });

  // João reservou 20h e abriu "procuro parceiros".
  const joaoBk = await prisma.booking.create({
    data: {
      courtId: "court-1",
      aptId: joao.id,
      startAt: at(20),
      endAt: at(21),
      openForPlayers: true,
    },
  });

  // Carlos sinalizou interesse -> gera notificação para o João.
  await prisma.joinInterest.create({ data: { bookingId: joaoBk.id, aptId: carlos.id } });
  await prisma.notification.create({
    data: {
      aptId: joao.id,
      type: "INTEREST",
      bookingId: joaoBk.id,
      message: `${carlos.label} (${carlos.unit}) tem interesse em jogar no seu horário de ${fmt(at(20))}.`,
    },
  });

  console.log("Demo populado para", dia, "— Maria 19h, João 20h (aberto), interesse de Carlos + notificação.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
