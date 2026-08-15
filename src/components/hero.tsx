"use client";

import Image from "next/image";
import { useLocale } from "@/components/locale-provider";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=2000&q=80";

export function Hero() {
  const { t, locale } = useLocale();

  const advocateMessage =
    locale === "sw"
      ? "Habari ShambaTrust, ningependa kuzungumza na wakili kuhusu urithi wa familia yangu."
      : "Hello ShambaTrust, I would like to talk to an advocate about my family's legacy.";

  return (
    <section className="relative min-h-[100svh] overflow-hidden text-white">
      <Image
        src={HERO_IMAGE}
        alt="Kenyan farmland under open sky"
        fill
        priority
        className="hero-media object-cover object-center"
        sizes="100vw"
      />
      <div
        className="absolute inset-0"
        style={{ background: "var(--hero-overlay)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(14,28,20,0.25) 0%, rgba(14,28,20,0.55) 55%, rgba(14,28,20,0.82) 100%)",
        }}
        aria-hidden
      />

      <div className="section relative z-10 flex min-h-[100svh] flex-col justify-end pb-14 pt-28 sm:justify-center sm:pb-20">
        <p className="brand-font fade-up mb-4 text-3xl font-semibold tracking-tight text-[#f3f7f2] sm:text-4xl md:text-5xl">
          {t.brand}
        </p>
        <h1 className="fade-up-delay max-w-3xl text-3xl font-semibold text-[#f7faf7] sm:text-4xl md:text-5xl lg:text-[3.35rem]">
          {t.hero.headline}
        </h1>
        <p className="fade-up-delay-2 mt-5 max-w-2xl text-lg text-[#e6efe8] sm:text-xl">
          {t.hero.subhead}
        </p>
        <div className="fade-up-delay-2 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href="/signup" className="btn btn-brass">
            {t.hero.ctaPrimary}
          </a>
          <a
            href={buildWhatsAppUrl(advocateMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            {t.hero.ctaSecondary}
          </a>
        </div>
      </div>
    </section>
  );
}
