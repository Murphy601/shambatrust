import { NextResponse } from "next/server";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  listAllocations,
  listAgentLinks,
  listAssets,
  listAudit,
  listBeneficiaries,
  listReviewRequests,
} from "@/lib/db/store";

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { vault, asAgent, session } = access;
  const [assets, beneficiaries, allocations, agents, reviews, audit] =
    await Promise.all([
      listAssets(vault.id),
      listBeneficiaries(vault.id),
      listAllocations(vault.id),
      listAgentLinks(vault.id),
      listReviewRequests(vault.id),
      listAudit(vault.id),
    ]);

  return NextResponse.json({
    session,
    asAgent,
    vault,
    counts: {
      assets: assets.length,
      beneficiaries: beneficiaries.length,
      allocations: allocations.length,
      agents: agents.filter((a) => a.status !== "revoked").length,
      reviews: reviews.length,
    },
    recentAudit: audit.slice(0, 8),
    latestReview: reviews[0] || null,
  });
}
