import Link from "next/link";
import { ChevronRight, CircleAlert, Clock, Info } from "lucide-react";

import type { DashboardAlert } from "@/features/dashboard/alerts";
import { cn } from "@/lib/utils";

const ICONS = { danger: CircleAlert, warning: Clock, info: Info } as const;

/** Alerte actionnable : titre, fondement, dossiers concernés, lien « Tout voir ». */
export function AlertCard({ alert }: { alert: DashboardAlert }) {
  const Icon = ICONS[alert.tone];
  return (
    <section
      aria-labelledby={`alerte-${alert.key}`}
      data-testid={`alert-${alert.key}`}
      className={cn(
        "flex flex-col rounded-xl border bg-card",
        alert.tone === "danger" && "border-destructive/40",
        alert.tone === "warning" && "border-warning-foreground/30",
      )}
    >
      <div className="flex gap-3 px-4 pt-3">
        <Icon
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-5 shrink-0",
            alert.tone === "danger" && "text-destructive",
            alert.tone === "warning" && "text-warning-foreground",
            alert.tone === "info" && "text-primary",
          )}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={`alerte-${alert.key}`} className="font-semibold">
            {alert.title}
          </h3>
          <p className="text-sm text-muted-foreground">{alert.basis}</p>
        </div>
      </div>
      <ul className="mt-2 divide-y border-t" aria-label={alert.title}>
        {alert.items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-accent"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{item.primary}</span>
                <span className="text-sm text-muted-foreground">
                  {item.secondary}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
      {alert.more && alert.count > alert.items.length ? (
        <Link
          href={alert.more.href}
          className="flex min-h-11 items-center justify-center border-t px-4 text-sm font-medium text-primary"
        >
          {alert.more.label} ({alert.count})
        </Link>
      ) : alert.more ? (
        <Link
          href={alert.more.href}
          className="flex min-h-11 items-center justify-center border-t px-4 text-sm text-primary"
        >
          {alert.more.label}
        </Link>
      ) : null}
    </section>
  );
}
