import { NextResponse } from "next/server";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  findUserById,
  getVaultById,
  listAdvocateMatchesForAdvocate,
  listAssets,
  listAllReviewRequests,
} from "@/lib/db/store";

export async function GET(request: Request) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const params = new URL(request.url).searchParams;
  const urgency = params.get("urgency") || "";
  const county = (params.get("county") || "").trim().toLowerCase();
  const packageTier = params.get("packageTier") || "";
  const reviewKind = params.get("reviewKind") || "";
  const matchedOnly = params.get("matched") === "true";

  const [reviews, myMatches] = await Promise.all([
    listAllReviewRequests(),
    listAdvocateMatchesForAdvocate(access.session.userId),
  ]);
  const matchByReview = new Map(
    myMatches.map((match) => [match.reviewRequestId, match]),
  );

  const enriched = await Promise.all(
    reviews.map(async (review) => {
      const vault = await getVaultById(review.vaultId);
      const [owner, assets] = await Promise.all([
        vault ? findUserById(vault.ownerId) : null,
        listAssets(review.vaultId),
      ]);
      const match = matchByReview.get(review.id);
      const vaultReviewCount = reviews.filter(
        (candidate) => candidate.vaultId === review.vaultId,
      ).length;
      const slaAgeHours = Math.max(
        0,
        Math.floor((Date.now() - new Date(review.createdAt).getTime()) / 3_600_000),
      );
      return {
        ...review,
        vaultStatus: vault?.status || null,
        ownerName: owner?.fullName || "Unknown",
        ownerPhone: owner?.phone || null,
        isMine: review.advocateId === access.session.userId,
        counties: [
          ...new Set(
            assets
              .filter((asset) => asset.type === "land" || asset.type === "commercial_plot")
              .map((asset) => asset.county.trim())
              .filter(Boolean),
          ),
        ],
        slaAgeHours,
        urgency:
          slaAgeHours >= 48 ? "urgent" : slaAgeHours >= 24 ? "aging" : "fresh",
        isAmendment: Boolean(vault?.amendmentFeeCharged || vaultReviewCount > 1),
        matched: Boolean(match && match.status === "offered"),
        matchReason: match?.reason || null,
        matchedCounties: match?.matchedCounties || [],
      };
    }),
  );

  const filtered = enriched.filter((review) => {
    if (urgency && review.urgency !== urgency) return false;
    if (county && !review.counties.some((value) => value.toLowerCase() === county)) {
      return false;
    }
    if (packageTier && review.packageTier !== packageTier) return false;
    if (reviewKind === "amendment" && !review.isAmendment) return false;
    if (reviewKind === "first" && review.isAmendment) return false;
    if (matchedOnly && !review.matched) return false;
    return true;
  });

  return NextResponse.json({ reviews: filtered });
}
