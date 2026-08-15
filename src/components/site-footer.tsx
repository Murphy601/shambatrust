"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function SiteFooter() {
  const { t, locale, toggleLocale } = useLocale();

  const message =
    locale === "sw"
      ? "Habari ShambaTrust, nina swali kuhusu urithi wangu."
      : "Hello ShambaTrust, I have a question about my legacy.";

  return (
    <footer className="border-t border-border bg-surface py-12">
      <div className="section grid gap-8 md:grid-cols-4">
        <div>
          <p className="brand-font text-2xl font-semibold text-forest-deep">
            {t.brand}
          </p>
          <p className="mt-2 text-base text-muted">{t.tagline}</p>
        </div>
        <div>
          <p className="font-semibold text-forest-deep">{t.footer.hotline}</p>
          <a
            href="tel:+254748879579"
            className="mt-2 block text-lg font-semibold text-ink underline-offset-4 hover:underline"
          >
            {t.footer.hotlineNumber}
          </a>
          <a
            href={buildWhatsAppUrl(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block font-semibold text-forest underline-offset-4 hover:underline"
          >
            WhatsApp
          </a>
        </div>
        <div>
          <p className="font-semibold text-forest-deep">{t.footer.offices}</p>
          <p className="mt-2 text-lg text-ink">{t.footer.officeList}</p>
          <button
            type="button"
            onClick={toggleLocale}
            className="mt-4 font-semibold text-forest underline-offset-4 hover:underline"
          >
            {t.langToggle}
          </button>
        </div>
        <div>
          <p className="font-semibold text-forest-deep">{t.footer.legal}</p>
          <ul className="mt-2 space-y-2 text-lg">
            <li>
              <Link
                href="/terms"
                className="font-semibold text-ink underline-offset-4 hover:underline"
              >
                {t.footer.terms}
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="font-semibold text-ink underline-offset-4 hover:underline"
              >
                {t.footer.privacyLink}
              </Link>
            </li>
            <li>
              <Link
                href="/faq"
                className="font-semibold text-ink underline-offset-4 hover:underline"
              >
                {t.footer.faq}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="section mt-10 border-t border-border pt-6">
        <p className="text-base text-muted">{t.footer.privacy}</p>
        <p className="mt-2 text-base text-muted">{t.footer.rights}</p>
      </div>
    </footer>
  );
}
