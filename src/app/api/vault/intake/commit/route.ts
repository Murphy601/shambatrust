import { NextResponse } from "next/server";
import { requireVaultAccess } from "@/lib/vault-access";
import { vaultContentLocked } from "@/lib/vault-lock";
import { findUserById } from "@/lib/db/store";
import { commitIntakeDraft } from "@/lib/intake/commit";
import { sanitizeDraft } from "@/lib/intake/extract";
import { isReadyToSubmit } from "@/lib/intake/fallback";

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (vaultContentLocked(access.vault)) {
    return NextResponse.json(
      {
        error:
          "This vault is in legal review. Guided intake is locked until review completes.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const draft = sanitizeDraft(body?.draft);
  if (!isReadyToSubmit(draft)) {
    return NextResponse.json(
      { error: "Add your full name and national ID before submitting." },
      { status: 400 },
    );
  }

  const owner = await findUserById(access.vault.ownerId);
  if (!owner) {
    return NextResponse.json({ error: "Owner not found." }, { status: 404 });
  }

  const result = await commitIntakeDraft({
    vault: access.vault,
    actorUserId: access.session.userId,
    asAgent: access.asAgent,
    draft,
    owner,
  });

  return NextResponse.json({
    ok: true,
    saved: result.saved,
    skippedHeirs: result.skippedHeirs,
    warning: result.skippedHeirs
      ? "Family helper mode cannot add heirs. Ask the elder to confirm heirs, or open the Heirs page after they approve."
      : null,
  });
}
