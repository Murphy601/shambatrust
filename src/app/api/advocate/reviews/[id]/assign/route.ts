import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  addAudit,
  assignReviewRequest,
  countAdvocateActiveCases,
  findUserById,
  getReviewRequest,
  resolveAdvocateMatches,
} from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  slaAccepted: z.literal(true),
});

export async function POST(request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Accept the partner SLA / Data Protection notice before claiming a case.",
      },
      { status: 400 },
    );
  }

  const [advocate, activeCases] = await Promise.all([
    findUserById(access.session.userId),
    countAdvocateActiveCases(access.session.userId),
  ]);
  if (!advocate || advocate.advocateSuspended) {
    return NextResponse.json(
      { error: "Your advocate account is suspended. Contact operations." },
      { status: 403 },
    );
  }
  if (
    advocate.advocateMaxCases !== null &&
    activeCases >= advocate.advocateMaxCases
  ) {
    return NextResponse.json(
      {
        error: `Capacity reached (${activeCases}/${advocate.advocateMaxCases} active cases).`,
      },
      { status: 409 },
    );
  }

  const { id } = await params;
  const existing = await getReviewRequest(id);
  if (!existing) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  if (
    existing.advocateId &&
    existing.advocateId !== access.session.userId &&
    existing.status !== "submitted"
  ) {
    return NextResponse.json(
      { error: "Already assigned to another advocate." },
      { status: 409 },
    );
  }

  const review = await assignReviewRequest(id, access.session.userId);
  if (!review) {
    return NextResponse.json({ error: "Could not assign." }, { status: 500 });
  }

  // First claim wins; the other routing offers on this case expire.
  await resolveAdvocateMatches(review.id, access.session.userId);

  await addAudit({
    vaultId: review.vaultId,
    actorUserId: access.session.userId,
    action: "advocate_assigned",
    detail: `Advocate claimed review ${review.id} · SLA accepted`,
  });

  return NextResponse.json({ review });
}
