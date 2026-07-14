# Lançamento no condomínio — guia rápido (sem e-mail)

Passo a passo para o síndico colocar o app no ar sem depender de e-mail.
O "esqueci minha senha" fica pelo síndico (ver seção 4).

---

## 1. Preparar a lista de moradores (CSV)

Monte uma planilha com **uma linha por morador**, nesta ordem de colunas:

```
CPF, Nome, Unidade, E-mail (opcional)
```

- **CPF:** com ou sem pontuação (o sistema limpa). É o login.
- **Nome:** nome de exibição do morador.
- **Unidade:** ex. `Bloco A - 101`.
- **E-mail:** pode deixar em branco (não usaremos e-mail neste lançamento).

Exemplo pronto: veja `modelo-import-moradores.csv`.

> Uma linha com CPF inválido ou já cadastrado é simplesmente ignorada — pode
> reimportar a lista sem medo de duplicar.

---

## 2. Importar no painel

1. Entre em `playa-quadra.vercel.app` como **síndico**.
2. **Painel → Importar moradores (CSV)**.
3. Cole o conteúdo do CSV.
4. No campo **senha provisória**, digite **uma senha única para todos**
   (ex.: `playa2026`). Todos serão obrigados a trocá-la no primeiro acesso.
5. Confirme. Pronto — todas as contas nascem ativas.

---

## 3. Comunicado aos moradores

Envie no grupo do condomínio (ajuste a senha provisória que você escolheu):

> 🎾 **Reserva das áreas comuns agora é pelo app!**
>
> Quadra de tênis, mesa de sinuca e sala de pilates: reserve pelo celular.
>
> 👉 Acesse: **playa-quadra.vercel.app**
> • **Login:** seu CPF (só números)
> • **Senha inicial:** `playa2026`
>
> No primeiro acesso o app pede para você **criar sua própria senha**.
>
> Dica: no celular, use "Adicionar à tela de início" para virar um app.
>
> Dúvidas ou esqueceu a senha? Fale com a administração.

---

## 4. Morador esqueceu a senha (fluxo pelo síndico)

Enquanto o e-mail automático não está ligado, o reset é feito pelo síndico:

1. **Painel → localize o morador → Redefinir senha.**
2. Digite uma senha provisória e confirme.
3. O sistema já marca "trocar no próximo acesso".
4. Passe a senha provisória ao morador (WhatsApp/presencial).
5. Ele entra e o app **obriga a criar uma nova senha**.

---

## 5. Quando fechar a venda (futuro)

Para ligar o "esqueci minha senha" automático por e-mail:
1. Registrar um domínio (~R$40/ano no Registro.br).
2. Verificar o domínio na Resend (registros DNS).
3. Definir `EMAIL_FROM` na Vercel com um endereço do domínio + redeploy.

Nada disso bloqueia o lançamento — é melhoria posterior.
