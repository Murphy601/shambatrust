"use client";

import Link from "next/link";
import { CarouselArrows, useCarousel } from "@/components/carousel";
import { useLocale } from "@/components/locale-provider";

/**
 * The four-step onboarding slider. Unlike the testimonial carousel this one
 * never auto-advances: it is a sequence a reader works through, so control
 * stays with them.
 */
export function OnboardingJourney() {
  const { t } = useLocale();
  const steps = t.journey.steps;
  const { trackRef, activeIndex, goTo, next, previous, pauseHandlers } =
    useCarousel({ count: steps.length });

  const progress = ((activeIndex + 1) / steps.length) * 100;

  return (
    <section
      id="journey"
      className="border-b border-border bg-bg-deep/70 py-16 sm:py-20"
      aria-labelledby="journey-title"
    >
      <div className="section">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2
              id="journey-title"
              className="text-3xl font-semibold text-forest-deep sm:text-4xl"
            >
              {t.journey.title}
            </h2>
            <p className="mt-3 text-lg text-muted">{t.journey.subtitle}</p>
          </div>
          <CarouselArrows
            onPrevious={previous}
            onNext={next}
            previousLabel={t.carousel.previous}
            nextLabel={t.carousel.next}
            atStart={activeIndex === 0}
            atEnd={activeIndex === steps.length - 1}
          />
        </div>

        <ol className="mt-8 flex flex-wrap gap-2" aria-label={t.journey.title}>
          {steps.map((step, index) => {
            const active = index === activeIndex;
            const done = index < activeIndex;
            return (
              <li key={step.title}>
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={active ? "step" : undefined}
                  className={`min-h-11 rounded-[0.35rem] border-2 px-3 py-2 text-base font-semibold transition-colors ${
                    active
                      ? "border-forest bg-forest text-white"
                      : done
                        ? "border-forest bg-surface text-forest"
                        : "border-border bg-surface text-muted hover:border-forest"
                  }`}
                >
                  <span aria-hidden="true">
                    {done ? "✓" : String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="ml-2 hidden sm:inline">{step.title}</span>
                  <span className="ml-2 sm:hidden">
                    {t.journey.stepLabel} {index + 1}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-6" {...pauseHandlers}>
          <div className="journey-progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div
            ref={trackRef}
            className="carousel-track mt-6"
            role="group"
            aria-roledescription="carousel"
            aria-label={t.journey.title}
            tabIndex={0}
          >
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="carousel-slide carousel-slide-wide rounded-[0.45rem] border-2 border-border bg-surface p-6 sm:p-8"
                role="group"
                aria-roledescription="slide"
                aria-label={`${t.journey.stepLabel} ${index + 1} ${t.journey.of} ${steps.length}`}
              >
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-brass">
                  {t.journey.stepLabel} {index + 1} {t.journey.of} {steps.length}
                </p>
                <div className="mt-3 flex items-start gap-4">
                  <p
                    className="brand-font text-5xl font-semibold text-brass/70"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <div>
                    <h3 className="text-2xl font-semibold text-forest-deep">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-lg text-ink">{step.body}</p>
                    <p className="mt-3 text-base text-muted">{step.detail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <Link href="/signup" className="btn btn-primary">
            {t.journey.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
