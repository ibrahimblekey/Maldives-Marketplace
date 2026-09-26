"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import type { ListingReportReason } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/server/auth/rate-limit";
import { submitReport, REPORT_REASON_LABELS } from "@/server/services/moderation-service";
import { userMessageFor } from "@/server/services/errors";
import { notifyReportCreated } from "@/server/email/notifications";
import type { ActionState } from "@/app/dashboard/_components/action-state";

const REASONS = Object.keys(REPORT_REASON_LABELS) as [ListingReportReason, ...ListingReportReason[]];

const reportSchema = z.object({
  reason: z.enum(REASONS, { message: "Choose what's wrong" }),
  details: z
    .string()
    .trim()
    .min(15, "Tell us a little more (at least 15 characters) so our team can check")
    .max(3000, "That's too long (max 3000 characters)"),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.string().email("Enter a valid email, or leave it empty").optional()),
});

/** "Report this listing". Open to everyone, signed in or not; rate-limited in the service. */
export async function reportListingAction(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reportSchema.safeParse({
    reason: formData.get("reason"),
    details: formData.get("details") ?? "",
    email: formData.get("email") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const session = await auth();
  let reportId: string;
  try {
    const report = await submitReport({
      propertySlug: slug,
      reason: parsed.data.reason,
      details: parsed.data.details,
      reporterUserId: session?.user?.id,
      reporterEmail: parsed.data.email,
      ipAddress: getClientIp(await headers()),
    });
    reportId = report.id;
  } catch (err) {
    return { error: userMessageFor(err, "report-listing") };
  }
  after(() => notifyReportCreated(reportId));
  return { error: null, message: "Thank you. Our team has been alerted and will look into this listing." };
}
