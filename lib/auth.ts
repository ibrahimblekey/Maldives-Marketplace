import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import { assertNotRateLimited, getClientIp, recordLoginAttempt } from "@/server/auth/rate-limit";

/**
 * Auth.js (NextAuth) configuration.
 *
 * Session strategy: JWT. Auth.js's Credentials provider only supports JWT
 * sessions (database sessions require a provider that doesn't need a
 * client-side secret check on every request). The `Session`/`Account`
 * tables in the schema stay unused for now — they're what a future
 * Google/Apple OAuth provider would use, added by registering another
 * provider here plus a Prisma adapter, without touching anything else.
 *
 * The JWT/session callbacks below are what carry the user's role and id
 * onto every request — this is the piece that makes role-based route
 * protection possible without a database lookup on every page load.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;
        const ipAddress = getClientIp(request.headers);

        // Throws RateLimitError (a CredentialsSignin subclass) when tripped.
        // Left to propagate — Auth.js catches it and surfaces its `code` on
        // the client's signIn() result; see the login page.
        await assertNotRateLimited(email, ipAddress);

        const user = await prisma.user.findUnique({ where: { email } });

        // Same failure path whether the account doesn't exist, has no
        // password (OAuth-only account), is deactivated, or the password is
        // wrong — never reveal which case it was.
        const isValid =
          user?.passwordHash && user.isActive
            ? await bcrypt.compare(password, user.passwordHash)
            : false;

        await recordLoginAttempt({
          email,
          ipAddress,
          success: isValid,
          userId: user?.id,
        });

        if (!isValid || !user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only defined right after sign-in; persist what we need
      // onto the token so subsequent requests don't hit the database.
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
