import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { auditActionLabel, auditDetails } from "@/features/audit/labels";
import { listAuditLogs } from "@/features/audit/queries";
import { getBusinessContext } from "@/features/businesses/active-business";
import { listMembers } from "@/features/businesses/team";
import { can } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Journal" };

export default async function AuditPage({
  searchParams,
}: PageProps<"/dashboard/audit">) {
  const params = await searchParams;
  const { business } = await getBusinessContext();
  if (!can(business.role, "audit.read")) redirect("/dashboard/settings");
  const before =
    typeof params.avant === "string" && /^\d+$/.test(params.avant)
      ? Number(params.avant)
      : undefined;
  const [{ entries, nextCursor }, members] = await Promise.all([
    listAuditLogs(business.id, before),
    listMembers(business.id),
  ]);
  const names = new Map(members.map((m) => [m.userId, m.displayName]));

  return (
    <>
      <Link
        href="/dashboard/exports"
        className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Exports
      </Link>
      <PageHeader
        title="Journal"
        description="Actions importantes de l'équipe : émissions, annulations, exports, publications, changements de rôle."
      />
      {entries.length ? (
        <ol
          className="flex flex-col divide-y rounded-xl border bg-card"
          aria-label="Journal"
        >
          {entries.map((entry) => {
            const details = auditDetails(entry.metadata);
            return (
              <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-3">
                <p className="font-medium">{auditActionLabel(entry.action)}</p>
                {details ? (
                  <p className="text-sm break-words">{details}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(entry.at)} ·{" "}
                  {entry.actorId
                    ? (names.get(entry.actorId) ?? "Ancien membre")
                    : "Système"}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucune action enregistrée.
        </p>
      )}
      {nextCursor ? (
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href={`/dashboard/audit?avant=${nextCursor}`}>Plus ancien</Link>
        </Button>
      ) : null}
    </>
  );
}
