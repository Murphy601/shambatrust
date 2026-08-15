"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { useLocale } from "@/components/locale-provider";

const ACTIONS = [
  {
    key: "vault",
    en: "Start / open my Shamba Vault",
    sw: "Anza / fungua Hifadhi yangu",
    href: "/signup",
    wa: "I want to start or open my Shamba Vault.",
  },
  {
    key: "login",
    en: "Sign in to my vault",
    sw: "Ingia kwenye hifadhi yangu",
    href: "/login",
    wa: "I want to sign in to my existing Shamba Vault.",
  },
  {
    key: "succession",
    en: "File or continue succession",
    sw: "Wasilisha au endelea na mirathi",
    href: "/vault/succession",
    wa: "I need help with succession filing.",
  },
  {
    key: "advocate",
    en: "Apply as partner advocate",
    sw: "Omba kama wakili mshirika",
    href: "/advocates/apply",
    wa: "I want to apply as a ShambaTrust partner advocate.",
  },
] as const;

export default function WhatsAppBotEntryPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";

  return (
    <>
      <SiteHeader />
      <main className="section py-14">
        <div className="mx-auto max-w-lg">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-brass">
            WhatsApp
          </p>
          <h1 className="brand-font mt-2 text-4xl font-semibold text-forest-deep">
            {sw ? "Anza kutoka gumzo" : "Start from chat"}
          </h1>
          <p className="mt-4 text-lg text-muted">
            {sw
              ? "Chagua unachotaka — tutafungua kiungo sahihi au WhatsApp yenye ujumbe tayari."
              : "Pick what you need — we’ll open the right link or WhatsApp with a ready message."}
          </p>
          <ul className="mt-8 space-y-3">
            {ACTIONS.map((a) => (
              <li key={a.key} className="rounded-[0.45rem] border-2 border-border bg-surface p-4">
                <p className="font-semibold text-forest-deep">
                  {sw ? a.sw : a.en}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={a.href} className="btn btn-primary">
                    {sw ? "Fungua" : "Open"}
                  </Link>
                  <a
                    href={buildWhatsAppUrl(
                      sw ? `Habari ShambaTrust, ${a.sw}` : `Hello ShambaTrust, ${a.wa}`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-whatsapp"
                  >
                    WhatsApp
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
