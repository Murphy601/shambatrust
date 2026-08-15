import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  addAudit,
  listExpiredDocReviews,
  purgeExpiredUploadPaths,
  revokeReviewDocAccess,
} from "@/lib/db/store";
import { getOpsSeatRole, seatCan } from "@/lib/ops/seats";

export async function GET(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const days = Number(new URL(request.url).searchParams.get("days") || "90");
  const expired = await listExpiredDocReviews(days);
  return NextResponse.json({ expired, retentionDays: days });
}

const postSchema = z.object({
  action: z.enum(["revoke", "purge"]),
  reviewId: z.string().optional(),
  retentionDays: z.number().optional(),
});

export async function POST(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!seatCan(getOpsSeatRole(access.session.phone), "purge_docs")) {
    return NextResponse.json(
      { error: "Compliance/super seat required." },
      { status: 403 },
    );
  }
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (parsed.data.action === "revoke") {
    if (!parsed.data.reviewId) {
      return NextResponse.json({ error: "reviewId required." }, { status: 400 });
    }
    const review = await revokeReviewDocAccess(parsed.data.reviewId);
    if (!review) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    await addAudit({
      vaultId: review.vaultId,
      actorUserId: access.session.userId,
      action: "doc_access_revoked",
      detail: `ops · ${review.id}`,
    });
    return NextResponse.json({ review });
  }

  const result = await purgeExpiredUploadPaths(parsed.data.retentionDays ?? 90);
  return NextResponse.json(result);
}
