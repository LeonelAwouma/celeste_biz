"use client";

/* eslint-disable @next/next/no-img-element -- URL signées temporaires. */
import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/features/auth/schemas";
import { removeSiteImage, uploadSiteImage } from "@/features/websites/actions";
import type { SiteMediaKind } from "@/features/websites/schemas";
import { shrinkImage } from "@/lib/images/shrink";

export type MediaPreview = { path: string; url: string | null };

const LABELS: Record<SiteMediaKind, { title: string; hint: string }> = {
  logo: { title: "Logo", hint: "Carré de préférence." },
  banner: { title: "Bannière", hint: "Photo large, en haut du site." },
  gallery: { title: "Galerie", hint: "Jusqu'à 8 photos de vos réalisations." },
};

function UploadForm({
  kind,
  disabled,
}: {
  kind: SiteMediaKind;
  disabled?: boolean;
}) {
  const [preparing, setPreparing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, action] = useActionState(uploadSiteImage, initialFormState);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      setSelected(null);
      return;
    }
    setPreparing(true);
    const shrunk = await shrinkImage(file, kind === "banner" ? 1600 : 1200);
    if (shrunk !== file) {
      const transfer = new DataTransfer();
      transfer.items.add(shrunk);
      input.files = transfer.files;
    }
    setSelected(`${file.name} (${Math.ceil(shrunk.size / 1024)} Ko)`);
    setPreparing(false);
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="kind" value={kind} />
      <FormMessage state={state} />
      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm">
        <ImagePlus
          aria-hidden="true"
          className="size-5 shrink-0 text-primary"
        />
        <span className="min-w-0 break-words">
          {selected ?? "Choisir une photo (JPEG, PNG ou WebP)"}
        </span>
        <input
          type="file"
          name="image"
          aria-label={`Photo : ${LABELS[kind].title}`}
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onChange}
          disabled={disabled}
        />
      </label>
      <SubmitButton
        variant="outline"
        pendingLabel="Envoi…"
        disabled={preparing || disabled || !selected}
      >
        {preparing ? "Préparation de la photo…" : "Ajouter la photo"}
      </SubmitButton>
    </form>
  );
}

function Preview({
  image,
  alt,
  className,
}: {
  image: MediaPreview;
  alt: string;
  className: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {image.url ? (
        <img src={image.url} alt={alt} className={className} />
      ) : (
        <div className={`${className} bg-muted`} />
      )}
      <form action={removeSiteImage}>
        <input type="hidden" name="path" value={image.path} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="text-destructive"
        >
          Retirer
        </Button>
      </form>
    </div>
  );
}

/** Logo, bannière et galerie du brouillon. */
export function SiteMediaForm({
  logo,
  banner,
  gallery,
  galleryMax,
}: {
  logo: MediaPreview | null;
  banner: MediaPreview | null;
  gallery: MediaPreview[];
  galleryMax: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="media-logo" className="flex flex-col gap-2">
        <h3 id="media-logo" className="font-medium">
          {LABELS.logo.title}
        </h3>
        <p className="text-sm text-muted-foreground">{LABELS.logo.hint}</p>
        {logo ? (
          <Preview
            image={logo}
            alt="Logo actuel"
            className="size-20 rounded-full object-cover"
          />
        ) : null}
        <UploadForm kind="logo" />
      </section>
      <section aria-labelledby="media-banner" className="flex flex-col gap-2">
        <h3 id="media-banner" className="font-medium">
          {LABELS.banner.title}
        </h3>
        <p className="text-sm text-muted-foreground">{LABELS.banner.hint}</p>
        {banner ? (
          <Preview
            image={banner}
            alt="Bannière actuelle"
            className="aspect-[16/7] w-full rounded-lg object-cover"
          />
        ) : null}
        <UploadForm kind="banner" />
      </section>
      <section aria-labelledby="media-gallery" className="flex flex-col gap-2">
        <h3 id="media-gallery" className="font-medium">
          {LABELS.gallery.title} ({gallery.length}/{galleryMax})
        </h3>
        <p className="text-sm text-muted-foreground">{LABELS.gallery.hint}</p>
        {gallery.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {gallery.map((image, index) => (
              <li key={image.path}>
                <Preview
                  image={image}
                  alt={`Photo ${index + 1} de la galerie`}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              </li>
            ))}
          </ul>
        ) : null}
        <UploadForm kind="gallery" disabled={gallery.length >= galleryMax} />
      </section>
    </div>
  );
}
