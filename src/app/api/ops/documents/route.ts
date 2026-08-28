import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { listOpsDocumentIndex } from "@/lib/ops/document-index";

export async function GET(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const q = new URL(request.url).searchParams.get("q") || "";
  const index = await listOpsDocumentIndex(q);
  return NextResponse.json(index);
}
