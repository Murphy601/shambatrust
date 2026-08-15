"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/components/locale-provider";

export default function AdvocatesJoinLandingPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";

  const steps = sw
    ? [
        "Wasilisha ombi + ID + cheti cha LSK",
        "Ops inakagua (siku 2–5 kawaida)",
        "Unapata WhatsApp: approved / rejected / need info",
        "Ingia lango: simu OTP + nambari ya LSK",
      ]
    : [
        "Submit application + ID + LSK certificate",
        "Ops reviews (typically 2–5 days)",
        "You get WhatsApp: approved / rejected / need info",
        "Sign in: phone OTP + LSK practising number",
      ];

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border bg-[linear-gradient(135deg,#1a3328_0%,#0f1f18_50%,#243528_100%)] py-16 text-[#f4f1ea] sm:py-24">
          <div className="section relative z-10 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#d4a574]">
              LSK partners
            </p>
            <h1 className="brand-font mt-3 text-4xl font-semibold sm:text-6xl">
              {sw
                ? "Jiunge na timu ya mawakili wa ShambaTrust"
                : "Join the ShambaTrust advocate bench"}
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-[#c5d0c8]">
              {sw
                ? "Kazi ya urithi iliyopangwa, wateja waliochunguzwa, na malipo ya uwazi. Si soko huria — ni ushirikiano ulioidhinishwa."
                : "Structured succession work, screened clients, and clear fee splits. Not an open marketplace — an approved partnership."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/advocates/apply"
                className="rounded bg-[#d4a574] px-5 py-3 text-base font-semibold text-[#0f1411]"
              >
                {sw ? "Anza ombi" : "Start application"}
              </Link>
              <Link
                href="/advocate/login"
                className="rounded border border-[#d4a574]/50 px-5 py-3 text-base font-semibold text-[#d4a574]"
              >
                {sw ? "Ingia lango" : "Portal login"}
              </Link>
            </div>
          </div>
        </section>

        <section className="section py-14">
          <h2 className="text-3xl font-semibold text-forest-deep">
            {sw ? "Mahitaji" : "Requirements"}
          </h2>
          <ul className="mt-6 space-y-3 text-lg text-ink">
            <li>{sw ? "Kitambulisho — mbele na nyuma" : "National ID — front and back"}</li>
            <li>{sw ? "Nambari ya LSK + cheti" : "LSK practising number + certificate"}</li>
            <li>{sw ? "Simu na barua pepe" : "Phone and email"}</li>
            <li className="text-muted">
              {sw
                ? "Si lazima: anwani ya ofisi, kampuni, shirika"
                : "Optional: office address, law firm, organization"}
            </li>
          </ul>

          <h2 className="mt-12 text-3xl font-semibold text-forest-deep">
            {sw ? "Ratiba" : "Timeline"}
          </h2>
          <ol className="mt-6 list-decimal space-y-3 pl-6 text-lg text-ink">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>

          <h2 className="mt-12 text-3xl font-semibold text-forest-deep">
            {sw ? "Faida" : "Benefits"}
          </h2>
          <ul className="mt-6 space-y-3 text-lg text-ink">
            <li>
              {sw
                ? "Kesi zilizopangwa: ukaguzi wa kisheria + mirathi"
                : "Pipeline of structured legal-review and succession cases"}
            </li>
            <li>
              {sw
                ? "Mgawanyo wa ada unaonekana (jukwaa / wakili)"
                : "Transparent fee split (platform / advocate)"}
            </li>
            <li>
              {sw
                ? "Zana: checklist, ArdhiSasa lookup, muhuri wa kidijitali"
                : "Tools: checklists, title lookup, digital seal"}
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
