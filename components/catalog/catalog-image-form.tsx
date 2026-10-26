"use client";

import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState, type FormState } from "@/features/auth/schemas";
import { uploadCatalogImage } from "@/features/catalog/actions";

const MAX_DIMENSION = 1200;
const QUALITY = 0.82;

/**
 * Réduit la photo dans le navigateur (1200 px max, WebP) pour économiser
 * les données mobiles. En cas d'échec, le fichier d'origine est envoyé :
 * le serveur revalide toujours taille et format.
 */
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
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

export function CatalogImageForm({ itemId }: { itemId: string }) {
  const [preparing, setPreparing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, action] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const result = await uploadCatalogImage(previous, formData);
      if (result.status === "success") setSelected(null);
      return result;
    },
    initialFormState,
  );

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      setSelected(null);
      return;
    }
    setPreparing(true);
    const shrunk = await shrinkImage(file);
    if (shrunk !== file) {
      const transfer = new DataTransfer();
      transfer.items.add(shrunk);
      input.files = transfer.files;
    }
    setSelected(`${file.name} (${Math.ceil(shrunk.size / 1024)} Ko)`);
    setPreparing(false);
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={itemId} />
      <FormMessage state={state} />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm">
        <ImagePlus aria-hidden="true" className="size-5 text-primary" />
        <span>{selected ?? "Choisir une photo (JPEG, PNG ou WebP)"}</span>
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onChange}
        />
      </label>
      <SubmitButton pendingLabel="Envoi…" disabled={preparing}>
        {preparing ? "Préparation de la photo…" : "Enregistrer la photo"}
      </SubmitButton>
    </form>
  );
}
