import { CredentialsSignin } from "next-auth";
import { prisma } from "@/lib/db";

/**
 * Authentication rate limiting.
 *
 * MVP implementation: backed by the LoginAttempt table (already written on
 * every login/registration attempt for audit purposes), so no extra
 * infrastructure is needed to ship this. It checks attempts within a
 * rolling window, keyed by IP and by email independently — either one
 * tripping the limit blocks the request.
 *
 * Known limitation: this does one or two extra database round-trips per
 * auth request. That's fine at MVP scale. If the app ever runs across many
 * server instances behind a load balancer with high auth traffic, swap this
 * for a Redis-backed limiter (e.g. Upstash) with the same function
 * signature — nothing calling this module needs to change.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 20;

/**
 * Extends Auth.js's CredentialsSignin (rather than plain Error) so that when
 * this is thrown from inside `authorize()` in src/lib/auth.ts, Auth.js
 * surfaces it as a distinct, checkable `code` on the client's signIn()
 * result — see the login page, which checks this code to show "too many
 * attempts" instead of the generic "invalid email or password". A plain
 * Error thrown from authorize() does not carry a stable, checkable code.
 */
export class RateLimitError extends CredentialsSignin {
  code = "rate_limited";
  constructor(message = "Too many attempts. Please try again later.") {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function assertNotRateLimited(email: string, ipAddress: string) {
  const since = new Date(Date.now() - WINDOW_MS);

  const [emailAttempts, ipAttempts] = await Promise.all([
    prisma.loginAttempt.count({
      where: { email, success: false, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { ipAddress, success: false, createdAt: { gte: since } },
    }),
  ]);

  if (emailAttempts >= MAX_ATTEMPTS_PER_EMAIL) {
    throw new RateLimitError(
      "Too many failed attempts for this account. Please try again in 15 minutes."
    );
  }

  if (ipAttempts >= MAX_ATTEMPTS_PER_IP) {
    throw new RateLimitError("Too many attempts from this network. Please try again in 15 minutes.");
  }
}

export async function recordLoginAttempt(params: {
  email: string;
  ipAddress: string;
  success: boolean;
  userId?: string;
}) {
  await prisma.loginAttempt.create({
    data: {
      email: params.email,
      ipAddress: params.ipAddress,
      success: params.success,
      userId: params.userId,
    },
  });
}

/**
 * Best-effort client IP extraction behind a proxy/load balancer.
 * `x-forwarded-for` can be spoofed by the client if the app isn't actually
 * behind a trusted proxy — in production, configure your host/proxy to
 * strip or overwrite this header before it reaches the app.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}
