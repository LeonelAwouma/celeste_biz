"use client";

import { useActionState } from "react";
import { ExternalLink, Eye } from "lucide-react";
import Link from "next/link";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/features/auth/schemas";
import { publishWebsite, unpublishWebsite } from "@/features/websites/actions";

/**
 * Publication explicite : rien n'est visible tant que le commerçant n'a pas
 * publié, et chaque modification attend la publication suivante.
 */
export function PublishPanel({
  version,
  status,
  statusText,
  publicUrl,
  editable,
}: {
  version: number;
  status: "never" | "published" | "outdated" | "unpublished";
  statusText: string;
  publicUrl: string | null;
  editable: boolean;
}) {
  const [publishState, publish] = useActionState(
    publishWebsite,
    initialFormState,
  );
  const [unpublishState, unpublish] = useActionState(
    unpublishWebsite,
    initialFormState,
  );
  const live = status === "published" || status === "outdated";

  return (
    <div className="flex flex-col gap-3">
      <FormMessage state={publishState} />
      <FormMessage state={unpublishState} />
      <p className="text-sm" data-testid="site-status">
        {statusText}
      </p>
      {live && publicUrl ? (
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="site-public-url"
          className="inline-flex items-center gap-1 text-sm break-all text-primary underline-offset-4 hover:underline"
        >
          {publicUrl}
          <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
        </a>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline">
          <Link href="/dashboard/website/preview">
            <Eye aria-hidden="true" />
            Prévisualiser
          </Link>
        </Button>
        {editable ? (
          <form
            action={publish}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Publier cette version ? Elle sera visible par tous ceux qui ont l'adresse.",
                )
              )
                event.preventDefault();
            }}
          >
            <input type="hidden" name="version" value={version} />
            <SubmitButton
              className="w-full"
              pendingLabel="Publication…"
              disabled={status === "published"}
            >
              {status === "outdated"
                ? "Publier les modifications"
                : status === "published"
                  ? "Site à jour"
                  : "Publier le site"}
            </SubmitButton>
          </form>
        ) : null}
      </div>
      {editable && live ? (
        <form
          action={unpublish}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Retirer le site ? Son adresse ne montrera plus rien jusqu'à la prochaine publication.",
              )
            )
              event.preventDefault();
          }}
        >
          <SubmitButton
            variant="ghost"
            className="text-destructive"
            pendingLabel="…"
          >
            Retirer le site
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
