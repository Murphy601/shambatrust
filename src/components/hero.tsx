"use client";

import { useLocale } from "@/components/locale-provider";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function Hero() {
  const { t, locale } = useLocale();

  const advocateMessage =
    locale === "sw"
      ? "Habari ShambaTrust, ningependa kuzungumza na wakili kuhusu urithi wa familia yangu."
      : "Hello ShambaTrust, I would like to talk to an advocate about my family's legacy.";

  return (
    <section
      className="relative min-h-[100svh] overflow-hidden bg-[#0B1D3A] bg-cover bg-center text-white"
      style={{ backgroundImage: "url(/landing/hero-kericho.png)" }}
      aria-label="Misty morning over rolling Kericho farmland and a modest homestead"
    >
      <div
        className="absolute inset-0"
        style={{ background: "var(--hero-overlay)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,29,58,0.28) 0%, rgba(11,29,58,0.58) 55%, rgba(11,29,58,0.86) 100%)",
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
        <div className="fade-up-delay-2 mt-8 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href="/signup" className="btn btn-primary w-full sm:w-auto">
            {t.hero.ctaPrimary}
          </a>
          <a
            href={buildWhatsAppUrl(advocateMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary w-full sm:w-auto"
          >
            {t.hero.ctaSecondary}
          </a>
        </div>
      </div>
    </section>
  );
}
