import {
  applySkipIfNeeded,
  cleanLocation,
  detectSwahili,
  looksLikeSkip,
  mergeIntakeDraft,
  parseHeirList,
  parseOcrText,
  parseUtterance,
} from "@/lib/intake/extract";
import {
  isSkipped,
  type IntakeDraft,
  type IntakeEngineTurn,
  type IntakeStep,
} from "@/lib/intake/types";

type Locale = "en" | "sw";

type PendingField = {
  field: string;
  step: IntakeStep;
  en: string;
  sw: string;
};

const QUESTIONS: PendingField[] = [
  {
    field: "fullName",
    step: 1,
    en: "Karibu. I am Amani. What is your full name, as written on your national ID?",
    sw: "Karibu. Mimi ni Amani. Jina lako kamili ni nani, kama lilivyo kwenye kitambulisho?",
  },
  {
    field: "nationalId",
    step: 1,
    en: "Thank you. What is your national ID number?",
    sw: "Asante. Namba yako ya kitambulisho ni ipi?",
  },
  {
    field: "kraPin",
    step: 1,
    en: "If you have a KRA PIN, please say it. If you do not, say skip.",
    sw: "Ukiwa na PIN ya KRA, niambie. Ikiwa huna, sema ruka.",
  },
  {
    field: "spouseName",
    step: 2,
    en: "What is your spouse’s name? If you have no spouse, say skip.",
    sw: "Jina la mke au mume wako ni nani? Ikiwa huna, sema ruka.",
  },
  {
    field: "heirs",
    step: 2,
    en: "Please name your children or other heirs, one by one or separated by commas.",
    sw: "Tafadhali taja watoto au warithi wako, mmoja mmoja au ukitumia koma.",
  },
  {
    field: "trusteeName",
    step: 2,
    en: "Who should be the trusted person to look after the land plan — a son, daughter, or other adult you trust?",
    sw: "Nani unayemwamini kusimamia mpango wa ardhi — mwana, binti, au mtu mzima unayemwamini?",
  },
  {
    field: "shambaLocation",
    step: 3,
    en: "Where is your shamba or plot? You can say the town and county, for example Nakuru.",
    sw: "Shamba lako liko wapi? Unaweza kusema mji na kaunti, kwa mfano Nakuru.",
  },
  {
    field: "lrNumber",
    step: 3,
    en: "What is the title or LR number on the paper deed? You can also upload a photo of the deed.",
    sw: "Namba ya hati miliki au LR ni ipi? Unaweza pia kupakia picha ya hati.",
  },
  {
    field: "plotSize",
    step: 3,
    en: "About how big is the land — for example 2 acres? Say skip if you are not sure.",
    sw: "Shamba ni ekari ngapi, takriban? Sema ruka kama hujui.",
  },
  {
    field: "saccoName",
    step: 4,
    en: "Do you save with a SACCO? If yes, what is its name? If no, say skip.",
    sw: "Je, unaakiba kwenye SACCO? Ikiwa ndiyo, jina lake ni nani? Ikiwa hapana, sema ruka.",
  },
  {
    field: "bankName",
    step: 4,
    en: "Which bank do you use, if any? Say skip if you prefer not to say yet.",
    sw: "Unatumia benki gani, kama iko? Sema ruka kama bado hautaki kusema.",
  },
  {
    field: "mpesaNominee",
    step: 4,
    en: "Who should receive your M-Pesa if you are gone? You can say a name, or skip.",
    sw: "Nani apokee M-Pesa yako ukiwa hauko? Unaweza kusema jina, au ruka.",
  },
];

function fieldFilled(draft: IntakeDraft, field: string): boolean {
  if (field === "heirs") return draft.heirs.length > 0;
  const value = draft[field as keyof IntakeDraft];
  return typeof value === "string" && value.trim().length > 0;
}

export function nextPendingField(draft: IntakeDraft): PendingField | null {
  for (const question of QUESTIONS) {
    if (isSkipped(draft, question.field)) continue;
    if (!fieldFilled(draft, question.field)) return question;
  }
  return null;
}

export function intakeStepFromDraft(draft: IntakeDraft): IntakeStep {
  const pending = nextPendingField(draft);
  if (!pending) return 5;
  return pending.step;
}

export function isReadyToSubmit(draft: IntakeDraft): boolean {
  return Boolean(draft.fullName.trim() && draft.nationalId.trim());
}

function fillFromCurrentQuestion(
  draft: IntakeDraft,
  utterance: string,
  pending: PendingField | null,
): IntakeDraft {
  let next = draft;
  if (!pending) return next;
  if (looksLikeSkip(utterance)) {
    return applySkipIfNeeded(next, utterance, pending.field);
  }
  if (pending.field === "heirs") {
    const heirs = parseHeirList(utterance);
    if (heirs.length) next = mergeIntakeDraft(next, { heirs });
    return next;
  }
  if (pending.field === "fullName" && utterance.trim() && !/\d{5,}/.test(utterance)) {
    return mergeIntakeDraft(next, { fullName: utterance.trim() });
  }
  if (pending.field === "shambaLocation") {
    return mergeIntakeDraft(next, { shambaLocation: cleanLocation(utterance) });
  }
  if (
    pending.field === "spouseName" ||
    pending.field === "trusteeName" ||
    pending.field === "plotSize" ||
    pending.field === "saccoName" ||
    pending.field === "bankName" ||
    pending.field === "mpesaNominee"
  ) {
    return mergeIntakeDraft(next, { [pending.field]: utterance.trim() });
  }
  return next;
}

export function guidedTurn(input: {
  draft: IntakeDraft;
  utterance: string;
  ocrText?: string;
  locale: Locale;
}): IntakeEngineTurn {
  const swahili =
    input.locale === "sw" || detectSwahili(input.utterance);
  let draft = input.draft;
  const pendingBefore = nextPendingField(draft);
  if (input.ocrText) {
    draft = mergeIntakeDraft(draft, parseOcrText(input.ocrText));
  }
  if (input.utterance.trim()) {
    draft = mergeIntakeDraft(draft, parseUtterance(input.utterance, draft));
    draft = fillFromCurrentQuestion(draft, input.utterance, pendingBefore);
  }
  const pending = nextPendingField(draft);
  const step = intakeStepFromDraft(draft);
  const readyToSubmit = !pending && isReadyToSubmit(draft);
  const reply = pending
    ? swahili
      ? pending.sw
      : pending.en
    : swahili
      ? "Asante. Kagua kadi ya kando, kisha bonyeza Thibitisha na hifadhi ili kuweka taarifa kwenye hifadhi yako."
      : "Thank you. Check the card on the side, then tap Confirm & Submit Vault to save this into your vault.";
  return {
    reply,
    draft,
    step,
    readyToSubmit,
    engine: "guided",
  };
}

export function openingGreeting(locale: Locale): string {
  return locale === "sw"
    ? "Karibu. Mimi ni Amani, mwongozi wa ShambaTrust. Tutazungumza hatua moja baada ya nyingine. Jina lako kamili ni nani, kama lilivyo kwenye kitambulisho?"
    : "Karibu. I am Amani, your ShambaTrust guide. We will take one simple step at a time. What is your full name, as written on your national ID?";
}
