// Runs in the browser. A logo is shown in a square everywhere, so it is cropped
// to a centered square and shrunk before upload: what the seller previews is
// exactly what customers see, and the file stays small.

const SIDE = 512;

export async function squareImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // not an image the browser can read: the server rejects it with a clear message
  }

  const crop = Math.min(bitmap.width, bitmap.height);
  const side = Math.min(SIDE, crop);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  canvas
    .getContext("2d")
    ?.drawImage(
      bitmap,
      (bitmap.width - crop) / 2,
      (bitmap.height - crop) / 2,
      crop,
      crop,
      0,
      0,
      side,
      side,
    );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) return file;
  const baseName = file.name.replace(/\.[^.]+$/, "") || "logo";
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}
