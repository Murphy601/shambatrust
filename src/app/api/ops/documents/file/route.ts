import path from "path";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { addAudit, findUserById, getVaultForUser, readStoredFile } from "@/lib/db/store";

export async function GET(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(request.url);
  const elderId = url.searchParams.get("elderId") || "";
  const slot = url.searchParams.get("slot");
  const disposition =
    url.searchParams.get("disposition") === "attachment"
      ? "attachment"
      : "inline";

  const elder = await findUserById(elderId);
  if (!elder || elder.role !== "elder") {
    return NextResponse.json({ error: "Elder not found." }, { status: 404 });
  }

  let stored: string | null = null;
  let fileName = "document";
  if (slot === "idFront") {
    stored = elder.idFrontPath;
    fileName = elder.idFrontName || "id-front";
  } else if (slot === "idBack") {
    stored = elder.idBackPath;
    fileName = elder.idBackName || "id-back";
  } else {
    return NextResponse.json({ error: "Invalid slot." }, { status: 400 });
  }

  if (!stored) {
    return NextResponse.json({ error: "File not on file." }, { status: 404 });
  }

  const data = await readStoredFile(stored);
  if (!data) {
    return NextResponse.json({ error: "File missing." }, { status: 404 });
  }

  const accessVault = await getVaultForUser(elder.id);
  await addAudit({
    vaultId: accessVault?.vault.id || elder.id,
    actorUserId: access.session.userId,
    action: disposition === "attachment" ? "document_downloaded" : "document_viewed",
    detail: `Ops ${disposition} ${slot} for ${elder.fullName}`,
  });

  const ext = path.extname(fileName).toLowerCase();
  const type =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${disposition}; filename="${fileName.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
