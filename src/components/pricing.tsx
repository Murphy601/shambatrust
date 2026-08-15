"use client";

import { useLocale } from "@/components/locale-provider";

export function Pricing() {
  const { t } = useLocale();

  return (
    <section
      id="pricing"
      className="py-16 sm:py-20"
      aria-labelledby="pricing-title"
    >
      <div className="section">
        <h2
          id="pricing-title"
          className="text-3xl font-semibold text-forest-deep sm:text-4xl"
        >
          {t.pricing.title}
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-muted">{t.pricing.subtitle}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {t.pricing.tiers.map((tier) => (
            <article
              key={tier.name}
              className="border-2 border-border bg-surface p-6"
            >
              <h3 className="text-2xl font-semibold text-forest-deep">
                {tier.name}
              </h3>
              <p className="mt-3 text-xl font-semibold text-brass">
                {tier.price}
              </p>
              <p className="mt-4 text-lg text-ink">{tier.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-base text-muted">{t.pricing.note}</p>
      </div>
    </section>
  );
}
