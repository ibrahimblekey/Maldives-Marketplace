"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/page-guards";
import { generateStatements, markStatementPaid, parseBillableMonth } from "@/server/services/commission-service";
import { userMessageFor } from "@/server/services/errors";
import type { ActionState } from "../../_components/action-state";

const PATH = "/dashboard/admin/statements";

export async function generateStatementsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin(PATH);
  const month = parseBillableMonth(String(formData.get("month") ?? ""));
  if (!month) return { error: "Choose a month that has already ended." };
  try {
    const { created, skipped } = await generateStatements(session.user.id, month);
    revalidatePath(PATH, "layout");
    return {
      error: null,
      message:
        created === 0
          ? "No new statements: there are no completed, unbilled stays up to that month."
          : `Created ${created} statement${created === 1 ? "" : "s"}.${skipped ? ` ${skipped} host(s) already had one for that month; their newer stays go on next month's.` : ""}`,
    };
  } catch (err) {
    return { error: userMessageFor(err, "generate-statements") };
  }
}

export async function markStatementPaidAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin(`${PATH}/${id}`);
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  try {
    await markStatementPaid(session.user.id, id, note);
  } catch (err) {
    return { error: userMessageFor(err, "mark-statement-paid") };
  }
  revalidatePath(PATH, "layout");
  return { error: null, message: "Marked as paid. If the host's listings were hidden for non-payment, they're visible again." };
}
