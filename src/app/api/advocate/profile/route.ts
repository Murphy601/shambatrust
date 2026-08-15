import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  countAdvocateActiveCases,
  findUserById,
  updateAdvocateCrm,
} from "@/lib/db/store";

const schema = z.object({
  advocateOooUntil: z.string().nullable().optional(),
  advocateMaxCases: z.number().int().min(1).max(100).nullable().optional(),
  advocateOooNote: z.string().max(500).optional(),
});

export async function GET() {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const [user, activeCases] = await Promise.all([
    findUserById(access.session.userId),
    countAdvocateActiveCases(access.session.userId),
  ]);
  if (!user) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  return NextResponse.json({ profile: user, activeCases });
}

export async function PATCH(request: Request) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid availability settings." }, { status: 400 });
  }
  const profile = await updateAdvocateCrm({
    userId: access.session.userId,
    ...parsed.data,
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  return NextResponse.json({ profile });
}
