import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SECRET_NAME = /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)/;

function parseEnvExample(): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of readFileSync(".env.example", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [name, ...rest] = trimmed.split("=");
    entries.set(name, rest.join("="));
  }
  return entries;
}

describe(".env.example", () => {
  const env = parseEnvExample();

  it("ne contient aucune valeur pour les variables secrètes", () => {
    for (const [name, value] of env) {
      if (SECRET_NAME.test(name)) expect(value, name).toBe("");
    }
  });

  it("n'expose aucune variable secrète au navigateur", () => {
    for (const name of env.keys()) {
      if (name.startsWith("NEXT_PUBLIC_")) {
        expect(SECRET_NAME.test(name), name).toBe(false);
      }
    }
  });

  it("désactive toutes les intégrations par défaut", () => {
    const flags = [...env].filter(([name]) => name.startsWith("FEATURE_"));
    expect(flags.length).toBeGreaterThan(0);
    for (const [name, value] of flags) expect(value, name).toBe("false");
  });
});

describe("hygiène du dépôt", () => {
  it("ne versionne aucun fichier .env réel", () => {
    const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .split("\n")
      .filter((file) => /(^|\/)\.env/.test(file));
    expect(tracked).toEqual([".env.example"]);
  });
});
