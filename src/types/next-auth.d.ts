import type { DefaultSession } from "next-auth";

// Extends Auth.js's built-in types so `session.user.id` / `.role` and
// `token.role` are known to TypeScript everywhere in the app, instead of
// requiring an `as` cast at every call site.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
