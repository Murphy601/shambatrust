import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { readSession } from "@/lib/auth/session";
import { addAudit, uploadsDir } from "@/lib/db/store";
import { resolveSecureDocAccess } from "@/lib/secure-docs/access";
import { validateViewToken } from "@/lib/secure-docs/tokens";

/**
 * Streams file bytes for the secure canvas viewer only.
 * Blocks top-level tab navigation to the raw file (browser PDF "Save as").
 */
export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const dest = (request.headers.get("sec-fetch-dest") || "").toLowerCase();
  const mode = (request.headers.get("sec-fetch-mode") || "").toLowerCase();
  // Only block opening the stream URL as a top-level document/tab.
  if (mode === "navigate" || dest === "document") {
    return NextResponse.json(
      {
        error:
          "Direct file opening is blocked. Use the secure view-only preview.",
      },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const reviewId = url.searchParams.get("reviewId") || "";
  const vaultId = url.searchParams.get("vaultId") || "";
  const assetId = url.searchParams.get("assetId");
  const documentId = url.searchParams.get("documentId");
  const caseId = url.searchParams.get("caseId");
  const token = url.searchParams.get("v");

  if (!token || !(await validateViewToken(token, session.userId))) {
    return NextResponse.json(
      { error: "Invalid or expired view session. Re-open the document." },
      { status: 403 },
    );
  }

  let target;
  if (kind === "death_cert") {
    target = { kind: "death_cert" as const, caseId: caseId || "" };
  } else if (kind === "asset" && vaultId && !reviewId && session.role === "admin") {
    target = {
      kind: "asset_admin" as const,
      assetId: assetId || "",
      vaultId,
    };
  } else if (kind === "asset") {
    target = {
      kind: "asset" as const,
      assetId: assetId || "",
      reviewId,
    };
  } else if (kind === "legal") {
    target = {
      kind: "legal" as const,
      documentId: documentId || "",
      reviewId,
    };
  } else {
    return NextResponse.json({ error: "Invalid document kind." }, { status: 400 });
  }

  const resolved = await resolveSecureDocAccess(session, target);

  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  if (
    resolved.filename.includes("..") ||
    resolved.filename.includes("/") ||
    resolved.filename.includes("\\")
  ) {
    return NextResponse.json({ error: "Invalid file." }, { status: 400 });
  }

  const filePath = path.join(uploadsDir(), resolved.filename);

  try {
    const bytes = await fs.readFile(filePath);
    const ext = path.extname(resolved.filename).toLowerCase();
    const type =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "image/jpeg";

    await addAudit({
      vaultId: resolved.vaultId,
      actorUserId: session.userId,
      action: "document_streamed",
      detail: `${kind}:${resolved.displayName}`,
    });

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on server." }, { status: 404 });
  }
}
