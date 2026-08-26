import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { listMarketingLeads } from "@/lib/db/store";

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const leads = await listMarketingLeads();
  return NextResponse.json({ leads });
}
