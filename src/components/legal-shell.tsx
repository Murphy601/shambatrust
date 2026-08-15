"use client";

import Link from "next/link";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/components/locale-provider";

export function LegalShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { t, locale } = useLocale();

  return (
    <>
      <SiteHeader />
      <main className="pb-16 pt-8">
        <div className="section max-w-3xl">
          <Link
            href="/"
            className="text-base font-semibold text-forest underline-offset-4 hover:underline"
          >
            ← {locale === "sw" ? "Rudi nyumbani" : "Back to home"}
          </Link>
          <h1 className="mt-6 text-3xl font-semibold text-forest-deep sm:text-4xl">
            {title}
          </h1>
          {children}
          <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-base font-semibold">
            <Link href="/terms" className="text-forest underline-offset-4 hover:underline">
              {locale === "sw" ? "Masharti" : "Terms"}
            </Link>
            <Link href="/privacy" className="text-forest underline-offset-4 hover:underline">
              {locale === "sw" ? "Faragha" : "Privacy"}
            </Link>
            <Link href="/faq" className="text-forest underline-offset-4 hover:underline">
              FAQ
            </Link>
            <Link href="/#contact" className="text-forest underline-offset-4 hover:underline">
              {t.nav.contact}
            </Link>
          </nav>
        </div>
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
