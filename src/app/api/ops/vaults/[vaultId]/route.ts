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
  listBeneficiaries,
  listLegalDocuments,
  listReviewRequests,
  listTitleLookups,
  listVaultBinders,
} from "@/lib/db/store";

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
  });
}
