/** Default KES amounts for billable milestones (platform bookkeeping). */
export const BILLING_AMOUNTS_KES = {
  review_submitted: {
    vault: 15000,
    standard: 35000,
    premium: 75000,
  },
  amendment_opened: 8000,
  amendment_submitted: 8000,
  title_lookup: 1500,
} as const;

export type BillingKind =
  | "review_submitted"
  | "amendment_opened"
  | "amendment_submitted"
  | "title_lookup";

export function amountForBillingEvent(
  kind: BillingKind,
  packageTier?: string | null,
): number {
  if (kind === "title_lookup") return BILLING_AMOUNTS_KES.title_lookup;
  if (kind === "amendment_opened" || kind === "amendment_submitted") {
    return BILLING_AMOUNTS_KES.amendment_opened;
  }
  const tier = (packageTier || "standard") as "vault" | "standard" | "premium";
  return BILLING_AMOUNTS_KES.review_submitted[tier] ?? BILLING_AMOUNTS_KES.review_submitted.standard;
}

/** Fee split shown to advocates (read-only). */
export const FEE_SPLIT = {
  platformShare: 0.35,
  advocateShare: 0.65,
} as const;
