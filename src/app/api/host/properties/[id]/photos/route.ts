import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole, ForbiddenError, UnauthenticatedError } from "@/server/auth/authorize";
import { addPhoto, assertCanAddPhoto } from "@/server/services/property-service";
import { UserFacingError } from "@/server/services/errors";
import {
  MAX_PHOTO_BYTES,
  PhotoStorageNotConfiguredError,
  deletePropertyPhotos,
  detectImageKind,
  storePropertyPhoto,
} from "@/server/storage/photo-storage";

/**
 * Upload one listing photo (multipart form field "photo").
 *
 * A route handler rather than a server action because photos are bigger
 * than a server action's default 1 MB body limit. The browser shrinks each
 * photo before sending it (see photo-uploader.tsx); this handler still
 * treats the upload as hostile: it re-checks the HOST role and ownership,
 * enforces the size limit, and identifies the file by its actual bytes —
 * only real JPEG/PNG/WebP images are stored, whatever the file is called.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/host/properties/[id]/photos">) {
  const { id: propertyId } = await ctx.params;

  let userId: string;
  try {
    userId = (await requireRole(["HOST"])).user.id;
  } catch (err) {
    if (err instanceof UnauthenticatedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PHOTO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "That photo is too large (max 4 MB after resizing)." }, { status: 413 });
  }

  let stored: string | null = null;
  try {
    await assertCanAddPhoto(userId, propertyId);

    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No photo was received." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "That photo is too large (max 4 MB after resizing)." }, { status: 413 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = detectImageKind(bytes);
    if (!kind) {
      return NextResponse.json({ error: "Only JPEG, PNG or WebP photos are accepted." }, { status: 415 });
    }

    stored = await storePropertyPhoto(propertyId, bytes, kind);
    const image = await addPhoto(userId, propertyId, stored);
    revalidatePath(`/dashboard/host/properties/${propertyId}`, "layout");
    return NextResponse.json({ id: image.id, url: image.url, status: image.status }, { status: 201 });
  } catch (err) {
    // The file was stored but the database refused it (e.g. the listing
    // was submitted for review in another tab meanwhile): don't leave an
    // orphaned file behind.
    if (stored) await deletePropertyPhotos([stored]);
    if (err instanceof UserFacingError || err instanceof PhotoStorageNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[photo-upload] unexpected error:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
