// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { OfflineBanner } from "@/components/feedback/offline-banner";

afterEach(cleanup);

describe("composants d'état", () => {
  it("EmptyState affiche le titre, l'explication et l'action", () => {
    render(
      <EmptyState
        title="Aucune commande"
        description="Enregistrez votre première commande."
        action={<button>Nouvelle commande</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Aucune commande" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Enregistrez votre première commande."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Nouvelle commande" }),
    ).toBeTruthy();
  });

  it("ErrorState est annoncé comme alerte et permet de réessayer", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("LoadingState expose un libellé accessible", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status").textContent).toContain("Chargement");
  });
});

describe("OfflineBanner", () => {
  function setOnline(value: boolean) {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => value,
    });
  }

  it("ne s'affiche pas en ligne", () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByText(/Connexion requise/)).toBeNull();
  });

  it("indique « connexion requise » hors ligne", () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByText(/Connexion requise/)).toBeTruthy();
  });
});
