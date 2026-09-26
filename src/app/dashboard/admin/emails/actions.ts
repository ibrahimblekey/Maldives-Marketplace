"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/page-guards";
import { sendTestEmail } from "@/server/email/notifications";
import { prisma } from "@/lib/db";
import type { ActionState } from "../../_components/action-state";

const MESSAGES = {
  SENT: "Sent! Check your inbox (and the spam folder) in a minute.",
  SKIPPED: "Not sent: email isn't set up yet. Add RESEND_API_KEY in Vercel, then redeploy.",
  FAILED: "Sending failed. See the error in the list below.",
  DUPLICATE: "Already sent.",
} as const;

/** Sends a test email to the signed-in admin's own address. */
export async function sendTestEmailAction(): Promise<ActionState> {
  const session = await requireAdmin("/dashboard/admin/emails");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
  if (!user) return { error: "Account not found." };
  const result = await sendTestEmail(user.email);
  revalidatePath("/dashboard/admin/emails");
  return result === "SENT" ? { error: null, message: MESSAGES.SENT } : { error: MESSAGES[result] };
}
