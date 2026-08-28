import type { Allocation, Beneficiary } from "@/lib/db/types";

const CLOSE_HEIR =
  /\b(spouse|wife|husband|widow|widower|son|daughter|child|children|mwanamke|mume|mke|mwana|binti)\b/i;

export function isCloseLegalHeir(relationship: string): boolean {
  return CLOSE_HEIR.test(relationship.trim());
}

export function unallocatedCloseHeirs(
  heirs: Beneficiary[],
  allocations: Allocation[],
): Beneficiary[] {
  const gifted = new Set(
    allocations
      .filter((row) => (row.percentage || 0) > 0 || Boolean(row.assetId) || Boolean(row.specificGift))
      .map((row) => row.beneficiaryId),
  );
  return heirs.filter((heir) => isCloseLegalHeir(heir.relationship) && !gifted.has(heir.id));
}
