const MAX_DIMENSION = 1200;
const QUALITY = 0.82;

/**
 * Réduit la photo dans le navigateur (1200 px max, WebP) pour économiser
 * les données mobiles. En cas d'échec, le fichier d'origine est envoyé :
 * le serveur revalide toujours taille et format.
 */
export async function shrinkImage(
  file: File,
  maxDimension = MAX_DIMENSION,
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size)
      return file;
    return new File([blob], "photo.webp", { type: "image/webp" });
  } catch {
    return file;
  }
}
