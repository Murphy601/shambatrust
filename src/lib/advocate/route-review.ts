import {
  addAudit,
  countAdvocateActiveCases,
  findUserById,
  getVaultById,
  listActiveAdvocates,
  listAssets,
  replaceAdvocateMatches,
} from "@/lib/db/store";
import { estateCounties, matchAdvocates } from "@/lib/advocate/matching";

/**
 * Routes a freshly submitted dossier to advocates practising in the estate's
 * counties. Runs after the review is created; a routing failure must never
 * fail the elder's submission, so callers ignore the result.
 */
export async function routeReviewToAdvocates(input: {
  reviewRequestId: string;
  vaultId: string;
  actorUserId: string;
}): Promise<void> {
  const vault = await getVaultById(input.vaultId);
  if (!vault) return;

  const [owner, assets, advocates] = await Promise.all([
    findUserById(vault.ownerId),
    listAssets(input.vaultId),
    listActiveAdvocates(),
  ]);

  const counties = estateCounties(assets, owner?.county || "");
  if (counties.length === 0) return;

  const candidates = await Promise.all(
    advocates.map(async (advocate) => ({
      advocate,
      activeCases: await countAdvocateActiveCases(advocate.id),
    })),
  );

  const matches = matchAdvocates({ counties, candidates });

  await replaceAdvocateMatches(
    input.reviewRequestId,
    matches.map((match) => ({
      reviewRequestId: input.reviewRequestId,
      vaultId: input.vaultId,
      advocateId: match.advocateId,
      matchedCounties: match.matchedCounties,
      score: match.score,
      reason: match.reason,
    })),
  );

  await addAudit({
    vaultId: input.vaultId,
    actorUserId: input.actorUserId,
    action: "advocate_matching_run",
    detail:
      matches.length > 0
        ? `${matches.length} advocate${matches.length === 1 ? "" : "s"} offered for ${counties.join(", ")} · top: ${matches[0].advocateName}`
        : `No advocate covers ${counties.join(", ")} — routed to the open queue`,
  });
}
