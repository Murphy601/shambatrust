import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { elderSignupUploadsDir, newId } from "@/lib/db/store";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Public upload for elder signup ID front/back (before account exists). */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const slot = String(form.get("slot") || "id");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be under 8MB." }, { status: 400 });
    }
    if (file.type && !ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Upload a JPG, PNG, WebP, or PDF." },
        { status: 400 },
      );
    }

    const dir = elderSignupUploadsDir();
    await fs.mkdir(dir, { recursive: true });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const documentPath = path.join(dir, `${slot}-${newId()}-${safeName}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(documentPath, buffer);

    return NextResponse.json({
      documentName: file.name,
      documentPath,
    });
  } catch {
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
