import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  SEED,
  acceptDialogs,
  createBusiness,
  login,
  signUpAndConfirm,
  uniqueEmail,
} from "./helpers";

function suffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

/** Numéro camerounais unique (format local, 9 chiffres). */
function uniquePhone() {
  return `69${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
}

test("créer, retrouver, modifier puis archiver un client", async ({ page }) => {
  acceptDialogs(page);
  const name = `Cliente E2E ${suffix()}`;
  const phone = uniquePhone();

  await page.goto("/dashboard/customers");
  await page.getByRole("main").getByRole("link", { name: "Nouveau" }).click();
  await page.getByRole("button", { name: "Enregistrer le client" }).click();
  await expect(
    page.getByText("Indiquez le nom ou un surnom du client."),
  ).toBeVisible();

  await page.getByLabel("Nom ou surnom").fill(name);
  await page.getByLabel("Téléphone (facultatif)").fill("12");
  await page.getByRole("button", { name: "Enregistrer le client" }).click();
  await expect(page.getByText(/Numéro invalide/)).toBeVisible();
  // La saisie est conservée après une erreur.
  await expect(page.getByLabel("Nom ou surnom")).toHaveValue(name);

  await page.getByLabel("Téléphone (facultatif)").fill(phone);
  await page
    .getByLabel("Notes internes (facultatif)")
    .fill("Préfère être appelée le soir");
  await page.getByRole("button", { name: "Enregistrer le client" }).click();
  await expect(page).toHaveURL(
    /\/dashboard\/customers\/[0-9a-f-]{36}\?enregistre=1$/,
  );
  await expect(page.getByRole("status")).toHaveText("Client enregistré.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);

  // Recherche par quelques chiffres du numéro.
  await page.goto(`/dashboard/customers?q=${phone.slice(-6)}`);
  const list = page.getByRole("list", { name: "Liste des clients" });
  await expect(
    list.getByRole("link", { name: new RegExp(`^${name}`) }),
  ).toBeVisible();
  await expect(
    list.getByRole("link", { name: `Appeler ${name}` }),
  ).toHaveAttribute("href", `tel:+237${phone}`);

  await list.getByRole("link", { name: new RegExp(`^${name}`) }).click();
  await page.getByLabel("E-mail (facultatif)").fill("Cliente@Exemple.TEST");
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("E-mail (facultatif)")).toHaveValue(
    "cliente@exemple.test",
  );

  await page.getByRole("button", { name: "Archiver le client" }).click();
  await expect(
    page.getByRole("button", { name: "Restaurer le client" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nom ou surnom")).toBeDisabled();

  await page.goto(`/dashboard/customers?q=${encodeURIComponent(name)}`);
  await expect(page.getByText("Aucun client trouvé")).toBeVisible();
  await page.getByRole("link", { name: "Archivés" }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(`^${name}`) }),
  ).toBeVisible();
});

test("un numéro déjà connu demande une confirmation avant de créer un doublon", async ({
  page,
}) => {
  await page.goto("/dashboard/customers/new");
  await page.getByLabel("Nom ou surnom").fill(`Homonyme ${suffix()}`);
  // Numéro de Mireille Ngo (données de démonstration).
  await page.getByLabel("Téléphone (facultatif)").fill("677 00 01 01");
  await page.getByRole("button", { name: "Enregistrer le client" }).click();
  await expect(page.getByText(/Mireille Ngo/)).toBeVisible();

  await page.getByRole("button", { name: "Enregistrer quand même" }).click();
  await expect(page).toHaveURL(/\?enregistre=1$/);
});

test.describe("membre de l'équipe (rôle employé)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("ajoute un client mais ne peut ni archiver ni modifier le catalogue", async ({
    page,
  }) => {
    await login(page, SEED.sam);
    await page.goto("/dashboard/customers");
    await expect(page.getByRole("main")).toContainText("Mireille Ngo");

    await page.getByRole("main").getByRole("link", { name: "Nouveau" }).click();
    await page.getByLabel("Nom ou surnom").fill(`Client de Sam ${suffix()}`);
    await page.getByRole("button", { name: "Enregistrer le client" }).click();
    await expect(page.getByRole("status")).toHaveText("Client enregistré.");
    await expect(
      page.getByRole("button", { name: "Archiver le client" }),
    ).toHaveCount(0);

    await page.goto("/dashboard/catalog");
    await expect(page.getByRole("main")).toContainText("Robe sur mesure");
    await expect(
      page.getByRole("main").getByRole("link", { name: "Nouveau" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: /Robe sur mesure/ }).click();
    await expect(page.getByLabel("Nom", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Archiver/ })).toHaveCount(0);

    await page.goto("/dashboard/catalog/new");
    await expect(page.getByText("Action non autorisée")).toBeVisible();
  });
});

test.describe("liste longue", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("la liste des clients se pagine par 20", async ({ page }) => {
    const email = uniqueEmail("pagination");
    const password = "Pilote2026";
    await signUpAndConfirm(page, email, password);
    await createBusiness(page, "Boutique Pagination");

    // 25 clients insérés avec les droits du propriétaire (RLS appliquée).
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      { auth: { persistSession: false } },
    );
    await supabase.auth.signInWithPassword({ email, password });
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .single();
    const { error } = await supabase.from("customers").insert(
      Array.from({ length: 25 }, (_, i) => ({
        business_id: business!.id,
        name: `Client ${String(i + 1).padStart(2, "0")}`,
      })),
    );
    expect(error).toBeNull();

    await page.goto("/dashboard/customers");
    const list = page.getByRole("list", { name: "Liste des clients" });
    await expect(list.getByRole("listitem")).toHaveCount(20);
    await expect(list).toContainText("Client 20");
    await page.getByRole("link", { name: "Voir la suite" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(5);
    await expect(list).toContainText("Client 21");
    await expect(list).not.toContainText("Client 01");
    await expect(page.getByRole("link", { name: "Voir la suite" })).toHaveCount(
      0,
    );
  });
});
