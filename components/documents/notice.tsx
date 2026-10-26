import { cn } from "@/lib/utils";

/** Bandeau d'information (succès, avertissement, erreur). */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        tone === "info" && "bg-accent text-accent-foreground",
        tone === "warning" && "bg-warning text-warning-foreground",
        tone === "danger" && "bg-destructive/10 text-destructive",
        className,
      )}
    >
      {children}
    </p>
  );
}
