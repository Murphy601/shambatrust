import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  AMENDMENT_FREE_HOURS,
  freeAmendmentRemainingMs,
  isWithinFreeAmendmentWindow,
  vaultContentLocked,
} from "@/lib/vault-lock";
import {
  addAudit,
  getLatestReviewSubmitAt,
  listReviewRequests,
  openVaultAmendment,
  recordBillingEvent,
} from "@/lib/db/store";

const schema = z.object({
  reason: z.string().min(3).max(500),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const reviews = await listReviewRequests(access.vault.id);
  const lastSubmitAt = await getLatestReviewSubmitAt(access.vault.id);
  const freeWindow = isWithinFreeAmendmentWindow(lastSubmitAt);
  const remainingMs = freeAmendmentRemainingMs(lastSubmitAt);

  return NextResponse.json({
    locked: vaultContentLocked(access.vault),
    amendmentOpen: access.vault.amendmentOpen,
    canRequestAmendment:
      !access.vault.amendmentOpen &&
      access.vault.status !== "draft" &&
      reviews.length > 0,
    freeWindow,
    freeHours: AMENDMENT_FREE_HOURS,
    freeRemainingMs: remainingMs,
    lastSubmitAt,
    vaultStatus: access.vault.status,
  });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (access.asAgent) {
    return NextResponse.json(
      {
        error: "Only the elder can request an amendment.",
      },
      { status: 403 },
    );
  }

  if (access.vault.amendmentOpen) {
    return NextResponse.json(
      { error: "An amendment is already open. Edit assets, then resubmit." },
      { status: 400 },
    );
  }

  if (access.vault.status === "draft") {
    return NextResponse.json(
      { error: "Vault is already a draft — no amendment needed." },
      { status: 400 },
    );
  }

  const reviews = await listReviewRequests(access.vault.id);
  if (reviews.length === 0) {
    return NextResponse.json(
      { error: "Submit for legal review first before requesting an amendment." },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Briefly say what you need to add or change (at least a few words)." },
      { status: 400 },
    );
  }

  const lastSubmitAt = await getLatestReviewSubmitAt(access.vault.id);
  const free = isWithinFreeAmendmentWindow(lastSubmitAt);

  const vault = await openVaultAmendment({
    vaultId: access.vault.id,
    reason: parsed.data.reason,
    free,
  });

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "amendment_opened",
    detail: `${free ? "free" : "paid"} · ${parsed.data.reason}`,
  });

  if (!free) {
    await recordBillingEvent({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      kind: "amendment_opened",
      detail: "amendment_fee",
      packageTier: access.vault.packageTier,
      relatedId: vault.id,
    });
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "billing_event",
      detail: "amendment_opened · amendment_fee",
    });
  }

  return NextResponse.json({
    vault,
    free,
    message: free
      ? `Amendment opened free (within ${AMENDMENT_FREE_HOURS}h of your last submit).`
      : "Amendment opened. An amendment fee applies (outside the free 48h window).",
  });
}
