import { NextResponse } from "next/server";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  findUserById,
  getReviewRequest,
  getVaultById,
  listConsultBookingsForAdvocate,
} from "@/lib/db/store";

export async function GET() {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const bookings = await listConsultBookingsForAdvocate(access.session.userId);
  const upcoming = bookings.filter(
    (booking) =>
      booking.status === "scheduled" &&
      new Date(booking.scheduledAt).getTime() >= Date.now(),
  );
  const enriched = await Promise.all(
    upcoming.map(async (booking) => {
      const review = await getReviewRequest(booking.reviewRequestId);
      const vault = review ? await getVaultById(review.vaultId) : null;
      const owner = vault ? await findUserById(vault.ownerId) : null;
      return {
        ...booking,
        ownerName: owner?.fullName || "Client",
        packageTier: review?.packageTier || null,
      };
    }),
  );
  return NextResponse.json({ bookings: enriched });
}
