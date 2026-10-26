import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CatalogImageForm } from "@/components/catalog/catalog-image-form";
import { CatalogItemForm } from "@/components/catalog/catalog-item-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { requireActiveBusiness } from "@/features/businesses/active-business";
import {
  removeCatalogImage,
  setCatalogItemArchived,
} from "@/features/catalog/actions";
import { formatCatalogPrice } from "@/features/catalog/format";
import { getCatalogItem, listCategories } from "@/features/catalog/queries";
import { toInputAmount } from "@/lib/monetary/xaf";
import { can } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Article du catalogue" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Africa/Douala",
});

export default async function CatalogItemPage({
  params,
  searchParams,
}: PageProps<"/dashboard/catalog/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const business = await requireActiveBusiness();
  const [item, categories] = await Promise.all([
    getCatalogItem(business.id, id),
    listCategories(business.id),
  ]);
  if (!item) notFound();

  const canManage = can(business.role, "catalog.write");
  const canEdit = canManage && !item.archived_at;

  return (
    <>
      <Link
        href="/dashboard/catalog"
        className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Catalogue
      </Link>
      <PageHeader
        title={item.name}
        description={
          item.archived_at
            ? `Archivé le ${dateFormat.format(new Date(item.archived_at))}`
            : formatCatalogPrice(item.price_mode, item.price, item.unit)
        }
      />
      {query.enregistre === "1" ? (
        <p
          role="status"
          className="mb-4 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          Article enregistré.
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        <section aria-labelledby="photo">
          <h2 id="photo" className="mb-2 text-lg font-semibold">
            Photo
          </h2>
          {item.imageUrl ? (
            // URL signée temporaire du stockage privé.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={`Photo : ${item.name}`}
              className="mb-3 aspect-square w-full max-w-xs rounded-xl border object-cover"
            />
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">Aucune photo.</p>
          )}
          {canEdit ? (
            <div className="flex flex-col gap-3">
              <CatalogImageForm itemId={item.id} />
              {item.image_path ? (
                <ConfirmActionForm
                  action={removeCatalogImage}
                  hidden={{ id: item.id }}
                  confirmMessage="Retirer la photo de cet article ?"
                  variant="ghost"
                >
                  Retirer la photo
                </ConfirmActionForm>
              ) : null}
            </div>
          ) : null}
        </section>

        <section aria-labelledby="informations">
          <h2 id="informations" className="mb-2 text-lg font-semibold">
            Informations
          </h2>
          <CatalogItemForm
            mode="edit"
            readOnly={!canEdit}
            categories={categories}
            item={{
              id: item.id,
              kind: item.kind,
              name: item.name,
              description: item.description ?? "",
              category: item.category ?? "",
              priceMode: item.price_mode,
              price: item.price === null ? "" : toInputAmount(item.price),
              unit: item.unit ?? "",
              visible: item.visibility === "public",
              position: String(item.position),
            }}
          />
        </section>

        {canManage ? (
          <ConfirmActionForm
            action={setCatalogItemArchived}
            hidden={{ id: item.id, archive: item.archived_at ? "0" : "1" }}
            confirmMessage={
              item.archived_at
                ? `Remettre « ${item.name} » dans le catalogue actif ?`
                : `Archiver « ${item.name} » ? Il ne sera plus proposé ; les commandes existantes ne changent pas.`
            }
          >
            {item.archived_at ? "Restaurer l'article" : "Archiver l'article"}
          </ConfirmActionForm>
        ) : null}
      </div>
    </>
  );
}
