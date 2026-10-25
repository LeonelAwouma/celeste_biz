import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <h1 className="text-2xl leading-tight font-semibold">{title}</h1>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        {isSupabaseConfigured() ? (
          children
        ) : (
          <p
            role="alert"
            className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground"
          >
            L&apos;authentification n&apos;est pas encore configurée sur ce
            serveur (projet Supabase non branché).
          </p>
        )}
      </Card>
      {footer ? (
        <div className="flex flex-col items-center gap-2 text-center text-sm">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
