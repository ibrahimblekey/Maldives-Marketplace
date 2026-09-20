"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, ForbiddenError, UnauthenticatedError } from "@/server/auth/authorize";
import { atollInputSchema, islandInputSchema } from "@/lib/validation/location";
import * as locationService from "@/server/services/location-service";

/**
 * Server actions backing the admin Locations screens.
 *
 * Every action re-checks the caller's role itself with requireRole() — it
 * does NOT rely on the admin section already being behind
 * /dashboard/admin's page-level check, because a server action can be
 * invoked directly (not just by rendering that page). This is the same
 * "don't rely only on middleware/page checks" rule already applied to the
 * registration API route.
 */

export type ActionState = { error: string | null };

const LOCATIONS_PATH = "/dashboard/admin/locations";

/** Maps a thrown error from the service layer to a message safe to show an admin. */
function messageFor(err: unknown): string {
  if (
    err instanceof locationService.NotFoundError ||
    err instanceof locationService.DuplicateNameError ||
    err instanceof locationService.HasDependentsError ||
    err instanceof locationService.NoCountryConfiguredError
  ) {
    return err.message;
  }
  // Anything else is unexpected — log it server-side, but don't leak
  // internals (stack traces, SQL, etc.) to the admin UI.
  console.error("[locations/actions] unexpected error:", err);
  return "Something went wrong. Please try again.";
}

async function assertAdmin() {
  try {
    await requireRole(["ADMIN", "SUPER_ADMIN"]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login?callbackUrl=" + LOCATIONS_PATH);
    if (err instanceof ForbiddenError) redirect("/dashboard");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Atolls
// ---------------------------------------------------------------------------

export async function createAtollAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const parsed = atollInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await locationService.createAtoll(parsed.data);
  } catch (err) {
    return { error: messageFor(err) };
  }

  revalidatePath(LOCATIONS_PATH);
  redirect(LOCATIONS_PATH);
}

export async function updateAtollAction(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const parsed = atollInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await locationService.updateAtoll(id, parsed.data);
  } catch (err) {
    return { error: messageFor(err) };
  }

  revalidatePath(LOCATIONS_PATH);
  redirect(LOCATIONS_PATH);
}

export async function deleteAtollAction(
  id: string,
  // useActionState requires this action to accept the previous state as its
  // last parameter, even though a delete has no use for it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ActionState
): Promise<ActionState> {
  await assertAdmin();

  try {
    await locationService.deleteAtoll(id);
  } catch (err) {
    return { error: messageFor(err) };
  }

  revalidatePath(LOCATIONS_PATH);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Islands
// ---------------------------------------------------------------------------

export async function createIslandAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const parsed = islandInputSchema.safeParse({
    name: formData.get("name"),
    atollId: formData.get("atollId"),
    description: formData.get("description"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await locationService.createIsland(parsed.data);
  } catch (err) {
    return { error: messageFor(err) };
  }

  revalidatePath(LOCATIONS_PATH);
  redirect(LOCATIONS_PATH);
}

export async function updateIslandAction(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertAdmin();

  const parsed = islandInputSchema.safeParse({
    name: formData.get("name"),
    atollId: formData.get("atollId"),
    description: formData.get("description"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await locationService.updateIsland(id, parsed.data);
  } catch (err) {
    return { error: messageFor(err) };
  }

  revalidatePath(LOCATIONS_PATH);
  redirect(LOCATIONS_PATH);
}

export async function deleteIslandAction(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ActionState
): Promise<ActionState> {
  await assertAdmin();

  try {
    await locationService.deleteIsland(id);
  } catch (err) {
    return { error: messageFor(err) };
  }

  revalidatePath(LOCATIONS_PATH);
  return { error: null };
}
