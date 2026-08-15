"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/components/locale-provider";

export default function SuccessionExplainerPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";

  return (
    <>
      <SiteHeader />
      <main className="section py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-brass">
            {sw ? "Mirathi" : "Succession"}
          </p>
          <h1 className="brand-font mt-2 text-4xl font-semibold text-forest-deep sm:text-5xl">
            {sw ? "Mrithi vs Amana — tofauti ni nini?" : "Heir vs trustee — who does what?"}
          </h1>
          <p className="mt-4 text-lg text-muted">
            {sw
              ? "Watu wengi huchanganya majukumu. Hapa kuna maelezo rahisi."
              : "Families often mix these roles up. Here is the simple picture."}
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <article className="rounded-[0.45rem] border-2 border-border bg-surface p-6">
              <h2 className="text-2xl font-semibold text-forest-deep">
                {sw ? "Mrithi (Heir)" : "Heir"}
              </h2>
              <p className="mt-3 text-lg text-ink">
                {sw
                  ? "Anapokea mali au asilimia. Anaweza kuwasilisha dai la mirathi (cheti cha kifo) akiwa ametajwa kwenye hifadhi."
                  : "Receives assets or shares. May file a succession claim (death certificate) if named on the vault."}
              </p>
            </article>
            <article className="rounded-[0.45rem] border-2 border-border bg-surface p-6">
              <h2 className="text-2xl font-semibold text-forest-deep">
                {sw ? "Amana (Trustee)" : "Trustee"}
              </h2>
              <p className="mt-3 text-lg text-ink">
                {sw
                  ? "Anathibitisha dai ni la kweli kwa OTP. Mzee anawaongeza chini ya Utekelezaji — si fomu ya warithi."
                  : "Confirms the claim is real via OTP. The elder adds them under Execution — not on the heirs form."}
              </p>
            </article>
          </div>

          <ol className="mt-10 list-decimal space-y-3 pl-6 text-lg text-ink">
            <li>
              {sw
                ? "Mzee anaweka warithi na amana (wakati hifadhi bado ni rasimu)."
                : "Elder names heirs and trustees while the vault is still a draft."}
            </li>
            <li>
              {sw
                ? "Baada ya muhuri, mrithi au amana anaweza kuwasilisha cheti cha kifo."
                : "After seal, an heir or trustee can file the death certificate."}
            </li>
            <li>
              {sw
                ? "Amana wanathibitisha kwa OTP → Ops → Wakili."
                : "Trustees approve by OTP → Ops verifies → Advocate takes over."}
            </li>
          </ol>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-primary">
              {sw ? "Fungua hifadhi" : "Open vault"}
            </Link>
            <Link href="/faq" className="btn btn-secondary-dark">
              FAQ
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
