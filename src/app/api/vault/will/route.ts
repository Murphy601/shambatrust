import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  addAudit,
  findUserById,
  listAllocations,
  listBeneficiaries,
  saveWillDraft,
  updateOwnerBirthYear,
} from "@/lib/db/store";
import { isSeventyFiveOrOlder } from "@/lib/legal/capacity";
import { unallocatedCloseHeirs } from "@/lib/legal/heirs";

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
  over75OrFrail: z.boolean().optional(),
  medicalCapacityAttached: z.boolean().optional(),
  medicalCapacityDocumentName: z.string().nullable().optional(),
  medicalCapacityDocumentPath: z.string().nullable().optional(),
  disinheritanceExplanation: z.string().optional(),
  birthYear: z.number().int().nullable().optional(),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const heirs = await listBeneficiaries(access.vault.id);
  const allocations = await listAllocations(access.vault.id);
  const owner = await findUserById(access.vault.ownerId);
  return NextResponse.json({
    draft: access.vault.willDraft,
    minors: heirs.filter((h) => h.isMinor),
    unallocatedCloseHeirs: unallocatedCloseHeirs(heirs, allocations).map((h) => ({
      id: h.id,
      fullName: h.fullName,
      relationship: h.relationship,
    })),
    birthYear: owner?.birthYear ?? null,
    over75: isSeventyFiveOrOlder(owner?.birthYear),
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
  const { birthYear, ...willFields } = parsed.data;
  if (birthYear !== undefined) {
    await updateOwnerBirthYear(access.vault.ownerId, birthYear);
  }
  const attached = Boolean(
    willFields.medicalCapacityAttached ?? existing?.medicalCapacityAttached,
  );
  const draft = await saveWillDraft(access.vault.id, {
    ...willFields,
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
    over75OrFrail: parsed.data.over75OrFrail ?? existing?.over75OrFrail ?? false,
    medicalCapacityAttached: attached,
    medicalCapacityDocumentName:
      parsed.data.medicalCapacityDocumentName ??
      existing?.medicalCapacityDocumentName ??
      null,
    medicalCapacityDocumentPath:
      parsed.data.medicalCapacityDocumentPath ??
      existing?.medicalCapacityDocumentPath ??
      null,
    medicalCapacityUploadedAt: parsed.data.medicalCapacityDocumentPath
      ? new Date().toISOString()
      : existing?.medicalCapacityUploadedAt ?? null,
    disinheritanceExplanation:
      parsed.data.disinheritanceExplanation ??
      existing?.disinheritanceExplanation ??
      "",
  });
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "will_draft_saved",
    detail: "Will builder draft saved for advocate review",
  });
  return NextResponse.json({ draft });
}
