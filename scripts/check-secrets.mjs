#!/usr/bin/env node
// Vérifie qu'aucun secret n'est versionné : fichiers .env, clés Supabase
// secrètes, JWT « service_role », clés privées. Lancé par `npm run check`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const FORBIDDEN_FILES = /(^|\/)\.env(\.(?!example$)[^/]+)?$/;
const PATTERNS = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, "clé secrète Supabase"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "clé privée"],
  [
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*InNlcnZpY2Vfcm9sZSI[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/,
    "JWT service_role",
  ],
  [/\bAKIA[0-9A-Z]{16}\b/, "clé AWS"],
  [/\bghp_[A-Za-z0-9]{36}\b/, "jeton GitHub"],
];

const problems = [];
for (const file of files) {
  if (FORBIDDEN_FILES.test(file)) {
    problems.push(`${file} : fichier d'environnement versionné`);
    continue;
  }
  if (
    file.startsWith("node_modules/") ||
    /\.(png|jpe?g|webp|ico|pdf|woff2?)$/.test(file)
  )
    continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [pattern, label] of PATTERNS) {
    if (pattern.test(text)) problems.push(`${file} : ${label}`);
  }
}

if (problems.length) {
  console.error(
    "Secrets détectés :\n" + problems.map((p) => `  - ${p}`).join("\n"),
  );
  process.exit(1);
}
console.log(`Aucun secret détecté (${files.length} fichiers).`);
