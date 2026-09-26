import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Sends one email through Resend (https://resend.com) and records it in
 * EmailLog.
 *
 * Rules:
 * - Never throws. Email is a side effect: a failed email must never undo or
 *   block the booking/approval that triggered it. Failures are logged.
 * - Not configured (no RESEND_API_KEY)? The email is recorded as SKIPPED and,
 *   in development, printed to the server console instead.
 * - `dedupeKey` makes an email send at most once, ever (used by the daily
 *   reminders so a re-run of the job can't email someone twice).
 *
 * Settings (Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY  the API key from Resend
 *   EMAIL_FROM      e.g. "Maldives Marketplace <bookings@your-domain.com>".
 *                   Until you verify a domain in Resend, leave it unset: the
 *                   default Resend test sender only delivers to the email
 *                   address you signed up to Resend with.
 */

const DEFAULT_FROM = "Maldives Marketplace <onboarding@resend.dev>";
const RESEND_URL = "https://api.resend.com/emails";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  replyTo?: string;
  dedupeKey?: string;
  related?: { type: string; id: string };
};

export type SendResult = "SENT" | "FAILED" | "SKIPPED" | "DUPLICATE";

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  // Common case for daily reminders: already sent on an earlier run.
  if (email.dedupeKey) {
    const existing = await prisma.emailLog
      .findUnique({ where: { dedupeKey: email.dedupeKey }, select: { id: true } })
      .catch(() => null);
    if (existing) return "DUPLICATE";
  }

  let logId: string;
  try {
    const log = await prisma.emailLog.create({
      data: {
        toEmail: email.to,
        template: email.template,
        subject: email.subject,
        dedupeKey: email.dedupeKey ?? null,
        relatedEntityType: email.related?.type ?? null,
        relatedEntityId: email.related?.id ?? null,
      },
    });
    logId = log.id;
  } catch (err) {
    // Two runs racing on the same reminder: the unique dedupeKey lets only one through.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return "DUPLICATE";
    console.error("[email] could not record email:", err);
    return "FAILED";
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[email] (not sent: RESEND_API_KEY not set) to=${email.to} subject="${email.subject}"\n${email.text}\n`);
    }
    await prisma.emailLog.update({
      where: { id: logId },
      data: { status: "SKIPPED", error: "Email isn't set up yet (RESEND_API_KEY is missing)." },
    });
    return "SKIPPED";
  }

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Resend ignores a repeated request with the same key, so a retry can't double-send.
        "Idempotency-Key": logId,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) throw new Error(`Resend ${response.status}: ${body.message ?? "unknown error"}`);

    await prisma.emailLog.update({ where: { id: logId }, data: { status: "SENT", providerId: body.id ?? null } });
    return "SENT";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] failed to send "${email.subject}" to ${email.to}:`, message);
    await prisma.emailLog
      .update({ where: { id: logId }, data: { status: "FAILED", error: message.slice(0, 500) } })
      .catch(() => undefined);
    return "FAILED";
  }
}
