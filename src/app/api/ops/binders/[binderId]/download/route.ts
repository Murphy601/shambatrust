import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { binderAbsolutePath } from "@/lib/binder/generate";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { addAudit, getVaultBinder } from "@/lib/db/store";

type Params = { params: Promise<{ binderId: string }> };

/** Download a ready sealed vault binder PDF. */
export async function GET(_request: Request, { params }: Params) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { binderId } = await params;
  const binder = await getVaultBinder(binderId);
  if (!binder) {
    return NextResponse.json({ error: "Binder not found." }, { status: 404 });
  }
  if (binder.status !== "ready" || !binder.documentPath) {
    return NextResponse.json(
      { error: "Binder PDF is not ready yet." },
      { status: 409 },
    );
  }

  const absolute = binderAbsolutePath(binder.documentPath);
  try {
    const bytes = await fs.readFile(absolute);
    await addAudit({
      vaultId: binder.vaultId,
      actorUserId: access.session.userId,
      action: "binder_downloaded",
      detail: `Ops downloaded binder v${binder.version}`,
    });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${binder.documentName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Binder file missing on disk." },
      { status: 404 },
    );
  }
}
