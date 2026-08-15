"use client";

import { useLocale } from "@/components/locale-provider";

export function HowItWorks() {
  const { t } = useLocale();

  return (
    <section
      id="how"
      className="border-y border-border bg-bg-deep/70 py-16 sm:py-20"
      aria-labelledby="how-title"
    >
      <div className="section">
        <h2
          id="how-title"
          className="text-3xl font-semibold text-forest-deep sm:text-4xl"
        >
          {t.how.title}
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-muted">{t.how.subtitle}</p>

        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {t.how.steps.map((step, index) => (
            <li key={step.title} className="relative">
              <p className="brand-font text-5xl font-semibold text-brass/80">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-forest-deep">
                {step.title}
              </h3>
              <p className="mt-3 text-lg text-ink">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
