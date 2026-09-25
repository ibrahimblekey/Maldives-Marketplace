"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../../ui.module.css";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // must match MAX_PHOTO_BYTES on the server
const MAX_EDGE = 2000; // px — plenty for a listing photo, and fast on slow island connections

/**
 * Shrinks a photo in the browser before upload: phone photos are often
 * 5–15 MB, which is slow to send and over Vercel's 4.5 MB request limit.
 * Re-encoding also strips location (EXIF) data from the host's phone.
 */
async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
  }
  throw new Error("could not make the photo small enough");
}

export function PhotoUploader({ propertyId, remainingSlots }: { propertyId: string; remainingSlots: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, remainingSlots);
    const problems: string[] = [];
    if (fileList.length > remainingSlots) {
      problems.push(`Only the first ${remainingSlots} photo(s) were uploaded. The photo limit has been reached.`);
    }
    setBusy(true);
    setErrors([]);

    let uploaded = 0;
    for (const [index, file] of files.entries()) {
      setStatus(`Uploading photo ${index + 1} of ${files.length}...`);
      if (!ACCEPTED.includes(file.type)) {
        problems.push(`${file.name}: only JPEG, PNG or WebP photos are accepted.`);
        continue;
      }
      if (file.size > MAX_ORIGINAL_BYTES) {
        problems.push(`${file.name}: too large (max 20 MB).`);
        continue;
      }
      try {
        const blob = await prepare(file);
        const body = new FormData();
        body.append("photo", blob, "photo.jpg");
        const response = await fetch(`/api/host/properties/${propertyId}/photos`, { method: "POST", body });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          problems.push(`${file.name}: ${data?.error ?? "upload failed."}`);
          continue;
        }
        uploaded += 1;
      } catch {
        problems.push(`${file.name}: this photo couldn't be read. Try saving it as a JPEG first.`);
      }
    }

    setBusy(false);
    setStatus(uploaded > 0 ? `${uploaded} photo${uploaded === 1 ? "" : "s"} uploaded.` : null);
    setErrors(problems);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className={styles.dropzone}>
      <p style={{ marginBottom: 12 }}>Choose one or more photos from your phone or computer (JPEG, PNG or WebP).</p>
      <label className={styles.button} style={busy || remainingSlots <= 0 ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
        {busy ? "Uploading..." : "Choose photos"}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          hidden
          disabled={busy || remainingSlots <= 0}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {status && (
        <p className={styles.success} role="status" style={{ marginTop: 12 }}>
          {status}
        </p>
      )}
      {errors.map((e) => (
        <p key={e} className={styles.error} role="alert" style={{ marginTop: 8 }}>
          {e}
        </p>
      ))}
    </div>
  );
}
