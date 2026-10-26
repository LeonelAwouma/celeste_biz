import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ImageIcon, Package, Plus } from "lucide-react";

import { ListToolbar } from "@/components/dashboard/list-toolbar";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import { formatCatalogPrice } from "@/features/catalog/format";
import { listCatalogItems, type CatalogItem } from "@/features/catalog/queries";
import { can } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Catalogue" };

const UNCATEGORIZED = "Sans catégorie";

function groupByCategory(items: CatalogItem[]) {
  const groups = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const key = item.category ?? UNCATEGORIZED;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

export default async function CatalogPage({
  searchParams,
}: PageProps<"/dashboard/catalog">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const archived = params.archives === "1";

  const { business, template } = await getBusinessContext();
  const canWrite = can(business.role, "catalog.write");
  const items = await listCatalogItems(business.id, { archived, query });

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Catalogue" description={template.labels.catalog} />
        {canWrite ? (
          <Button asChild className="shrink-0">
            <Link href="/dashboard/catalog/new">
              <Plus aria-hidden="true" />
              Nouveau
            </Link>
          </Button>
        ) : null}
      </div>
      <ListToolbar
        basePath="/dashboard/catalog"
        query={query}
        archived={archived}
        searchLabel="Nom ou catégorie"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            query
              ? "Aucun article trouvé"
              : archived
                ? "Aucun article archivé"
                : "Catalogue vide"
          }
          description={
            query
              ? "Vérifiez l'orthographe ou cherchez par catégorie."
              : "Ajoutez vos services ou produits avec un prix fixe, « à partir de » ou « sur devis » pour aller plus vite lors des commandes."
          }
          action={
            canWrite && !query && !archived ? (
              <Button asChild>
                <Link href="/dashboard/catalog/new">Ajouter un article</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groupByCategory(items).map(([category, group]) => (
            <section key={category} aria-label={category}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                {category}
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {group.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/dashboard/catalog/${item.id}`}
                      className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-accent"
                    >
                      {item.imageUrl ? (
                        // URL signée temporaire : pas d'optimisation next/image.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          width={48}
                          height={48}
                          loading="lazy"
                          className="size-12 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                          <ImageIcon
                            aria-hidden="true"
                            className="size-5 text-muted-foreground"
                          />
                        </span>
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {item.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatCatalogPrice(
                            item.price_mode,
                            item.price,
                            item.unit,
                          )}
                          {item.visibility === "private" ? " · Interne" : ""}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="ml-auto size-5 shrink-0 text-muted-foreground"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
