import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Recherche (formulaire GET, fonctionne sans JavaScript) et onglets
 * Actifs / Archivés.
 */
export function ListToolbar({
  basePath,
  query,
  archived,
  searchLabel,
}: {
  basePath: string;
  query: string;
  archived: boolean;
  searchLabel: string;
}) {
  const tab = (isArchived: boolean, label: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (isArchived) params.set("archives", "1");
    const href = params.size ? `${basePath}?${params}` : basePath;
    const active = archived === isArchived;
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground",
          active && "bg-accent text-accent-foreground",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="mb-4 flex flex-col gap-3">
      <form role="search" action={basePath} className="flex gap-2">
        {archived ? <input type="hidden" name="archives" value="1" /> : null}
        <label htmlFor="q" className="sr-only">
          {searchLabel}
        </label>
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={searchLabel}
          enterKeyHint="search"
          maxLength={100}
        />
        <Button
          type="submit"
          variant="outline"
          size="icon"
          aria-label="Rechercher"
        >
          <Search aria-hidden="true" />
        </Button>
      </form>
      <nav aria-label="Filtre" className="flex gap-1">
        {tab(false, "Actifs")}
        {tab(true, "Archivés")}
      </nav>
    </div>
  );
}
