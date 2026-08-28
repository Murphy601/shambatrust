"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

export function WillVsTrust() {
  const { locale } = useLocale();
  const sw = locale === "sw";

  return (
    <section
      id="will-trust"
      className="py-16 sm:py-20"
      aria-labelledby="will-trust-title"
    >
      <div className="section">
        <h2
          id="will-trust-title"
          className="text-3xl font-semibold text-forest-deep sm:text-4xl"
        >
          {sw ? "Wosia au Amana ya Ardhi ya Familia?" : "Will vs Family Land Trust"}
        </h2>
        <p className="mt-3 max-w-3xl text-lg text-muted">
          {sw
            ? "Chagua njia inayofaa urithi wako. Wosia hulinda pesa na vitu vya kibinafsi. Amana hulinda mashamba yasigawanywe."
            : "Choose the path that fits your legacy. A will covers personal belongings and cash. A family land trust keeps shambas unified."}
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <article className="rounded-[0.45rem] bg-[#0B1D3A] p-6 text-white sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#D4AF37]">
              {sw ? "Wosia ulioandikwa" : "Written will"}
            </p>
            <h3 className="mt-2 text-3xl font-semibold">
              {sw ? "Bei ya chini mwanzoni" : "Lower cost to start"}
            </h3>
            <ul className="mt-5 space-y-3 text-lg text-slate-100">
              <li>
                {sw
                  ? "Hufunika M-Pesa, SACCO, akaunti za benki, na vitu vya nyumbani."
                  : "Covers M-Pesa, SACCOs, bank accounts, and household belongings."}
              </li>
              <li>
                {sw
                  ? "Inafuata Kifungu cha 11 cha Sheria ya Mirathi — mashahidi 2 wasio warithi."
                  : "Follows Section 11 of the Law of Succession Act — 2 independent non-beneficiary witnesses."}
              </li>
              <li>
                {sw
                  ? "Huteua mtekelezaji wa kuaminika kusimamia mirathi."
                  : "Appoints a trusted executor to manage the estate."}
              </li>
              <li>
                {sw
                  ? "Inapitia Mahakama Kuu (probate) — kawaida miezi 6–18 — kisha inakuwa rekodi ya umma."
                  : "Goes through High Court probate (typically 6–18 months) and becomes a public record."}
              </li>
            </ul>
            <Link href="/signup" className="btn btn-primary mt-8 w-full sm:w-auto">
              {sw ? "Andika wosia wangu" : "Draft My Will"}
            </Link>
          </article>

          <article className="rounded-[0.45rem] bg-[#0B1D3A] p-6 text-white sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#D4AF37]">
              {sw ? "Amana / kampuni ya familia" : "Family land trust"}
            </p>
            <h3 className="mt-2 text-3xl font-semibold">
              {sw ? "Shamba linabaki pamoja" : "Keeps land unified"}
            </h3>
            <ul className="mt-5 space-y-3 text-lg text-slate-100">
              <li>
                {sw
                  ? "Hulinda mashamba ya ukoo yasigawanywe au kuuzwa kila kizazi bila ridhaa ya familia."
                  : "Protects ancestral shambas from being split or sold off every generation."}
              </li>
              <li>
                {sw
                  ? "Huepuka ucheleweshaji wa mahakama — mawakili wa amana wanaendelea mara moja, kwa siri."
                  : "Avoids court probate delays, offering immediate continuity and total privacy."}
              </li>
              <li>
                {sw
                  ? "Ardhi inakaa chini ya muundo wa familia — si mgawanyo wa haraka."
                  : "Kept under a unified family holding structure — not a rushed subdivision."}
              </li>
              <li>
                {sw
                  ? "Wateule wa amana wanasimamia shamba bila kungoja amri ya mahakama."
                  : "Allows seamless management through appointed trustees without court intervention."}
              </li>
            </ul>
            <Link href="/signup" className="btn btn-primary mt-8 w-full sm:w-auto">
              {sw ? "Tengeneza amana" : "Structure My Trust"}
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
