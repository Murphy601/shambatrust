export type LandOwnershipType =
  | "sole_owner"
  | "joint_tenancy"
  | "tenancy_in_common";

export const LAND_OWNERSHIP_TYPES: LandOwnershipType[] = [
  "sole_owner",
  "joint_tenancy",
  "tenancy_in_common",
];

export function normalizeLandOwnership(
  value: string | null | undefined,
): LandOwnershipType | "" {
  if (value === "sole_owner" || value === "joint_tenancy" || value === "tenancy_in_common") {
    return value;
  }
  return "";
}

export function landOwnershipLabel(
  value: LandOwnershipType | "" | undefined,
  locale: "en" | "sw" = "en",
): string {
  const sw = locale === "sw";
  switch (value) {
    case "sole_owner":
      return sw ? "Mmiliki pekee" : "Sole owner";
    case "joint_tenancy":
      return sw ? "Umiliki wa pamoja (joint tenancy)" : "Joint tenancy";
    case "tenancy_in_common":
      return sw ? "Umiliki kwa hisa (tenancy-in-common)" : "Tenancy-in-common";
    default:
      return sw ? "Haijawekwa" : "Not set";
  }
}

export const JOINT_TENANCY_ALERT_EN =
  "Joint tenancy passes this shamba automatically to the surviving owner. A Will cannot transfer it. Convert to tenancy-in-common with an LSK advocate before putting it in a trust or Will.";

export const JOINT_TENANCY_ALERT_SW =
  "Joint tenancy inapeleka shamba moja kwa moja kwa mmiliki aliyehai. Wosia hauwezi kulihamisha. Badilisha kuwa tenancy-in-common na wakili wa LSK kabla ya kuiweka kwenye amana au wosia.";
