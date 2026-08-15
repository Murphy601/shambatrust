import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import { listAdvocatesCrm, updateAdvocateCrm } from "@/lib/db/store";
import { getOpsSeatRole, seatCan } from "@/lib/ops/seats";

export async function GET() {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const advocates = await listAdvocatesCrm();
  return NextResponse.json({ advocates });
}

const patchSchema = z.object({
  userId: z.string(),
  advocateSuspended: z.boolean().optional(),
  advocateMaxCases: z.number().nullable().optional(),
  advocateOooUntil: z.string().nullable().optional(),
  advocateOooNote: z.string().optional(),
});

export async function PATCH(request: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!seatCan(getOpsSeatRole(access.session.phone), "manage_advocates")) {
    return NextResponse.json(
      { error: "Reviewer/compliance/super seat required." },
      { status: 403 },
    );
  }
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const user = await updateAdvocateCrm(parsed.data);
  if (!user) {
    return NextResponse.json({ error: "Advocate not found." }, { status: 404 });
  }
  return NextResponse.json({ user });
}
