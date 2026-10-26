export default function TrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-4 py-6">
      <main id="contenu" className="w-full max-w-md">
        {children}
      </main>
      <p className="mt-8 text-xs text-muted-foreground">
        Suivi fourni par Céleste Biz
      </p>
    </div>
  );
}
