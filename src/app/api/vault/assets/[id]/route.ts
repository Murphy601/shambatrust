import { NextResponse } from "next/server";
import { requireVaultAccess } from "@/lib/vault-access";
import { vaultContentLocked } from "@/lib/vault-lock";
import { addAudit, deleteAsset, getAsset } from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { id } = await params;
  const asset = await getAsset(access.vault.id, id);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
  return NextResponse.json({ asset, asAgent: access.asAgent });
}

export async function DELETE(_request: Request, { params }: Params) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (vaultContentLocked(access.vault)) {
    return NextResponse.json(
      {
        error:
          "This vault is in legal review. Asset edits are locked until review completes.",
      },
      { status: 403 },
    );
  }

  if (access.asAgent) {
    return NextResponse.json(
      {
        error:
          "Agents cannot delete assets. Ask the elder to confirm this change.",
        requiresElder: true,
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const asset = await getAsset(access.vault.id, id);
  const ok = await deleteAsset(access.vault.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "asset_deleted",
    detail: asset?.title || id,
  });

  return NextResponse.json({ ok: true });
}
