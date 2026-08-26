import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  countAdvocateActiveCases,
  findUserById,
  updateAdvocateCounties,
  updateAdvocateCrm,
} from "@/lib/db/store";
import { KENYA_COUNTIES } from "@/lib/kenya-counties";
import { normalizeCounty } from "@/lib/advocate/matching";

const schema = z.object({
  advocateOooUntil: z.string().nullable().optional(),
  advocateMaxCases: z.number().int().min(1).max(100).nullable().optional(),
  advocateOooNote: z.string().max(500).optional(),
  advocateCounties: z.array(z.string()).max(47).optional(),
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

  const { advocateCounties, ...crm } = parsed.data;

  if (advocateCounties) {
    // Store the canonical county spelling so matching stays predictable.
    const canonical = new Map(
      KENYA_COUNTIES.map((name) => [normalizeCounty(name), name]),
    );
    const cleaned: string[] = [];
    for (const raw of advocateCounties) {
      const match = canonical.get(normalizeCounty(raw));
      if (!match) {
        return NextResponse.json(
          { error: `"${raw}" is not a Kenyan county.` },
          { status: 400 },
        );
      }
      if (!cleaned.includes(match)) cleaned.push(match);
    }
    const updated = await updateAdvocateCounties(access.session.userId, cleaned);
    if (!updated) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }
  }

  const profile = await updateAdvocateCrm({
    userId: access.session.userId,
    ...crm,
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  return NextResponse.json({ profile });
}
