import { Card, CardDescription, CardHeader } from "@/components/ui/card";

export function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20" aria-labelledby={`${id}-title`}>
      <CardHeader>
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {children}
    </Card>
  );
}

export function ReadOnlyNotice() {
  return (
    <p className="text-sm text-muted-foreground">
      Seul le propriétaire peut modifier ces informations.
    </p>
  );
}
