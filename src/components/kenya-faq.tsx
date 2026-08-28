"use client";

import { LandingPhoto } from "@/components/landing-photo";
import { useLocale } from "@/components/locale-provider";

type FaqItem = {
  q: string;
  a?: string;
  steps?: string[];
  note?: string;
};

const ITEMS: Record<"en" | "sw", FaqItem[]> = {
  en: [
    {
      q: "Can I talk instead of filling long forms?",
      a: "Yes. In your vault, open Talk to Amani. Amani asks one simple question at a time in English or Kiswahili. You can speak, type, or photograph an ID or title deed. The usual Assets and Heirs pages still work.",
    },
    {
      q: "Can my family dispute a digital title deed vault in court?",
      a: "The vault is evidence and a sealed plan — not a replacement for a court grant. A partner advocate uses your documents to file for Grant of Representation. A well-kept vault with an LSK-reviewed will makes disputes harder, not impossible.",
    },
    {
      q: "How does ShambaTrust verify land titles on ArdhiSasa?",
      a: "ShambaTrust verifies titles through our partner LSK advocates. You never have to hunt for a Ministry login by yourself.",
      steps: [
        "Land details: enter the parcel or title (LR) number in the vault.",
        "Advocate filing: a verified LSK advocate starts the search on their official ArdhiSasa professional account.",
        "Simple elder consent: sign a one-page paper authorization (easiest), or let a registered child help approve the request in the owner's ArdhiSasa Notifications. This is not an SMS code.",
        "Vault backup: the advocate stores the official Search Certificate in your Document Vault.",
      ],
      note: "Status moves from Pending Verification to Officially Verified by LSK Advocate.",
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
      q: "Naweza kuongea badala ya kujaza fomu ndefu?",
      a: "Ndiyo. Katika hifadhi yako, fungua Ongea na Amani. Amani anauliza swali moja rahisi kwa wakati. Unaweza kuzungumza, kuandika, au kupiga picha ya kitambulisho au hati miliki.",
    },
    {
      q: "Je, familia inaweza kupinga hifadhi ya hati miliki mahakamani?",
      a: "Hifadhi ni ushahidi na mpango uliofungwa — si badala ya amri ya mahakama. Wakili mshirika hutumia nyaraka zako kuomba Grant of Representation. Wosia uliokaguliwa na LSK hufanya mizozo kuwa ngumu, si kuizuia kabisa.",
    },
    {
      q: "ShambaTrust inathibitishaje hati za ardhi kwenye ArdhiSasa?",
      a: "ShambaTrust inathibitisha hati kupitia mawakili washirika wa LSK. Huhitaji kutafuta kuingia kwenye tovuti ya Wizara peke yako.",
      steps: [
        "Maelezo ya kiwanja: weka nambari ya kiwanja au hati (LR) kwenye hifadhi.",
        "Uwasilishaji wa wakili: wakili aliyehakikiwa wa LSK anaanza utafutaji kwenye akaunti yake rasmi ya ArdhiSasa.",
        "Idhini rahisi: saini fomu moja ya karatasi (rahisi zaidi), au mtoto aliyeandikishwa akusaidie kuidhinisha ombi katika Arifa za ArdhiSasa ya mmiliki. Si msimbo wa SMS.",
        "Hifadhi: wakili anahifadhi Cheti rasmi cha Utafutaji kwenye Hifadhi yako ya Nyaraka.",
      ],
      note: "Hali inabadilika kutoka Inasubiri uthibitisho hadi Imethibitishwa rasmi na wakili wa LSK.",
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
              {item.a ? (
                <p className="mt-3 text-lg leading-relaxed text-ink">{item.a}</p>
              ) : null}
              {item.steps ? (
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-lg leading-relaxed text-ink">
                  {item.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}
              {item.note ? (
                <p className="mt-3 text-base font-semibold text-forest">{item.note}</p>
              ) : null}
            </details>
          ))}
        </div>
        </div>
      </div>
    </section>
  );
}
