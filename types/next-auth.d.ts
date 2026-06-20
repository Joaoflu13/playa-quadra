import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      aptId: string;
      role: string;
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    aptId?: string;
    role?: string;
  }
}
