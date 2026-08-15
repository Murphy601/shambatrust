import { NextResponse } from "next/server";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  addAudit,
  advocateClaimSuccession,
  completeSuccessionCase,
  findUserById,
  getExecutionPlan,
  getSuccessionCase,
  getVaultById,
  listAllSuccessionCases,
  listAllocations,
  listApprovalsForCase,
  listAssets,
  listBeneficiaries,
  listLegalDocuments,
} from "@/lib/db/store";

export async function GET() {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const cases = await listAllSuccessionCases();
  const visible = cases.filter(
    (c) =>
      c.status === "succession_verified" ||
      c.status === "with_advocate" ||
      (c.status === "succession_completed" &&
        c.advocateId === access.session.userId),
  );

  const enriched = await Promise.all(
    visible.map(async (c) => {
      const vault = await getVaultById(c.vaultId);
      const owner = vault ? await findUserById(vault.ownerId) : null;
      return {
        ...c,
        ownerName: owner?.fullName || "Unknown",
        isMine: c.advocateId === access.session.userId,
        coolingActive: Boolean(
          c.coolingEndsAt &&
            new Date(c.coolingEndsAt).getTime() > Date.now() &&
            c.status === "succession_verified",
        ),
      };
    }),
  );

  return NextResponse.json({ cases: enriched });
}
