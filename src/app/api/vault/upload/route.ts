import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireVaultAccess } from "@/lib/vault-access";
import { writeStoredFile } from "@/lib/db/store";

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 8MB)." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${access.vault.id}-${randomUUID()}-${safeName}`;
  const documentPath = await writeStoredFile(filename, bytes, file.type || undefined);

  return NextResponse.json({
    documentName: file.name,
    documentPath,
  });
}
