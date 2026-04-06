import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import { isDeviceTrusted } from "./device";
import { sendVerificationCode } from "./send-code";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        deviceToken: { label: "Device Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!valid) return null;

        // Check if device is already trusted
        const trusted = await isDeviceTrusted(
          user.id,
          credentials.deviceToken as string | undefined
        );

        if (trusted) {
          return { id: user.id, email: user.email, name: user.name ?? undefined };
        }

        // New device — send 2FA code and flag session
        try {
          await sendVerificationCode(user.email!, "2fa");
        } catch {
          // If email fails, deny login rather than silently skip 2FA
          return null;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          requires2FA: true,
        } as any;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user, trigger, session }) {
      // Session update — allow clearing requires2FA after verification
      if (trigger === "update" && session !== undefined) {
        if (session.requires2FA === false) {
          token.requires2FA = false;
        }
        if (session.name !== undefined) {
          token.name = session.name;
        }
      }
      if (user) {
        token.id = user.id;
        token.email = user.email;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.requires2FA = (user as any).requires2FA ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      if (session.user && token.name) {
        session.user.name = token.name as string;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).requires2FA = token.requires2FA ?? false;
      return session;
    },
  },
});
