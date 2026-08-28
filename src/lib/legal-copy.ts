import type { Locale } from "@/lib/dictionaries";

type DocSection = { heading: string; body: string[] };

type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: DocSection[];
};

type FaqItem = { q: string; a: string };

const terms: Record<Locale, LegalDoc> = {
  en: {
    title: "Terms of Service",
    updated: "Last updated: April 2026",
    intro:
      "These Terms govern your use of ShambaTrust websites, vault tools, and related services in Kenya. By creating an account or submitting a review request, you agree to these Terms.",
    sections: [
      {
        heading: "1. Who we are",
        body: [
          "ShambaTrust provides a digital platform for cataloguing family assets, planning succession, and connecting you with partner advocates for formal legal work. We are a technology and intake platform — not a law firm and not a substitute for independent legal advice.",
        ],
      },
      {
        heading: "2. Eligibility",
        body: [
          "You must be able to enter a binding agreement under Kenyan law. Vault owners should be the rightful decision-makers for the assets described. Family helpers (Agent Mode) may assist with data entry but final legal submissions require the elder’s authorisation.",
        ],
      },
      {
        heading: "3. Our services",
        body: [
          "We offer digital vault storage, guided questionnaires, Family Peace Audit tools, WhatsApp support, and referral to vetted partner advocates. Advocate services (wills, trusts, powers of attorney, conveyancing) are performed by independent advocates under the Advocates Act and applicable fee rules.",
          "Package prices may include a platform fee and an advocate fee. Advocate fees are held or paid according to the package description and any escrow arrangement we communicate at checkout.",
        ],
      },
      {
        heading: "4. Your responsibilities",
        body: [
          "You must provide accurate information (title numbers, heir details, identity documents). You must not upload documents you are not authorised to share. You remain responsible for keeping your phone number secure for OTP access.",
        ],
      },
      {
        heading: "5. Documents and advocate access",
        body: [
          "When you consent and request legal review, the assigned partner advocate may view your vault details and uploaded documents on a view-only basis to prepare and seal your matter. Access is logged and ends when the vault is sealed, subject to our Privacy Policy.",
        ],
      },
      {
        heading: "6. No guarantees of land outcomes",
        body: [
          "We do not guarantee Ministry of Lands outcomes, absence of caveats, or that courts will uphold any plan. ShambaTrust cannot query ArdhiSasa automatically — the Ministry does not provide a public third-party API. Official searches require an LSK partner advocate to file on their professional account and the registered owner's OTP consent. Always rely on the official search PDF stored in the vault and advocate advice for high-stakes decisions.",
        ],
      },
      {
        heading: "7. Acceptable use",
        body: [
          "Do not misuse the platform for fraud, impersonation, harassment, or unlawful surveillance of family members. We may suspend accounts that breach these Terms or applicable law.",
        ],
      },
      {
        heading: "8. Limitation of liability",
        body: [
          "To the fullest extent permitted by Kenyan law, ShambaTrust is not liable for indirect or consequential losses arising from family disputes, third-party advocate errors, registry delays, or force majeure. Our aggregate liability for platform services is limited to fees you paid us in the twelve months before the claim.",
        ],
      },
      {
        heading: "9. Changes",
        body: [
          "We may update these Terms. Material changes will be posted on this page with a new “Last updated” date. Continued use after changes constitutes acceptance.",
        ],
      },
      {
        heading: "10. Contact",
        body: [
          "Questions: WhatsApp or call +254 748 879 579, or write via the contact form on our homepage.",
        ],
      },
    ],
  },
  sw: {
    title: "Masharti ya Huduma",
    updated: "Ilisasishwa: Aprili 2026",
    intro:
      "Masharti haya yanadhibiti matumizi yako ya tovuti ya ShambaTrust, zana za hifadhi, na huduma zinazohusiana nchini Kenya. Kwa kuunda akaunti au kuwasilisha ombi la ukaguzi, unakubali Masharti haya.",
    sections: [
      {
        heading: "1. Sisi ni nani",
        body: [
          "ShambaTrust hutoa jukwaa la kidijitali la kuorodhesha mali za familia, kupanga mirathi, na kukuunganisha na mawakili washirika kwa kazi rasmi ya kisheria. Sisi ni jukwaa la teknolojia — si kampuni ya sheria wala mbadala wa ushauri huru wa kisheria.",
        ],
      },
      {
        heading: "2. Ustahiki",
        body: [
          "Lazima uweze kuingia mkataba chini ya sheria za Kenya. Wamiliki wa hifadhi wanapaswa kuwa wenye uamuzi juu ya mali zilizoelezwa. Wasaidizi wa familia (Hali ya Wakala) wanaweza kusaidia kuingiza data, lakini uwasilishaji wa kisheria unahitaji idhini ya mzee.",
        ],
      },
      {
        heading: "3. Huduma zetu",
        body: [
          "Tunatoa hifadhi ya kidijitali, maswali yanayoongozwa, Ukaguzi wa Amani ya Familia, msaada wa WhatsApp, na rufaa kwa mawakili washirika. Huduma za wakili (wosia, amana, nguvu ya uwakilishi) hufanywa na mawakili huru chini ya Sheria ya Mawakili.",
        ],
      },
      {
        heading: "4. Wajibu wako",
        body: [
          "Lazima utoe taarifa sahihi. Usipakie nyaraka ambazo huna ruhusa ya kushiriki. Unawajibika kulinda nambari yako ya simu kwa ufikiaji wa OTP.",
        ],
      },
      {
        heading: "5. Nyaraka na ufikiaji wa wakili",
        body: [
          "Unapokubali na kuomba ukaguzi wa kisheria, wakili mshirika aliyepangiwa anaweza kuona maelezo ya hifadhi na nyaraka kwa njia ya kuona tu. Ufikiaji unaandikwa kumbukumbu na unaisha hifadhi ikifungwa, kulingana na Sera ya Faragha.",
        ],
      },
      {
        heading: "6. Hakuna dhamana ya matokeo ya ardhi",
        body: [
          "Hatuhakikishii matokeo ya Wizara ya Ardhi au mahakama. Utafutaji wa hati kwenye zana za majaribio unaweza kuwa wa kuiga hadi miunganisho halisi iweze. Tegemea utafutaji rasmi na ushauri wa wakili.",
        ],
      },
      {
        heading: "7. Matumizi yanayokubalika",
        body: [
          "Usitumie jukwaa kwa udanganyifu, kujifanya mtu mwingine, au uvunjaji wa sheria. Tunaweza kusimamisha akaunti zinazokiuka Masharti haya.",
        ],
      },
      {
        heading: "8. Kikomo cha dhima",
        body: [
          "Kwa kiwango kinachoruhusiwa na sheria ya Kenya, ShambaTrust haiwajibiki kwa hasara zisizo za moja kwa moja kutokana na migogoro ya familia, makosa ya mawakili wa tatu, au ucheleweshaji wa rejista.",
        ],
      },
      {
        heading: "9. Mabadiliko",
        body: [
          "Tunaweza kusasisha Masharti haya. Mabadiliko muhimu yatawekwa kwenye ukurasa huu. Kuendelea kutumia baada ya mabadiliko kunamaanisha kukubali.",
        ],
      },
      {
        heading: "10. Mawasiliano",
        body: [
          "Maswali: WhatsApp au piga +254 748 879 579, au tumia fomu ya mawasiliano kwenye ukurasa wa kwanza.",
        ],
      },
    ],
  },
};

const privacy: Record<Locale, LegalDoc> = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: April 2026",
    intro:
      "This Privacy Policy explains how ShambaTrust collects, uses, stores, and shares personal data in line with Kenya’s Data Protection Act, 2019.",
    sections: [
      {
        heading: "1. Data we collect",
        body: [
          "Identity and contact data (name, phone number, optional LSK number for advocates).",
          "Vault data you enter (assets, title numbers, locations, heirs, allocations, notes).",
          "Documents you upload (e.g. title deed scans).",
          "Technical and security logs (sign-in events, document views, audit actions).",
          "Messages you send via WhatsApp or our lead forms.",
        ],
      },
      {
        heading: "2. Why we process data",
        body: [
          "To create and secure your vault, verify OTP sign-in, and provide support.",
          "To prepare pre-packaged briefs for partner advocates when you request review and give consent.",
          "To operate the internal ops desk for customer support and compliance.",
          "To improve product safety and prevent fraud or abuse.",
        ],
      },
      {
        heading: "3. Legal bases",
        body: [
          "Performance of a contract (providing the vault and packages you request).",
          "Consent (advocate document sharing, marketing WhatsApp where required).",
          "Legitimate interests (security, audit logs, service improvement) balanced against your rights.",
          "Legal obligation where we must retain or disclose records under Kenyan law.",
        ],
      },
      {
        heading: "4. Sharing",
        body: [
          "Assigned partner advocates — only for your matter, view-only where applicable, logged.",
          "Service providers (hosting, SMS OTP, payment) under confidentiality obligations.",
          "Authorities when required by law or court order.",
          "We do not sell your personal data.",
        ],
      },
      {
        heading: "5. Retention",
        body: [
          "Vault and document data are kept while your account is active and as needed for sealed estates, disputes, or legal retention. Audit logs of sensitive access are kept for security and accountability. You may request deletion subject to legal holds and advocate file requirements.",
        ],
      },
      {
        heading: "6. Security",
        body: [
          "We use access controls, encrypted transport (HTTPS in production), role-based portals, view-only document previews for advocates, and audit trails. No system is perfectly secure; report suspected breaches promptly to our hotline.",
        ],
      },
      {
        heading: "7. Your rights",
        body: [
          "Under the Data Protection Act you may request access, correction, deletion, or restriction of processing, and withdraw consent where processing is consent-based. Contact +254 748 879 579 or WhatsApp to exercise these rights.",
        ],
      },
      {
        heading: "8. Children",
        body: [
          "ShambaTrust is not directed at children. Heir details may include minors’ names as beneficiaries entered by an adult vault owner; we process that data only as part of the estate plan you create.",
        ],
      },
      {
        heading: "9. Contact / Data Protection Officer",
        body: [
          "Data questions and Data Subject Access Requests: +254 748 879 579 or WhatsApp. Our Data Protection Officer desk logs access, correction, deletion, and restriction requests in Admin Ops under Kenya’s Data Protection Act, 2019. Offices: Nairobi, Nakuru, Eldoret.",
        ],
      },
    ],
  },
  sw: {
    title: "Sera ya Faragha",
    updated: "Ilisasishwa: Aprili 2026",
    intro:
      "Sera hii inaeleza jinsi ShambaTrust inavyokusanya, kutumia, kuhifadhi, na kushiriki data binafsi kwa mujibu wa Sheria ya Ulinzi wa Data ya Kenya, 2019.",
    sections: [
      {
        heading: "1. Data tunayokusanya",
        body: [
          "Utambulisho na mawasiliano (jina, simu).",
          "Data ya hifadhi unayoingiza (mali, nambari za hati, warithi).",
          "Nyaraka unazopakia.",
          "Kumbukumbu za usalama (kuingia, kuona nyaraka).",
          "Ujumbe wa WhatsApp au fomu za mawasiliano.",
        ],
      },
      {
        heading: "2. Kwa nini tunachakata data",
        body: [
          "Kuunda na kulinda hifadhi yako, kuthibitisha OTP, na kutoa msaada.",
          "Kuandaa muhtasari kwa mawakili washirika unapoomba ukaguzi na kukubali.",
          "Kuendesha dawati la msaada la ndani.",
          "Kuboresha usalama na kuzuia udanganyifu.",
        ],
      },
      {
        heading: "3. Misingi ya kisheria",
        body: [
          "Utekelezaji wa mkataba, idhini, maslahi halali (usalama), na wajibu wa kisheria inapohitajika.",
        ],
      },
      {
        heading: "4. Kushiriki",
        body: [
          "Mawakili washirika waliopewa kesi yako — kwa kuona tu inapofaa, na kumbukumbu.",
          "Watoa huduma (uhifadhi, SMS, malipo) chini ya siri.",
          "Mamlaka inapohitajika kisheria.",
          "Hatuuzi data yako binafsi.",
        ],
      },
      {
        heading: "5. Uhifadhi",
        body: [
          "Data huhifadhiwa wakati akaunti iko hai na inavyohitajika kwa mirathi iliyofungwa au mahitaji ya kisheria. Unaweza kuomba kufutwa kulingana na vikwazo vya kisheria.",
        ],
      },
      {
        heading: "6. Usalama",
        body: [
          "Tunatumia udhibiti wa ufikiaji, HTTPS (uzalishaji), majukumu, onyesho la kuona tu, na kumbukumbu za ukaguzi.",
        ],
      },
      {
        heading: "7. Haki zako",
        body: [
          "Unaweza kuomba ufikiaji, marekebisho, kufutwa, au kuzuia uchakataji. Wasiliana: +254 748 879 579.",
        ],
      },
      {
        heading: "8. Watoto",
        body: [
          "Huduma haielekezwi kwa watoto. Majina ya warithi wadogo yanaweza kuingizwa na mmiliki mzima wa hifadhi kama sehemu ya mpango wa mirathi.",
        ],
      },
      {
        heading: "9. Mawasiliano / Afisa wa Ulinzi wa Data",
        body: [
          "Maswali ya data na maombi ya DSAR: +254 748 879 579 au WhatsApp. Dawati la Afisa wa Ulinzi wa Data linarekodi maombi ya ufikiaji, marekebisho, kufutwa, na kuzuia chini ya Sheria ya Ulinzi wa Data, 2019. Ofisi: Nairobi, Nakuru, Eldoret.",
        ],
      },
    ],
  },
};

const faqs: Record<
  Locale,
  { title: string; intro: string; items: FaqItem[] }
> = {
  en: {
    title: "Frequently Asked Questions",
    intro:
      "Straight answers for elders and families considering ShambaTrust.",
    items: [
      {
        q: "Is ShambaTrust a law firm?",
        a: "No. We are a secure digital platform and intake service. Formal wills, trusts, and conveyancing are handled by independent partner advocates.",
      },
      {
        q: "Who can see my title deeds?",
        a: "You and any family helper you invite. When you consent and request review, only the assigned advocate can open documents in a view-only preview. Views are logged. Access ends when your vault is sealed.",
      },
      {
        q: "Can my child fill the forms for me?",
        a: "Yes — Agent Mode lets a trusted family member help. Final review submission and sensitive changes still require your authorisation.",
      },
      {
        q: "Are draft edits free?",
        a: "Yes. Saving assets, heirs, and allocations never bills you. You are charged when you intentionally submit for legal review (or open a paid amendment after the free 48-hour window).",
      },
      {
        q: "What is the 48-hour amendment window?",
        a: "After you submit for review, you can request an amendment free for 48 hours to add forgotten land, banks, or cars. After that, a smaller amendment fee applies — not a full new package. Once sealed, use amendment again if needed.",
      },
      {
        q: "What is locked after submit or seal?",
        a: "Assets, heirs, and allocations are locked so paid cases stay consistent. Use Request amendment on Legal review to reopen edits, then resubmit.",
      },
      {
        q: "Heir vs trustee — what’s the difference?",
        a: "Heirs inherit. Trustees confirm a death claim by OTP. The elder adds trustees under Execution (not the heirs form). See the Succession guide on the site.",
      },
      {
        q: "How much does it cost?",
        a: "Packages are charged at legal-review submit. Amendments can be free within 48h then a smaller fee. Each advocate-filed ArdhiSasa search is billed separately (~KES 1,500). See homepage pricing.",
      },
      {
        q: "Do you work in Swahili?",
        a: "Yes. The site and vault switch between English and Kiswahili. Support is available on WhatsApp and phone.",
      },
      {
        q: "What is the Family Peace Audit?",
        a: "A short questionnaire that scores common legacy risks (missing deeds, unclear boundaries, unspoken heir plans) and points you to next steps — including opening a vault.",
      },
      {
        q: "What happens when the elder passes away?",
        a: "A named trustee, heir, or family agent files a succession claim with a death certificate. Other trustees confirm by OTP. ShambaTrust Ops verifies the claim, then a partner advocate handles probate and transfers using the sealed vault plan.",
      },
      {
        q: "How does ShambaTrust know someone has died?",
        a: "We do not detect death automatically. The family (or hotline) files a claim with proofs. Ops must verify before any advocate succession work starts.",
      },
      {
        q: "How do I contact you?",
        a: "Call or WhatsApp +254 748 879 579, or use the contact section on the homepage. Offices: Nairobi, Nakuru, Eldoret.",
      },
    ],
  },
  sw: {
    title: "Maswali Yanayoulizwa Mara kwa Mara",
    intro: "Majibu wazi kwa wazee na familia zinazozingatia ShambaTrust.",
    items: [
      {
        q: "Je, ShambaTrust ni kampuni ya sheria?",
        a: "Hapana. Sisi ni jukwaa salama la kidijitali. Wosia, amana, na uhamishaji wa ardhi hushughulikiwa na mawakili washirika huru.",
      },
      {
        q: "Nani anaweza kuona hati zangu miliki?",
        a: "Wewe na msaidizi wa familia unayemwalika. Unapokubali na kuomba ukaguzi, ni wakili aliyepangiwa tu anayeweza kuona nyaraka kwa onyesho la kuona tu. Ufikiaji unaisha hifadhi ikifungwa.",
      },
      {
        q: "Je, mwanangu anaweza kujaza fomu?",
        a: "Ndiyo — Hali ya Wakala inaruhusu msaada. Uwasilishaji wa mwisho unahitaji idhini yako.",
      },
      {
        q: "Gharama ni kiasi gani?",
        a: "Bei za hifadhi na vifurushi viko kwenye sehemu ya bei kwenye ukurasa wa kwanza. Kwa kawaida kuna ada ya jukwaa na ada ya wakili.",
      },
      {
        q: "Je, mna Kiswahili?",
        a: "Ndiyo. Tovuti na hifadhi zinabadilisha Kiingereza/Kiswahili. Msaada upo kwa WhatsApp na simu.",
      },
      {
        q: "Ukaguzi wa Amani ya Familia ni nini?",
        a: "Maswali mafupi yanayopima hatari za urithi (hati zilizopotea, mipaka isiyo wazi, warithi wasiojulikana) na kukuonyesha hatua zifuatazo.",
      },
      {
        q: "Nini hutokea mzee anapofariki?",
        a: "Amana, mrithi, au wakala anawasilisha dai la mirathi pamoja na cheti cha kifo. Amana wengine wanathibitisha kwa OTP. Ops ya ShambaTrust inathibitisha, kisha wakili mshirika hushughulikia mirathi kwa kutumia hifadhi iliyofungwa.",
      },
      {
        q: "ShambaTrust inajuaje kuwa mtu amefariki?",
        a: "Hatuoni kifo kiotomatiki. Familia (au simu ya msaada) inawasilisha dai na ushahidi. Ops lazima ithibitishe kabla ya kazi ya wakili kuanza.",
      },
      {
        q: "Nawezaje kuwasiliana?",
        a: "Piga au WhatsApp +254 748 879 579. Ofisi: Nairobi, Nakuru, Eldoret.",
      },
    ],
  },
};

export function getTerms(locale: Locale) {
  return terms[locale];
}

export function getPrivacy(locale: Locale) {
  return privacy[locale];
}

export function getFaqs(locale: Locale) {
  return faqs[locale];
}
