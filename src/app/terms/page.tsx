"use client";

import { LegalShell } from "@/components/legal-shell";
import { useLocale } from "@/components/locale-provider";
import { getTerms } from "@/lib/legal-copy";

export default function TermsPage() {
  const { locale } = useLocale();
  const doc = getTerms(locale);

  return (
    <LegalShell title={doc.title}>
      <p className="mt-2 text-base text-muted">{doc.updated}</p>
      <p className="mt-6 text-lg leading-relaxed text-ink">{doc.intro}</p>
      <div className="mt-10 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold text-forest-deep">
              {section.heading}
            </h2>
            {section.body.map((para) => (
              <p key={para.slice(0, 48)} className="mt-3 text-lg leading-relaxed text-ink">
                {para}
              </p>
            ))}
          </section>
        ))}
      </div>
    </LegalShell>
  );
}
