"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  keepValues,
  toFieldErrors,
  type FormState,
} from "@/features/auth/schemas";
import { requireActiveBusiness } from "@/features/businesses/active-business";
import { can } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

import {
  CATALOG_FORM_FIELDS,
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  catalogItemSchema,
  detectImageType,
} from "./schemas";

const FORBIDDEN: FormState = {
  status: "error",
  message: "Seuls le propriétaire et le gestionnaire modifient le catalogue.",
};

const SAVE_FAILED: FormState = {
  status: "error",
  message:
    "L'article n'a pas été enregistré. Vérifiez votre connexion et réessayez.",
};

async function authorizeCatalog() {
  const business = await requireActiveBusiness();
  return can(business.role, "catalog.write") ? business : null;
}

export async function saveCatalogItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorizeCatalog();
  if (!business) return FORBIDDEN;

  const values = {
    ...keepValues(formData, CATALOG_FORM_FIELDS),
    visible: formData.get("visible") === "on" ? "on" : "",
  };
  const parsed = catalogItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);
  const input = parsed.data;
  const mode = formData.get("mode") === "edit" ? "edit" : "create";

  const row = {
    kind: input.kind,
    name: input.name,
    description: input.description,
    category: input.category,
    price_mode: input.priceMode,
    price: input.price,
    unit: input.unit,
    visibility: input.visible ? "public" : "private",
    position: input.position,
  } as const;
  const supabase = await createClient();

  if (mode === "create") {
    const { error } = await supabase
      .from("catalog_items")
      .insert({ id: input.id, business_id: business.id, ...row });
    if (error && error.code !== "23505") return { ...SAVE_FAILED, values };
    revalidatePath("/dashboard/catalog");
    redirect(`/dashboard/catalog/${input.id}?enregistre=1`);
  }

  const { data, error } = await supabase
    .from("catalog_items")
    .update(row)
    .eq("business_id", business.id)
    .eq("id", input.id)
    .select("id");
  if (error || !data?.length) return { ...SAVE_FAILED, values };

  revalidatePath("/dashboard/catalog");
  return { status: "success", message: "Modifications enregistrées.", values };
}

export async function setCatalogItemArchived(
  formData: FormData,
): Promise<void> {
  const business = await authorizeCatalog();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!business || !id.success) redirect("/dashboard/catalog");

  const supabase = await createClient();
  await supabase
    .from("catalog_items")
    .update({
      archived_at:
        formData.get("archive") === "1" ? new Date().toISOString() : null,
    })
    .eq("business_id", business.id)
    .eq("id", id.data);

  revalidatePath("/dashboard/catalog");
  redirect(`/dashboard/catalog/${id.data}`);
}

/**
 * Photo facultative : type vérifié sur le contenu réel, 2 Mo maximum, nom
 * de fichier généré (jamais celui de l'utilisateur), dossier de l'entreprise.
 */
export async function uploadCatalogImage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorizeCatalog();
  if (!business) return FORBIDDEN;

  const id = z.uuid().safeParse(formData.get("id"));
  const file = formData.get("image");
  if (!id.success || !(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choisissez une photo." };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { status: "error", message: "Photo trop lourde (2 Mo maximum)." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return {
      status: "error",
      message: "Format non accepté : JPEG, PNG ou WebP.",
    };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("catalog_items")
    .select("image_path")
    .eq("business_id", business.id)
    .eq("id", id.data)
    .maybeSingle();
  if (!item) return SAVE_FAILED;

  const path = `${business.id}/${crypto.randomUUID()}.${type}`;
  const { error: uploadError } = await supabase.storage
    .from("catalog-images")
    .upload(path, bytes, {
      contentType: IMAGE_CONTENT_TYPES[type],
      upsert: false,
    });
  if (uploadError) return SAVE_FAILED;

  const { error } = await supabase
    .from("catalog_items")
    .update({ image_path: path })
    .eq("business_id", business.id)
    .eq("id", id.data);
  if (error) {
    await supabase.storage.from("catalog-images").remove([path]);
    return SAVE_FAILED;
  }
  if (item.image_path) {
    await supabase.storage.from("catalog-images").remove([item.image_path]);
  }

  revalidatePath(`/dashboard/catalog/${id.data}`);
  return { status: "success", message: "Photo enregistrée." };
}

export async function removeCatalogImage(formData: FormData): Promise<void> {
  const business = await authorizeCatalog();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!business || !id.success) redirect("/dashboard/catalog");

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("catalog_items")
    .select("image_path")
    .eq("business_id", business.id)
    .eq("id", id.data)
    .maybeSingle();
  if (item?.image_path) {
    await supabase
      .from("catalog_items")
      .update({ image_path: null })
      .eq("business_id", business.id)
      .eq("id", id.data);
    await supabase.storage.from("catalog-images").remove([item.image_path]);
  }
  revalidatePath(`/dashboard/catalog/${id.data}`);
  redirect(`/dashboard/catalog/${id.data}`);
}
