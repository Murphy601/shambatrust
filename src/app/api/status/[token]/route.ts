import { NextResponse } from "next/server";
import {
  findUserById,
  getPublicStatusToken,
  getReviewRequest,
  getVaultById,
} from "@/lib/db/store";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const row = await getPublicStatusToken(token);
  if (!row) {
    return NextResponse.json({ error: "Status link not found." }, { status: 404 });
  }
  const [vault, review] = await Promise.all([
    getVaultById(row.vaultId),
    getReviewRequest(row.reviewRequestId),
  ]);
  if (!vault || !review) {
    return NextResponse.json({ error: "Case no longer available." }, { status: 404 });
  }
  const advocate = review.advocateId
    ? await findUserById(review.advocateId)
    : null;
  const owner = await findUserById(vault.ownerId);

  return NextResponse.json({
    status: review.status,
    packageTier: review.packageTier,
    vaultStatus: vault.status,
    submittedAt: review.createdAt,
    assignedAt: review.assignedAt,
    completedAt: review.completedAt,
    advocateName: advocate?.fullName
      ? advocate.fullName.split(" ").slice(0, 2).join(" ")
      : null,
    ownerFirstName: owner?.fullName?.split(" ")[0] || "Family",
    message:
      review.status === "completed"
        ? "Your vault has been sealed by a partner advocate."
        : review.status === "assigned"
          ? `Your review is with advocate ${advocate?.fullName?.split(" ")[0] || "X"}.`
          : "Your review is queued for a partner advocate.",
  });
}
