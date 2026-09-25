"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireHost } from "@/server/auth/page-guards";
import { parseIsoDate } from "@/lib/stay-pricing";
import { addBlock, removeBlock } from "@/server/services/availability-service";
import { userMessageFor } from "@/server/services/errors";
import type { ActionState } from "../../../../_components/action-state";

const DAY_MS = 24 * 60 * 60 * 1000;
const path = (id: string) => `/dashboard/host/properties/${id}/availability`;

const blockSchema = z.object({
  roomId: z.string().min(1, "Choose a room type"),
  firstNight: z.string(),
  lastNight: z.string(),
  count: z.coerce.number().int().min(1, "Block at least 1 room").max(500),
  reason: z.string().trim().max(200).optional(),
});

export async function addBlockAction(propertyId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireHost(path(propertyId));
  const parsed = blockSchema.safeParse({
    roomId: formData.get("roomId"),
    firstNight: formData.get("firstNight"),
    lastNight: formData.get("lastNight"),
    count: formData.get("count"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const first = parseIsoDate(parsed.data.firstNight);
  const last = parseIsoDate(parsed.data.lastNight);
  if (!first || !last) return { error: "Choose the first and last night to block." };

  try {
    await addBlock(session.user.id, propertyId, {
      roomId: parsed.data.roomId,
      startDate: first,
      endDate: new Date(last.getTime() + DAY_MS), // stored end is exclusive
      count: parsed.data.count,
      reason: parsed.data.reason,
    });
  } catch (err) {
    return { error: userMessageFor(err, "add-block") };
  }
  revalidatePath(path(propertyId));
  return { error: null, message: "Dates blocked. Travelers can't book those rooms for those nights." };
}

export async function removeBlockAction(propertyId: string, blockId: string): Promise<ActionState> {
  const session = await requireHost(path(propertyId));
  try {
    await removeBlock(session.user.id, propertyId, blockId);
  } catch (err) {
    return { error: userMessageFor(err, "remove-block") };
  }
  revalidatePath(path(propertyId));
  return { error: null };
}
