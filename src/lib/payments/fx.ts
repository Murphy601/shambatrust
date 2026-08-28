import type { CheckoutCurrency } from "@/lib/db/types";

/**
 * Bookkeeping FX only — not a live rate feed.
 * Used to store a KES equivalent on dual-currency checkouts.
 */
export const KES_PER_UNIT: Record<CheckoutCurrency, number> = {
  KES: 1,
  USD: 130,
  GBP: 170,
  EUR: 140,
};

export function toKesEquivalent(
  amount: number,
  currency: CheckoutCurrency,
): number {
  const rate = KES_PER_UNIT[currency] || 1;
  return Math.round(amount * rate);
}

export function fromKes(
  amountKes: number,
  currency: CheckoutCurrency,
): number {
  const rate = KES_PER_UNIT[currency] || 1;
  if (currency === "KES") return amountKes;
  return Math.round((amountKes / rate) * 100) / 100;
}

export const CHECKOUT_DEFAULTS_KES = {
  advocate_fee: 35000,
  estate_maintenance: 5000,
  title_lookup: 1500,
  review: 35000,
  amendment: 8000,
} as const;
