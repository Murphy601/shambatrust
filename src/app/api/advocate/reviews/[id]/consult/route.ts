import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  getReviewRequest,
  listConsultBookingsForAdvocate,
  saveConsultBooking,
  updateReviewRequest,
} from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  mode: z.enum(["whatsapp", "video", "in_person"]),
  scheduledAt: z.string().datetime(),
  notes: z.string().max(2000).optional().default(""),
});

export async function GET(_request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { id } = await params;
  const review = await getReviewRequest(id);
  if (!review || review.advocateId !== access.session.userId) {
    return NextResponse.json({ error: "Assigned case not found." }, { status: 404 });
  }
  const bookings = (await listConsultBookingsForAdvocate(access.session.userId)).filter(
    (booking) => booking.reviewRequestId === id,
  );
  return NextResponse.json({ bookings });
}

export async function POST(request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { id } = await params;
  const review = await getReviewRequest(id);
  if (!review || review.advocateId !== access.session.userId) {
    return NextResponse.json({ error: "Assigned case not found." }, { status: 404 });
  }
  if (review.status === "completed") {
    return NextResponse.json({ error: "Completed cases are read-only." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid consultation slot." }, { status: 400 });
  }
  const booking = await saveConsultBooking({
    reviewRequestId: review.id,
    vaultId: review.vaultId,
    advocateId: access.session.userId,
    mode: parsed.data.mode,
    scheduledAt: parsed.data.scheduledAt,
    notes: parsed.data.notes,
  });
  await updateReviewRequest(review.id, {
    consultScheduledAt: booking.scheduledAt,
    consultNotes: booking.notes,
  });
  return NextResponse.json({ booking }, { status: 201 });
}
