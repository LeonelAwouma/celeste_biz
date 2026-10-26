"use client";

import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { whatsappLink } from "@/lib/whatsapp";

/** Lien court à coller dans une publication, un statut ou une affiche. */
export function ShareLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <code
        data-testid="campaign-link"
        className="block rounded-md bg-muted px-3 py-2 text-sm break-all"
      >
        {url}
      </code>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy aria-hidden="true" />
          {copied ? "Copié" : "Copier"}
        </Button>
        <Button asChild variant="outline">
          <a
            href={whatsappLink(null, `${label}\n${url}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" />
            Partager
          </a>
        </Button>
      </div>
    </div>
  );
}
