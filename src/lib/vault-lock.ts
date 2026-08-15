import type { Vault, VaultStatus } from "@/lib/db/types";

/** Hours after a review submit during which amendment reopen is free. */
export const AMENDMENT_FREE_HOURS = 48;

/** Draft or open-amendment vaults can be edited (unless ops force-locked). */
export function vaultContentLocked(
  vault: Pick<Vault, "status" | "amendmentOpen" | "forceLocked">,
): boolean {
  if (vault.forceLocked) return true;
  if (vault.amendmentOpen) return false;
  return vault.status !== "draft";
}

export function isEditableVaultStatus(status: VaultStatus): boolean {
  return status === "draft";
}

export function isWithinFreeAmendmentWindow(
  lastSubmitAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!lastSubmitAt) return false;
  const submitted = new Date(lastSubmitAt).getTime();
  if (Number.isNaN(submitted)) return false;
  return nowMs - submitted < AMENDMENT_FREE_HOURS * 60 * 60 * 1000;
}

export function freeAmendmentRemainingMs(
  lastSubmitAt: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (!lastSubmitAt) return 0;
  const submitted = new Date(lastSubmitAt).getTime();
  if (Number.isNaN(submitted)) return 0;
  const ends = submitted + AMENDMENT_FREE_HOURS * 60 * 60 * 1000;
  return Math.max(0, ends - nowMs);
}
