"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

type CarouselOptions = {
  /** Number of slides in the track. */
  count: number;
  /** Milliseconds between auto-advances. Omit or pass 0 to disable autoplay. */
  autoPlayMs?: number;
};

export type Carousel = {
  trackRef: RefObject<HTMLDivElement | null>;
  activeIndex: number;
  goTo: (index: number) => void;
  next: () => void;
  previous: () => void;
  /** Bind to the element wrapping the track so hover/focus pauses autoplay. */
  pauseHandlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocusCapture: () => void;
    onBlurCapture: (event: React.FocusEvent<HTMLElement>) => void;
    onTouchStart: () => void;
  };
  isPaused: boolean;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Drives a CSS scroll-snap carousel.
 *
 * The track owns the scroll position, so touch swipes, trackpad gestures and
 * keyboard scrolling all keep working; this hook only mirrors that position
 * into React state and provides programmatic controls on top of it.
 */
export function useCarousel({ count, autoPlayMs = 0 }: CarouselOptions): Carousel {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);

  const clamp = useCallback(
    (index: number) => {
      if (count <= 0) return 0;
      return ((index % count) + count) % count;
    },
    [count],
  );

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track || count <= 0) return;
      const target = track.children[clamp(index)] as HTMLElement | undefined;
      if (!target) return;
      // Scroll the track itself rather than using scrollIntoView, which would
      // also drag the whole page vertically towards the carousel.
      const left =
        target.offsetLeft - (track.clientWidth - target.clientWidth) / 2;
      track.scrollTo({
        left: Math.max(0, left),
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    },
    [clamp, count],
  );

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const previous = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  // Mirror scroll position into activeIndex.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    const sync = () => {
      frame = 0;
      const center = track.scrollLeft + track.clientWidth / 2;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < track.children.length; i += 1) {
        const child = track.children[i] as HTMLElement;
        const childCenter = child.offsetLeft + child.clientWidth / 2;
        const distance = Math.abs(childCenter - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      setActiveIndex(bestIndex);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [count]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setDocumentHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const isPaused = hoverPaused || reducedMotion || documentHidden;

  useEffect(() => {
    if (!autoPlayMs || autoPlayMs <= 0 || count <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        const target = clamp(current + 1);
        goTo(target);
        return current;
      });
    }, autoPlayMs);
    return () => window.clearInterval(timer);
  }, [autoPlayMs, clamp, count, goTo, isPaused]);

  const pauseHandlers = useMemo(
    () => ({
      onMouseEnter: () => setHoverPaused(true),
      onMouseLeave: () => setHoverPaused(false),
      onFocusCapture: () => setHoverPaused(true),
      onBlurCapture: (event: React.FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHoverPaused(false);
        }
      },
      // Touch users get no hover; pausing on first touch stops the track from
      // sliding out from under a finger mid-swipe.
      onTouchStart: () => setHoverPaused(true),
    }),
    [],
  );

  return { trackRef, activeIndex, goTo, next, previous, pauseHandlers, isPaused };
}

export function CarouselDots({
  count,
  activeIndex,
  onSelect,
  label,
  slideLabel,
}: {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  label: string;
  slideLabel: (index: number) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          role="tab"
          className="carousel-dot"
          aria-current={index === activeIndex}
          aria-selected={index === activeIndex}
          aria-label={slideLabel(index)}
          onClick={() => onSelect(index)}
        />
      ))}
    </div>
  );
}

export function CarouselArrows({
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  atStart,
  atEnd,
}: {
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  atStart?: boolean;
  atEnd?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="carousel-arrow"
        onClick={onPrevious}
        aria-label={previousLabel}
        disabled={atStart}
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        type="button"
        className="carousel-arrow"
        onClick={onNext}
        aria-label={nextLabel}
        disabled={atEnd}
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
