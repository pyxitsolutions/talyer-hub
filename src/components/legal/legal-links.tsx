import Link from "next/link";

import { cn } from "@/lib/utils";

interface LegalLinksProps {
  className?: string;
}

export function LegalLinks({ className }: LegalLinksProps) {
  return (
    <p className={cn("text-center text-xs text-muted-foreground", className)}>
      <Link href="/privacy" className="hover:text-foreground hover:underline">
        Privacy Policy
      </Link>
      {" · "}
      <Link href="/terms" className="hover:text-foreground hover:underline">
        Terms of Service
      </Link>
    </p>
  );
}
