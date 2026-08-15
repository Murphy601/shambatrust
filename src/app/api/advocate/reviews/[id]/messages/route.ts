import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  addCaseMessage,
  getReviewRequest,
  listCaseMessages,
} from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

const messageSchema = z.object({
  to: z.enum(["elder", "ops"]),
  body: z.string().trim().min(1).max(2000),
});

async function getAccessibleReview(id: string, advocateId: string) {
  const review = await getReviewRequest(id);
  if (!review || review.advocateId !== advocateId) return null;
  return review;
}

export async function GET(_request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const review = await getAccessibleReview(id, access.session.userId);
  if (!review) {
    return NextResponse.json({ error: "Assigned case not found." }, { status: 404 });
  }

  return NextResponse.json({ messages: await listCaseMessages(id) });
}

export async function POST(request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const review = await getAccessibleReview(id, access.session.userId);
  if (!review) {
    return NextResponse.json({ error: "Assigned case not found." }, { status: 404 });
  }

  const parsed = messageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a message and recipient." }, { status: 400 });
  }

  const message = await addCaseMessage({
    reviewRequestId: review.id,
    vaultId: review.vaultId,
    fromUserId: access.session.userId,
    fromRole: "advocate",
    to: parsed.data.to,
    body: parsed.data.body,
  });
  return NextResponse.json({ message }, { status: 201 });
}
