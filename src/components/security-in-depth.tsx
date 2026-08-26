"use client";

import { useLocale } from "@/components/locale-provider";

export function SecurityInDepth() {
  const { locale } = useLocale();
  const sw = locale === "sw";
  const items = [
    {
      title: sw ? "Hifadhi isiyobadilishwa kimya" : "Zero-knowledge document vault",
      body: sw
        ? "Wafanyakazi hawawezi kubadilisha wosia au warithi bila idhini yako au ya wakili."
        : "Staff cannot alter wills or reassign heirs without your or the advocate’s authorisation.",
    },
    {
      title: sw ? "Hati miliki zilizosimbwa AES-256" : "AES-256 encrypted title storage",
      body: sw
        ? "Skani za hati, vitambulisho, na logbook zinalindwa kwa usimbaji wa kiwango cha benki."
        : "Deed scans, IDs, and logbooks are protected with bank-level encryption in transit and at rest in a secure document database.",
    },
    {
      title: sw ? "Sheria ya Ulinzi wa Data, 2019" : "Data Protection Act compliance",
      body: sw
        ? "Tunafuata Sheria ya Ulinzi wa Data ya Kenya na tunafanya kazi na mawakili wa LSK."
        : "Built for Kenya’s Data Protection Act (2019) and backed by Law Society of Kenya network advocates.",
    },
  ];

  return (
    <section
      id="security"
      className="py-16 sm:py-20"
      aria-labelledby="security-title"
    >
      <div className="section">
        <h2
          id="security-title"
          className="text-3xl font-semibold text-forest-deep sm:text-4xl"
        >
          {sw ? "Usalama wa kina" : "Security in Depth"}
        </h2>
        <p className="mt-3 max-w-3xl text-lg text-muted">
          {sw
            ? "Wakenya wanaogopa udanganyifu wa ardhi mtandaoni. Hivi ndivyo tunavyolinda hati zako."
            : "Kenyans are right to be wary of digital land scams. This is how we protect your papers."}
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.title}
              className="rounded-[0.45rem] bg-[#0B1D3A] p-6 text-white"
            >
              <p className="text-2xl text-[#12B76A]" aria-hidden>
                ●
              </p>
              <h3 className="mt-3 text-2xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-lg text-slate-200">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
