/** Ops SLA thresholds (hours). */
export const SLA_ASSIGN_HOURS = 24;
export const SLA_COMPLETE_HOURS = 72;

export type SlaBreach = {
  reviewId: string;
  vaultId: string;
  packageTier: string;
  status: string;
  kind: "unassigned" | "stuck_in_review";
  ageHours: number;
  thresholdHours: number;
  createdAt: string;
  assignedAt: string | null;
};

export function hoursSince(iso: string, nowMs = Date.now()): number {
  return (nowMs - new Date(iso).getTime()) / (60 * 60 * 1000);
}

export function findSlaBreaches(
  reviews: Array<{
    id: string;
    vaultId: string;
    packageTier: string;
    status: string;
    createdAt: string;
    assignedAt: string | null;
    completedAt: string | null;
  }>,
  nowMs = Date.now(),
): SlaBreach[] {
  const breaches: SlaBreach[] = [];
  for (const r of reviews) {
    if (r.status === "completed" || r.completedAt) continue;
    if (r.status === "submitted") {
      const age = hoursSince(r.createdAt, nowMs);
      if (age >= SLA_ASSIGN_HOURS) {
        breaches.push({
          reviewId: r.id,
          vaultId: r.vaultId,
          packageTier: r.packageTier,
          status: r.status,
          kind: "unassigned",
          ageHours: Math.round(age * 10) / 10,
          thresholdHours: SLA_ASSIGN_HOURS,
          createdAt: r.createdAt,
          assignedAt: r.assignedAt,
        });
      }
    }
    if (r.status === "assigned" && r.assignedAt) {
      const age = hoursSince(r.assignedAt, nowMs);
      if (age >= SLA_COMPLETE_HOURS) {
        breaches.push({
          reviewId: r.id,
          vaultId: r.vaultId,
          packageTier: r.packageTier,
          status: r.status,
          kind: "stuck_in_review",
          ageHours: Math.round(age * 10) / 10,
          thresholdHours: SLA_COMPLETE_HOURS,
          createdAt: r.createdAt,
          assignedAt: r.assignedAt,
        });
      }
    }
  }
  return breaches.sort((a, b) => b.ageHours - a.ageHours);
}

export function buildSlaAlertMessage(breach: SlaBreach, origin: string): string {
  const kind =
    breach.kind === "unassigned"
      ? `unassigned >${SLA_ASSIGN_HOURS}h`
      : `in review >${SLA_COMPLETE_HOURS}h`;
  return (
    `ShambaTrust SLA alert: review ${breach.reviewId} (${breach.packageTier}) is ${kind} ` +
    `(${breach.ageHours}h). Vault: ${origin}/ops/vaults/${breach.vaultId}`
  );
}
