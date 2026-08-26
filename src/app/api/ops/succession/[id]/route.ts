import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  addAudit,
  findUserById,
  getExecutionPlan,
  getSuccessionCase,
  getSuccessionReleaseGates,
  getVaultById,
  listAllocations,
  listApprovalsForCase,
  listAssets,
  listBeneficiaries,
  listAudioTestaments,
  listLegalDocuments,
  opsDecideSuccession,
  releaseSuccessionVault,
} from "@/lib/db/store";
import { spokenLanguageLabel } from "@/lib/languages";

type Params = { params: Promise<{ id: string }> };

const decideSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  opsNotes: z.string().optional().default(""),
});

const releaseSchema = z.object({
  action: z.literal("release_vault"),
  releaseNotes: z.string().max(2000).optional().default(""),
});

export async function GET(_request: Request, { params }: Params) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const successionCase = await getSuccessionCase(id);
  if (!successionCase) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  const vault = await getVaultById(successionCase.vaultId);
  const [
    owner,
    filer,
    approvals,
    plan,
    assets,
    beneficiaries,
    allocations,
    documents,
    testaments,
    gates,
  ] = await Promise.all([
    vault ? findUserById(vault.ownerId) : null,
    findUserById(successionCase.filedByUserId),
    listApprovalsForCase(id),
    getExecutionPlan(successionCase.vaultId),
    listAssets(successionCase.vaultId),
    listBeneficiaries(successionCase.vaultId),
    listAllocations(successionCase.vaultId),
    listLegalDocuments(successionCase.vaultId),
    listAudioTestaments(successionCase.vaultId),
    getSuccessionReleaseGates(id),
  ]);

  await addAudit({
    vaultId: successionCase.vaultId,
    actorUserId: access.session.userId,
    action: "ops_succession_opened",
    detail: `Ops opened succession ${id}`,
  });

  return NextResponse.json({
    case: successionCase,
    vault,
    owner: owner
      ? { id: owner.id, fullName: owner.fullName, phone: owner.phone }
      : null,
    filer: filer
      ? { id: filer.id, fullName: filer.fullName, phone: filer.phone }
      : null,
    approvals,
    plan,
    assets: assets.map((a) => ({
      ...a,
      documentPath: null,
      hasDocument: Boolean(a.documentPath),
    })),
    beneficiaries,
    allocations,
    documents: documents.map((d) => ({
      ...d,
      documentPath: null,
      hasFile: Boolean(d.documentPath),
    })),
    testaments: testaments.map((t) => ({
      id: t.id,
      title: t.title,
      languageLabel: spokenLanguageLabel(t.language),
      durationSeconds: t.durationSeconds,
      transcript: t.transcript,
      transcriptStatus: t.transcriptStatus,
    })),
    gates,
  });
}

export async function POST(request: Request, { params }: Params) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const release = releaseSchema.safeParse(body);
  if (release.success) {
    try {
      const successionCase = await releaseSuccessionVault({
        caseId: id,
        adminUserId: access.session.userId,
        releaseNotes: release.data.releaseNotes,
      });

      await addAudit({
        vaultId: successionCase.vaultId,
        actorUserId: access.session.userId,
        action: "succession_vault_released",
        detail: `Succession ${id} · vault access released to executors · ${
          release.data.releaseNotes || "no notes"
        }`,
      });

      return NextResponse.json({ case: successionCase });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Release failed." },
        { status: 400 },
      );
    }
  }

  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }

  try {
    const successionCase = await opsDecideSuccession({
      caseId: id,
      adminUserId: access.session.userId,
      decision: parsed.data.decision,
      opsNotes: parsed.data.opsNotes,
    });

    await addAudit({
      vaultId: successionCase.vaultId,
      actorUserId: access.session.userId,
      action:
        parsed.data.decision === "approve" ? "ops_verified" : "ops_rejected",
      detail: `Succession ${id} · ${parsed.data.opsNotes || "no notes"}`,
    });

    return NextResponse.json({ case: successionCase });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Decision failed." },
      { status: 400 },
    );
  }
}
