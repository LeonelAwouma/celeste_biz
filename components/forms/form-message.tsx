import type { FormState } from "@/features/auth/schemas";
import { cn } from "@/lib/utils";

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        state.status === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-accent text-accent-foreground",
      )}
    >
      {state.message}
    </p>
  );
}
