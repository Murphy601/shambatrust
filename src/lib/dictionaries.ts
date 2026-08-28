export type Locale = "en" | "sw";

export const dictionaries = {
  en: {
    brand: "ShambaTrust",
    tagline: "Ancestral Asset Digitization & Estate Succession Vault",
    nav: {
      how: "How It Works",
      stories: "Success stories",
      audit: "Family Peace Audit",
      pricing: "Pricing",
      trust: "Why trust us",
      contact: "Contact",
      solutions: "Solutions",
      advocates: "For Advocates",
      help: "Help Center",
      signIn: "Sign in",
      getStarted: "Secure My Legacy",
      succession: "Succession",
    },
    langToggle: "Kiswahili",
    carousel: {
      previous: "Previous",
      next: "Next",
      goToSlide: "Go to slide",
      pauseHint: "Rotates automatically — hover, focus, or swipe to take control.",
    },
    journey: {
      title: "Your onboarding journey",
      subtitle:
        "Four guided steps from a drawer full of paper to a sealed, advocate-verified vault.",
      stepLabel: "Step",
      of: "of",
      cta: "Start step 1",
      steps: [
        {
          title: "Asset inventory & GPS pinning",
          body: "List every shamba, plot, business, vehicle, SACCO, and account. Capture the title number, ArdhiSasa parcel and block, and drop a GPS pin on the boundary.",
          detail: "Takes about 20 minutes. A son or daughter can help in Agent Mode.",
        },
        {
          title: "Will or trust selection",
          body: "Name your heirs, set percentages or specific gifts, and choose whether your estate passes by will, family land trust, or power of attorney.",
          detail: "Free to edit as a draft. You are only charged when you submit.",
        },
        {
          title: "LSK advocate verification",
          body: "We route your dossier to verified Law Society of Kenya advocates practising in your county. They check the title, stamp the instrument, and sign it digitally.",
          detail: "Matched by county automatically — no cold calling for a lawyer.",
        },
        {
          title: "Secured vault & beneficiary access",
          body: "Your sealed binder is stored encrypted. When the day comes, trustees and guardians verify the death before executors are given access.",
          detail: "Every view, edit, and download is written to an audit trail.",
        },
      ],
    },
    stories: {
      title: "Success stories from across the counties",
      subtitle:
        "Verified outcomes from families who secured their land before a dispute started. Names are shortened at each family's request.",
      verified: "Verified with the family",
      outcomeLabel: "Outcome",
      items: [
        {
          quote:
            "My four sons each knew which portion was theirs before I signed. The advocate confirmed the title in Kiambu and sealed everything the same week.",
          name: "Mzee J. Ngugi",
          county: "Kiambu County",
          detail: "3 shambas · 4 heirs",
          outcome: "Boundaries agreed before any transfer began",
        },
        {
          quote:
            "We had two title deeds in a suitcase and no will. Now the deeds are scanned, the trustees are named, and my mother stopped worrying.",
          name: "Wanjiru M.",
          county: "Nakuru County",
          detail: "Family helper · Agent Mode",
          outcome: "Deeds digitised and trustees appointed",
        },
        {
          quote:
            "My father recorded his wishes in Kalenjin. Hearing his own voice ended the argument my uncles were starting.",
          name: "Kiprotich A.",
          county: "Uasin Gishu (Eldoret)",
          detail: "Voice testament · transcribed",
          outcome: "Family dispute settled without court",
        },
        {
          quote:
            "The SACCO nomination and the will finally said the same thing. Before this, they contradicted each other.",
          name: "Achieng' O.",
          county: "Kisumu County",
          detail: "SACCO + bank accounts",
          outcome: "Nominee percentages aligned with the will",
        },
        {
          quote:
            "A buyer claimed our plot had been sold twice. The title search and our sealed binder settled it in one meeting.",
          name: "Mutua K.",
          county: "Machakos County",
          detail: "Commercial plot · title search",
          outcome: "Fraudulent double allocation stopped",
        },
        {
          quote:
            "When my father passed, two trustees and two guardians confirmed before anything opened. Nobody could rush it.",
          name: "Njeri W.",
          county: "Murang'a County",
          detail: "Succession activated",
          outcome: "Vault released only after dual verification",
        },
      ],
    },
    hero: {
      headline:
        "You Spent 40 Years Building Your Family's Legacy. Protect It Forever.",
      subhead:
        "Secure your shambas, title deeds, and businesses in a legally binding digital vault. No family disputes. No land grabbers.",
      ctaPrimary: "Secure My Legacy Today",
      ctaSecondary: "Talk to an Advocate",
    },
    problem: {
      title: "The reality many families face",
      items: [
        "Court battles that last 10+ years",
        "Lost or damaged title deeds",
        "Fraudulent land sales and double allocations",
        "Children divided over unclear inheritance",
      ],
      solutionTitle: "The ShambaTrust solution",
      solutions: [
        "Digital mapping of every shamba and plot",
        "Encrypted document vault for title deeds",
        "Advocate-verified succession plans",
        "Clear inheritance rules your family can follow",
      ],
    },
    how: {
      title: "How it works",
      subtitle: "Three simple steps. No confusion.",
      steps: [
        {
          title: "Catalog Your Assets",
          body: "List land plots, businesses, and title deed details — with help from a family member if you wish.",
        },
        {
          title: "Define Your Legacy",
          body: "Name heirs, trusts, and conditions through guided steps in English or Kiswahili.",
        },
        {
          title: "Legal Verification",
          body: "A verified partner advocate reviews, seals, and registers your documents.",
        },
      ],
    },
    audit: {
      title: "Family Peace Audit",
      subtitle:
        "Answer 5 short questions. See your Legacy Risk Score — and what to fix first.",
      start: "Start the audit",
      next: "Next question",
      back: "Back",
      seeScore: "See my score",
      restart: "Retake audit",
      questionOf: "Question",
      of: "of",
      questions: [
        {
          id: "deed",
          text: "Is your title deed currently stored safely (not just in a drawer or with one relative)?",
        },
        {
          id: "boundaries",
          text: "Do your children know the exact boundaries of each shamba or plot?",
        },
        {
          id: "will",
          text: "Do you have a written will or succession plan reviewed by an advocate?",
        },
        {
          id: "heirs",
          text: "Have you clearly named who inherits each property?",
        },
        {
          id: "trustees",
          text: "Have you named trusted family trustees to act when you pass?",
        },
      ],
      answers: {
        yes: "Yes",
        partly: "Partly / Not sure",
        no: "No",
      },
      results: {
        low: {
          label: "Low Legacy Risk",
          message:
            "You have strong foundations. A digital vault and advocate seal will lock in the peace you have already built.",
        },
        medium: {
          label: "Moderate Legacy Risk",
          message:
            "Some gaps could still cause disputes. Cataloguing assets and clarifying heirs now prevents pain later.",
        },
        high: {
          label: "High Legacy Risk",
          message:
            "Your family's land and businesses are exposed. Secure your documents and succession plan before conflict starts.",
        },
      },
      cta: "Secure my legacy on WhatsApp",
      ctaForm: "Or leave your details — we will call you",
    },
    trust: {
      title: "Built for trust",
      badges: [
        "256-Bit Bank-Level Encryption",
        "Law Society of Kenya Partner Network",
        "Kenya Data Protection Act Compliant",
      ],
      quote:
        "I worked my shamba for forty years. Now my children will not fight over it — everything is written and sealed.",
      quoteAttr: "— Elder from Nakuru County",
      partners: "Partner advocate networks across Nairobi, Nakuru, and Eldoret",
    },
    pricing: {
      title: "Clear pricing — no surprise draft fees",
      subtitle:
        "Draft edits are free. You pay at intentional milestones. Advocate-filed ArdhiSasa searches are billed separately.",
      tiers: [
        {
          name: "Digital Vault",
          price: "KES 15,000 package",
          body: "Encrypted vault, mapping, and advocate intake. Platform + advocate escrow on submit.",
        },
        {
          name: "Standard Legacy Package",
          price: "KES 35,000 package",
          body: "Will-ready review, consult, Legacy Binder. Charged when you submit for legal review.",
        },
        {
          name: "Trust & Business Estate",
          price: "KES 75,000+ package",
          body: "Multi-asset estate, trusts, premium consult. Same rule: drafts free until submit.",
        },
      ],
      note: "Amendments: free within 48 hours of submit, then a smaller amendment fee (not a full new package). Each advocate-filed ArdhiSasa search is billed per filing (~KES 1,500).",
    },
    lead: {
      title: "Start securing your family shamba today",
      subtitle:
        "Message us on WhatsApp or leave your details. A ShambaTrust guide will respond in English or Kiswahili.",
      name: "Full name",
      phone: "Phone number (+254…)",
      county: "County",
      language: "Preferred language",
      message: "What would you like help with? (optional)",
      submit: "Send my details",
      whatsapp: "Chat on WhatsApp",
      whatsappHint: "Fastest way — open a chat with our team now",
      success:
        "Thank you. Open WhatsApp to send your request, or wait for our call.",
      counties: [
        "Nairobi",
        "Nakuru",
        "Eldoret / Uasin Gishu",
        "Kiambu",
        "Kisumu",
        "Mombasa",
        "Other",
      ],
    },
    footer: {
      hotline: "Hotline",
      hotlineNumber: "+254 748 879 579",
      offices: "Offices",
      officeList: "Nairobi · Nakuru · Eldoret",
      privacy: "Your documents are encrypted and never shared without your consent.",
      rights: "© ShambaTrust. Legacy protection for Kenyan families.",
      legal: "Legal",
      terms: "Terms of Service",
      privacyLink: "Privacy Policy",
      faq: "FAQs",
    },
    floatingWhatsapp: "WhatsApp us",
    auditPage: {
      backHome: "Back to home",
    },
  },
  sw: {
    brand: "ShambaTrust",
    tagline: "Hifadhi ya Mali za Urithi na Mpango wa Mirathi",
    nav: {
      how: "Jinsi inavyofanya kazi",
      stories: "Hadithi za mafanikio",
      audit: "Ukaguzi wa Amani ya Familia",
      pricing: "Bei",
      trust: "Kwa nini tutumaini",
      contact: "Wasiliana",
      solutions: "Suluhisho",
      advocates: "Kwa Mawakili",
      help: "Kituo cha Msaada",
      signIn: "Ingia",
      getStarted: "Linda Urithi",
      succession: "Mirathi",
    },
    langToggle: "English",
    carousel: {
      previous: "Iliyotangulia",
      next: "Ifuatayo",
      goToSlide: "Nenda kwa slaidi",
      pauseHint:
        "Hubadilika yenyewe — weka kishale, bofya, au telezesha ili kudhibiti.",
    },
    journey: {
      title: "Safari yako ya kuanza",
      subtitle:
        "Hatua nne kutoka droo iliyojaa karatasi hadi hifadhi iliyotiwa muhuri na wakili.",
      stepLabel: "Hatua",
      of: "kati ya",
      cta: "Anza hatua ya 1",
      steps: [
        {
          title: "Orodha ya mali na alama ya GPS",
          body: "Orodhesha kila shamba, kiwanja, biashara, gari, SACCO, na akaunti. Andika nambari ya hati, kiwanja na block cha ArdhiSasa, na weka alama ya GPS kwenye mpaka.",
          detail: "Huchukua dakika 20 hivi. Mwana au binti anaweza kusaidia kwa Hali ya Wakala.",
        },
        {
          title: "Chagua wosia au amana",
          body: "Taja warithi, weka asilimia au zawadi maalum, na uchague kama mali yako itapita kwa wosia, amana ya ardhi ya familia, au uwakilishi wa nguvu.",
          detail: "Kuhariri rasimu ni bure. Utatozwa tu unapowasilisha.",
        },
        {
          title: "Uthibitisho wa wakili wa LSK",
          body: "Tunapeleka jalada lako kwa mawakili wa Law Society of Kenya wanaofanya kazi katika kaunti yako. Wanakagua hati, wanatia muhuri, na kusaini kidijitali.",
          detail: "Unalinganishwa kwa kaunti kiotomatiki — hakuna kutafuta wakili mwenyewe.",
        },
        {
          title: "Hifadhi salama na ufikiaji wa warithi",
          body: "Kitabu chako kilichotiwa muhuri huhifadhiwa kwa usimbaji fiche. Siku ikifika, amana na walezi huthibitisha kifo kabla ya watekelezaji kupewa ufikiaji.",
          detail: "Kila kuangalia, kuhariri, na kupakua huandikwa kwenye kumbukumbu.",
        },
      ],
    },
    stories: {
      title: "Hadithi za mafanikio kutoka kaunti mbalimbali",
      subtitle:
        "Matokeo yaliyothibitishwa kutoka familia zilizolinda ardhi yao kabla ya mgogoro kuanza. Majina yamefupishwa kwa ombi la kila familia.",
      verified: "Imethibitishwa na familia",
      outcomeLabel: "Matokeo",
      items: [
        {
          quote:
            "Wanangu wanne kila mmoja alijua sehemu yake kabla sijasaini. Wakili alithibitisha hati Kiambu na kutia muhuri kila kitu wiki hiyo hiyo.",
          name: "Mzee J. Ngugi",
          county: "Kaunti ya Kiambu",
          detail: "Mashamba 3 · warithi 4",
          outcome: "Mipaka ilikubaliwa kabla ya uhamisho wowote",
        },
        {
          quote:
            "Tulikuwa na hati mbili kwenye sanduku na hakuna wosia. Sasa hati zimeskaniwa, amana wametajwa, na mama yangu ameacha wasiwasi.",
          name: "Wanjiru M.",
          county: "Kaunti ya Nakuru",
          detail: "Msaidizi wa familia · Hali ya Wakala",
          outcome: "Hati zimehifadhiwa kidijitali na amana kuteuliwa",
        },
        {
          quote:
            "Baba yangu alirekodi matakwa yake kwa Kalenjin. Kusikia sauti yake mwenyewe kulimaliza ugomvi ambao wajomba zangu walikuwa wanaanzisha.",
          name: "Kiprotich A.",
          county: "Uasin Gishu (Eldoret)",
          detail: "Wosia wa sauti · umeandikwa",
          outcome: "Mgogoro wa familia ulitatuliwa bila mahakama",
        },
        {
          quote:
            "Uteuzi wa SACCO na wosia hatimaye vilisema kitu kimoja. Kabla ya hapo, vilikinzana.",
          name: "Achieng' O.",
          county: "Kaunti ya Kisumu",
          detail: "SACCO na akaunti za benki",
          outcome: "Asilimia za wateule zililingana na wosia",
        },
        {
          quote:
            "Mnunuzi alidai kiwanja chetu kiliuzwa mara mbili. Utafutaji wa hati na kitabu chetu kilichotiwa muhuri vilimaliza hilo kwa mkutano mmoja.",
          name: "Mutua K.",
          county: "Kaunti ya Machakos",
          detail: "Kiwanja cha biashara · utafutaji wa hati",
          outcome: "Ugawaji maradufu wa udanganyifu ulizuiwa",
        },
        {
          quote:
            "Baba yangu alipofariki, amana wawili na walezi wawili walithibitisha kabla ya chochote kufunguliwa. Hakuna aliyeweza kuharakisha.",
          name: "Njeri W.",
          county: "Kaunti ya Murang'a",
          detail: "Mirathi imeanzishwa",
          outcome: "Hifadhi ilifunguliwa baada tu ya uthibitisho maradufu",
        },
      ],
    },
    hero: {
      headline:
        "Umetumia Miaka 40 Kujenga Urithi wa Familia Yako. Ulinde Milele.",
      subhead:
        "Linda mashamba, hati miliki, na biashara zako katika hifadhi salama ya kisheria. Hakuna migogoro ya familia. Hakuna wanyang'anyi wa ardhi.",
      ctaPrimary: "Linda Urithi Wangu Leo",
      ctaSecondary: "Zungumza na Wakili",
    },
    problem: {
      title: "Ukweli ambao familia nyingi hukutana nao",
      items: [
        "Kesi mahakamani zinazochukua miaka 10+",
        "Hati miliki zilizopotea au kuharibika",
        "Uuzaji wa ardhi wa udanganyifu na ugawaji maradufu",
        "Watoto wakigombana kwa sababu ya mirathi isiyo wazi",
      ],
      solutionTitle: "Suluhisho la ShambaTrust",
      solutions: [
        "Ramani ya kidijitali ya kila shamba na kiwanja",
        "Hifadhi salama ya hati miliki",
        "Mipango ya mirathi iliyothibitishwa na mawakili",
        "Sheria wazi za urithi ambazo familia inaweza kufuata",
      ],
    },
    how: {
      title: "Jinsi inavyofanya kazi",
      subtitle: "Hatua tatu rahisi. Bila kuchanganyikiwa.",
      steps: [
        {
          title: "Orodhesha Mali Zako",
          body: "Andika mashamba, biashara, na maelezo ya hati miliki — kwa msaada wa mwanafamilia ikiwa unataka.",
        },
        {
          title: "Eleza Urithi Wako",
          body: "Taja warithi, amana, na masharti kupitia hatua rahisi kwa Kiingereza au Kiswahili.",
        },
        {
          title: "Uthibitisho wa Kisheria",
          body: "Wakili mshirika aliyehakikishwa hukagua, anatia muhuri, na kusajili nyaraka zako.",
        },
      ],
    },
    audit: {
      title: "Ukaguzi wa Amani ya Familia",
      subtitle:
        "Jibu maswali 5 mafupi. Angalia Alama yako ya Hatari ya Urithi — na cha kurekebisha kwanza.",
      start: "Anza ukaguzi",
      next: "Swali linalofuata",
      back: "Rudi",
      seeScore: "Ona alama yangu",
      restart: "Fanya tena",
      questionOf: "Swali",
      of: "kati ya",
      questions: [
        {
          id: "deed",
          text: "Je, hati miliki yako inahifadhiwa salama (siyo tu kwenye droo au kwa ndugu mmoja)?",
        },
        {
          id: "boundaries",
          text: "Je, watoto wako wanajua mipaka hasa ya kila shamba au kiwanja?",
        },
        {
          id: "will",
          text: "Je, una wasia au mpango wa mirathi ulioandikwa na kukaguliwa na wakili?",
        },
        {
          id: "heirs",
          text: "Je, umetaja wazi nani atarithi kila mali?",
        },
        {
          id: "trustees",
          text: "Je, umeteua wadhamini wa familia wa kuaminika watakaotenda utakapofariki?",
        },
      ],
      answers: {
        yes: "Ndiyo",
        partly: "Kiasi / Sina uhakika",
        no: "Hapana",
      },
      results: {
        low: {
          label: "Hatari Ndogo ya Urithi",
          message:
            "Una msingi mzuri. Hifadhi ya kidijitali na muhuri wa wakili itaimarisha amani uliyojenga.",
        },
        medium: {
          label: "Hatari ya Wastani ya Urithi",
          message:
            "Mapengo kadhaa bado yanaweza kusababisha migogoro. Kuorodhesha mali na kufafanua warithi sasa huzuia maumivu baadaye.",
        },
        high: {
          label: "Hatari Kubwa ya Urithi",
          message:
            "Ardhi na biashara za familia yako ziko hatarini. Linda nyaraka na mpango wa mirathi kabla ya migogoro kuanza.",
        },
      },
      cta: "Linda urithi wangu kupitia WhatsApp",
      ctaForm: "Au tuache maelezo yako — tutakupigia simu",
    },
    trust: {
      title: "Imejengwa kwa uaminifu",
      badges: [
        "Usimbaji Fiche wa Benki wa Biti 256",
        "Mtandao wa Washirika wa Law Society of Kenya",
        "Inatii Sheria ya Ulinzi wa Data ya Kenya",
      ],
      quote:
        "Nilifanya kazi shambani kwangu kwa miaka arobaini. Sasa watoto wangu hawatagombania — kila kitu kimeandikwa na kutiwa muhuri.",
      quoteAttr: "— Mzee kutoka Kaunti ya Nakuru",
      partners:
        "Mitandao ya mawakili washirika Nairobi, Nakuru, na Eldoret",
    },
    pricing: {
      title: "Bei wazi — hakuna ada za rasimu za kushtukiza",
      subtitle:
        "Kuhariri rasimu ni bure. Unalipa kwa hatua za makusudi. Uwasilishaji wa ArdhiSasa na wakili hutozwa tofauti.",
      tiers: [
        {
          name: "Hifadhi ya Kidijitali",
          price: "KES 15,000 kifurushi",
          body: "Hifadhi salama, ramani, na ukaguzi wa wakili. Ada ya jukwaa + wakili unapowasilisha.",
        },
        {
          name: "Kifurushi cha Urithi wa Kawaida",
          price: "KES 35,000 kifurushi",
          body: "Ukaguzi wa wasia, ushauri, Kitabu cha Urithi. Hutozwa unapowasilisha kwa ukaguzi.",
        },
        {
          name: "Amana na Biashara ya Familia",
          price: "KES 75,000+ kifurushi",
          body: "Mali nyingi, amana, ushauri wa juu. Kanuni ileile: rasimu bure hadi uwasilishe.",
        },
      ],
      note: "Marekebisho: bure ndani ya saa 48 baada ya kuwasilisha, kisha ada ndogo ya marekebisho. Kila uwasilishaji wa ArdhiSasa na wakili ~KES 1,500.",
    },
    lead: {
      title: "Anza kulinda urithi wako",
      subtitle:
        "Tutumie ujumbe WhatsApp au tuache maelezo yako. Mwongozi wa ShambaTrust atajibu kwa Kiingereza au Kiswahili.",
      name: "Jina kamili",
      phone: "Nambari ya simu (+254…)",
      county: "Kaunti",
      language: "Lugha unayopendelea",
      message: "Unahitaji msaada gani? (si lazima)",
      submit: "Tuma maelezo yangu",
      whatsapp: "Ongea kwa WhatsApp",
      whatsappHint: "Njia ya haraka — fungua gumzo na timu yetu sasa",
      success:
        "Asante. Fungua WhatsApp kutuma ombi lako, au subiri simu yetu.",
      counties: [
        "Nairobi",
        "Nakuru",
        "Eldoret / Uasin Gishu",
        "Kiambu",
        "Kisumu",
        "Mombasa",
        "Nyingine",
      ],
    },
    footer: {
      hotline: "Simu ya msaada",
      hotlineNumber: "+254 748 879 579",
      offices: "Ofisi",
      officeList: "Nairobi · Nakuru · Eldoret",
      privacy:
        "Nyaraka zako zimesimbwa fiche na hazishirikiwi bila idhini yako.",
      rights: "© ShambaTrust. Ulinzi wa urithi kwa familia za Kenya.",
      legal: "Kisheria",
      terms: "Masharti ya Huduma",
      privacyLink: "Sera ya Faragha",
      faq: "Maswali (FAQ)",
    },
    floatingWhatsapp: "WhatsApp",
    auditPage: {
      backHome: "Rudi nyumbani",
    },
  },
} as const;

export type Dictionary = (typeof dictionaries)["en"];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary;
}
