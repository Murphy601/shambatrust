import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import {
  addAudit,
  findUserById,
  getSuccessionCase,
  getVaultById,
  listAllocations,
  listAssets,
  listAudioTestaments,
  listBeneficiaries,
  listLegalDocuments,
  listReleasedCasesForUser,
  userCanOpenReleasedVault,
} from "@/lib/db/store";
import { assetSummary } from "@/lib/asset-fields";
import { spokenLanguageLabel } from "@/lib/languages";

/**
 * The executor view of a released vault. Everything here is read-only and
 * summarised — executors get the estate picture and the certified instrument
 * list, not the ability to edit a sealed dossier.
 */
export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const caseId = new URL(request.url).searchParams.get("caseId") || "";
  if (!caseId) {
    return NextResponse.json({ error: "Case id required." }, { status: 400 });
  }

  const successionCase = await getSuccessionCase(caseId);
  if (!successionCase) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  if (!successionCase.vaultReleasedAt) {
    return NextResponse.json(
      {
        error:
          "This vault has not been released yet. ShambaTrust releases access only after every verification step passes.",
      },
      { status: 403 },
    );
  }

  const allowed = await userCanOpenReleasedVault({
    userId: session.userId,
    phone: session.phone,
    caseId,
  });
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "Only confirmed trustees, confirmed guardians, and named heirs can open this vault.",
      },
      { status: 403 },
    );
  }

  const vault = await getVaultById(successionCase.vaultId);
  if (!vault) {
    return NextResponse.json({ error: "Vault not found." }, { status: 404 });
  }

  const [owner, assets, beneficiaries, allocations, documents, testaments] =
    await Promise.all([
      findUserById(vault.ownerId),
      listAssets(vault.id),
      listBeneficiaries(vault.id),
      listAllocations(vault.id),
      listLegalDocuments(vault.id),
      listAudioTestaments(vault.id),
    ]);

  await addAudit({
    vaultId: vault.id,
    actorUserId: session.userId,
    action: "released_vault_opened",
    detail: `Executor opened released vault via case ${caseId}`,
  });

  return NextResponse.json({
    case: {
      id: successionCase.id,
      vaultId: successionCase.vaultId,
      deathDate: successionCase.deathDate,
      vaultReleasedAt: successionCase.vaultReleasedAt,
      releaseNotes: successionCase.releaseNotes,
      status: successionCase.status,
    },
    owner: owner ? { fullName: owner.fullName, county: owner.county } : null,
    assets: assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      title: asset.title,
      summary: assetSummary(asset),
      saccoNominees: asset.saccoNominees,
    })),
    beneficiaries: beneficiaries.map((b) => ({
      id: b.id,
      fullName: b.fullName,
      relationship: b.relationship,
    })),
    allocations,
    documents: documents
      .filter((d) => d.status === "signed" || d.status === "certified")
      .map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        status: d.status,
        signatureName: d.signatureName,
        signedAt: d.signedAt,
        stampRef: d.stampRef,
        stampAdvocateName: d.stampAdvocateName,
        stampLskNumber: d.stampLskNumber,
        stampedAt: d.stampedAt,
      })),
    testaments: testaments.map((t) => ({
      id: t.id,
      title: t.title,
      languageLabel: spokenLanguageLabel(t.language),
      durationSeconds: t.durationSeconds,
      transcript: t.transcript,
      transcriptStatus: t.transcriptStatus,
    })),
  });
}

/** Released cases the signed-in user can open, for listing in the vault UI. */
export async function POST() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const releases = await listReleasedCasesForUser({
    userId: session.userId,
    phone: session.phone,
  });
  return NextResponse.json({ releases });
}
