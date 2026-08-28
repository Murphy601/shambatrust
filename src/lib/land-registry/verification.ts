import type {
  ArdhiSasaVerificationStatus,
  TitleLookupRecord,
  TitleLookupResult,
} from "@/lib/db/types";

/**
 * The Ministry of Lands does not publish a third-party ArdhiSasa API.
 * Searches require an LSK advocate's professional account and owner OTP consent.
 */
export const ARDHISASA_NOTICE_EN =
  "To protect against unauthorized land inquiries, Ministry of Lands searches require verified advocate filing and owner OTP consent. Our partner LSK Advocate will initiate this request on your behalf.";

export const ARDHISASA_NOTICE_SW =
  "Ili kuzuia utafutaji wa ardhi usioidhinishwa, Wizara ya Ardhi inahitaji wakili aliyehakikiwa kuwasilisha ombi na idhini ya OTP ya mmiliki. Wakili wetu mshirika wa LSK atawasilisha ombi hili kwa niaba yako.";

export function pendingSearchResult(): TitleLookupResult {
  const checkedAt = new Date().toISOString();
  return {
    found: false,
    simulated: false,
    ownerName: null,
    registrationStatus: "pending_advocate_submission",
    approximateLocation: null,
    caveats: [],
    checkedAt,
    rawNote:
      "No Ministry API. An LSK advocate must file this search on ArdhiSasa and obtain the registered owner's OTP consent.",
  };
}

export function inferArdhiSasaStatus(
  row: Pick<
    TitleLookupRecord,
    "status" | "documentPath" | "result" | "filedAt"
  >,
): ArdhiSasaVerificationStatus {
  if (row.status) return row.status;
  if (row.documentPath) return "certificate_on_file";
  if (row.filedAt) return "awaiting_owner_consent";
  if (row.result?.simulated) return "legacy_simulated";
  return "pending_advocate_submission";
}

export function lookupParcelSummary(row: TitleLookupRecord): string {
  return [
    row.titleNumber ? `LR ${row.titleNumber}` : null,
    row.parcelNumber ? `Parcel ${row.parcelNumber}` : null,
    row.blockNumber ? `Block ${row.blockNumber}` : null,
    row.registrationSection || null,
    row.landRegistryOffice || row.county || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ardhisasaStatusLabel(
  status: ArdhiSasaVerificationStatus | undefined,
  locale: "en" | "sw" = "en",
): string {
  const sw = locale === "sw";
  switch (status || "pending_advocate_submission") {
    case "pending_advocate_submission":
      return sw ? "Inasubiri uwasilishaji wa wakili" : "Pending Advocate Submission";
    case "awaiting_owner_consent":
      return sw
        ? "Imewasilishwa — inasubiri OTP ya mmiliki"
        : "Filed — awaiting owner OTP consent";
    case "certificate_on_file":
      return sw ? "Cheti rasmi kimehifadhiwa" : "Official search certificate on file";
    case "withdrawn":
      return sw ? "Imeondolewa" : "Withdrawn";
    case "legacy_simulated":
      return sw
        ? "Utafutaji wa majaribio (si rasmi)"
        : "Legacy demo lookup (not official)";
    default:
      return (status || "pending_advocate_submission").replace(/_/g, " ");
  }
}
