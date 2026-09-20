import { handlers } from "@/lib/auth";

// Auth.js's catch-all route: handles /api/auth/signin, /callback,
// /session, /signout, /csrf, etc.
export const { GET, POST } = handlers;
