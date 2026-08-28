import type { LegalDocument, LegalDocumentStatus } from "@/lib/db/types";

export function isLegallyAttested(doc: Pick<LegalDocument, "status" | "stampedAt">): boolean {
  if (!doc.stampedAt) return false;
  return doc.status === "signed" || doc.status === "certified";
}

export function legalDocumentStatusLabel(
  status: LegalDocumentStatus,
  stampedAt?: string | null,
  locale: "en" | "sw" = "en",
): string {
  const sw = locale === "sw";
  if ((status === "signed" || status === "certified") && stampedAt) {
    return sw ? "Imethibitishwa kisheria" : "Legally Attested";
  }
  switch (status) {
    case "ready_for_sign":
      return sw ? "Muhuri umewekwa — tayari kusaini" : "Stamped — ready to sign";
    case "signed":
      return sw ? "Imesainiwa" : "Signed";
    case "certified":
      return sw ? "Imethibitishwa" : "Certified";
    default:
      return sw ? "Rasimu" : "Draft";
  }
}
