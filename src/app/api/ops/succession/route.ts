import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  findUserById,
  getExecutionPlan,
  getVaultById,
  listAllSuccessionCases,
  listApprovalsForCase,
} from "@/lib/db/store";

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const cases = await listAllSuccessionCases();
  const enriched = await Promise.all(
    cases.map(async (c) => {
      const vault = await getVaultById(c.vaultId);
      const owner = vault ? await findUserById(vault.ownerId) : null;
      const filer = await findUserById(c.filedByUserId);
      const approvals = await listApprovalsForCase(c.id);
      const plan = await getExecutionPlan(c.vaultId);
      return {
        ...c,
        ownerName: owner?.fullName || "Unknown",
        ownerPhone: owner?.phone || null,
        filerName: filer?.fullName || "Unknown",
        approvals,
        requiredApprovals: plan?.minTrusteeApprovals || 0,
        approvedCount: approvals.filter((a) => a.status === "approved").length,
      };
    }),
  );

  return NextResponse.json({ cases: enriched });
}
