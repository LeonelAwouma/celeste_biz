"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  keepValues,
  toFieldErrors,
  type FormState,
} from "@/features/auth/schemas";
import { getProfessionTemplate } from "@/features/professions/registry";
import { requireUser } from "@/lib/auth/session";
import { getAppUrl } from "@/lib/env";
import { can, type Permission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

import {
  ACTIVE_BUSINESS_COOKIE,
  listMyBusinesses,
  requireActiveBusiness,
  type BusinessMembership,
} from "./active-business";
import { PENDING_INVITATION_COOKIE } from "./invitation-cookie";
import {
  businessIdSchema,
  createBusinessSchema,
  invitationTokenSchema,
  inviteMemberSchema,
  memberRoleSchema,
  parseModuleForm,
  updateBusinessSchema,
  updateProfessionSchema,
} from "./schemas";

const ONE_YEAR = 60 * 60 * 24 * 365;

const FORBIDDEN: FormState = {
  status: "error",
  message: "Cette action est réservée au propriétaire de l'entreprise.",
};

const SAVE_FAILED: FormState = {
  status: "error",
  message:
    "La modification n'a pas été enregistrée. Vérifiez votre connexion et réessayez.",
};

async function rememberActiveBusiness(businessId: string) {
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/**
 * Entreprise active de l'utilisateur, si son rôle le permet. L'entreprise
 * n'est jamais lue dans le formulaire ; la base revérifie le rôle.
 */
async function authorize(
  permission: Permission,
): Promise<BusinessMembership | null> {
  const business = await requireActiveBusiness();
  return can(business.role, permission) ? business : null;
}

export async function createBusiness(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const values = keepValues(formData, [
    "name",
    "professionKey",
    "city",
    "whatsappPhone",
  ]);
  const parsed = createBusinessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  // La fonction SQL crée l'entreprise, l'adhésion « owner », les réglages
  // et l'audit dans une seule transaction.
  const { data, error } = await supabase
    .rpc("create_business", {
      p_name: parsed.data.name,
      p_profession_key: parsed.data.professionKey,
      p_city: parsed.data.city ?? null,
      p_whatsapp_phone_e164: parsed.data.whatsappPhone ?? null,
    })
    .single<{ id: string }>();

  if (error || !data) {
    if (error?.code === "54000") {
      return {
        status: "error",
        message: "Vous avez atteint le nombre maximal d'entreprises.",
        values,
      };
    }
    return {
      status: "error",
      message:
        "L'entreprise n'a pas été créée. Vérifiez votre connexion et réessayez.",
      values,
    };
  }

  await rememberActiveBusiness(data.id);
  redirect("/dashboard/today");
}

export async function setActiveBusiness(formData: FormData): Promise<void> {
  const parsed = businessIdSchema.safeParse(formData.get("businessId"));
  if (!parsed.success) redirect("/dashboard/today");

  // L'ID reçu n'est qu'un choix : il doit correspondre à une adhésion active.
  const businesses = await listMyBusinesses();
  if (businesses.some((business) => business.id === parsed.data)) {
    await rememberActiveBusiness(parsed.data);
  }
  redirect("/dashboard/today");
}

export async function updateBusiness(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorize("business.update");
  if (!business) return FORBIDDEN;

  const values = keepValues(formData, ["name", "city", "whatsappPhone"]);
  const parsed = updateBusinessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .update({
      name: parsed.data.name,
      city: parsed.data.city ?? null,
      whatsapp_phone_e164: parsed.data.whatsappPhone ?? null,
    })
    .eq("id", business.id)
    .select("id");

  if (error || !data?.length) return { ...SAVE_FAILED, values };
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Informations enregistrées." };
}

export async function updateProfession(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorize("business.update");
  if (!business) return FORBIDDEN;

  const parsed = updateProfessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_business_profession", {
    p_business_id: business.id,
    p_profession_key: parsed.data.professionKey,
  });
  if (error) return SAVE_FAILED;

  revalidatePath("/dashboard", "layout");
  return {
    status: "success",
    message: `Métier enregistré : ${getProfessionTemplate(parsed.data.professionKey).label}.`,
  };
}

export async function updateModules(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorize("business.update");
  if (!business) return FORBIDDEN;

  const template = getProfessionTemplate(
    business.professionKey,
    business.professionVersion,
  );
  const modules = parseModuleForm(formData, template.availableModules);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_settings")
    .update({ modules })
    .eq("business_id", business.id)
    .select("business_id");

  if (error || !data?.length) return SAVE_FAILED;
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Modules enregistrés." };
}

export async function inviteMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorize("members.manage");
  if (!business) return FORBIDDEN;

  const values = keepValues(formData, ["email", "role"]);
  const parsed = inviteMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_business_id: business.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });

  if (error || typeof token !== "string") {
    if (error?.code === "23505") {
      return {
        status: "error",
        fieldErrors: {
          email: ["Cette personne fait déjà partie de l'équipe."],
        },
        values,
      };
    }
    if (error?.code === "54000") {
      return {
        status: "error",
        message: "Trop d'invitations en attente. Annulez-en avant d'en créer.",
        values,
      };
    }
    return { ...SAVE_FAILED, values };
  }

  revalidatePath("/dashboard/settings");
  return {
    status: "success",
    message: `Invitation créée pour ${parsed.data.email}. Envoyez-lui ce lien (valable 7 jours) :`,
    data: {
      link: `${getAppUrl()}/invitation/${token}`,
      businessName: business.name,
    },
  };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const business = await authorize("members.manage");
  const invitationId = businessIdSchema.safeParse(formData.get("invitationId"));
  if (business && invitationId.success) {
    const supabase = await createClient();
    await supabase.rpc("revoke_invitation", {
      p_invitation_id: invitationId.data,
    });
  }
  revalidatePath("/dashboard/settings");
}

export async function changeMemberRole(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorize("members.manage");
  if (!business) return FORBIDDEN;

  const parsed = memberRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Rôle invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_business_id: business.id,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error?.code === "23514") {
    return {
      status: "error",
      message: "L'entreprise doit garder au moins un propriétaire.",
    };
  }
  if (error) return SAVE_FAILED;

  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Rôle mis à jour." };
}

export async function removeMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorize("members.manage");
  if (!business) return FORBIDDEN;

  const userId = businessIdSchema.safeParse(formData.get("userId"));
  if (!userId.success) return { status: "error", message: "Membre invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_member", {
    p_business_id: business.id,
    p_user_id: userId.data,
  });
  if (error?.code === "23514") {
    return {
      status: "error",
      message: "L'entreprise doit garder au moins un propriétaire.",
    };
  }
  if (error) return SAVE_FAILED;

  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Accès retiré." };
}

export async function acceptInvitation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const token = invitationTokenSchema.safeParse(formData.get("token"));
  if (!token.success) {
    return { status: "error", message: "Lien d'invitation invalide." };
  }

  const supabase = await createClient();
  const { data: businessId, error } = await supabase.rpc("accept_invitation", {
    p_token: token.data,
  });

  if (error || typeof businessId !== "string") {
    if (error?.code === "42501") {
      return {
        status: "error",
        message:
          "Cette invitation est destinée à une autre adresse e-mail. Connectez-vous avec le bon compte.",
      };
    }
    return {
      status: "error",
      message: "Cette invitation n'est plus valable. Demandez-en une nouvelle.",
    };
  }

  const store = await cookies();
  store.delete(PENDING_INVITATION_COOKIE);
  await rememberActiveBusiness(businessId);
  redirect("/dashboard/today");
}
