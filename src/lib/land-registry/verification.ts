import type {
  ArdhiSasaConsentPath,
  ArdhiSasaVerificationStatus,
  TitleLookupRecord,
  TitleLookupResult,
} from "@/lib/db/types";

export const ARDHISASA_PORTAL_URL = "https://ardhisasa.lands.go.ke";

export const ARDHISASA_NOTICE_EN =
  "Ministry rules require owner authorization before land records are released. Choose the easiest path: sign a one-page paper form, or let a registered child help approve the request on ArdhiSasa. Our partner LSK advocate files the search on your behalf.";

export const ARDHISASA_NOTICE_SW =
  "Sheria ya Wizara inahitaji idhini ya mmiliki kabla ya kutoa rekodi za ardhi. Chagua njia rahisi: saini fomu moja ya karatasi, au mtoto aliyeandikishwa akusaidie kuidhinisha ombi kwenye ArdhiSasa. Wakili wetu mshirika wa LSK atawasilisha utafutaji kwa niaba yako.";

export const PAPER_AUTH_TITLE_EN =
  "Land Search Consent & Advocate Authorization";
export const PAPER_AUTH_TITLE_SW =
  "Idhini ya Utafutaji wa Ardhi na Uwakilishi wa Wakili";

export const PAPER_AUTH_BODY_EN = `I am the registered owner (or lawful representative) of the land listed on this page.

I authorize the assigned Law Society of Kenya partner advocate to:
1. Start an official land search on ArdhiSasa for these parcels.
2. Receive the official search certificate.
3. Store that certificate in my ShambaTrust Document Vault.

A family member may sit with me and help me sign. This one-page form is my consent.`;

export const PAPER_AUTH_BODY_SW = `Mimi ndiye mmiliki aliyesajiliwa (au mwakilishi halali) wa ardhi iliyoandikwa kwenye ukurasa huu.

Ninamuidhinisha wakili mshirika wa Law Society of Kenya aliyepangiwa:
1. Kuanza utafutaji rasmi kwenye ArdhiSasa kwa viwanja hivi.
2. Kupokea cheti rasmi cha utafutaji.
3. Kuhifadhi cheti hicho kwenye Hifadhi ya Nyaraka ya ShambaTrust.

Mwanafamilia anaweza kukaa nami na kunisaidia kusaini. Fomu hii ya ukurasa mmoja ndiyo idhini yangu.`;

export function pendingSearchResult(): TitleLookupResult {
  const checkedAt = new Date().toISOString();
  return {
    found: false,
    simulated: false,
    ownerName: null,
    registrationStatus: "pending_verification",
    approximateLocation: null,
    caveats: [],
    checkedAt,
    rawNote:
      "Pending verification. An LSK advocate will file this search on ArdhiSasa after owner authorization (paper form or family-assisted portal approval).",
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
      return sw ? "Inasubiri uthibitisho" : "Pending Verification";
    case "awaiting_owner_consent":
      return sw ? "Inasubiri idhini ya mmiliki" : "Waiting for owner consent";
    case "certificate_on_file":
      return sw
        ? "Imethibitishwa rasmi na wakili wa LSK"
        : "Officially Verified by LSK Advocate";
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

export function consentPathLabel(
  path: ArdhiSasaConsentPath | null | undefined,
  locale: "en" | "sw" = "en",
): string {
  const sw = locale === "sw";
  if (path === "family_assisted") {
    return sw ? "Msaada wa mwanafamilia" : "Family-assisted portal approval";
  }
  return sw ? "Fomu ya karatasi iliyosainiwa" : "Signed paper authorization";
}

export function familyAssistMessage(
  elderName: string,
  locale: "en" | "sw" = "en",
): string {
  const name = elderName.trim() || (locale === "sw" ? "mzee" : "the elder");
  if (locale === "sw") {
    return `ShambaTrust: Wakili anahitaji idhini ili kuthibitisha hati ya ardhi ya ${name}.

Hatua fupi:
1. Fungua ${ARDHISASA_PORTAL_URL}
2. Ingia kwa kitambulisho cha ${name}
3. Fungua Arifa (Notifications)
4. Bonyeza Approve

Ukihitaji msaada, tuma WhatsApp kwa ShambaTrust.`;
  }
  return `ShambaTrust: An advocate needs approval to verify ${name}'s land title.

Simple steps:
1. Open ${ARDHISASA_PORTAL_URL}
2. Log in with ${name}'s National ID
3. Open Notifications
4. Tap Approve

Need help? WhatsApp ShambaTrust.`;
}
