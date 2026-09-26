import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { autoCompletePastStays } from "@/server/services/booking-service";
import { sendDailyReminders } from "@/server/email/notifications";

/**
 * Daily job, called by Vercel Cron (schedule in vercel.json).
 *
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET
 * environment variable is set; anything else is refused, so nobody else
 * can trigger mass reminder emails. Safe to run more than once a day:
 * auto-completing is idempotent and each reminder is sent at most once.
 */
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const completed = await autoCompletePastStays();
  const reminders = await sendDailyReminders();
  return NextResponse.json({ ok: true, completed, reminders });
}
