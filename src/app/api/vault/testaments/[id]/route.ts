import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireVaultAccess } from "@/lib/vault-access";
import { vaultContentLocked } from "@/lib/vault-lock";
import {
  addAudit,
  deleteAudioTestament,
  testamentUploadsDir,
} from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (vaultContentLocked(access.vault)) {
    return NextResponse.json(
      { error: "This vault is in legal review. Recordings are locked." },
      { status: 403 },
    );
  }

  // Same rule as heir changes: an agent may add, only the elder may remove.
  if (access.asAgent) {
    return NextResponse.json(
      {
        error:
          "Family agents cannot delete recordings. Ask the elder to remove it.",
        requiresElder: true,
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const removed = await deleteAudioTestament(access.vault.id, id);
  if (!removed) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  try {
    await fs.unlink(path.join(testamentUploadsDir(), removed.documentPath));
  } catch {
    // The row is already gone; a missing file on disk is not an error.
  }

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "testament_deleted",
    detail: removed.title,
  });

  return NextResponse.json({ ok: true });
}
