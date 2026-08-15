import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { getAdvocateApplication } from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

const SLOTS = {
  idFront: ["idFrontPath", "idFrontName"],
  idBack: ["idBackPath", "idBackName"],
  lskCert: ["lskCertPath", "lskCertName"],
} as const;

export async function GET(request: Request, { params }: Params) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const app = await getAdvocateApplication(id);
  if (!app) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const slot = new URL(request.url).searchParams.get("slot") as keyof typeof SLOTS;
  if (!slot || !(slot in SLOTS)) {
    return NextResponse.json({ error: "Invalid file slot." }, { status: 400 });
  }

  const [pathKey, nameKey] = SLOTS[slot];
  const filePath = app[pathKey];
  const fileName = app[nameKey];
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const type =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";
    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on disk." }, { status: 404 });
  }
}
