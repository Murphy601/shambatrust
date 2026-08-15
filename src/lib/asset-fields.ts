import type { Asset, AssetType } from "@/lib/db/types";
import type { Locale } from "@/lib/dictionaries";

export function isLandLike(type: AssetType): boolean {
  return type === "land" || type === "commercial_plot";
}

export function assetSummary(asset: Asset, locale: Locale = "en"): string {
  if (isLandLike(asset.type)) {
    const parts = [
      asset.titleNumber
        ? locale === "sw"
          ? `Hati: ${asset.titleNumber}`
          : `Title: ${asset.titleNumber}`
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
    return "Pakia hati (si lazima)";
  }
  if (isLandLike(type)) return "Upload title deed photo";
  if (type === "vehicle") return "Upload logbook / vehicle ID";
  if (type === "bank_account") return "Upload bank statement (optional)";
  if (type === "business") return "Upload business registration certificate";
  return "Upload supporting document (optional)";
}
