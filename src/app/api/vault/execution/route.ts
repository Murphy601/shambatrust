import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeKenyanPhone, phonesEqual } from "@/lib/auth/phone";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  addAudit,
  getExecutionPlan,
  saveExecutionPlan,
} from "@/lib/db/store";
import type { ExecutionEnforcer, ExecutionGuardian, ExecutionTrustee } from "@/lib/db/types";

const trusteeSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(9),
  idNumber: z.string().optional().default(""),
});

const guardianSchema = trusteeSchema.extend({
  relationship: z.string().optional().default(""),
});

const saveSchema = z.object({
  trustees: z.array(trusteeSchema).max(5),
  minTrusteeApprovals: z.number().int().min(1).max(5),
  guardians: z.array(guardianSchema).max(5),
  minGuardianApprovals: z.number().int().min(0).max(5),
  enforcer: z
    .object({
      fullName: z.string(),
      phone: z.string(),
      idNumber: z.string().optional().default(""),
      organization: z.string().optional().default(""),
    })
    .nullable()
    .optional(),
  minCoSignApprovals: z.number().int().min(2).max(5).optional().default(2),
  requireDeathCertificate: z.boolean(),
  requireDeathNotification: z.boolean(),
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

  const trustees: ExecutionTrustee[] = [];
  for (const t of parsed.data.trustees) {
    const phone = normalizeKenyanPhone(t.phone);
    if (!phone) {
      return NextResponse.json(
        { error: `Invalid trustee phone: ${t.phone}` },
        { status: 400 },
      );
    }
    if (trustees.some((existing) => phonesEqual(existing.phone, phone))) {
      return NextResponse.json(
        { error: `${t.fullName} is listed twice as a trustee.` },
        { status: 400 },
      );
    }
    trustees.push({
      fullName: t.fullName.trim(),
      phone,
      idNumber: t.idNumber.trim(),
    });
  }

  const guardians: ExecutionGuardian[] = [];
  for (const g of parsed.data.guardians) {
    const phone = normalizeKenyanPhone(g.phone);
    if (!phone) {
      return NextResponse.json(
        { error: `Invalid guardian phone: ${g.phone}` },
        { status: 400 },
      );
    }
    // Two confirmations from the same handset would defeat the whole point.
    if (guardians.some((existing) => phonesEqual(existing.phone, phone))) {
      return NextResponse.json(
        { error: `${g.fullName} is listed twice as a guardian.` },
        { status: 400 },
      );
    }
    guardians.push({
      fullName: g.fullName.trim(),
      phone,
      idNumber: g.idNumber.trim(),
      relationship: g.relationship.trim(),
    });
  }

  if (trustees.length > 0 && parsed.data.minTrusteeApprovals > trustees.length) {
    return NextResponse.json(
      { error: "Approvals required cannot exceed number of trustees." },
      { status: 400 },
    );
  }
  if (parsed.data.minGuardianApprovals > guardians.length) {
    return NextResponse.json(
      {
        error:
          "Guardian confirmations required cannot exceed the number of guardians you named.",
      },
      { status: 400 },
    );
  }
  if (guardians.length > 0 && parsed.data.minGuardianApprovals < 2) {
    return NextResponse.json(
      {
        error:
          "Guardian verification needs at least two confirmations. Set it to 2 or remove the guardians.",
      },
      { status: 400 },
    );
  }

  let enforcer: ExecutionEnforcer | null = null;
  const rawEnforcer = parsed.data.enforcer;
  if (rawEnforcer && rawEnforcer.fullName.trim()) {
    const phone = normalizeKenyanPhone(rawEnforcer.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "Enter a valid Kenyan phone for the Enforcer." },
        { status: 400 },
      );
    }
    enforcer = {
      fullName: rawEnforcer.fullName.trim(),
      phone,
      idNumber: rawEnforcer.idNumber.trim(),
      organization: rawEnforcer.organization.trim(),
    };
  }

  const plan = await saveExecutionPlan({
    vaultId: access.vault.id,
    trustees,
    minTrusteeApprovals: parsed.data.minTrusteeApprovals,
    guardians,
    minGuardianApprovals: parsed.data.minGuardianApprovals,
    enforcer,
    minCoSignApprovals: parsed.data.minCoSignApprovals || 2,
    requireDeathCertificate: parsed.data.requireDeathCertificate,
    requireDeathNotification: parsed.data.requireDeathNotification,
    coolingHours: parsed.data.coolingHours,
    updatedByUserId: access.session.userId,
  });

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "execution_plan_saved",
    detail:
      `${trustees.length} trustees · need ${plan.minTrusteeApprovals} approvals · ` +
      `${guardians.length} guardians · need ${plan.minGuardianApprovals} confirmations` +
      (plan.enforcer ? ` · enforcer ${plan.enforcer.fullName}` : ""),
  });

  return NextResponse.json({ plan });
}
