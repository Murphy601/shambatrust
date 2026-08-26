import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  isWithinFreeAmendmentWindow,
  vaultContentLocked,
} from "@/lib/vault-lock";
import {
  addAudit,
  createReviewRequest,
  createPublicStatusToken,
  getLatestReviewSubmitAt,
  listAllocations,
  listAssets,
  listBeneficiaries,
  listReviewRequests,
  recordBillingEvent,
} from "@/lib/db/store";
import { routeReviewToAdvocates } from "@/lib/advocate/route-review";

const schema = z.object({
  packageTier: z.enum(["vault", "standard", "premium"]),
  consultMode: z.enum(["whatsapp", "video", "in_person"]),
  notes: z.string().optional().default(""),
  consentAccepted: z.literal(true),
  instruments: z
    .array(z.enum(["will", "land_trust", "poa"]))
    .optional()
    .default(["will"]),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const reviews = await listReviewRequests(access.vault.id);
  const lastSubmitAt = await getLatestReviewSubmitAt(access.vault.id);
  return NextResponse.json({
    reviews,
    locked: vaultContentLocked(access.vault),
    vaultStatus: access.vault.status,
    setupStep: access.vault.setupStep,
    amendmentOpen: access.vault.amendmentOpen,
    freeAmendmentWindow: isWithinFreeAmendmentWindow(lastSubmitAt),
    lastSubmitAt,
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
        error:
          "Only the elder can submit a legal review request (final OTP gate).",
      },
      { status: 403 },
    );
  }

  if (vaultContentLocked(access.vault)) {
    return NextResponse.json(
      {
        error:
          "Vault is locked. Request an amendment if you need to add or change details.",
      },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Confirm the advocate document-sharing consent before submitting.",
      },
      { status: 400 },
    );
  }

  const [assets, beneficiaries, allocations, priorReviews] = await Promise.all([
    listAssets(access.vault.id),
    listBeneficiaries(access.vault.id),
    listAllocations(access.vault.id),
    listReviewRequests(access.vault.id),
  ]);

  if (assets.length === 0) {
    return NextResponse.json(
      { error: "Add at least one asset before requesting review." },
      { status: 400 },
    );
  }
  if (beneficiaries.length === 0) {
    return NextResponse.json(
      { error: "Add at least one heir before requesting review." },
      { status: 400 },
    );
  }
  if (allocations.length === 0) {
    return NextResponse.json(
      { error: "Save at least one allocation before requesting review." },
      { status: 400 },
    );
  }

  const isAmendment =
    access.vault.amendmentOpen || priorReviews.length > 0;
  const lastSubmitAt = await getLatestReviewSubmitAt(access.vault.id);
  const withinFree = isWithinFreeAmendmentWindow(lastSubmitAt);
  const alreadyChargedOpen = access.vault.amendmentFeeCharged;

  const instrumentLabels: Record<string, string> = {
    will: "Last Will & Testament",
    land_trust: "Family Land Trust",
    poa: "Power of Attorney",
  };
  const instrumentLine = parsed.data.instruments
    .map((item) => instrumentLabels[item] || item)
    .join(", ");
  const notes = [
    `Requested instruments: ${instrumentLine || "Last Will & Testament"}`,
    parsed.data.notes.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const review = await createReviewRequest({
    vaultId: access.vault.id,
    packageTier: parsed.data.packageTier,
    consultMode: parsed.data.consultMode,
    notes,
    consentAccepted: true,
  });

  if (!isAmendment) {
    await recordBillingEvent({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      kind: "review_submitted",
      detail: `${parsed.data.packageTier} / ${parsed.data.consultMode}`,
      packageTier: parsed.data.packageTier,
      relatedId: review.id,
    });
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "billing_event",
      detail: `review_submitted · ${parsed.data.packageTier} / ${parsed.data.consultMode}`,
    });
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "review_requested",
      detail: `${parsed.data.packageTier} / ${parsed.data.consultMode} · consent accepted`,
    });
    await createPublicStatusToken({
      vaultId: access.vault.id,
      reviewRequestId: review.id,
    });
  } else if (alreadyChargedOpen) {
    // Fee taken when amendment was opened outside the free window
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "amendment_resubmitted",
      detail: `${parsed.data.packageTier} / ${parsed.data.consultMode} · fee already charged on open`,
    });
  } else if (withinFree) {
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "amendment_resubmitted",
      detail: `${parsed.data.packageTier} / ${parsed.data.consultMode} · free (within 48h)`,
    });
  } else {
    await recordBillingEvent({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      kind: "amendment_submitted",
      detail: `${parsed.data.packageTier} / ${parsed.data.consultMode}`,
      packageTier: parsed.data.packageTier,
      relatedId: review.id,
    });
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "billing_event",
      detail: `amendment_submitted · ${parsed.data.packageTier} / ${parsed.data.consultMode}`,
    });
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "amendment_resubmitted",
      detail: `${parsed.data.packageTier} / ${parsed.data.consultMode} · paid`,
    });
  }

  // Automated county routing. Never block the elder's submission on it — the
  // case still lands in the open advocate queue if matching cannot run.
  try {
    await routeReviewToAdvocates({
      reviewRequestId: review.id,
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
    });
  } catch {
    /* routing is best effort */
  }

  return NextResponse.json({
    review,
    isAmendment,
    billed:
      !isAmendment ||
      (!alreadyChargedOpen && !withinFree),
  });
}
