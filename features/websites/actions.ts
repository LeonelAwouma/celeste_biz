"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  keepValues,
  toFieldErrors,
  type FormState,
} from "@/features/auth/schemas";
import { requireActiveBusiness } from "@/features/businesses/active-business";
import {
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  detectImageType,
} from "@/features/catalog/schemas";
import { can } from "@/lib/permissions/roles";
import { QUOTA_MESSAGES, consumeQuota } from "@/lib/quotas";
import { createClient } from "@/lib/supabase/server";

import { getWebsite, siteCacheTag } from "./queries";
import {
  SITE_FORM_FIELDS,
  SITE_GALLERY_MAX,
  SITE_MEDIA_KINDS,
  contentToJson,
  readSiteMedia,
  referencedSiteImages,
  siteFormSchema,
  type SiteMedia,
} from "./schemas";
import { isSiteTemplateKey } from "./templates";

const FORBIDDEN: FormState = {
  status: "error",
  message: "Seuls le propriétaire et le gestionnaire modifient le site.",
};

const NETWORK: FormState = {
  status: "error",
  message: "Rien n'a été enregistré. Vérifiez votre connexion et réessayez.",
};

function rpcFailure(
  error: { code?: string; message: string },
  values?: Record<string, string>,
): FormState {
  switch (error.code) {
    case "CB422":
      return { status: "error", message: error.message, values };
    case "CB409":
      return {
        status: "error",
        message:
          "Le site a été modifié entre-temps. Rechargez la page pour voir la dernière version.",
        values,
      };
    case "42501":
      return { ...FORBIDDEN, values };
    default:
      return { ...NETWORK, values };
  }
}

async function authorizeWebsite() {
  const business = await requireActiveBusiness();
  return can(business.role, "website.write") ? business : null;
}

function refreshEditor() {
  revalidatePath("/dashboard/website");
  revalidatePath("/dashboard/website/preview");
}

/** Supprime les photos qui ne servent plus ni au brouillon ni au site publié. */
async function removeOrphanImages(businessId: string) {
  const website = await getWebsite(businessId);
  if (!website) return;
  const keep = referencedSiteImages(
    readSiteMedia(website.media),
    website.published ? readSiteMedia(website.published.media) : null,
  );
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("site-images")
    .list(businessId, { limit: 200 });
  const orphans = (data ?? [])
    .map((file) => `${businessId}/${file.name}`)
    .filter((path) => !keep.has(path));
  if (orphans.length) {
    await supabase.storage.from("site-images").remove(orphans);
  }
}

export async function createWebsite(formData: FormData): Promise<void> {
  const business = await authorizeWebsite();
  if (!business) redirect("/dashboard/website");
  const template = formData.get("templateKey");
  const supabase = await createClient();
  await supabase.rpc("create_website", {
    p_business_id: business.id,
    p_template_key: isSiteTemplateKey(template) ? template : null,
  });
  refreshEditor();
  redirect("/dashboard/website");
}

/** Textes, modèle, adresse et prestations du brouillon. */
export async function saveWebsite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorizeWebsite();
  if (!business) return FORBIDDEN;

  const values = keepValues(formData, SITE_FORM_FIELDS);
  const parsed = siteFormSchema.safeParse({
    ...Object.fromEntries(formData),
    showPrices: formData.get("showPrices") === "on",
    serviceIds: formData.getAll("serviceIds").map(String),
  });
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_website", {
    p_business_id: business.id,
    p_version: parsed.data.version,
    p_template_key: parsed.data.templateKey,
    p_slug: parsed.data.slug,
    p_content: contentToJson(parsed.data),
  });
  if (error) return rpcFailure(error, values);

  refreshEditor();
  return {
    status: "success",
    message:
      "Brouillon enregistré. Prévisualisez-le puis publiez pour le rendre visible.",
  };
}

async function writeMedia(businessId: string, media: SiteMedia) {
  const supabase = await createClient();
  return supabase.rpc("set_website_media", {
    p_business_id: businessId,
    p_logo: media.logo,
    p_banner: media.banner,
    p_gallery: media.gallery,
  });
}

/** Logo, bannière ou photo de galerie (brouillon). */
export async function uploadSiteImage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorizeWebsite();
  if (!business) return FORBIDDEN;

  const kind = z.enum(SITE_MEDIA_KINDS).safeParse(formData.get("kind"));
  const file = formData.get("image");
  if (!kind.success || !(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choisissez une photo." };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { status: "error", message: "Photo trop lourde (2 Mo maximum)." };
  }
  if (!(await consumeQuota(business.id, "upload"))) {
    return { status: "error", message: QUOTA_MESSAGES.upload };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return {
      status: "error",
      message: "Format non accepté : JPEG, PNG ou WebP.",
    };
  }

  const website = await getWebsite(business.id);
  if (!website) return FORBIDDEN;
  const media = readSiteMedia(website.media);
  if (kind.data === "gallery" && media.gallery.length >= SITE_GALLERY_MAX) {
    return {
      status: "error",
      message: `${SITE_GALLERY_MAX} photos au maximum : retirez-en une d'abord.`,
    };
  }

  const supabase = await createClient();
  const path = `${business.id}/${crypto.randomUUID()}.${type}`;
  const { error: uploadError } = await supabase.storage
    .from("site-images")
    .upload(path, bytes, {
      contentType: IMAGE_CONTENT_TYPES[type],
      upsert: false,
    });
  if (uploadError) return NETWORK;

  const next: SiteMedia =
    kind.data === "gallery"
      ? { ...media, gallery: [...media.gallery, path] }
      : { ...media, [kind.data]: path };
  const { error } = await writeMedia(business.id, next);
  if (error) {
    await supabase.storage.from("site-images").remove([path]);
    return rpcFailure(error);
  }
  await removeOrphanImages(business.id);
  refreshEditor();
  return { status: "success", message: "Photo ajoutée au brouillon." };
}

export async function removeSiteImage(formData: FormData): Promise<void> {
  const business = await authorizeWebsite();
  if (!business) redirect("/dashboard/website");
  const path = String(formData.get("path") ?? "");
  const website = await getWebsite(business.id);
  if (website) {
    const media = readSiteMedia(website.media);
    const next: SiteMedia = {
      logo: media.logo === path ? null : media.logo,
      banner: media.banner === path ? null : media.banner,
      gallery: media.gallery.filter((entry) => entry !== path),
    };
    const { error } = await writeMedia(business.id, next);
    if (!error) await removeOrphanImages(business.id);
  }
  refreshEditor();
  redirect("/dashboard/website");
}

/** Publication explicite de la version prévisualisée. */
export async function publishWebsite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorizeWebsite();
  if (!business) return FORBIDDEN;
  const version = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(formData.get("version"));
  if (!version.success) return NETWORK;

  const before = await getWebsite(business.id);
  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("publish_website", {
    p_business_id: business.id,
    p_version: version.data,
  });
  if (error) return rpcFailure(error);

  updateTag(siteCacheTag(String(slug)));
  if (before?.publishedSlug && before.publishedSlug !== slug) {
    updateTag(siteCacheTag(before.publishedSlug));
  }
  await removeOrphanImages(business.id);
  refreshEditor();
  return {
    status: "success",
    message: "Site publié. Les visiteurs voient maintenant cette version.",
    data: { slug: String(slug) },
  };
}

export async function unpublishWebsite(): Promise<FormState> {
  const business = await authorizeWebsite();
  if (!business) return FORBIDDEN;
  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("unpublish_website", {
    p_business_id: business.id,
  });
  if (error) return rpcFailure(error);
  if (slug) updateTag(siteCacheTag(String(slug)));
  await removeOrphanImages(business.id);
  refreshEditor();
  return {
    status: "success",
    message: "Site retiré : son adresse ne montre plus rien.",
  };
}
