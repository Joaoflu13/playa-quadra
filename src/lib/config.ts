/**
 * Configuração do condomínio — único arquivo a editar para adaptar o app
 * a um novo cliente. Troque nome, localização, short name e a lista de áreas.
 */

export const CONDO = {
  name: "Playa del Mago",
  location: "Barra da Tijuca",
  shortName: "Reservas Playa",
};

export type AreaConfig = {
  courtId: string;
  title: string;
  allowMatch: boolean;
  capacity?: number;
  openHour?: number;
  closeHour?: number;
  photo: {
    src: string;
    alt: string;
    objectPosition?: string;
  };
};

/**
 * Áreas de lazer do condomínio.
 * Cada entrada vira uma seção na página inicial e uma área reservável no banco.
 * - `capacity`: vagas simultâneas por horário (default 1)
 * - `openHour`/`closeHour`: janela própria (default = regra global do síndico)
 * - `allowMatch`: liga o "procurar parceiro" (faz sentido só para esportes 1x1)
 */
export const AREAS: AreaConfig[] = [
  {
    courtId: "court-1",
    title: "Quadra de Tênis",
    allowMatch: true,
    photo: {
      src: "/quadra.jpg",
      alt: `Quadra de tênis do ${CONDO.name}`,
      objectPosition: "center 82%",
    },
  },
  {
    courtId: "court-2",
    title: "Mesa de Sinuca",
    allowMatch: false,
    photo: {
      src: "/sinuca.jpg",
      alt: `Mesa de sinuca do ${CONDO.name}`,
      objectPosition: "center 55%",
    },
  },
  {
    courtId: "court-3",
    title: "Sala de Pilates",
    allowMatch: false,
    capacity: 2,
    openHour: 5,
    closeHour: 24,
    photo: {
      src: "/pilates.jpg",
      alt: `Sala de pilates do ${CONDO.name}`,
      objectPosition: "center 42%",
    },
  },
];
