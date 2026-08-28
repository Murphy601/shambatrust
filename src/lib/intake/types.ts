export const INTAKE_STEPS = 5;

export type IntakeStep = 1 | 2 | 3 | 4 | 5;

export type IntakeDraft = {
  fullName: string;
  nationalId: string;
  kraPin: string;
  spouseName: string;
  heirs: string[];
  trusteeName: string;
  shambaLocation: string;
  lrNumber: string;
  plotSize: string;
  county: string;
  saccoName: string;
  saccoMemberNumber: string;
  bankName: string;
  accountNumber: string;
  mpesaNominee: string;
  mpesaNumber: string;
  documentName: string;
  documentPath: string;
  skippedFields: string[];
};

export type IntakeChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type IntakeEngineTurn = {
  reply: string;
  draft: IntakeDraft;
  step: IntakeStep;
  readyToSubmit: boolean;
  engine: "groq" | "guided";
};

export function emptyIntakeDraft(): IntakeDraft {
  return {
    fullName: "",
    nationalId: "",
    kraPin: "",
    spouseName: "",
    heirs: [],
    trusteeName: "",
    shambaLocation: "",
    lrNumber: "",
    plotSize: "",
    county: "",
    saccoName: "",
    saccoMemberNumber: "",
    bankName: "",
    accountNumber: "",
    mpesaNominee: "",
    mpesaNumber: "",
    documentName: "",
    documentPath: "",
    skippedFields: [],
  };
}

export function isSkipped(draft: IntakeDraft, field: string): boolean {
  return draft.skippedFields.includes(field);
}

export function markSkipped(draft: IntakeDraft, field: string): IntakeDraft {
  if (draft.skippedFields.includes(field)) return draft;
  return { ...draft, skippedFields: [...draft.skippedFields, field] };
}
