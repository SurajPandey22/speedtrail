import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { query, initDb } from "@/lib/db";
import bcrypt from "bcryptjs";

const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await initDb();
        const users = await query<{
          id: number; name: string; email: string; password_hash: string;
        }>("SELECT id, name, email, password_hash FROM members WHERE email = $1", [
          credentials.email,
        ]);
        const user = users[0];
        if (!user) return null;
        let valid = false;
        if (!user.password_hash) {
          const newHash = await bcrypt.hash(credentials.password, 10);
          await query("UPDATE members SET password_hash = $1 WHERE id = $2", [newHash, user.id]);
          valid = true;
        } else {
          valid = await bcrypt.compare(credentials.password, user.password_hash);
        }
        
        if (!valid) return null;
        return { id: String(user.id), name: user.name, email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" as const },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET || "speedtrail-dev-secret-change-in-prod",
};

const handler = NextAuth(authOptions as any);
export { handler as GET, handler as POST };
