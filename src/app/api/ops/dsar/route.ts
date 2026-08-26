import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  createDsarRequest,
  listDsarRequests,
  updateDsarRequest,
} from "@/lib/db/store";

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const requests = await listDsarRequests();
  return NextResponse.json({ requests });
}

const createSchema = z.object({
  elderUserId: z.string().nullable().optional().default(null),
  requesterName: z.string().min(1),
  requesterPhone: z.string().min(9),
  requestType: z.enum(["access", "correction", "deletion", "restriction"]),
  notes: z.string().optional().default(""),
});

export async function POST(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check DSAR details." }, { status: 400 });
  }
  const row = await createDsarRequest({
    ...parsed.data,
    elderUserId: parsed.data.elderUserId || null,
    status: "received",
  });
  return NextResponse.json({ request: row });
}

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(["received", "in_progress", "fulfilled", "refused"]),
  notes: z.string().optional(),
});

export async function PATCH(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  const row = await updateDsarRequest(parsed.data);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ request: row });
}
