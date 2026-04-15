import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import { verifyCode } from "./send-code";
import { isWorkEmail } from "./auth-constants";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = ((credentials?.email as string) ?? "").toLowerCase().trim();
        const code = (credentials?.code as string) ?? "";

        if (!email || !code) return null;
        if (!isWorkEmail(email)) return null;

        // Verify the magic login code
        const result = await verifyCode(email, code, "magic-login");
        if (!result.success) return null;

        // Find or create user — any verified @timeproofusa.com email gets in
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: email.split("@")[0],
              role: "REP",
            },
          });
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session !== undefined) {
        if (session.name !== undefined) token.name = session.name;
      }
      if (user) {
        token.id = user.id;
        token.email = user.email;
        // Fetch role from DB so it's available in middleware
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      if (session.user && token.email) session.user.email = token.email as string;
      if (session.user && token.name) session.user.name = token.name as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (session.user && token.role) (session.user as any).role = token.role as string;
      return session;
    },
  },
});
