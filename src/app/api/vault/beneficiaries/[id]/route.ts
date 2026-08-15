import { NextResponse } from "next/server";
import { requireVaultAccess } from "@/lib/vault-access";
import { vaultContentLocked } from "@/lib/vault-lock";
import { addAudit, deleteBeneficiary } from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (vaultContentLocked(access.vault)) {
    return NextResponse.json(
      {
        error:
          "This vault is in legal review. Heir edits are locked until review completes.",
      },
      { status: 403 },
    );
  }

  if (access.asAgent) {
    return NextResponse.json(
      {
        error: "Removing heirs requires elder confirmation.",
        requiresElder: true,
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const ok = await deleteBeneficiary(access.vault.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Heir not found." }, { status: 404 });
  }

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "beneficiary_removed",
    detail: id,
  });

  return NextResponse.json({ ok: true });
}
