// Envio de e-mail via Resend (https://resend.com) usando fetch — sem SDK.
// Se RESEND_API_KEY não estiver definido, faz fallback para console.log,
// então o app funciona em dev sem configurar e-mail.

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "Quadra <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

type Mail = { to: string; subject: string; html: string };

async function send({ to, subject, html }: Mail): Promise<void> {
  if (!API_KEY) {
    console.log(`[mail:fallback] para=${to} assunto="${subject}" (defina RESEND_API_KEY para enviar de verdade)`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[mail] falha", res.status, await res.text());
    }
  } catch (e) {
    console.error("[mail] erro de rede", e);
  }
}

function fmt(start: Date, end: Date): string {
  const dia = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(start);
  const hora = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  return `${dia}, das ${hora(start)} às ${hora(end)}`;
}

function shell(title: string, body: string): string {
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
    <h2 style="color:#16a34a">${title}</h2>
    ${body}
    <p style="margin-top:24px"><a href="${APP_URL}" style="color:#16a34a">Abrir o sistema de reservas</a></p>
    <p style="font-size:12px;color:#94a3b8">Quadra de Tênis do condomínio</p>
  </div>`;
}

export async function sendBookingConfirmation(to: string, label: string, start: Date, end: Date) {
  await send({
    to,
    subject: "Reserva confirmada — Quadra de Tênis",
    html: shell(
      "Reserva confirmada ✅",
      `<p>Olá, <strong>${label}</strong>!</p>
       <p>Sua reserva da quadra está confirmada para:</p>
       <p style="font-size:18px"><strong>${fmt(start, end)}</strong></p>`
    ),
  });
}

export async function sendPasswordReset(to: string, label: string, url: string) {
  await send({
    to,
    subject: "Redefinição de senha — Quadra de Tênis",
    html: shell(
      "Redefinir senha 🔑",
      `<p>Olá, <strong>${label}</strong>!</p>
       <p>Recebemos um pedido para redefinir sua senha. Clique no botão abaixo
       (o link expira em 1 hora):</p>
       <p style="margin:20px 0">
         <a href="${url}" style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Criar nova senha</a>
       </p>
       <p style="font-size:13px;color:#94a3b8">Se não foi você, ignore este e-mail.</p>`
    ),
  });
}

export async function sendInterestNotice(
  to: string,
  ownerLabel: string,
  interestedName: string,
  start: Date,
  end: Date
) {
  await send({
    to,
    subject: "Alguém quer jogar no seu horário — Quadra de Tênis",
    html: shell(
      "Tem gente a fim de jogar 🎾",
      `<p>Olá, <strong>${ownerLabel}</strong>!</p>
       <p><strong>${interestedName}</strong> sinalizou interesse em jogar na sua reserva de:</p>
       <p style="font-size:18px"><strong>${fmt(start, end)}</strong></p>
       <p>Combine com ele(a) pelo condomínio se quiser dividir a quadra.</p>`
    ),
  });
}

export async function sendBookingReminder(to: string, label: string, start: Date, end: Date) {
  await send({
    to,
    subject: "Lembrete — sua reserva da quadra é em breve",
    html: shell(
      "Lembrete de reserva ⏰",
      `<p>Olá, <strong>${label}</strong>!</p>
       <p>Não esqueça: você tem a quadra reservada para:</p>
       <p style="font-size:18px"><strong>${fmt(start, end)}</strong></p>
       <p>Se não puder ir, cancele para liberar o horário aos vizinhos.</p>`
    ),
  });
}
