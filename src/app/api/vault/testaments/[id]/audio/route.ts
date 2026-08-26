import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { readSession } from "@/lib/auth/session";
import { addAudit, testamentUploadsDir } from "@/lib/db/store";
import { resolveAudioTestamentAccess } from "@/lib/secure-docs/access";

type Params = { params: Promise<{ id: string }> };

/**
 * Streams a voice testament for in-page playback. Unlike the document viewer
 * there is no canvas trick to apply to audio, so this leans on access control
 * plus an audit entry for every play.
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const resolved = await resolveAudioTestamentAccess(session, id);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { testament } = resolved;
  if (
    testament.documentPath.includes("..") ||
    testament.documentPath.includes("/") ||
    testament.documentPath.includes("\\")
  ) {
    return NextResponse.json({ error: "Invalid file." }, { status: 400 });
  }

  try {
    const bytes = await fs.readFile(
      path.join(testamentUploadsDir(), testament.documentPath),
    );

    await addAudit({
      vaultId: testament.vaultId,
      actorUserId: session.userId,
      action: "testament_played",
      detail: `${testament.title} · ${session.role}`,
    });

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": testament.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Recording missing on server." }, { status: 404 });
  }
}
