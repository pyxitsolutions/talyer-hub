import Link from "next/link";

import { AppLogo } from "@/components/shared/app-logo";
import { LegalLinks } from "@/components/legal/legal-links";
import { APP_NAME } from "@/lib/constants";

export interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

interface LegalDocumentProps {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export function LegalDocument({
  title,
  lastUpdated,
  intro,
  sections,
}: LegalDocumentProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-6">
          <Link
            href="/login"
            className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
          >
            <AppLogo alt={APP_NAME} size="sm" />
            <span className="font-semibold">{APP_NAME}</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <article className="space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
            <p className="text-muted-foreground leading-relaxed">{intro}</p>
          </header>

          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        <footer className="mt-12 space-y-4 border-t border-border/60 pt-8">
          <LegalLinks />
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
