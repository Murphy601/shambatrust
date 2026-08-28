import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { addAudit, findUserById, saveTrustDraft } from "@/lib/db/store";
import { isSeventyFiveOrOlder } from "@/lib/legal/capacity";

const schema = z.object({
  trustName: z.string().default(""),
  primaryTrustee: z.string().default(""),
  coTrustee: z.string().default(""),
  titleNumbers: z.string().default(""),
  conditions: z.string().default(""),
  enforcerName: z.string().default(""),
  enforcerPhone: z.string().default(""),
  enforcerIdNumber: z.string().default(""),
  enforcerOrganization: z.string().default(""),
  minCoSignApprovals: z.number().int().min(2).max(5).default(2),
  over75OrFrail: z.boolean().optional(),
  medicalCapacityAttached: z.boolean().optional(),
  medicalCapacityDocumentName: z.string().nullable().optional(),
  medicalCapacityDocumentPath: z.string().nullable().optional(),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const owner = await findUserById(access.vault.ownerId);
  return NextResponse.json({
    draft: access.vault.trustDraft,
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
    return NextResponse.json({ error: "Check the trust details." }, { status: 400 });
  }
  const existing = access.vault.trustDraft;
  const draft = await saveTrustDraft(access.vault.id, {
    ...parsed.data,
    over75OrFrail: parsed.data.over75OrFrail ?? existing?.over75OrFrail ?? false,
    medicalCapacityAttached:
      parsed.data.medicalCapacityAttached ?? existing?.medicalCapacityAttached ?? false,
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
  });
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "trust_draft_saved",
    detail: draft.trustName || "Family land trust draft saved",
  });
  return NextResponse.json({ draft });
}
