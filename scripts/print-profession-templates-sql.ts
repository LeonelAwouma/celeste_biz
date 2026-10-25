/**
 * Affiche les lignes SQL `profession_templates` à partir du registre TypeScript,
 * pour écrire la migration d'une nouvelle version de profil métier :
 *   npx tsx scripts/print-profession-templates-sql.ts
 */
import { PROFESSION_TEMPLATES } from "../features/professions/registry";

const rows = PROFESSION_TEMPLATES.map((template) => {
  const json = JSON.stringify(template).replaceAll("'", "''");
  const label = template.label.replaceAll("'", "''");
  return `  ('${template.key}', ${template.version}, '${label}', '${json}'::jsonb)`;
});

console.log(rows.join(",\n"));
