"use client";

import { useLocale } from "@/components/locale-provider";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function FloatingWhatsApp() {
  const { t, locale } = useLocale();

  const message =
    locale === "sw"
      ? "Habari ShambaTrust, ningependa msaada kuhusu urithi wa familia."
      : "Hello ShambaTrust, I need help securing my family's legacy.";

  return (
    <a
      href={buildWhatsAppUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 inline-flex min-h-14 items-center gap-2 rounded-[0.4rem] bg-[#146c43] px-4 text-base font-semibold text-white shadow-none transition-colors hover:bg-[#0f5635] sm:bottom-6 sm:right-6"
      aria-label={t.floatingWhatsapp}
    >
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-sm bg-[#8dffc0]"
      />
      {t.floatingWhatsapp}
    </a>
  );
}
