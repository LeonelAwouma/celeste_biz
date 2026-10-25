import { requireActiveBusiness } from "@/features/businesses/active-business";

/**
 * Vérifie la session et l'entreprise active avant d'afficher un espace.
 * Sans entreprise, l'utilisateur est dirigé vers la création.
 */
export async function DashboardGate({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActiveBusiness();
  return <>{children}</>;
}
