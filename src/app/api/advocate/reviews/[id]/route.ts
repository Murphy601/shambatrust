import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  canAdvocateSeeSensitiveBrief,
  advocateHasDocAccess,
} from "@/lib/secure-docs/access";
import {
  addAudit,
  findUserById,
  getReviewRequest,
  getVaultById,
  listAdvocateMatchesForReview,
  listAllocations,
  listAssets,
  listAudioTestaments,
  listBeneficiaries,
  listLegalDocuments,
  listLegalDocumentsForReview,
  listReviewRequests,
  listTitleLookups,
  updateReviewRequest,
} from "@/lib/db/store";
import { spokenLanguageLabel } from "@/lib/languages";
import type { Asset, Beneficiary } from "@/lib/db/types";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  checklist: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        done: z.boolean(),
        notes: z.string(),
      }),
    )
    .optional(),
  consultScheduledAt: z.string().nullable().optional(),
  consultNotes: z.string().optional(),
  notes: z.string().optional(),
});

function redactAsset(a: Asset) {
  return {
    id: a.id,
    vaultId: a.vaultId,
    type: a.type,
    title: a.title,
    notes: "",
    documentName: a.documentName ? "Uploaded (claim to view)" : null,
    documentPath: null as string | null,
    hasDocument: Boolean(a.documentPath),
    titleNumber: a.titleNumber ? "••••" : "",
    county: a.county || "",
    subCounty: "",
    landmark: "",
    gpsLat: null as number | null,
    gpsLng: null as number | null,
    parcelNumber: a.parcelNumber ? "••••" : "",
    blockNumber: a.blockNumber ? "••••" : "",
    registrationSection: "",
    // County registry office is not sensitive and tells an advocate whether the
    // matter is even in their jurisdiction before they claim it.
    landRegistryOffice: a.landRegistryOffice || "",
    registrationNumber: "",
    makeModel: "",
    year: "",
    bankName: "",
    accountNumber: "",
    accountType: "",
    businessRegNumber: "",
    kraPin: "",
    saccoName: a.saccoName || "",
    saccoMemberNumber: "",
    saccoNominees: [] as Asset["saccoNominees"],
    mpesaNumber: "",
    disputeFlag: false,
    disputeNotes: "",
    familyAlert: false,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function fullAsset(a: Asset) {
  return {
    ...a,
    hasDocument: Boolean(a.documentPath),
    // Never send raw filesystem path to the client for downloads
    documentPath: null as string | null,
  };
}

function redactBeneficiary(b: Beneficiary) {
  return {
    ...b,
    idNumber: b.idNumber ? "••••" : "",
    phone: b.phone ? "••••" : "",
  };
}

export async function GET(_request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const review = await getReviewRequest(id);
  if (!review) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  // Least privilege: another advocate's assigned case is blocked
  if (
    review.advocateId &&
    review.advocateId !== access.session.userId &&
    review.status !== "submitted"
  ) {
    return NextResponse.json(
      { error: "This case is assigned to another advocate." },
      { status: 403 },
    );
  }

  const vault = await getVaultById(review.vaultId);
  if (!vault) {
    return NextResponse.json({ error: "Vault missing." }, { status: 404 });
  }

  const sensitive = canAdvocateSeeSensitiveBrief(review, access.session.userId);
  const docAccess = advocateHasDocAccess(review, access.session.userId);

  const [
    owner,
    assets,
    beneficiaries,
    allocations,
    documents,
    sealHistory,
    lookups,
    vaultReviews,
    testaments,
    matches,
  ] =
    await Promise.all([
      findUserById(vault.ownerId),
      listAssets(vault.id),
      listBeneficiaries(vault.id),
      listAllocations(vault.id),
      listLegalDocumentsForReview(review.id),
      listLegalDocuments(vault.id),
      listTitleLookups(vault.id),
      listReviewRequests(vault.id),
      listAudioTestaments(vault.id),
      listAdvocateMatchesForReview(review.id),
    ]);

  const myMatch =
    matches.find((match) => match.advocateId === access.session.userId) || null;

  const previousReview = vaultReviews
    .filter(
      (candidate) =>
        candidate.id !== review.id &&
        candidate.status === "completed" &&
        candidate.createdAt < review.createdAt,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const delta = previousReview
    ? {
        previousReviewId: previousReview.id,
        previousReviewCreatedAt: previousReview.createdAt,
        assets: {
          before: assets.filter((item) => item.createdAt <= previousReview.createdAt)
            .length,
          now: assets.length,
        },
        heirs: {
          before: beneficiaries.filter(
            (item) => item.createdAt <= previousReview.createdAt,
          ).length,
          now: beneficiaries.length,
        },
        allocations: {
          before: allocations.filter(
            (item) => item.createdAt <= previousReview.createdAt,
          ).length,
          now: allocations.length,
        },
        newAssetTitles: sensitive
          ? assets
              .filter((item) => item.createdAt > previousReview.createdAt)
              .map((item) => item.title)
          : [],
      }
    : null;

  if (sensitive) {
    await addAudit({
      vaultId: review.vaultId,
      actorUserId: access.session.userId,
      action: "case_brief_opened",
      detail: `Review ${review.id} · docAccess=${docAccess}`,
    });
  }

  return NextResponse.json({
    review,
    vault,
    owner: owner
      ? {
          id: owner.id,
          fullName: owner.fullName,
          phone: sensitive ? owner.phone : "••••",
        }
      : null,
    assets: sensitive ? assets.map(fullAsset) : assets.map(redactAsset),
    beneficiaries: sensitive
      ? beneficiaries
      : beneficiaries.map(redactBeneficiary),
    allocations: sensitive ? allocations : [],
    documents: sensitive
      ? documents.map((d) => ({
          ...d,
          documentPath: null,
          hasFile: Boolean(d.documentPath),
        }))
      : [],
    sealHistory: sensitive
      ? sealHistory.map((d) => ({
          id: d.id,
          reviewRequestId: d.reviewRequestId,
          title: d.title,
          type: d.type,
          status: d.status,
          signedAt: d.signedAt,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }))
      : [],
    lookups: sensitive ? lookups : [],
    delta: sensitive ? delta : null,
    // Recordings are listed either way so an advocate knows the elder left a
    // spoken statement, but the audio only plays once the case is claimed.
    testaments: testaments.map((t) => ({
      id: t.id,
      title: t.title,
      languageLabel: spokenLanguageLabel(t.language),
      durationSeconds: t.durationSeconds,
      transcript: sensitive ? t.transcript : "",
      transcriptStatus: t.transcriptStatus,
      recordedByAgent: t.recordedByAgent,
      assetId: t.assetId,
      createdAt: t.createdAt,
    })),
    match: myMatch
      ? {
          status: myMatch.status,
          reason: myMatch.reason,
          matchedCounties: myMatch.matchedCounties,
        }
      : null,
    access: {
      sensitive,
      docAccess,
      reason: !sensitive
        ? "Claim this case to unlock the full brief and documents."
        : !docAccess
          ? "Document access ended when the vault was sealed (metadata only)."
          : null,
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const review = await getReviewRequest(id);
  if (!review) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  if (review.advocateId !== access.session.userId) {
    return NextResponse.json(
      { error: "Only the assigned advocate can update this case." },
      { status: 403 },
    );
  }

  if (review.status === "completed" || review.docAccessRevokedAt) {
    return NextResponse.json(
      { error: "Sealed cases are read-only." },
      { status: 403 },
    );
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const updated = await updateReviewRequest(id, parsed.data);
  return NextResponse.json({ review: updated });
}
