import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { addAudit, saveTrustDraft } from "@/lib/db/store";

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
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  return NextResponse.json({ draft: access.vault.trustDraft });
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
  const draft = await saveTrustDraft(access.vault.id, parsed.data);
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "trust_draft_saved",
    detail: draft.trustName || "Family land trust draft saved",
  });
  return NextResponse.json({ draft });
}
