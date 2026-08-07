# Kit de Prospecção — como conseguir as primeiras reuniões

Objetivo: sair de 0 clientes marcando reuniões/demos. Duas frentes:
**síndico** (venda direta, vira case) e **administradora** (canal que multiplica).

Regra de ouro: **a demo ao vivo vende, não o texto.** As mensagens abaixo servem
só para conseguir 15 minutos de atenção. O fechamento acontece na demo.

---

## 1. Como demonstrar (mesmo sem um condomínio ativo)

O app já roda em `playa-quadra.vercel.app`. Para uma demo forte:

1. Popular com dados de exemplo: `npm run db:seed:demo`.
2. No celular, mostrar em ~3 minutos:
   - a **home** com as áreas (foto bonita, cara de app pronto);
   - **reservar** um horário → confirmação;
   - **cancelar** → grade atualiza sozinha;
   - **quem marcou** (nome + unidade);
   - **painel do síndico**: relatório de uso, cadastro, bloqueio por falta.
3. Frase de efeito: *"Isso não é protótipo — está no ar e funcionando. Seu
   condomínio teria a mesma coisa com o nome e as áreas de vocês em uma semana."*

---

## 2. Roteiro de demo (3 minutos)

1. **Problema (15s):** "Hoje a quadra/salão é marcado no grupo de WhatsApp,
   dá confusão, gente que falta e não avisa, e sobra pro síndico apagar incêndio."
2. **Solução (30s):** "Cada morador loga com o CPF e reserva pelo celular, com
   regras automáticas. Olha aqui." → **demonstra reservar**.
3. **Para o morador (45s):** ver a grade, quem marcou, procurar parceiro,
   notificação. → **demonstra cancelar e a grade atualizando**.
4. **Para o síndico (45s):** → **abre o painel**: relatório de uso, bloqueio por
   falta, cadastro em massa por CSV.
5. **Fecho (30s):** "Roda 100% na nuvem, zero instalação pro condomínio. Custa
   R$ 395/mês pra três áreas — menos de R$ 2,50 por apartamento. Topa um piloto
   de 30 dias grátis pra vocês sentirem?"

O **piloto de 30 dias grátis** derruba quase toda objeção. Use-o.

---

## 3. Mensagens prontas

### 3a. WhatsApp para SÍNDICO (curto, direto)

> Oi, [Nome]! Tudo bem? Sou o [seu nome], moro/trabalho aqui na região.
> Criei um sisteminha que resolve a bagunça de reservar quadra/salão/áreas
> comuns — cada morador reserva pelo celular com o CPF, com regras automáticas
> (limite, antecedência, bloqueio por falta). Já está no ar e funcionando.
> Posso te mostrar em 3 minutos numa call ou pessoalmente? Tem um piloto de
> 30 dias grátis pro condomínio testar sem compromisso.

### 3b. E-mail para SÍNDICO

> **Assunto:** Reserva das áreas comuns do [Condomínio] pelo celular — piloto grátis
>
> Olá, [Nome],
>
> As áreas comuns (quadra, salão, churrasqueira) costumam ser reservadas no
> grupo de WhatsApp ou num caderno — o que gera confusão, faltas sem
> consequência e trabalho extra pra administração.
>
> Desenvolvi um sistema onde **cada morador reserva pelo celular, logando com o
> CPF**, com regras automáticas (limite de reservas, antecedência, bloqueio por
> falta) e um painel de gestão pro síndico. **Já está em produção e funcionando.**
>
> Posso mostrar em uma demo de 3 minutos, e ofereço um **piloto de 30 dias
> grátis** para o condomínio experimentar sem compromisso.
>
> Qual seria um bom horário esta semana?
>
> Abraço,
> [seu nome] · [telefone]

### 3c. Mensagem para ADMINISTRADORA (canal — foco em escala)

> Olá, [Nome/Empresa]! Sou o [seu nome], desenvolvi um sistema de reserva de
> áreas comuns (quadra, salão, churrasqueira, etc.) que os condomínios de vocês
> poderiam oferecer aos moradores: reserva pelo celular por CPF, regras
> automáticas e painel de gestão. Já está em produção.
>
> Faria sentido conversarmos sobre oferecer isso à carteira de vocês? Posso
> mostrar em 15 min e desenhar um modelo de parceria (vocês agregam valor aos
> condomínios, eu cuido de toda a operação técnica). Tem um piloto grátis pra
> começar por um prédio.

---

## 4. Objeções comuns (e respostas)

| Objeção | Resposta |
|---|---|
| "É seguro? E os dados dos moradores?" | Cada morador tem login próprio por CPF, senha criptografada, e o banco tem controle de acesso (RLS). Segue a LGPD: nome de quem reservou só aparece pra quem tem direito. |
| "E se ninguém usar?" | Por isso o piloto de 30 dias grátis. Se o engajamento não vier, não custou nada. Na prática, reserva pelo celular é mais fácil que o grupo de WhatsApp. |
| "O condomínio vai ter que instalar/manter servidor?" | Zero. Roda 100% na nuvem. Vocês não instalam nada; é só um link/app no celular. |
| "Quem dá suporte?" | Eu. Manutenção, correções, ajuste de regras e suporte ao síndico estão inclusos na mensalidade. |
| "Está caro?" | Menos de R$ 2,50 por apartamento/mês — cerca de R$ 30 por apartamento no ano. Menos que um cafezinho por mês pra acabar com a confusão das reservas. |
| "Já temos um grupo de WhatsApp." | O grupo não impede reserva dupla, não registra falta, não gera relatório e vira bagunça. O sistema faz tudo isso sozinho. |

---

## 5. Onde encontrar alvos

- **Seu próprio prédio e vizinhos** — comece pelo que você conhece (indicação vale ouro).
- **Grupos de síndicos** no Facebook/WhatsApp (ex.: "Síndicos RJ", "Síndicos Barra da Tijuca").
- **Administradoras de condomínio** da região (busca no Google Maps por "administradora de condomínios [bairro]"). Priorize as que gerenciam muitos prédios.
- **Indicações:** todo síndico conhece outros síndicos. Peça sempre.
- **Feiras/eventos** do setor condominial (ex.: eventos de síndicos profissionais).

---

## 6. Metas simples para as primeiras semanas

1. Falar com **10 síndicos/administradoras** (mensagens acima).
2. Marcar **3 demos**.
3. Fechar **1 piloto grátis** — esse vira seu case e destrava os próximos.
