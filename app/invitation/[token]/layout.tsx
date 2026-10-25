import Link from "next/link";

export default function InvitationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <Link href="/" className="mb-8 text-xl font-bold text-primary">
        Céleste Biz
      </Link>
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
