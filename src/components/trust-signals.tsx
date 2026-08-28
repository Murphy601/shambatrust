"use client";

import { LandingPhoto } from "@/components/landing-photo";
import { useLocale } from "@/components/locale-provider";

export function TrustSignals() {
  const { t, locale } = useLocale();

  return (
    <section
      id="trust"
      className="border-y border-border bg-[#0B1D3A] py-16 text-white sm:py-20"
      aria-labelledby="trust-title"
    >
      <div className="section">
        <h2
          id="trust-title"
          className="text-3xl font-semibold text-[#f4f8f4] sm:text-4xl"
        >
          {t.trust.title}
        </h2>

        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <LandingPhoto
            src="/landing/advocates.png"
            alt={
              locale === "sw"
                ? "Mawakili wa Kenya wakiangalia faili la mirathi lililofungwa muhuri ofisini"
                : "Kenyan advocates reviewing a stamped succession file in a panelled office"
            }
            className="min-h-[16rem]"
          />
        <ul className="grid gap-4">
          {t.trust.badges.map((badge) => (
            <li
              key={badge}
              className="border border-[rgba(233,240,234,0.28)] px-4 py-5 text-lg font-semibold"
            >
              {badge}
            </li>
          ))}
        </ul>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded border border-[rgba(233,240,234,0.28)] px-4 py-5">
            <p className="text-3xl font-semibold text-[#d4a574]">120+</p>
            <p className="mt-1 text-base text-[#c7d6cb]">
              {locale === "sw"
                ? "Familia zilizolindwa (bila majina)"
                : "Families protected (anonymized)"}
            </p>
          </div>
          <div className="rounded border border-[rgba(233,240,234,0.28)] px-4 py-5">
            <p className="text-3xl font-semibold text-[#d4a574]">LSK</p>
            <p className="mt-1 text-base text-[#c7d6cb]">
              {locale === "sw"
                ? "Mawakili wenye cheti walioidhinishwa"
                : "Vetted practising advocates only"}
            </p>
          </div>
          <div className="rounded border border-[rgba(233,240,234,0.28)] px-4 py-5">
            <p className="text-3xl font-semibold text-[#d4a574]">48h</p>
            <p className="mt-1 text-base text-[#c7d6cb]">
              {locale === "sw"
                ? "Dirisha la bure la marekebisho baada ya kuwasilisha"
                : "Free amendment window after submit"}
            </p>
          </div>
        </div>

        <blockquote className="mt-12 max-w-3xl border-l-4 border-brass-soft pl-5">
          <p className="text-xl leading-relaxed text-[#f2f7f2] sm:text-2xl">
            “{t.trust.quote}”
          </p>
          <footer className="mt-4 text-base text-[#c7d6cb]">
            {t.trust.quoteAttr}
          </footer>
        </blockquote>

        <p className="mt-8 text-lg text-[#c7d6cb]">{t.trust.partners}</p>
      </div>
    </section>
  );
}
