import {
  CORE_MODULES,
  OPTIONAL_MODULES,
  type ModuleKey,
  type OptionalModule,
  type ProfessionTemplate,
} from "./schema";

export type ModuleOverrides = Partial<Record<OptionalModule, boolean>>;

/**
 * Modules actifs d'une entreprise : modules cœur + modules facultatifs du
 * métier, selon les réglages de l'entreprise (sinon les valeurs par défaut).
 * Un module non proposé par le métier n'est jamais activé.
 */
export function resolveModules(
  template: ProfessionTemplate,
  overrides: ModuleOverrides = {},
): Set<ModuleKey> {
  const active = new Set<ModuleKey>(CORE_MODULES);
  for (const moduleKey of template.availableModules) {
    const enabled =
      overrides[moduleKey] ?? template.defaultModules.includes(moduleKey);
    if (enabled) active.add(moduleKey);
  }
  return active;
}

/** Ne garde que des réglages booléens sur des modules facultatifs connus. */
export function sanitizeModuleOverrides(value: unknown): ModuleOverrides {
  if (!value || typeof value !== "object") return {};
  const result: ModuleOverrides = {};
  for (const moduleKey of OPTIONAL_MODULES) {
    const flag = (value as Record<string, unknown>)[moduleKey];
    if (typeof flag === "boolean") result[moduleKey] = flag;
  }
  return result;
}
