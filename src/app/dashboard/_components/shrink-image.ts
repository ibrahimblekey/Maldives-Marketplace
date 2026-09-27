/**
 * Shrinks a photo in the browser before upload: phone photos are often
 * 5–15 MB, which is slow to send and over Vercel's 4.5 MB request limit.
 * Re-encoding also strips location (EXIF) data from the phone.
 */
export async function shrinkImage(file: File, { maxEdge, maxBytes }: { maxEdge: number; maxBytes: number }): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new Error("could not make the image small enough");
}
