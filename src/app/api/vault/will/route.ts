import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { addAudit, listBeneficiaries, saveWillDraft } from "@/lib/db/store";

const schema = z.object({
  testatorName: z.string().default(""),
  testatorId: z.string().default(""),
  primaryResidence: z.string().default(""),
  executorName: z.string().default(""),
  executorPhone: z.string().default(""),
  altExecutorName: z.string().default(""),
  altExecutorPhone: z.string().default(""),
  guardianName: z.string().default(""),
  guardianPhone: z.string().default(""),
  altGuardianName: z.string().default(""),
  witnessAcknowledged: z.boolean().default(false),
  notes: z.string().default(""),
  testamentaryTrustEnabled: z.boolean().optional(),
  testamentaryTrustTerms: z.string().optional(),
  testamentaryTrustUntilAge: z.number().int().min(18).max(25).optional(),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const heirs = await listBeneficiaries(access.vault.id);
  return NextResponse.json({
    draft: access.vault.willDraft,
    minors: heirs.filter((h) => h.isMinor),
  });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the will details." }, { status: 400 });
  }
  const existing = access.vault.willDraft;
  const draft = await saveWillDraft(access.vault.id, {
    ...parsed.data,
    testamentaryTrustEnabled:
      parsed.data.testamentaryTrustEnabled ??
      existing?.testamentaryTrustEnabled ??
      false,
    testamentaryTrustTerms:
      parsed.data.testamentaryTrustTerms ?? existing?.testamentaryTrustTerms ?? "",
    testamentaryTrustUntilAge:
      parsed.data.testamentaryTrustUntilAge ??
      existing?.testamentaryTrustUntilAge ??
      18,
  });
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "will_draft_saved",
    detail: "Will builder draft saved for advocate review",
  });
  return NextResponse.json({ draft });
}
