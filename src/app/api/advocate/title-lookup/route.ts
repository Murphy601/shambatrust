import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import { lookupTitleDeed } from "@/lib/land-registry/mock";
import {
  addAudit,
  getAsset,
  getReviewRequest,
  saveTitleLookup,
} from "@/lib/db/store";

const schema = z.object({
  reviewId: z.string().optional(),
  vaultId: z.string(),
  assetId: z.string().nullable().optional(),
  titleNumber: z.string().min(1),
  county: z.string().optional().default(""),
});

export async function POST(request: Request) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lookup request." }, { status: 400 });
  }

  let titleNumber = parsed.data.titleNumber;
  let county = parsed.data.county;
  let assetId = parsed.data.assetId || null;

  if (parsed.data.assetId) {
    const asset = await getAsset(parsed.data.vaultId, parsed.data.assetId);
    if (asset) {
      titleNumber = asset.titleNumber || titleNumber;
      county = asset.county || county;
      assetId = asset.id;
    }
  }

  if (parsed.data.reviewId) {
    const review = await getReviewRequest(parsed.data.reviewId);
    if (!review || review.vaultId !== parsed.data.vaultId) {
      return NextResponse.json({ error: "Review/vault mismatch." }, { status: 400 });
    }
    if (review.advocateId !== access.session.userId || review.status !== "assigned") {
      return NextResponse.json(
        { error: "Claim this active case before requesting a lookup." },
        { status: 403 },
      );
    }
  }

  const result = lookupTitleDeed({ titleNumber, county });
  const record = await saveTitleLookup({
    vaultId: parsed.data.vaultId,
    assetId,
    titleNumber,
    county,
    result,
    requestedByUserId: access.session.userId,
    reviewRequestId: parsed.data.reviewId || null,
  });

  await addAudit({
    vaultId: parsed.data.vaultId,
    actorUserId: access.session.userId,
    action: "title_lookup",
    detail: `${titleNumber}: ${result.registrationStatus}`,
  });

  return NextResponse.json({ lookup: record });
}
