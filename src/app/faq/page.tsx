"use client";

import { LegalShell } from "@/components/legal-shell";
import { useLocale } from "@/components/locale-provider";
import { getFaqs } from "@/lib/legal-copy";

export default function FaqPage() {
  const { locale } = useLocale();
  const doc = getFaqs(locale);

  return (
    <LegalShell title={doc.title}>
      <p className="mt-6 text-lg leading-relaxed text-muted">{doc.intro}</p>
      <div className="mt-10 space-y-4">
        {doc.items.map((item) => (
          <details
            key={item.q}
            className="group rounded-[0.45rem] border-2 border-border bg-surface px-5 py-4"
          >
            <summary className="cursor-pointer list-none text-lg font-semibold text-forest-deep marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-3">
                {item.q}
                <span className="text-brass group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-3 text-lg leading-relaxed text-ink">{item.a}</p>
          </details>
        ))}
      </div>
    </LegalShell>
  );
}
