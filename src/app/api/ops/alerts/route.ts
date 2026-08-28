import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { listDisputedAssets, listOutboundNotices } from "@/lib/db/store";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const [notices, disputed] = await Promise.all([
    listOutboundNotices(),
    listDisputedAssets(),
  ]);
  return NextResponse.json({
    notices: notices.map((n) => ({
      ...n,
      whatsappUrl: buildWhatsAppUrl(n.body),
    })),
    disputed,
  });
}
