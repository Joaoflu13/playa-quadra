// Auth.js (NextAuth v5). Login por e-mail+senha, 1 conta por apartamento.
// Sessão JWT -> não precisa de adapter/tabelas de sessão no MVP.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { onlyDigits } from "@/lib/cpf";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { cpf: {}, password: {} },
      authorize: async (creds) => {
        const cpf = onlyDigits(String(creds?.cpf ?? ""));
        const password = String(creds?.password ?? "");
        if (!cpf || !password) return null;

        const apt = await prisma.apartment.findUnique({ where: { cpf } });
        if (!apt) return null;

        const ok = await bcrypt.compare(password, apt.passwordHash);
        if (!ok) return null;

        // O "name" exibido é o nome do morador.
        return { id: apt.id, email: apt.email ?? undefined, name: apt.label, role: apt.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.aptId = (user as { id: string }).id;
        token.role = (user as { role?: string }).role ?? "RESIDENT";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.aptId = token.aptId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});

// types/next-auth.d.ts (criar separadamente) para tipar aptId/role:
//
// import "next-auth";
// declare module "next-auth" {
//   interface Session { user: { aptId: string; role: string } & DefaultSession["user"] }
//   interface User { role?: string }
// }
