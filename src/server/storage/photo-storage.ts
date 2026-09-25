import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

/**
 * Where listing photos live.
 *
 * Production: Vercel Blob (public store). The BLOB_READ_WRITE_TOKEN
 * environment variable is added to the Vercel project automatically when a
 * Blob store is connected to it — see README "Photo storage".
 *
 * Local development without that token: files are written to
 * public/dev-uploads/ (git-ignored) so the whole listing flow can still be
 * tried end to end. This fallback is refused in production so a missing
 * token can never silently write to a server's temporary disk.
 */

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // after in-browser resizing; Vercel caps request bodies at 4.5 MB

export class PhotoStorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Photo storage isn't set up yet. An admin needs to connect a Vercel Blob store to the project."
    );
    this.name = "PhotoStorageNotConfiguredError";
  }
}

type ImageKind = { contentType: "image/jpeg" | "image/png" | "image/webp"; extension: string };

/**
 * Identifies an image by its first bytes ("magic numbers") rather than
 * trusting the file name or the browser-reported type, both of which the
 * uploader controls. Returns null for anything that isn't JPEG/PNG/WebP.
 */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) {
    return { contentType: "image/png", extension: "png" };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

function shouldUseLocalFallback() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return false;
  if (process.env.NODE_ENV === "production") throw new PhotoStorageNotConfiguredError();
  return true;
}

const LOCAL_DIR = path.join(process.cwd(), "public", "dev-uploads");

/** Stores a validated image and returns its public URL. */
export async function storePropertyPhoto(
  propertyId: string,
  bytes: Uint8Array,
  kind: ImageKind
): Promise<string> {
  const fileName = `${randomUUID()}.${kind.extension}`;

  if (shouldUseLocalFallback()) {
    const dir = path.join(LOCAL_DIR, propertyId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), bytes);
    return `/dev-uploads/${propertyId}/${fileName}`;
  }

  const blob = await put(`properties/${propertyId}/${fileName}`, Buffer.from(bytes), {
    access: "public",
    contentType: kind.contentType,
    addRandomSuffix: false, // the UUID file name is already unguessable and unique
  });
  return blob.url;
}

/**
 * Deletes stored photos. Best effort: a failure here leaves an orphaned
 * file behind but must never block the database change that triggered it,
 * so errors are logged rather than thrown.
 */
export async function deletePropertyPhotos(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    const local = urls.filter((u) => u.startsWith("/dev-uploads/"));
    const remote = urls.filter((u) => !u.startsWith("/dev-uploads/"));
    for (const url of local) {
      const target = path.join(process.cwd(), "public", url);
      // Only ever delete inside the dev upload folder.
      if (target.startsWith(LOCAL_DIR + path.sep)) {
        await unlink(target).catch(() => undefined);
      }
    }
    if (remote.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
      await del(remote);
    }
  } catch (err) {
    console.error("[photo-storage] failed to delete photos:", err);
  }
}
