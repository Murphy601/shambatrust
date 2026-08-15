import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  addAudit,
  advocateClaimSuccession,
  completeSuccessionCase,
  findUserById,
  getExecutionPlan,
  getSuccessionCase,
  getVaultById,
  listAllocations,
  listApprovalsForCase,
  listAssets,
  listBeneficiaries,
  listLegalDocuments,
} from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  action: z.enum(["claim", "complete"]),
  notes: z.string().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const successionCase = await getSuccessionCase(id);
  if (!successionCase) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  if (
    successionCase.advocateId &&
    successionCase.advocateId !== access.session.userId &&
    successionCase.status !== "succession_verified"
  ) {
    return NextResponse.json(
      { error: "Assigned to another advocate." },
      { status: 403 },
    );
  }

  const vault = await getVaultById(successionCase.vaultId);
  const [owner, approvals, plan, assets, beneficiaries, allocations, documents] =
    await Promise.all([
      vault ? findUserById(vault.ownerId) : null,
      listApprovalsForCase(id),
      getExecutionPlan(successionCase.vaultId),
      listAssets(successionCase.vaultId),
      listBeneficiaries(successionCase.vaultId),
      listAllocations(successionCase.vaultId),
      listLegalDocuments(successionCase.vaultId),
    ]);

  return NextResponse.json({
    case: successionCase,
    vault,
    owner: owner
      ? { fullName: owner.fullName, phone: owner.phone }
      : null,
    approvals,
    plan,
    assets: assets.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      titleNumber: a.titleNumber,
      county: a.county,
    })),
    beneficiaries,
    allocations,
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      status: d.status,
      hasFile: Boolean(d.documentPath),
    })),
  });
}

export async function POST(request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "claim") {
      const successionCase = await advocateClaimSuccession({
        caseId: id,
        advocateId: access.session.userId,
      });
      await addAudit({
        vaultId: successionCase.vaultId,
        actorUserId: access.session.userId,
        action: "succession_advocate_assigned",
        detail: `Advocate claimed succession ${id}`,
      });
      return NextResponse.json({ case: successionCase });
    }

    const successionCase = await completeSuccessionCase({
      caseId: id,
      advocateId: access.session.userId,
      notes: parsed.data.notes,
    });
    await addAudit({
      vaultId: successionCase.vaultId,
      actorUserId: access.session.userId,
      action: "succession_completed",
      detail: `Succession ${id} completed`,
    });
    return NextResponse.json({ case: successionCase });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Action failed." },
      { status: 400 },
    );
  }
}
