"use client";

import { LandingPhoto } from "@/components/landing-photo";
import { useLocale } from "@/components/locale-provider";

const ITEMS = {
  en: [
    {
      q: "Can my family dispute a digital title deed vault in court?",
      a: "The vault is evidence and a sealed plan — not a replacement for a court grant. A partner advocate uses your documents to file for Grant of Representation. A well-kept vault with an LSK-reviewed will makes disputes harder, not impossible.",
    },
    {
      q: "How does ShambaTrust integrate with ArdhiSasa land searches?",
      a: "You capture the title/LR, parcel, block, registry section, and ArdhiSasa account ID. A partner LSK advocate then files the search on their professional ArdhiSasa account. The registered owner must consent by OTP on ArdhiSasa itself. The advocate uploads the official digital search PDF into your Document Vault. Status starts as Pending Advocate Submission.",
    },
    {
      q: "What happens to my M-Pesa and SACCO savings if I don't leave a will?",
      a: "Without a will or nominee form, Safaricom and SACCOs follow their own rules and the Law of Succession Act intestacy rules. That often means frozen funds, family arguments, and long delays. Name nominees and record membership numbers in the vault.",
    },
    {
      q: "Is a Will written on ShambaTrust legally binding under the Law of Succession Act?",
      a: "The draft is a starting point. It becomes a valid written will only after you sign in the presence of two adult witnesses who are not beneficiaries (Section 11), and a partner advocate reviews and seals it. We never skip that step.",
    },
  ],
  sw: [
    {
      q: "Je, familia inaweza kupinga hifadhi ya hati miliki mahakamani?",
      a: "Hifadhi ni ushahidi na mpango uliofungwa — si badala ya amri ya mahakama. Wakili mshirika hutumia nyaraka zako kuomba Grant of Representation. Wosia uliokaguliwa na LSK hufanya mizozo kuwa ngumu, si kuizuia kabisa.",
    },
    {
      q: "ShambaTrust inaunganishwaje na ArdhiSasa?",
      a: "Unahifadhi nambari ya hati/LR, kiwanja, block, sehemu ya usajili, na ArdhiSasa ID. Wakili mshirika wa LSK anawasilisha ombi kwenye akaunti yake ya kitaalamu. Mmiliki lazima aidhinishe kwa OTP kwenye ArdhiSasa. Wakili anapakia PDF rasmi kwenye hifadhi yako. Hali huanza kama Inasubiri uwasilishaji wa wakili.",
    },
    {
      q: "M-Pesa na SACCO zinaenda wapi bila wosia?",
      a: "Bila wosia au fomu ya mteule, Safaricom na SACCO zinafuata sheria zao na Sheria ya Mirathi. Mara nyingi pesa hufungwa na familia inagombana. Taja wateule na nambari za uanachama kwenye hifadhi.",
    },
    {
      q: "Je, wosia wa ShambaTrust una nguvu kisheria?",
      a: "Rasimu ni mwanzo. Inakuwa wosia halali baada ya kusaini mbele ya mashahidi 2 watu wazima ambao SI warithi (Kifungu cha 11), na wakili mshirika kuukagua na kuufunga. Hatukuruka hatua hiyo.",
    },
  ],
};

export function KenyaFaq() {
  const { locale } = useLocale();
  const items = ITEMS[locale];

  return (
    <section
      id="kenya-faq"
      className="bg-[#F8F9FA] py-16 sm:py-20"
      aria-labelledby="kenya-faq-title"
    >
      <div className="section">
        <h2
          id="kenya-faq-title"
          className="text-3xl font-semibold text-forest-deep sm:text-4xl"
        >
          {locale === "sw" ? "Maswali ya kisheria ya Kenya" : "Kenya legal questions"}
        </h2>
        <p className="mt-3 max-w-3xl text-lg text-muted">
          {locale === "sw"
            ? "Majibu mafupi kuhusu wosia, ArdhiSasa, M-Pesa, na mahakama za Kenya."
            : "Short answers on wills, ArdhiSasa, M-Pesa, and Kenyan courts."}
        </p>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <LandingPhoto
            src="/landing/title-verify.png"
            alt={
              locale === "sw"
                ? "Kurasa za hati miliki ya Kenya zilizo na muhuri wa kijani wa uthibitisho"
                : "Kenyan land-title pages with a green verified stamp and official seals"
            }
            className="min-h-[18rem] lg:min-h-[26rem]"
          />
        <div className="space-y-4">
          {items.map((item) => (
            <details
              key={item.q}
              className="group rounded-[0.45rem] border-2 border-border bg-surface px-5 py-4"
            >
              <summary className="cursor-pointer list-none text-lg font-semibold text-forest-deep marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  {item.q}
                  <span className="shrink-0 text-2xl leading-none text-[#1E5631] group-open:hidden">
                    +
                  </span>
                  <span className="hidden shrink-0 text-2xl leading-none text-[#1E5631] group-open:inline">
                    −
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-lg leading-relaxed text-ink">{item.a}</p>
            </details>
          ))}
        </div>
        </div>
      </div>
    </section>
  );
}
