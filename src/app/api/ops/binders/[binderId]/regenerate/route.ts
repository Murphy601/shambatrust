import { NextResponse } from "next/server";
import { regenerateFailedVaultBinder } from "@/lib/binder/generate";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { getVaultBinder } from "@/lib/db/store";

type Params = { params: Promise<{ binderId: string }> };

/** Retry generation for a failed binder (same version — ready binders stay immutable). */
export async function POST(_request: Request, { params }: Params) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { binderId } = await params;
  const binder = await getVaultBinder(binderId);
  if (!binder) {
    return NextResponse.json({ error: "Binder not found." }, { status: 404 });
  }

  const result = await regenerateFailedVaultBinder(
    binderId,
    access.session.userId,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const updated = await getVaultBinder(binderId);
  return NextResponse.json({ ok: true, binder: updated });
}
