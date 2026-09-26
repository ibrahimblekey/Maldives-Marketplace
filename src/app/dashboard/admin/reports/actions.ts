"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/page-guards";
import { resolveReport } from "@/server/services/moderation-service";
import { userMessageFor } from "@/server/services/errors";
import type { ActionState } from "../../_components/action-state";

export async function closeReportAction(reportId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin("/dashboard/admin/reports");
  const outcome = formData.get("outcome");
  if (outcome !== "RESOLVED" && outcome !== "DISMISSED") return { error: "Choose what you did." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  try {
    await resolveReport(session.user.id, reportId, outcome, note);
  } catch (err) {
    return { error: userMessageFor(err, "close-report") };
  }
  revalidatePath("/dashboard/admin", "layout");
  return { error: null, message: "Report closed." };
}
