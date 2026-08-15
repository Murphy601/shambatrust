import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  addAudit,
  getExecutionPlan,
  saveExecutionPlan,
} from "@/lib/db/store";

const trusteeSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  idNumber: z.string().optional().default(""),
});

const saveSchema = z.object({
  trustees: z.array(trusteeSchema).max(5),
  minTrusteeApprovals: z.number().int().min(1).max(5),
  requireDeathCertificate: z.boolean(),
  coolingHours: z.number().int().min(0).max(720),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const plan = await getExecutionPlan(access.vault.id);
  return NextResponse.json({
    plan,
    vaultStatus: access.vault.status,
    asAgent: access.asAgent,
  });
}

export async function PUT(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.asAgent) {
    return NextResponse.json(
      { error: "Only the elder can finalize execution triggers." },
      { status: 403 },
    );
  }

  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid execution plan." }, { status: 400 });
  }

  const trustees = [];
  for (const t of parsed.data.trustees) {
    const phone = normalizeKenyanPhone(t.phone);
    if (!phone) {
      return NextResponse.json(
        { error: `Invalid trustee phone: ${t.phone}` },
        { status: 400 },
      );
    }
    trustees.push({
      fullName: t.fullName.trim(),
      phone,
      idNumber: t.idNumber.trim(),
    });
  }

  if (
    trustees.length > 0 &&
    parsed.data.minTrusteeApprovals > trustees.length
  ) {
    return NextResponse.json(
      { error: "Approvals required cannot exceed number of trustees." },
      { status: 400 },
    );
  }

  const plan = await saveExecutionPlan({
    vaultId: access.vault.id,
    trustees,
    minTrusteeApprovals: parsed.data.minTrusteeApprovals,
    requireDeathCertificate: parsed.data.requireDeathCertificate,
    coolingHours: parsed.data.coolingHours,
    updatedByUserId: access.session.userId,
  });

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "execution_plan_saved",
    detail: `${trustees.length} trustees · need ${plan.minTrusteeApprovals} approvals`,
  });

  return NextResponse.json({ plan });
}
