import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { vaultContentLocked } from "@/lib/vault-lock";
import {
  addAudit,
  listAllocations,
  replaceAllocations,
} from "@/lib/db/store";

const schema = z.object({
  allocations: z.array(
    z.object({
      beneficiaryId: z.string(),
      assetId: z.string().nullable(),
      percentage: z.number().min(0).max(100).nullable(),
      specificGift: z.string().optional().default(""),
    }),
  ),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const allocations = await listAllocations(access.vault.id);
  return NextResponse.json({
    allocations,
    asAgent: access.asAgent,
    locked: vaultContentLocked(access.vault),
  });
}

export async function PUT(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (vaultContentLocked(access.vault)) {
    return NextResponse.json(
      {
        error:
          "This vault is in legal review. Allocation edits are locked until review completes.",
      },
      { status: 403 },
    );
  }

  if (access.asAgent) {
    return NextResponse.json(
      {
        error: "Changing allocations requires elder OTP confirmation.",
        requiresElder: true,
      },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid allocations." }, { status: 400 });
  }

  const percentRows = parsed.data.allocations.filter(
    (a) => a.percentage != null && !a.assetId,
  );
  const total = percentRows.reduce((sum, a) => sum + (a.percentage || 0), 0);
  if (percentRows.length > 0 && Math.abs(total - 100) > 0.01) {
    return NextResponse.json(
      { error: `Share percentages must total 100% (currently ${total}%).` },
      { status: 400 },
    );
  }

  // Prefer asset title over duplicating specificGift text
  const cleaned = parsed.data.allocations.map((a) => ({
    ...a,
    specificGift: a.assetId ? "" : a.specificGift || "",
  }));

  const allocations = await replaceAllocations(access.vault.id, cleaned);

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "allocations_updated",
    detail: `${allocations.length} allocation(s)`,
  });

  return NextResponse.json({ allocations });
}
