import type { Asset, AssetType, SaccoNominee } from "@/lib/db/types";
import type { Locale } from "@/lib/dictionaries";

export function isLandLike(type: AssetType): boolean {
  return type === "land" || type === "commercial_plot";
}

/** Total of the nominee shares; SACCO bylaws expect this to reach 100. */
export function nomineeTotal(nominees: SaccoNominee[]): number {
  return nominees.reduce((sum, nominee) => sum + (nominee.percentage || 0), 0);
}

/**
 * ArdhiSasa parcel identifiers an LSK advocate needs to file a professional search.
 * Returns an empty list for non-land assets.
 */
export function parcelIdentifiers(
  asset: Asset,
  locale: Locale = "en",
): Array<{ label: string; value: string }> {
  if (!isLandLike(asset.type)) return [];
  const sw = locale === "sw";
  return [
    { label: sw ? "Nambari ya hati (LR)" : "Title / LR number", value: asset.titleNumber },
    { label: sw ? "Nambari ya kiwanja" : "Parcel number", value: asset.parcelNumber },
    { label: sw ? "Nambari ya block" : "Block number", value: asset.blockNumber },
    {
      label: sw ? "Sehemu ya usajili" : "Registration section",
      value: asset.registrationSection,
    },
    {
      label: sw ? "Ofisi ya ardhi ya kaunti" : "County land registry",
      value: asset.landRegistryOffice,
    },
    {
      label: sw ? "Aina ya umiliki" : "Ownership type",
      value:
        asset.landOwnershipType === "joint_tenancy"
          ? sw
            ? "Joint tenancy"
            : "Joint tenancy"
          : asset.landOwnershipType === "tenancy_in_common"
            ? "Tenancy-in-common"
            : asset.landOwnershipType === "sole_owner"
              ? sw
                ? "Mmiliki pekee"
                : "Sole owner"
              : "",
    },
  ].filter((row) => row.value.trim().length > 0);
}

export function assetSummary(asset: Asset, locale: Locale = "en"): string {
  if (isLandLike(asset.type)) {
    const parts = [
      asset.titleNumber
        ? locale === "sw"
          ? `Hati: ${asset.titleNumber}`
          : `Title: ${asset.titleNumber}`
        : null,
      asset.blockNumber
        ? locale === "sw"
          ? `Block: ${asset.blockNumber}`
          : `Block: ${asset.blockNumber}`
        : null,
      asset.landOwnershipType === "joint_tenancy"
        ? locale === "sw"
          ? "Joint tenancy — badilisha kuwa tenancy-in-common"
          : "Joint tenancy — convert before a Will"
        : asset.landOwnershipType === "tenancy_in_common"
          ? locale === "sw"
            ? "Tenancy-in-common"
            : "Tenancy-in-common"
          : asset.landOwnershipType === "sole_owner"
            ? locale === "sw"
              ? "Mmiliki pekee"
              : "Sole owner"
            : null,
      asset.parcelNumber
        ? locale === "sw"
          ? `Kiwanja: ${asset.parcelNumber}`
          : `Parcel: ${asset.parcelNumber}`
        : null,
      asset.county,
      asset.subCounty,
      asset.landmark
        ? locale === "sw"
          ? `Karibu na ${asset.landmark}`
          : `Near ${asset.landmark}`
        : null,
    ].filter(Boolean);
    return parts.join(" · ") || (locale === "sw" ? "Ardhi" : "Land asset");
  }

  if (asset.type === "sacco") {
    const nominees = asset.saccoNominees.length;
    const parts = [
      asset.saccoName,
      asset.saccoMemberNumber
        ? locale === "sw"
          ? `Mwanachama: ${asset.saccoMemberNumber}`
          : `Member: ${asset.saccoMemberNumber}`
        : null,
      nominees
        ? locale === "sw"
          ? `Wateule ${nominees} (${nomineeTotal(asset.saccoNominees)}%)`
          : `${nominees} nominee${nominees === 1 ? "" : "s"} (${nomineeTotal(asset.saccoNominees)}%)`
        : null,
      asset.mpesaNumber ? `M-Pesa ${maskAccount(asset.mpesaNumber)}` : null,
    ].filter(Boolean);
    return parts.join(" · ") || (locale === "sw" ? "SACCO" : "SACCO account");
  }

  if (asset.type === "vehicle") {
    const parts = [
      asset.registrationNumber
        ? locale === "sw"
          ? `Nambari: ${asset.registrationNumber}`
          : `Reg: ${asset.registrationNumber}`
        : null,
      asset.makeModel,
      asset.year,
    ].filter(Boolean);
    return parts.join(" · ") || (locale === "sw" ? "Gari" : "Vehicle");
  }

  if (asset.type === "bank_account") {
    const parts = [
      asset.bankName,
      asset.accountType,
      asset.accountNumber
        ? locale === "sw"
          ? `Akaunti: ${maskAccount(asset.accountNumber)}`
          : `A/C: ${maskAccount(asset.accountNumber)}`
        : null,
    ].filter(Boolean);
    return parts.join(" · ") || (locale === "sw" ? "Akaunti" : "Bank account");
  }

  if (asset.type === "business") {
    const parts = [
      asset.businessRegNumber
        ? locale === "sw"
          ? `Usajili: ${asset.businessRegNumber}`
          : `Reg: ${asset.businessRegNumber}`
        : null,
      asset.kraPin ? `KRA: ${asset.kraPin}` : null,
      asset.county,
    ].filter(Boolean);
    return parts.join(" · ") || (locale === "sw" ? "Biashara" : "Business");
  }

  return (
    asset.notes?.slice(0, 80) ||
    (locale === "sw" ? "Mali nyingine" : "Other asset")
  );
}

function maskAccount(value: string): string {
  const digits = value.replace(/\s/g, "");
  if (digits.length <= 4) return digits;
  return `••••${digits.slice(-4)}`;
}

export function uploadLabel(type: AssetType, locale: Locale): string {
  if (locale === "sw") {
    if (isLandLike(type)) return "Pakia picha ya hati miliki";
    if (type === "vehicle") return "Pakia logbook / kitambulisho cha gari";
    if (type === "bank_account") return "Pakia taarifa ya benki (si lazima)";
    if (type === "business") return "Pakia cheti cha biashara";
    if (type === "sacco") return "Pakia fomu ya uteuzi wa SACCO (si lazima)";
    return "Pakia hati (si lazima)";
  }
  if (isLandLike(type)) return "Upload title deed photo";
  if (type === "vehicle") return "Upload logbook / vehicle ID";
  if (type === "bank_account") return "Upload bank statement (optional)";
  if (type === "business") return "Upload business registration certificate";
  if (type === "sacco") return "Upload SACCO nomination form (optional)";
  return "Upload supporting document (optional)";
}
