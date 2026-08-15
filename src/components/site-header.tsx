"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function SiteHeader() {
  const { t, locale, toggleLocale } = useLocale();

  const introMessage =
    locale === "sw"
      ? "Habari ShambaTrust, ningependa kulinda urithi wa familia yangu."
      : "Hello ShambaTrust, I want to protect my family's legacy.";

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-[color-mix(in_srgb,var(--bg)_92%,white)] backdrop-blur-md">
      <div className="section flex items-center justify-between gap-3 py-3">
        <Link
          href="/"
          className="brand-font text-2xl font-semibold text-forest-deep sm:text-3xl"
        >
          {t.brand}
        </Link>

        <nav className="hidden items-center gap-5 text-base font-medium text-muted lg:flex">
          <a href="#how" className="hover:text-forest">
            {t.nav.how}
          </a>
          <a href="#audit" className="hover:text-forest">
            {t.nav.audit}
          </a>
          <a href="#pricing" className="hover:text-forest">
            {t.nav.pricing}
          </a>
          <a href="#contact" className="hover:text-forest">
            {t.nav.contact}
          </a>
          <Link href="/advocates" className="hover:text-forest">
            Advocates
          </Link>
          <Link href="/succession-guide" className="hover:text-forest">
            Succession
          </Link>
          <Link href="/help-parent" className="hover:text-forest">
            Help parent
          </Link>
          <Link href="/login" className="hover:text-forest">
            Sign in
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLocale}
            className="min-h-11 rounded-[0.35rem] border-2 border-border bg-surface px-3 text-base font-semibold text-forest-deep hover:border-forest"
            aria-label="Switch language"
          >
            {t.langToggle}
          </button>
          <Link href="/signup" className="btn btn-primary hidden min-h-11 px-3 text-base sm:inline-flex">
            Join
          </Link>
          <a
            href={buildWhatsAppUrl(introMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-whatsapp hidden min-h-11 px-3 text-base md:inline-flex"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </header>
  );
}
