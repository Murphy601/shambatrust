import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  addAudit,
  findUserById,
  getExecutionPlan,
  getLatestVaultBinder,
  getVaultById,
  listAllocations,
  listAssets,
  listAudit,
  listAudioTestaments,
  listBeneficiaries,
  listBuyoutOffers,
  listConsensusProposals,
  listHouseholdHouses,
  listLegalDocuments,
  listPaymentCheckouts,
  listReviewRequests,
  listTitleLookups,
  listVaultBinders,
} from "@/lib/db/store";
import { spokenLanguageLabel } from "@/lib/languages";

type Params = { params: Promise<{ vaultId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { vaultId } = await params;
  const vault = await getVaultById(vaultId);
  if (!vault) {
    return NextResponse.json({ error: "Vault not found." }, { status: 404 });
  }

  const [
    owner,
    assets,
    beneficiaries,
    allocations,
    reviews,
    documents,
    lookups,
    audit,
    binders,
    latestBinder,
    plan,
    testaments,
  ] = await Promise.all([
    findUserById(vault.ownerId),
    listAssets(vaultId),
    listBeneficiaries(vaultId),
    listAllocations(vaultId),
    listReviewRequests(vaultId),
    listLegalDocuments(vaultId),
    listTitleLookups(vaultId),
    listAudit(vaultId),
    listVaultBinders(vaultId),
    getLatestVaultBinder(vaultId),
    getExecutionPlan(vaultId),
    listAudioTestaments(vaultId),
  ]);
  const [houses, proposals, buyouts, checkouts] = await Promise.all([
    listHouseholdHouses(vaultId),
    listConsensusProposals(vaultId),
    listBuyoutOffers(vaultId),
    listPaymentCheckouts(vaultId),
  ]);

  await addAudit({
    vaultId,
    actorUserId: access.session.userId,
    action: "ops_vault_opened",
    detail: `Ops desk opened vault ${vaultId}`,
  });

  const latestReview =
    [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ||
    null;

  return NextResponse.json({
    vault,
    owner: owner
      ? {
          id: owner.id,
          fullName: owner.fullName,
          phone: owner.phone,
          email: owner.email,
          county: owner.county,
          address: owner.address,
          preferredLanguage: owner.preferredLanguage,
          idOnFile: Boolean(owner.idFrontPath || owner.idBackPath),
          idFrontName: owner.idFrontName,
          idBackName: owner.idBackName,
          isDiaspora: owner.isDiaspora,
          countryOfResidence: owner.countryOfResidence,
          ardhiSasaId: owner.ardhiSasaId,
          ecitizenId: owner.ecitizenId,
          passportNumber: owner.passportNumber,
        }
      : null,
    assets: assets.map((a) => ({
      ...a,
      documentPath: null,
      hasDocument: Boolean(a.documentPath),
    })),
    beneficiaries,
    allocations,
    reviews,
    documents: documents.map((d) => ({
      ...d,
      documentPath: null,
      hasFile: Boolean(d.documentPath),
    })),
    lookups,
    executionPlan: plan,
    testaments: testaments.map((t) => ({
      id: t.id,
      title: t.title,
      languageLabel: spokenLanguageLabel(t.language),
      durationSeconds: t.durationSeconds,
      transcript: t.transcript,
      transcriptStatus: t.transcriptStatus,
      recordedByAgent: t.recordedByAgent,
      assetId: t.assetId,
      createdAt: t.createdAt,
    })),
    audit,
    binders: binders.map((b) => ({
      id: b.id,
      version: b.version,
      status: b.status,
      documentName: b.documentName,
      pageCount: b.pageCount,
      fileHash: b.fileHash,
      error: b.error,
      advocateName: b.advocateName,
      sealedAt: b.sealedAt,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
      hasFile: b.status === "ready" && Boolean(b.documentPath),
    })),
    latestBinder: latestBinder
      ? {
          id: latestBinder.id,
          version: latestBinder.version,
          status: latestBinder.status,
          documentName: latestBinder.documentName,
          pageCount: latestBinder.pageCount,
          fileHash: latestBinder.fileHash,
          error: latestBinder.error,
          advocateName: latestBinder.advocateName,
          sealedAt: latestBinder.sealedAt,
          hasFile:
            latestBinder.status === "ready" && Boolean(latestBinder.documentPath),
        }
      : null,
    viewReviewId: latestReview?.id || null,
    houses,
    proposals,
    buyouts,
    checkouts,
  });
}
