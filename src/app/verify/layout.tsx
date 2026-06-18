import Link from "next/link";
import { AppLogo } from "@/components/shared/app-logo";
import { APP_NAME } from "@/lib/constants";

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Link
        href="/login"
        className="relative mb-8 flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-80"
      >
        <AppLogo alt={APP_NAME} size="md" />
        <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
      </Link>

      <div className="relative w-full max-w-lg">{children}</div>

      <p className="relative mt-8 text-center text-xs text-muted-foreground">
        Public invoice verification — no login required.
      </p>
    </div>
  );
}
