"use client";

import { useLocale } from "@/components/locale-provider";
import { LandingPhoto } from "@/components/landing-photo";

export function HowItWorks() {
  const { t, locale } = useLocale();

  return (
    <section
      id="how"
      className="border-y border-border bg-bg-deep/70 py-16 sm:py-20"
      aria-labelledby="how-title"
    >
      <div className="section grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <h2
            id="how-title"
            className="text-3xl font-semibold text-forest-deep sm:text-4xl"
          >
            {t.how.title}
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-muted">{t.how.subtitle}</p>

          <ol className="mt-10 grid gap-8">
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
        <LandingPhoto
          src="/landing/how-it-works.png"
          alt={
            locale === "sw"
              ? "Mwanamke wa Kenya akiangalia simu mezani nyumbani Nairobi"
              : "A Kenyan woman reviewing her phone at a sunlit kitchen table in Nairobi"
          }
          className="h-52 w-full min-h-52 sm:h-72 sm:min-h-72 lg:h-full"
        />
      </div>
    </section>
  );
}
