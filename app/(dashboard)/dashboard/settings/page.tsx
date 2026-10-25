import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { BusinessInfoForm } from "@/components/settings/business-info-form";
import { ModulesForm } from "@/components/settings/modules-form";
import { ProfessionForm } from "@/components/settings/profession-form";
import { TeamSection } from "@/components/settings/team-section";
import { getBusinessContext } from "@/features/businesses/active-business";
import {
  listPendingInvitations,
  listMembers,
} from "@/features/businesses/team";
import { can, ROLE_LABELS } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const context = await getBusinessContext();
  const { business, template, moduleOverrides } = context;
  const isOwner = can(business.role, "business.update");
  const canManageTeam = can(business.role, "members.manage");

  const [members, invitations] = await Promise.all([
    listMembers(business.id),
    canManageTeam ? listPendingInvitations(business.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Paramètres"
        description={`Votre rôle : ${ROLE_LABELS[business.role]}.`}
      />
      <div className="flex flex-col gap-4">
        <BusinessInfoForm
          editable={isOwner}
          name={business.name}
          city={business.city ?? ""}
          whatsappPhone={business.whatsappPhone ?? ""}
        />
        <ProfessionForm editable={isOwner} professionKey={template.key} />
        <ModulesForm
          editable={isOwner}
          available={template.availableModules}
          defaults={template.defaultModules}
          overrides={moduleOverrides}
        />
        <TeamSection
          canManage={canManageTeam}
          members={members}
          invitations={invitations}
        />
      </div>
    </>
  );
}
