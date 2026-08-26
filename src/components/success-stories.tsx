"use client";

import { CarouselArrows, CarouselDots, useCarousel } from "@/components/carousel";
import { useLocale } from "@/components/locale-provider";

const AUTO_ADVANCE_MS = 7000;

export function SuccessStories() {
  const { t } = useLocale();
  const stories = t.stories.items;
  const { trackRef, activeIndex, goTo, next, previous, pauseHandlers } =
    useCarousel({ count: stories.length, autoPlayMs: AUTO_ADVANCE_MS });

  return (
    <section
      id="stories"
      className="border-y border-border py-16 sm:py-20"
      aria-labelledby="stories-title"
    >
      <div className="section">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2
              id="stories-title"
              className="text-3xl font-semibold text-forest-deep sm:text-4xl"
            >
              {t.stories.title}
            </h2>
            <p className="mt-3 text-lg text-muted">{t.stories.subtitle}</p>
          </div>
          <CarouselArrows
            onPrevious={previous}
            onNext={next}
            previousLabel={t.carousel.previous}
            nextLabel={t.carousel.next}
          />
        </div>

        <div className="mt-10" {...pauseHandlers}>
          <div
            ref={trackRef}
            className="carousel-track"
            role="group"
            aria-roledescription="carousel"
            aria-label={t.stories.title}
            tabIndex={0}
          >
            {stories.map((story, index) => (
              <article
                key={story.name}
                className="carousel-slide flex flex-col justify-between rounded-[0.45rem] border-2 border-border bg-surface p-6 sm:p-7"
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} / ${stories.length} — ${story.county}`}
              >
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.12em] text-brass">
                    {story.county}
                  </p>
                  <blockquote className="mt-4 border-l-4 border-brass-soft pl-4">
                    <p className="text-xl leading-relaxed text-ink">
                      “{story.quote}”
                    </p>
                  </blockquote>
                </div>
                <div className="mt-6">
                  <p className="text-lg font-semibold text-forest-deep">
                    {story.name}
                  </p>
                  <p className="text-base text-muted">{story.detail}</p>
                  <p className="mt-3 rounded-[0.35rem] bg-[color-mix(in_srgb,var(--forest)_9%,white)] px-3 py-2 text-base text-forest-deep">
                    <span className="font-semibold">
                      {t.stories.outcomeLabel}:
                    </span>{" "}
                    {story.outcome}
                  </p>
                  <p className="mt-3 text-sm font-semibold uppercase tracking-[0.1em] text-forest">
                    ✓ {t.stories.verified}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <CarouselDots
              count={stories.length}
              activeIndex={activeIndex}
              onSelect={goTo}
              label={t.stories.title}
              slideLabel={(index) =>
                `${t.carousel.goToSlide} ${index + 1}: ${stories[index].county}`
              }
            />
            <p className="text-sm text-muted">{t.carousel.pauseHint}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
